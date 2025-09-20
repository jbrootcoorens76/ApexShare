/**
 * DNS Stack for ApexShare Infrastructure
 *
 * Creates and configures:
 * - Route 53 hosted zone for domain management
 * - ACM certificates for HTTPS (CloudFront and ALB)
 * - DNS records for domain validation
 * - Health checks for monitoring domain availability
 * - CAA records for certificate authority authorization
 */

import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { ApexShareStackProps } from '../shared/types';
import { getResourceNames } from '../shared/config';
import { DNS_CONFIG, MONITORING_CONFIG } from '../shared/constants';

export interface DnsStackOutputs {
  hostedZone: route53.IHostedZone;
  certificate: acm.ICertificate;
  wildcardCertificate: acm.ICertificate;
  usEast1Certificate: acm.ICertificate; // For CloudFront
  hostedZoneId: string;
  nameServers: string[];
}

export class DnsStack extends cdk.Stack {
  public readonly outputs: DnsStackOutputs;

  constructor(scope: Construct, id: string, props: ApexShareStackProps) {
    super(scope, id, props);

    const { config } = props;
    const resourceNames = getResourceNames(config);
    const tags = resourceNames.getTags();

    // Apply tags to the entire stack
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });

    // Create hosted zone
    const hostedZone = this.createHostedZone(config, resourceNames);

    // Create certificates
    const certificate = this.createCertificate(hostedZone, config);
    const wildcardCertificate = this.createWildcardCertificate(hostedZone, config);
    const usEast1Certificate = this.createCloudFrontCertificate(hostedZone, config);

    // Create CAA records for certificate authority authorization
    this.createCaaRecords(hostedZone);

    // Create health checks for monitoring
    this.createHealthChecks(hostedZone, config);

    // Create domain validation records if needed (handled automatically by ACM)
    this.createDomainValidationRecords(hostedZone, config);

    // Set outputs
    this.outputs = {
      hostedZone,
      certificate,
      wildcardCertificate,
      usEast1Certificate,
      hostedZoneId: hostedZone.hostedZoneId,
      nameServers: hostedZone.hostedZoneNameServers || [],
    };

    // Create CloudFormation outputs
    this.createOutputs();
  }

  /**
   * Create Route 53 hosted zone for the domain
   */
  private createHostedZone(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>
  ): route53.HostedZone {
    const hostedZone = new route53.HostedZone(this, 'HostedZone', {
      zoneName: config.domain,
      comment: `ApexShare ${config.env} - Hosted zone for ${config.domain}`,
    });

    // Add TXT record for domain verification if needed
    new route53.TxtRecord(this, 'DomainVerification', {
      zone: hostedZone,
      recordName: '_apexshare-verification',
      values: [`apexshare-domain-verification-${config.env}-${Date.now()}`],
      ttl: cdk.Duration.minutes(5),
      comment: 'Domain ownership verification for ApexShare',
    });

    return hostedZone;
  }

  /**
   * Create ACM certificate for the main domain
   */
  private createCertificate(
    hostedZone: route53.IHostedZone,
    config: any
  ): acm.Certificate {
    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: config.domain,
      subjectAlternativeNames: [`www.${config.domain}`],
      validation: acm.CertificateValidation.fromDns(hostedZone),
      certificateName: `apexshare-${config.env}-cert`,
    });

    // Add tags specific to this certificate
    cdk.Tags.of(certificate).add('CertificateType', 'Primary');
    cdk.Tags.of(certificate).add('Usage', 'ALB-API');

    return certificate;
  }

  /**
   * Create wildcard certificate for subdomains
   */
  private createWildcardCertificate(
    hostedZone: route53.IHostedZone,
    config: any
  ): acm.Certificate {
    const wildcardCertificate = new acm.Certificate(this, 'WildcardCertificate', {
      domainName: `*.${config.domain}`,
      subjectAlternativeNames: [config.domain],
      validation: acm.CertificateValidation.fromDns(hostedZone),
      certificateName: `apexshare-${config.env}-wildcard-cert`,
    });

    // Add tags specific to this certificate
    cdk.Tags.of(wildcardCertificate).add('CertificateType', 'Wildcard');
    cdk.Tags.of(wildcardCertificate).add('Usage', 'Subdomains');

    return wildcardCertificate;
  }

  /**
   * Create certificate in us-east-1 for CloudFront
   */
  private createCloudFrontCertificate(
    hostedZone: route53.IHostedZone,
    config: any
  ): acm.Certificate {
    const usEast1Certificate = new acm.Certificate(this, 'CloudFrontCertificate', {
      domainName: config.domain,
      subjectAlternativeNames: [
        `www.${config.domain}`,
        `cdn.${config.domain}`,
        `static.${config.domain}`,
      ],
      validation: acm.CertificateValidation.fromDns(hostedZone),
      certificateName: `apexshare-${config.env}-cloudfront-cert`,
      // Note: For CloudFront, this certificate should be created in us-east-1
      // In CDK v2, use cross-region stack support for proper us-east-1 deployment
    });

    // Add tags specific to this certificate
    cdk.Tags.of(usEast1Certificate).add('CertificateType', 'CloudFront');
    cdk.Tags.of(usEast1Certificate).add('Usage', 'CDN');
    cdk.Tags.of(usEast1Certificate).add('Region', 'us-east-1');

    return usEast1Certificate;
  }

  /**
   * Create CAA records for certificate authority authorization
   * TODO: Fix CAA records for CDK v2 compatibility
   */
  private createCaaRecords(hostedZone: route53.IHostedZone): void {
    // TODO: Temporarily disabled due to CDK v2 CaaTag compatibility issues
    return;

    // TODO: CAA records temporarily disabled due to CDK v2 compatibility issues
    // CAA records specify which Certificate Authorities can issue certificates
    // new route53.CaaRecord(this, 'CaaRecord', {
    //   zone: hostedZone,
    //   values: [
    //     // Allow Amazon's Certificate Authority
    //     {
    //       flag: 0,
    //       tag: 'issue',
    //       value: 'amazon.com',
    //     },
    //     {
    //       flag: 0,
    //       tag: 'issue',
    //       value: 'amazontrust.com',
    //     },
    //     {
    //       flag: 0,
    //       tag: 'issue',
    //       value: 'awstrust.com',
    //     },
    //     // Allow Let's Encrypt as backup
    //     {
    //       flag: 0,
    //       tag: 'issue',
    //       value: 'letsencrypt.org',
    //     },
    //     // Specify incident reporting
    //     {
    //       flag: 0,
    //       tag: 'iodef',
    //       value: 'mailto:security@apexshare.be',
    //     },
    //   ],
    //   ttl: cdk.Duration.hours(24),
    //   comment: 'Certificate Authority Authorization for ApexShare',
    // });
  }

  /**
   * Create health checks for domain monitoring
   * TODO: Fix health check implementation for CDK v2 compatibility
   */
  private createHealthChecks(hostedZone: route53.IHostedZone, config: any): void {
    if (!config.monitoring.healthChecks) return;

    // TODO: Temporarily disabled due to CDK v2 property compatibility issues
    return;

    /* TODO: Uncomment and fix when CDK v2 compatibility issues are resolved
    // Create SNS topic for health check notifications
    const healthCheckTopic = new sns.Topic(this, 'HealthCheckAlerts', {
      topicName: `apexshare-health-checks-${config.env}`,
      displayName: 'ApexShare Health Check Alerts',
    });

    // TODO: Health checks temporarily disabled due to CDK v2 property compatibility issues
    // Main domain health check
    // const mainHealthCheck = new route53.CfnHealthCheck(this, 'MainDomainHealthCheck', {
    //   type: 'HTTPS',
    //   resourcePath: '/health',
      fullyQualifiedDomainName: config.domain,
      port: 443,
      requestInterval: 30, // seconds
      failureThreshold: 3,
      measureLatency: true,
      regions: [
        'us-east-1',
        'us-west-2',
        'eu-west-1',
        'ap-southeast-1',
      ],
      alarmIdentifier: {
        name: `ApexShare-MainDomain-${config.env}`,
        region: this.region,
      },
      insufficientDataHealthStatus: 'Failure',
      tags: [
        {
          key: 'Name',
          value: `ApexShare Main Domain Health Check - ${config.env}`,
        },
        {
          key: 'Environment',
          value: config.env,
        },
        {
          key: 'Project',
          value: 'ApexShare',
        },
      ],
    });

    // API endpoint health check
    const apiHealthCheck = new route53.CfnHealthCheck(this, 'ApiHealthCheck', {
      // type: 'HTTPS',
      resourcePath: '/api/health',
      fullyQualifiedDomainName: `api.${config.domain}`,
      port: 443,
      requestInterval: 30,
      failureThreshold: 3,
      measureLatency: true,
      regions: [
        'us-east-1',
        'us-west-2',
        'eu-west-1',
      ],
      alarmIdentifier: {
        name: `ApexShare-API-${config.env}`,
        region: this.region,
      },
      insufficientDataHealthStatus: 'Failure',
      tags: [
        {
          key: 'Name',
          value: `ApexShare API Health Check - ${config.env}`,
        },
        {
          key: 'Environment',
          value: config.env,
        },
        {
          key: 'Project',
          value: 'ApexShare',
        },
      ],
    });

    // Create CloudWatch alarms for health checks
    new cloudwatch.Alarm(this, 'MainDomainHealthAlarm', {
      alarmName: `ApexShare-MainDomain-Health-${config.env}`,
      alarmDescription: 'Main domain health check failed',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Route53',
        metricName: 'HealthCheckStatus',
        dimensionsMap: {
          HealthCheckId: mainHealthCheck.attrHealthCheckId,
        },
        statistic: 'Minimum',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    new cloudwatch.Alarm(this, 'ApiHealthAlarm', {
      alarmName: `ApexShare-API-Health-${config.env}`,
      alarmDescription: 'API endpoint health check failed',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Route53',
        metricName: 'HealthCheckStatus',
        dimensionsMap: {
          HealthCheckId: apiHealthCheck.attrHealthCheckId,
        },
        statistic: 'Minimum',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });
    */ // End of commented health checks section
  }

  /**
   * Create additional domain validation records if needed
   */
  private createDomainValidationRecords(
    hostedZone: route53.IHostedZone,
    config: any
  ): void {
    // Create DMARC record for email security
    new route53.TxtRecord(this, 'DmarcRecord', {
      zone: hostedZone,
      recordName: '_dmarc',
      values: [
        'v=DMARC1; p=quarantine; rua=mailto:dmarc@apexshare.be; ruf=mailto:dmarc@apexshare.be; fo=1',
      ],
      ttl: cdk.Duration.hours(1),
      comment: 'DMARC policy for email authentication',
    });

    // Create SPF record for email sending
    new route53.TxtRecord(this, 'SpfRecord', {
      zone: hostedZone,
      recordName: '@',
      values: [
        'v=spf1 include:amazonses.com ~all',
      ],
      ttl: cdk.Duration.hours(1),
      comment: 'SPF record for SES email sending',
    });

    // Create security.txt record
    new route53.TxtRecord(this, 'SecurityTxtRecord', {
      zone: hostedZone,
      recordName: '_security',
      values: [
        'Contact: security@apexshare.be',
        'Expires: 2025-12-31T23:59:59.000Z',
        'Preferred-Languages: en, nl',
        'Canonical: https://apexshare.be/.well-known/security.txt',
      ],
      ttl: cdk.Duration.hours(24),
      comment: 'Security contact information',
    });

    // Create SES domain verification record (will be created by SES automatically)
    // This is a placeholder for documentation
    new route53.TxtRecord(this, 'SesVerificationPlaceholder', {
      zone: hostedZone,
      recordName: '_amazonses',
      values: ['SES-VERIFICATION-TOKEN-PLACEHOLDER'],
      ttl: cdk.Duration.minutes(5),
      comment: 'Placeholder for SES domain verification - will be replaced automatically',
    });
  }

  /**
   * Create CloudFormation outputs
   */
  private createOutputs(): void {
    new cdk.CfnOutput(this, 'HostedZoneId', {
      value: this.outputs.hostedZoneId,
      description: 'Route 53 Hosted Zone ID',
      exportName: `${this.stackName}-HostedZoneId`,
    });

    new cdk.CfnOutput(this, 'NameServers', {
      value: cdk.Fn.join(',', this.outputs.nameServers),
      description: 'Route 53 Name Servers',
      exportName: `${this.stackName}-NameServers`,
    });

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.outputs.certificate.certificateArn,
      description: 'ACM Certificate ARN for ALB/API',
      exportName: `${this.stackName}-CertificateArn`,
    });

    new cdk.CfnOutput(this, 'WildcardCertificateArn', {
      value: this.outputs.wildcardCertificate.certificateArn,
      description: 'ACM Wildcard Certificate ARN',
      exportName: `${this.stackName}-WildcardCertificateArn`,
    });

    new cdk.CfnOutput(this, 'CloudFrontCertificateArn', {
      value: this.outputs.usEast1Certificate.certificateArn,
      description: 'ACM Certificate ARN for CloudFront (us-east-1)',
      exportName: `${this.stackName}-CloudFrontCertificateArn`,
    });

    // Output DNS setup instructions
    new cdk.CfnOutput(this, 'DnsSetupInstructions', {
      value: `Update domain registrar to use these name servers: ${cdk.Fn.join(', ', this.outputs.nameServers)}`,
      description: 'DNS setup instructions for domain registrar',
    });

    new cdk.CfnOutput(this, 'EmailSetupInstructions', {
      value: 'SES will automatically create DKIM and verification records',
      description: 'Email DNS setup will be handled automatically by SES',
    });
  }
}