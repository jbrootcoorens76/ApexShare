/**
 * Security Stack for ApexShare Infrastructure
 *
 * Creates and configures:
 * - AWS WAF v2 Web ACL with comprehensive security rules
 * - KMS encryption keys for various services
 * - IAM roles and policies following least privilege principle
 * - Security monitoring and compliance configurations
 * - CloudTrail for audit logging
 * - Config rules for compliance monitoring
 */

import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as awsConfig from 'aws-cdk-lib/aws-config';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { ApexShareStackProps, WafRuleConfig } from '../shared/types';
import { getResourceNames } from '../shared/config';
import { SECURITY_CONFIG, MONITORING_CONFIG, COMPLIANCE_CONFIG } from '../shared/constants';

export interface SecurityStackOutputs {
  webAcl: wafv2.CfnWebACL;
  kmsKeys: {
    s3: kms.IKey;
    dynamodb: kms.IKey;
    logs: kms.IKey;
    ses: kms.IKey;
    lambda: kms.IKey;
    general: kms.IKey;
  };
  lambdaExecutionRole: iam.Role;
  apiGatewayRole: iam.Role;
  cloudTrail: cloudtrail.Trail;
  complianceNotificationTopic: sns.Topic;
}

export class SecurityStack extends cdk.Stack {
  public readonly outputs: SecurityStackOutputs;

  constructor(scope: Construct, id: string, props: ApexShareStackProps) {
    super(scope, id, props);

    const { config } = props;
    const resourceNames = getResourceNames(config);
    const tags = resourceNames.getTags();

    // Apply tags to the entire stack
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });

    // Create KMS encryption keys
    const kmsKeys = this.createKmsKeys(config, resourceNames);

    // Create IAM roles and policies
    const { lambdaExecutionRole, apiGatewayRole } = this.createIamRoles(config, resourceNames, kmsKeys);

    // Create WAF Web ACL
    const webAcl = this.createWebAcl(config, resourceNames);

    // Create CloudTrail for audit logging
    const cloudTrail = this.createCloudTrail(config, resourceNames, kmsKeys);

    // Create Config rules for compliance
    this.createConfigRules(config, resourceNames);

    // Create SNS topic for security notifications
    const complianceNotificationTopic = this.createSecurityNotificationTopic(config, resourceNames);

    // Set outputs
    this.outputs = {
      webAcl,
      kmsKeys,
      lambdaExecutionRole,
      apiGatewayRole,
      cloudTrail,
      complianceNotificationTopic,
    };

    // Create CloudFormation outputs
    this.createOutputs();
  }

  /**
   * Create KMS encryption keys for different services
   */
  private createKmsKeys(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>
  ): SecurityStackOutputs['kmsKeys'] {
    // S3 encryption key
    const s3Key = new kms.Key(this, 'S3EncryptionKey', {
      alias: resourceNames.s3Key,
      description: 'KMS key for S3 bucket encryption',
      enableKeyRotation: SECURITY_CONFIG.ENCRYPTION.KMS_KEY_ROTATION,
      // enableKeyRotation is handled by the separate property
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: 'Enable IAM User Permissions',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            sid: 'Allow S3 Service',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('s3.amazonaws.com')],
            actions: [
              'kms:Decrypt',
              'kms:GenerateDataKey*',
              'kms:ReEncrypt*',
              'kms:CreateGrant',
              'kms:DescribeKey',
            ],
            resources: ['*'],
          }),
        ],
      }),
    });

    // DynamoDB encryption key
    const dynamodbKey = new kms.Key(this, 'DynamoDBEncryptionKey', {
      alias: resourceNames.dynamoKey,
      description: 'KMS key for DynamoDB table encryption',
      enableKeyRotation: SECURITY_CONFIG.ENCRYPTION.KMS_KEY_ROTATION,
      // enableKeyRotation is handled by the separate property
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: 'Enable IAM User Permissions',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            sid: 'Allow DynamoDB Service',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('dynamodb.amazonaws.com')],
            actions: [
              'kms:Decrypt',
              'kms:GenerateDataKey*',
              'kms:ReEncrypt*',
              'kms:CreateGrant',
              'kms:DescribeKey',
            ],
            resources: ['*'],
          }),
        ],
      }),
    });

    // CloudWatch Logs encryption key
    const logsKey = new kms.Key(this, 'LogsEncryptionKey', {
      alias: `${resourceNames.logGroup}-logs-key`,
      description: 'KMS key for CloudWatch Logs encryption',
      enableKeyRotation: SECURITY_CONFIG.ENCRYPTION.KMS_KEY_ROTATION,
      // enableKeyRotation is handled by the separate property
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: 'Enable IAM User Permissions',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            sid: 'Allow CloudWatch Logs',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal(`logs.${this.region}.amazonaws.com`)],
            actions: [
              'kms:Encrypt',
              'kms:Decrypt',
              'kms:ReEncrypt*',
              'kms:GenerateDataKey*',
              'kms:DescribeKey',
            ],
            resources: ['*'],
            conditions: {
              ArnEquals: {
                'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${this.region}:${this.account}:*`,
              },
            },
          }),
        ],
      }),
    });

    // SES encryption key
    const sesKey = new kms.Key(this, 'SESEncryptionKey', {
      alias: `apexshare-ses-key-${config.env}`,
      description: 'KMS key for SES encryption',
      enableKeyRotation: SECURITY_CONFIG.ENCRYPTION.KMS_KEY_ROTATION,
      // enableKeyRotation is handled by the separate property
    });

    // Lambda encryption key
    const lambdaKey = new kms.Key(this, 'LambdaEncryptionKey', {
      alias: resourceNames.lambdaKey,
      description: 'KMS key for Lambda environment variables encryption',
      enableKeyRotation: SECURITY_CONFIG.ENCRYPTION.KMS_KEY_ROTATION,
      // enableKeyRotation is handled by the separate property
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: 'Enable IAM User Permissions',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            sid: 'Allow Lambda Service',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('lambda.amazonaws.com')],
            actions: [
              'kms:Decrypt',
              'kms:GenerateDataKey*',
              'kms:DescribeKey',
            ],
            resources: ['*'],
          }),
        ],
      }),
    });

    // General purpose encryption key
    const generalKey = new kms.Key(this, 'GeneralEncryptionKey', {
      alias: `apexshare-general-key-${config.env}`,
      description: 'General purpose KMS key for various services',
      enableKeyRotation: SECURITY_CONFIG.ENCRYPTION.KMS_KEY_ROTATION,
      // enableKeyRotation is handled by the separate property
    });

    return {
      s3: s3Key,
      dynamodb: dynamodbKey,
      logs: logsKey,
      ses: sesKey,
      lambda: lambdaKey,
      general: generalKey,
    };
  }

  /**
   * Create IAM roles and policies
   */
  private createIamRoles(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>,
    kmsKeys: SecurityStackOutputs['kmsKeys']
  ): { lambdaExecutionRole: iam.Role; apiGatewayRole: iam.Role } {
    // Lambda execution role
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: `apexshare-lambda-execution-role-${config.env}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for ApexShare Lambda functions',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
      inlinePolicies: {
        ApexShareLambdaPolicy: new iam.PolicyDocument({
          statements: [
            // S3 permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:GetObjectVersion',
                's3:GeneratePresignedPost',
              ],
              resources: [`arn:aws:s3:::${resourceNames.videosBucket}/*`],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:ListBucket'],
              resources: [`arn:aws:s3:::${resourceNames.videosBucket}`],
            }),
            // DynamoDB permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:Query',
                'dynamodb:Scan',
              ],
              resources: [
                `arn:aws:dynamodb:${this.region}:${this.account}:table/${resourceNames.uploadsTable}`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/${resourceNames.uploadsTable}/index/*`,
              ],
            }),
            // SES permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ses:SendEmail',
                'ses:SendRawEmail',
                'ses:SendTemplatedEmail',
              ],
              resources: [`arn:aws:ses:${this.region}:${this.account}:identity/*`],
            }),
            // KMS permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'kms:Decrypt',
                'kms:GenerateDataKey',
                'kms:DescribeKey',
              ],
              resources: [
                kmsKeys.s3.keyArn,
                kmsKeys.dynamodb.keyArn,
                kmsKeys.ses.keyArn,
                kmsKeys.lambda.keyArn,
              ],
            }),
            // CloudWatch metrics and logs
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cloudwatch:PutMetricData',
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: ['*'],
            }),
            // SQS permissions for dead letter queues
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'sqs:SendMessage',
                'sqs:ReceiveMessage',
                'sqs:DeleteMessage',
                'sqs:GetQueueAttributes',
              ],
              resources: [`arn:aws:sqs:${this.region}:${this.account}:*apexshare*`],
            }),
          ],
        }),
      },
    });

    // API Gateway role
    const apiGatewayRole = new iam.Role(this, 'ApiGatewayRole', {
      roleName: `apexshare-apigateway-role-${config.env}`,
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      description: 'Role for API Gateway to invoke Lambda functions',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs'),
      ],
      inlinePolicies: {
        ApexShareApiGatewayPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['lambda:InvokeFunction'],
              resources: [`arn:aws:lambda:${this.region}:${this.account}:function:*apexshare*`],
            }),
          ],
        }),
      },
    });

    return { lambdaExecutionRole, apiGatewayRole };
  }

  /**
   * Create WAF Web ACL with security rules
   */
  private createWebAcl(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>
  ): wafv2.CfnWebACL {
    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      name: resourceNames.webAcl,
      description: 'WAF Web ACL for ApexShare application security',
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'ApexShareWebACL',
      },
      rules: this.createWafRules(config),
      tags: [
        {
          key: 'Name',
          value: resourceNames.webAcl,
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

    return webAcl;
  }

  /**
   * Create WAF rules for security protection
   */
  private createWafRules(config: any): wafv2.CfnWebACL.RuleProperty[] {
    const rules: wafv2.CfnWebACL.RuleProperty[] = [];

    // Rate limiting rule
    rules.push({
      name: 'RateLimitRule',
      priority: 1,
      action: { block: {} },
      statement: {
        rateBasedStatement: {
          limit: SECURITY_CONFIG.WAF.RATE_LIMIT,
          aggregateKeyType: 'IP',
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'RateLimitRule',
      },
    });

    // Geographic restriction rule
    if (SECURITY_CONFIG.WAF.BLOCKED_COUNTRIES.length > 0) {
      rules.push({
        name: 'GeoBlockRule',
        priority: 2,
        action: { block: {} },
        statement: {
          geoMatchStatement: {
            countryCodes: [...SECURITY_CONFIG.WAF.BLOCKED_COUNTRIES],
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'GeoBlockRule',
        },
      });
    }

    // AWS Managed Rules
    SECURITY_CONFIG.WAF.MANAGED_RULES.forEach((ruleGroupName, index) => {
      rules.push({
        name: `AWSManagedRule${index + 1}`,
        priority: 10 + index,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: ruleGroupName,
            excludedRules: [], // Can be configured per environment
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `AWSManagedRule${index + 1}`,
        },
      });
    });

    // Custom rule to block suspicious user agents
    rules.push({
      name: 'BlockSuspiciousUserAgents',
      priority: 50,
      action: { block: {} },
      statement: {
        regexMatchStatement: {
          regexString: '(bot|crawler|spider|scraper|scanner)',
          fieldToMatch: {
            singleHeader: { name: 'user-agent' },
          },
          textTransformations: [
            {
              priority: 0,
              type: 'LOWERCASE',
            },
          ],
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'BlockSuspiciousUserAgents',
      },
    });

    // Block requests with no User-Agent
    rules.push({
      name: 'BlockEmptyUserAgent',
      priority: 51,
      action: { block: {} },
      statement: {
        notStatement: {
          statement: {
            regexMatchStatement: {
              regexString: '.+',
              fieldToMatch: {
                singleHeader: { name: 'user-agent' },
              },
              textTransformations: [
                {
                  priority: 0,
                  type: 'NONE',
                },
              ],
            },
          },
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'BlockEmptyUserAgent',
      },
    });

    return rules;
  }

  /**
   * Create CloudTrail for audit logging
   */
  private createCloudTrail(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>,
    kmsKeys: SecurityStackOutputs['kmsKeys']
  ): cloudtrail.Trail {
    // Create S3 bucket for CloudTrail logs
    const cloudTrailBucket = new s3.Bucket(this, 'CloudTrailBucket', {
      bucketName: `apexshare-cloudtrail-logs-${config.env}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsKeys.s3,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'CloudTrailLogRetention',
          enabled: true,
          expiration: cdk.Duration.days(COMPLIANCE_CONFIG.DATA_RETENTION.AUDIT_DATA_DAYS),
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Create CloudTrail
    const cloudTrail = new cloudtrail.Trail(this, 'CloudTrail', {
      trailName: `apexshare-cloudtrail-${config.env}`,
      bucket: cloudTrailBucket,
      encryptionKey: kmsKeys.general,
      includeGlobalServiceEvents: true,
      isMultiRegionTrail: true,
      enableFileValidation: true,
      sendToCloudWatchLogs: true,
      cloudWatchLogGroup: new logs.LogGroup(this, 'CloudTrailLogGroup', {
        logGroupName: `/aws/cloudtrail/apexshare-${config.env}`,
        retention: logs.RetentionDays.ONE_YEAR,
        encryptionKey: kmsKeys.logs,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      }),
    });

    // Add event selectors for data events
    cloudTrail.addEventSelector(cloudtrail.DataResourceType.S3_OBJECT, [
      `${resourceNames.videosBucket}/*`,
    ]);

    return cloudTrail;
  }

  /**
   * Create AWS Config rules for compliance monitoring
   */
  private createConfigRules(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>
  ): void {
    // Create Config delivery channel
    const configBucket = new s3.Bucket(this, 'ConfigBucket', {
      bucketName: `apexshare-config-logs-${config.env}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'ConfigLogRetention',
          enabled: true,
          expiration: cdk.Duration.days(COMPLIANCE_CONFIG.DATA_RETENTION.AUDIT_DATA_DAYS),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Config service role
    const configRole = new iam.Role(this, 'ConfigRole', {
      assumedBy: new iam.ServicePrincipal('config.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/ConfigRole'),
      ],
    });

    // Grant Config access to the bucket
    configBucket.grantReadWrite(configRole);

    // Configuration recorder
    new awsConfig.CfnConfigurationRecorder(this, 'ConfigRecorder', {
      name: 'ApexShareConfigRecorder',
      roleArn: configRole.roleArn,
      recordingGroup: {
        allSupported: true,
        includeGlobalResourceTypes: true,
        resourceTypes: [],
      },
    });

    // Delivery channel
    new awsConfig.CfnDeliveryChannel(this, 'ConfigDeliveryChannel', {
      name: 'ApexShareDeliveryChannel',
      s3BucketName: configBucket.bucketName,
      configSnapshotDeliveryProperties: {
        deliveryFrequency: 'TwentyFour_Hours',
      },
    });

    // Config rules
    const configRules = [
      {
        name: 'S3-BUCKET-SSL-REQUESTS-ONLY',
        description: 'Checks whether S3 buckets have policies that require requests to use SSL',
        source: {
          owner: 'AWS',
          sourceIdentifier: 'S3_BUCKET_SSL_REQUESTS_ONLY',
        },
      },
      {
        name: 'S3-BUCKET-PUBLIC-ACCESS-PROHIBITED',
        description: 'Checks that S3 buckets do not allow public access',
        source: {
          owner: 'AWS',
          sourceIdentifier: 'S3_BUCKET_PUBLIC_ACCESS_PROHIBITED',
        },
      },
      {
        name: 'ENCRYPTED-VOLUMES',
        description: 'Checks whether EBS volumes are encrypted',
        source: {
          owner: 'AWS',
          sourceIdentifier: 'ENCRYPTED_VOLUMES',
        },
      },
      {
        name: 'IAM-PASSWORD-POLICY',
        description: 'Checks whether the account password policy meets specified requirements',
        source: {
          owner: 'AWS',
          sourceIdentifier: 'IAM_PASSWORD_POLICY',
        },
      },
    ];

    configRules.forEach((rule, index) => {
      const configRule = new awsConfig.CfnConfigRule(this, `ConfigRule${index}`, {
        configRuleName: rule.name,
        description: rule.description,
        source: rule.source,
      });
      // Note: Dependencies should be set using addDependency() if needed
    });
  }

  /**
   * Create SNS topic for security notifications
   */
  private createSecurityNotificationTopic(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>
  ): sns.Topic {
    const topic = new sns.Topic(this, 'SecurityNotificationTopic', {
      topicName: `apexshare-security-notifications-${config.env}`,
      displayName: 'ApexShare Security Notifications',
      fifo: false,
    });

    // Add CloudWatch Logs subscription for security events
    const securityLogGroup = new logs.LogGroup(this, 'SecurityLogGroup', {
      logGroupName: `/aws/security/apexshare-events-${config.env}`,
      retention: logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    return topic;
  }

  /**
   * Create CloudFormation outputs
   */
  private createOutputs(): void {
    new cdk.CfnOutput(this, 'WebAclArn', {
      value: this.outputs.webAcl.attrArn,
      description: 'WAF Web ACL ARN',
      exportName: `${this.stackName}-WebAclArn`,
    });

    new cdk.CfnOutput(this, 'S3KmsKeyId', {
      value: this.outputs.kmsKeys.s3.keyId,
      description: 'S3 KMS Key ID',
      exportName: `${this.stackName}-S3KmsKeyId`,
    });

    new cdk.CfnOutput(this, 'DynamoDBKmsKeyId', {
      value: this.outputs.kmsKeys.dynamodb.keyId,
      description: 'DynamoDB KMS Key ID',
      exportName: `${this.stackName}-DynamoDBKmsKeyId`,
    });

    new cdk.CfnOutput(this, 'LambdaExecutionRoleArn', {
      value: this.outputs.lambdaExecutionRole.roleArn,
      description: 'Lambda Execution Role ARN',
      exportName: `${this.stackName}-LambdaExecutionRoleArn`,
    });

    new cdk.CfnOutput(this, 'ApiGatewayRoleArn', {
      value: this.outputs.apiGatewayRole.roleArn,
      description: 'API Gateway Role ARN',
      exportName: `${this.stackName}-ApiGatewayRoleArn`,
    });

    new cdk.CfnOutput(this, 'CloudTrailArn', {
      value: this.outputs.cloudTrail.trailArn,
      description: 'CloudTrail ARN',
      exportName: `${this.stackName}-CloudTrailArn`,
    });

    new cdk.CfnOutput(this, 'SecurityNotificationTopicArn', {
      value: this.outputs.complianceNotificationTopic.topicArn,
      description: 'Security Notification Topic ARN',
      exportName: `${this.stackName}-SecurityNotificationTopicArn`,
    });

    // Output security setup instructions
    new cdk.CfnOutput(this, 'SecuritySetupInstructions', {
      value: 'WAF Web ACL created - associate with CloudFront distribution manually if needed',
      description: 'Security setup instructions',
    });
  }
}