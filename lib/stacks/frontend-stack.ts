/**
 * Frontend Stack for ApexShare Infrastructure
 *
 * Creates and configures:
 * - CloudFront distribution for global content delivery
 * - S3 static website hosting configuration
 * - Origin Access Control for secure S3 access
 * - Security headers and CSP policies
 * - Cache behaviors for optimal performance
 * - SSL/TLS configuration with custom domain
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { ApexShareStackProps, CrossStackRefs } from '../shared/types';
import { getResourceNames } from '../shared/config';
import { CLOUDFRONT_CONFIG } from '../shared/constants';

export interface FrontendStackProps extends ApexShareStackProps {
  crossStackRefs: CrossStackRefs;
}

export class FrontendStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly originAccessControl: cloudfront.OriginAccessControl;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { config, crossStackRefs } = props;

    // Extract resources from cross-stack references
    if (!crossStackRefs.storageStack || !crossStackRefs.dnsStack || !crossStackRefs.apiStack) {
      throw new Error('Storage, DNS, and API stack references are required for Frontend stack');
    }

    const frontendBucket = crossStackRefs.storageStack.frontendBucket;
    const certificate = crossStackRefs.dnsStack.certificate;
    const hostedZone = crossStackRefs.dnsStack.hostedZone;
    const api = crossStackRefs.apiStack.restApi;
    const resourceNames = getResourceNames(config);
    const tags = resourceNames.getTags();

    // Apply tags to the entire stack
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });

    // Create Origin Access Control for S3
    this.originAccessControl = this.createOriginAccessControl(resourceNames);

    // Create security headers policy
    const securityHeadersPolicy = this.createSecurityHeadersPolicy();

    // Create cache policies
    const cachePolicies = this.createCachePolicies();

    // Create CloudFront distribution
    this.distribution = this.createCloudFrontDistribution(
      config,
      resourceNames,
      frontendBucket,
      api,
      this.originAccessControl,
      securityHeadersPolicy,
      cachePolicies,
      certificate
    );

    // Update S3 bucket policy for CloudFront access
    this.updateS3BucketPolicy(frontendBucket, this.distribution);

    // Create Route 53 records if custom domain is configured
    if (hostedZone && certificate) {
      this.createRoute53Records(hostedZone, config.domain, this.distribution);
    }

    // Deploy default static files
    this.deployStaticFiles(frontendBucket, config);

    // Create outputs
    this.createOutputs(config);
  }

  /**
   * Create Origin Access Control for S3
   */
  private createOriginAccessControl(
    resourceNames: ReturnType<typeof getResourceNames>
  ): cloudfront.OriginAccessControl {
    return new cloudfront.OriginAccessControl(this, 'OriginAccessControl', {
      description: `OAC for ApexShare frontend bucket - ${resourceNames.getTags().Environment}`,
      originAccessControlOriginType: cloudfront.OriginAccessControlOriginType.S3,
      signingBehavior: cloudfront.OriginAccessControlSigningBehavior.ALWAYS,
      signingProtocol: cloudfront.OriginAccessControlSigningProtocol.SIGV4,
    });
  }

  /**
   * Create security headers response policy
   */
  private createSecurityHeadersPolicy(): cloudfront.ResponseHeadersPolicy {
    return new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeadersPolicy', {
      responseHeadersPolicyName: `ApexShare-SecurityHeaders-${this.stackName}`,
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.seconds(31536000), // 1 year
          includeSubdomains: true,
          preload: true,
          override: true,
        },
        contentTypeOptions: {
          override: true,
        },
        frameOptions: {
          frameOption: cloudfront.FrameOptions.DENY,
          override: true,
        },
        xssProtection: {
          protection: true,
          modeBlock: true,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: cloudfront.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
      customHeadersBehavior: {
        customHeaders: [
          {
            header: 'Content-Security-Policy',
            value: CLOUDFRONT_CONFIG.SECURITY_HEADERS.CONTENT_SECURITY_POLICY,
            override: true,
          },
          {
            header: 'Permissions-Policy',
            value: CLOUDFRONT_CONFIG.SECURITY_HEADERS.PERMISSIONS_POLICY,
            override: true,
          },
          {
            header: 'X-Content-Type-Options',
            value: CLOUDFRONT_CONFIG.SECURITY_HEADERS.CONTENT_TYPE_OPTIONS,
            override: true,
          },
        ],
      },
    });
  }

  /**
   * Create cache policies for different content types
   */
  private createCachePolicies(): {
    staticAssets: cloudfront.CachePolicy;
    apiRequests: cloudfront.CachePolicy;
  } {
    const staticAssets = new cloudfront.CachePolicy(this, 'StaticAssetsCachePolicy', {
      cachePolicyName: `ApexShare-StaticAssets-${this.stackName}`,
      defaultTtl: cdk.Duration.hours(24),
      maxTtl: cdk.Duration.days(365),
      minTtl: cdk.Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
      comment: 'Cache policy for static assets like CSS, JS, images',
    });

    const apiRequests = new cloudfront.CachePolicy(this, 'ApiRequestsCachePolicy', {
      cachePolicyName: `ApexShare-ApiRequests-${this.stackName}`,
      defaultTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.minutes(5),
      minTtl: cdk.Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'Authorization',
        'Content-Type',
        'Accept'
      ),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      enableAcceptEncodingGzip: false,
      enableAcceptEncodingBrotli: false,
      comment: 'Cache policy for API requests with minimal caching',
    });

    return { staticAssets, apiRequests };
  }

  /**
   * Create CloudFront distribution
   */
  private createCloudFrontDistribution(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>,
    frontendBucket: s3.Bucket,
    api: apigateway.RestApi,
    originAccessControl: cloudfront.OriginAccessControl,
    securityHeadersPolicy: cloudfront.ResponseHeadersPolicy,
    cachePolicies: any,
    certificate?: certificatemanager.ICertificate
  ): cloudfront.Distribution {
    const domainNames = certificate ? [config.domain] : undefined;

    return new cloudfront.Distribution(this, 'Distribution', {
      comment: `ApexShare CloudFront Distribution - ${config.env}`,
      domainNames,
      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      sslSupportMethod: cloudfront.SSLMethod.SNI,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Use only North America and Europe for cost optimization
      enableIpv6: true,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // Default behavior for static website content
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket, {
          originAccessIdentity: undefined, // Use OAC instead
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cachePolicies.staticAssets,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        responseHeadersPolicy: securityHeadersPolicy,
        compress: true,
      },
      additionalBehaviors: {
        // API requests
        '/api/*': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: cachePolicies.apiRequests,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: securityHeadersPolicy,
          compress: false, // Don't compress API responses
        },
        // Static assets with longer cache times
        '/assets/*': {
          origin: new origins.S3Origin(frontendBucket, {
            originAccessIdentity: undefined, // Use OAC instead
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: new cloudfront.CachePolicy(this, 'LongTermCachePolicy', {
            cachePolicyName: `ApexShare-LongTerm-${this.stackName}`,
            defaultTtl: cdk.Duration.days(30),
            maxTtl: cdk.Duration.days(365),
            minTtl: cdk.Duration.days(1),
            headerBehavior: cloudfront.CacheHeaderBehavior.none(),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
            cookieBehavior: cloudfront.CacheCookieBehavior.none(),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true,
          }),
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
          responseHeadersPolicy: securityHeadersPolicy,
          compress: true,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      // Enable access logging if configured
      enableLogging: config.monitoring.detailedMetrics,
      logBucket: config.monitoring.detailedMetrics ? this.createAccessLogsBucket(resourceNames) : undefined,
      logFilePrefix: 'cloudfront-access-logs/',
      logIncludesCookies: false,
    });
  }

  /**
   * Create access logs bucket for CloudFront
   */
  private createAccessLogsBucket(resourceNames: ReturnType<typeof getResourceNames>): s3.Bucket {
    return new s3.Bucket(this, 'CloudFrontAccessLogsBucket', {
      bucketName: `${resourceNames.accessLogsBucket}-cloudfront`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          id: 'CloudFrontLogsLifecycle',
          enabled: true,
          expiration: cdk.Duration.days(90),
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  /**
   * Update S3 bucket policy to allow CloudFront access
   */
  private updateS3BucketPolicy(
    frontendBucket: s3.Bucket,
    distribution: cloudfront.Distribution
  ): void {
    frontendBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudFrontServicePrincipal',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        actions: ['s3:GetObject'],
        resources: [frontendBucket.arnForObjects('*')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
          },
        },
      })
    );
  }

  /**
   * Create Route 53 DNS records
   */
  private createRoute53Records(
    hostedZone: route53.IHostedZone,
    domain: string,
    distribution: cloudfront.Distribution
  ): void {
    // A record for the domain
    new route53.ARecord(this, 'ARecord', {
      zone: hostedZone,
      recordName: domain,
      target: route53.RecordTarget.fromAlias(
        new route53targets.CloudFrontTarget(distribution)
      ),
      comment: 'A record for ApexShare frontend',
    });

    // AAAA record for IPv6
    new route53.AaaaRecord(this, 'AaaaRecord', {
      zone: hostedZone,
      recordName: domain,
      target: route53.RecordTarget.fromAlias(
        new route53targets.CloudFrontTarget(distribution)
      ),
      comment: 'AAAA record for ApexShare frontend IPv6',
    });
  }

  /**
   * Deploy default static files
   */
  private deployStaticFiles(frontendBucket: s3.Bucket, config: any): void {
    // Create a basic index.html file for initial deployment
    const indexHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ApexShare - Motorcycle Training Video Sharing</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #1a365d 0%, #2563eb 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
        }
        .container {
            max-width: 800px;
            padding: 40px 20px;
        }
        h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            font-weight: 600;
        }
        p {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            opacity: 0.9;
        }
        .status {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 12px;
            backdrop-filter: blur(10px);
            margin: 20px 0;
        }
        .environment {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.2);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 500;
        }
        .footer {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 0.9rem;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="environment">${config.env.toUpperCase()}</div>
    <div class="container">
        <h1>🏍️ ApexShare</h1>
        <p>Secure motorcycle training video sharing system</p>
        <div class="status">
            <h3>Infrastructure Deployed Successfully</h3>
            <p>The ApexShare infrastructure is now ready for the frontend application.</p>
            <p><strong>Environment:</strong> ${config.env}</p>
            <p><strong>Domain:</strong> ${config.domain}</p>
        </div>
    </div>
    <div class="footer">
        © 2025 ApexShare Training - Built with AWS CDK
    </div>
</body>
</html>
    `.trim();

    // Deploy the basic HTML file
    new s3deploy.BucketDeployment(this, 'DeployStaticFiles', {
      sources: [
        s3deploy.Source.data('index.html', indexHtml),
        s3deploy.Source.data('error.html', indexHtml), // Use same content for error page
      ],
      destinationBucket: frontendBucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      prune: false, // Don't delete existing files
    });
  }

  /**
   * Create CloudFormation outputs
   */
  private createOutputs(config: any): void {
    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: `${this.stackName}-DistributionId`,
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
      exportName: `${this.stackName}-DistributionDomainName`,
    });

    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: `https://${config.domain}`,
      description: 'Website URL',
      exportName: `${this.stackName}-WebsiteUrl`,
    });

    new cdk.CfnOutput(this, 'OriginAccessControlId', {
      value: this.originAccessControl.originAccessControlId,
      description: 'Origin Access Control ID',
      exportName: `${this.stackName}-OriginAccessControlId`,
    });
  }
}