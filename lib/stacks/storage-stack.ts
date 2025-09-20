/**
 * Storage Stack for ApexShare Infrastructure
 *
 * Creates and configures:
 * - S3 buckets for video storage and access logging
 * - DynamoDB table for upload metadata with proper indexing
 * - KMS encryption keys for enhanced security
 * - Lifecycle policies for cost optimization
 */

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { ApexShareStackProps } from '../shared/types';
import { getResourceNames } from '../shared/config';
import {
  S3_CONFIG,
  DYNAMODB_CONFIG,
  COMPLIANCE_CONFIG,
  SECURITY_CONFIG
} from '../shared/constants';

export class StorageStack extends cdk.Stack {
  public readonly videosBucket: s3.Bucket;
  public readonly frontendBucket: s3.Bucket;
  public readonly accessLogsBucket: s3.Bucket;
  public readonly templatesBucket: s3.Bucket;
  public readonly uploadsTable: dynamodb.Table;
  public readonly s3EncryptionKey: kms.Key;
  public readonly dynamoEncryptionKey: kms.Key;

  constructor(scope: Construct, id: string, props: ApexShareStackProps) {
    super(scope, id, props);

    const { config } = props;
    const resourceNames = getResourceNames(config);
    const tags = resourceNames.getTags();

    // Apply tags to the entire stack
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });

    // Create KMS encryption keys for enhanced security
    this.s3EncryptionKey = this.createS3EncryptionKey(resourceNames);
    this.dynamoEncryptionKey = this.createDynamoEncryptionKey(resourceNames);

    // Create S3 buckets
    this.accessLogsBucket = this.createAccessLogsBucket(resourceNames, config);
    this.videosBucket = this.createVideosBucket(resourceNames, config);
    this.frontendBucket = this.createFrontendBucket(resourceNames, config);
    this.templatesBucket = this.createTemplatesBucket(resourceNames, config);

    // Create DynamoDB table
    this.uploadsTable = this.createUploadsTable(resourceNames, config);

    // Create outputs
    this.createOutputs(resourceNames);
  }

  /**
   * Create KMS encryption key for S3 buckets
   */
  private createS3EncryptionKey(resourceNames: ReturnType<typeof getResourceNames>): kms.Key {
    return new kms.Key(this, 'S3EncryptionKey', {
      description: 'KMS key for S3 bucket encryption in ApexShare',
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      enableKeyRotation: SECURITY_CONFIG.ENCRYPTION.KMS_KEY_ROTATION,
      policy: new iam.PolicyDocument({
        statements: [
          // Root account permissions
          new iam.PolicyStatement({
            sid: 'EnableIAMUserPermissions',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          // S3 service permissions
          new iam.PolicyStatement({
            sid: 'AllowS3Service',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('s3.amazonaws.com')],
            actions: [
              'kms:Decrypt',
              'kms:DescribeKey',
              'kms:Encrypt',
              'kms:GenerateDataKey',
              'kms:ReEncrypt*',
            ],
            resources: ['*'],
            conditions: {
              StringEquals: {
                'kms:ViaService': [`s3.${this.region}.amazonaws.com`],
              },
            },
          }),
        ],
      }),
      alias: resourceNames.s3Key,
    });
  }

  /**
   * Create KMS encryption key for DynamoDB table
   */
  private createDynamoEncryptionKey(resourceNames: ReturnType<typeof getResourceNames>): kms.Key {
    return new kms.Key(this, 'DynamoEncryptionKey', {
      description: 'KMS key for DynamoDB encryption in ApexShare',
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      enableKeyRotation: SECURITY_CONFIG.ENCRYPTION.KMS_KEY_ROTATION,
      policy: new iam.PolicyDocument({
        statements: [
          // Root account permissions
          new iam.PolicyStatement({
            sid: 'EnableIAMUserPermissions',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          // DynamoDB service permissions
          new iam.PolicyStatement({
            sid: 'AllowDynamoDBService',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('dynamodb.amazonaws.com')],
            actions: [
              'kms:Decrypt',
              'kms:DescribeKey',
              'kms:Encrypt',
              'kms:GenerateDataKey',
              'kms:ReEncrypt*',
            ],
            resources: ['*'],
            conditions: {
              StringEquals: {
                'kms:ViaService': [`dynamodb.${this.region}.amazonaws.com`],
              },
            },
          }),
        ],
      }),
      alias: resourceNames.dynamoKey,
    });
  }

  /**
   * Create S3 bucket for access logs
   */
  private createAccessLogsBucket(
    resourceNames: ReturnType<typeof getResourceNames>,
    config: any
  ): s3.Bucket {
    return new s3.Bucket(this, 'AccessLogsBucket', {
      bucketName: resourceNames.accessLogsBucket,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          id: 'AccessLogsLifecycle',
          enabled: true,
          expiration: cdk.Duration.days(COMPLIANCE_CONFIG.DATA_RETENTION.OPERATIONAL_DATA_DAYS),
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
    });
  }

  /**
   * Create S3 bucket for video storage with security and lifecycle policies
   */
  private createVideosBucket(
    resourceNames: ReturnType<typeof getResourceNames>,
    config: any
  ): s3.Bucket {
    const bucket = new s3.Bucket(this, 'VideosBucket', {
      bucketName: resourceNames.videosBucket,
      encryption: config.security.encryptionAtRest
        ? s3.BucketEncryption.KMS
        : s3.BucketEncryption.S3_MANAGED,
      encryptionKey: config.security.encryptionAtRest ? this.s3EncryptionKey : undefined,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: config.s3.versioning,
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      serverAccessLogsBucket: config.s3.accessLogging ? this.accessLogsBucket : undefined,
      serverAccessLogsPrefix: config.s3.accessLogging ? 'videos-access-logs/' : undefined,
      eventBridgeEnabled: true, // Enable EventBridge notifications
      // Note: IntelligentTiering disabled temporarily due to CDK v2 compatibility
      // intelligentTieringConfigurations: config.s3.intelligentTiering ? [
      //   {
      //     id: 'EntireBucketIntelligentTiering',
      //     status: s3.IntelligentTieringStatus.ENABLED,
      //     prefix: S3_CONFIG.PATHS.VIDEOS,
      //     optionalFields: [
      //       s3.IntelligentTieringOptionalFields.BUCKET_KEY_STATUS,
      //     ],
      //   },
      // ] : undefined,
      lifecycleRules: config.s3.lifecycleRules ? [
        // Video files lifecycle
        {
          id: 'VideoLifecycle',
          enabled: true,
          prefix: S3_CONFIG.PATHS.VIDEOS,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(S3_CONFIG.LIFECYCLE.TRANSITION_TO_IA_DAYS),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(S3_CONFIG.LIFECYCLE.TRANSITION_TO_GLACIER_DAYS),
            },
          ],
          expiration: cdk.Duration.days(config.retentionDays),
        },
        // Temporary uploads cleanup
        {
          id: 'TempUploadsCleanup',
          enabled: true,
          prefix: S3_CONFIG.PATHS.TEMP_UPLOADS,
          expiration: cdk.Duration.days(S3_CONFIG.LIFECYCLE.TEMP_CLEANUP_DAYS),
        },
      ] : undefined,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: config.corsOrigins,
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag', 'x-amz-version-id'],
          maxAge: S3_CONFIG.CORS.MAX_AGE,
        },
      ],
      notificationsHandlerRole: new iam.Role(this, 'S3NotificationsRole', {
        assumedBy: new iam.ServicePrincipal('s3.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSS3NotificationRolePolicy'),
        ],
      }),
    });

    // Add bucket policy for enhanced security
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyInsecureConnections',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:*'],
        resources: [bucket.bucketArn, bucket.arnForObjects('*')],
        conditions: {
          Bool: {
            'aws:SecureTransport': 'false',
          },
        },
      })
    );

    // Deny unencrypted object uploads
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyUnencryptedObjectUploads',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:PutObject'],
        resources: [bucket.arnForObjects('*')],
        conditions: {
          StringNotEquals: {
            's3:x-amz-server-side-encryption': ['AES256', 'aws:kms'],
          },
        },
      })
    );

    return bucket;
  }

  /**
   * Create S3 bucket for frontend static hosting
   */
  private createFrontendBucket(
    resourceNames: ReturnType<typeof getResourceNames>,
    config: any
  ): s3.Bucket {
    return new s3.Bucket(this, 'FrontendBucket', {
      bucketName: resourceNames.frontendBucket,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: config.s3.versioning,
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      serverAccessLogsBucket: config.s3.accessLogging ? this.accessLogsBucket : undefined,
      serverAccessLogsPrefix: config.s3.accessLogging ? 'frontend-access-logs/' : undefined,
      lifecycleRules: [
        {
          id: 'FrontendCleanup',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
    });
  }

  /**
   * Create S3 bucket for email templates
   */
  private createTemplatesBucket(
    resourceNames: ReturnType<typeof getResourceNames>,
    config: any
  ): s3.Bucket {
    return new s3.Bucket(this, 'TemplatesBucket', {
      bucketName: resourceNames.templatesBucket,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });
  }

  /**
   * Create DynamoDB table for upload metadata with proper indexing and security
   */
  private createUploadsTable(
    resourceNames: ReturnType<typeof getResourceNames>,
    config: any
  ): dynamodb.Table {
    const table = new dynamodb.Table(this, 'UploadsTable', {
      tableName: resourceNames.uploadsTable,
      partitionKey: {
        name: DYNAMODB_CONFIG.UPLOAD_TABLE.PARTITION_KEY,
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: DYNAMODB_CONFIG.UPLOAD_TABLE.SORT_KEY,
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: config.security.encryptionAtRest
        ? dynamodb.TableEncryption.CUSTOMER_MANAGED
        : dynamodb.TableEncryption.AWS_MANAGED,
      encryptionKey: config.security.encryptionAtRest ? this.dynamoEncryptionKey : undefined,
      pointInTimeRecovery: config.dynamodb.pointInTimeRecovery,
      deletionProtection: config.dynamodb.deletionProtection,
      timeToLiveAttribute: DYNAMODB_CONFIG.UPLOAD_TABLE.TTL_ATTRIBUTE,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      contributorInsightsEnabled: config.monitoring.detailedMetrics,
    });

    // Add Global Secondary Index for student email queries
    table.addGlobalSecondaryIndex({
      indexName: DYNAMODB_CONFIG.UPLOAD_TABLE.GSI1.NAME,
      partitionKey: {
        name: DYNAMODB_CONFIG.UPLOAD_TABLE.GSI1.PARTITION_KEY,
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: DYNAMODB_CONFIG.UPLOAD_TABLE.GSI1.SORT_KEY,
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Add Global Secondary Index for date range queries
    table.addGlobalSecondaryIndex({
      indexName: DYNAMODB_CONFIG.UPLOAD_TABLE.GSI2.NAME,
      partitionKey: {
        name: DYNAMODB_CONFIG.UPLOAD_TABLE.GSI2.PARTITION_KEY,
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: DYNAMODB_CONFIG.UPLOAD_TABLE.GSI2.SORT_KEY,
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    return table;
  }

  /**
   * Create CloudFormation outputs for cross-stack references
   */
  private createOutputs(resourceNames: ReturnType<typeof getResourceNames>): void {
    // S3 Bucket outputs
    new cdk.CfnOutput(this, 'VideosBucketName', {
      value: this.videosBucket.bucketName,
      description: 'Name of the S3 bucket for video storage',
      exportName: `${this.stackName}-VideosBucketName`,
    });

    new cdk.CfnOutput(this, 'VideosBucketArn', {
      value: this.videosBucket.bucketArn,
      description: 'ARN of the S3 bucket for video storage',
      exportName: `${this.stackName}-VideosBucketArn`,
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: this.frontendBucket.bucketName,
      description: 'Name of the S3 bucket for frontend hosting',
      exportName: `${this.stackName}-FrontendBucketName`,
    });

    new cdk.CfnOutput(this, 'TemplatesBucketName', {
      value: this.templatesBucket.bucketName,
      description: 'Name of the S3 bucket for email templates',
      exportName: `${this.stackName}-TemplatesBucketName`,
    });

    // DynamoDB outputs
    new cdk.CfnOutput(this, 'UploadsTableName', {
      value: this.uploadsTable.tableName,
      description: 'Name of the DynamoDB table for upload metadata',
      exportName: `${this.stackName}-UploadsTableName`,
    });

    new cdk.CfnOutput(this, 'UploadsTableArn', {
      value: this.uploadsTable.tableArn,
      description: 'ARN of the DynamoDB table for upload metadata',
      exportName: `${this.stackName}-UploadsTableArn`,
    });

    new cdk.CfnOutput(this, 'UploadsTableStreamArn', {
      value: this.uploadsTable.tableStreamArn || '',
      description: 'Stream ARN of the DynamoDB table',
      exportName: `${this.stackName}-UploadsTableStreamArn`,
    });

    // KMS Key outputs
    new cdk.CfnOutput(this, 'S3EncryptionKeyId', {
      value: this.s3EncryptionKey.keyId,
      description: 'ID of the KMS key for S3 encryption',
      exportName: `${this.stackName}-S3EncryptionKeyId`,
    });

    new cdk.CfnOutput(this, 'DynamoEncryptionKeyId', {
      value: this.dynamoEncryptionKey.keyId,
      description: 'ID of the KMS key for DynamoDB encryption',
      exportName: `${this.stackName}-DynamoEncryptionKeyId`,
    });
  }
}