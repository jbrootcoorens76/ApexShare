// /lib/constructs/s3-cost-optimization-construct.ts
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../shared/config';

export interface S3CostOptimizationProps {
  bucket: s3.Bucket;
  config: EnvironmentConfig;
}

export class S3CostOptimizationConstruct extends Construct {
  public readonly intelligentTieringConfig: s3.CfnBucket.IntelligentTieringConfigurationProperty;
  public readonly storageAnalyzer: lambda.Function;
  public readonly costOptimizationDashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: S3CostOptimizationProps) {
    super(scope, id);

    // Configure S3 Intelligent Tiering for automatic cost optimization
    this.configureIntelligentTiering(props.bucket, props.config);

    // Enhanced lifecycle policies for video content
    this.configureAdvancedLifecyclePolicies(props.bucket, props.config);

    // Storage class analyzer Lambda function
    this.storageAnalyzer = this.createStorageAnalyzer(props.bucket, props.config);

    // CloudWatch dashboard for S3 cost monitoring
    this.costOptimizationDashboard = this.createS3CostDashboard(props.bucket, props.config);

    // S3 access pattern analyzer
    this.createAccessPatternAnalyzer(props.bucket, props.config);

    // Cost optimization recommendations
    this.createCostOptimizationRecommendations(props.bucket, props.config);
  }

  private configureIntelligentTiering(bucket: s3.Bucket, config: EnvironmentConfig) {
    // Add Intelligent Tiering configuration
    const cfnBucket = bucket.node.defaultChild as s3.CfnBucket;

    cfnBucket.addPropertyOverride('IntelligentTieringConfigurations', [
      {
        Id: 'EntireBucketIntelligentTiering',
        Status: 'Enabled',
        Prefix: 'videos/',
        OptionalFields: [
          'BucketKeyStatus',
          'AccessTier'
        ],
        Tierings: [
          {
            AccessTier: 'ARCHIVE_ACCESS',
            Days: 90
          },
          {
            AccessTier: 'DEEP_ARCHIVE_ACCESS',
            Days: 180
          }
        ]
      }
    ]);

    // Add inventory configuration for better cost analysis
    cfnBucket.addPropertyOverride('InventoryConfigurations', [
      {
        Id: 'CostOptimizationInventory',
        IsEnabled: true,
        Destination: {
          BucketArn: bucket.bucketArn,
          Format: 'CSV',
          Prefix: 'inventory-reports/',
          BucketAccountId: cdk.Stack.of(this).account
        },
        IncludedObjectVersions: 'Current',
        OptionalFields: [
          'Size',
          'LastModifiedDate',
          'StorageClass',
          'IntelligentTieringAccessTier'
        ],
        Schedule: {
          Frequency: 'Weekly'
        }
      }
    ]);

    // Add analytics configuration
    cfnBucket.addPropertyOverride('AnalyticsConfigurations', [
      {
        Id: 'VideoStorageAnalytics',
        Prefix: 'videos/',
        StorageClassAnalysis: {
          DataExport: {
            Destination: {
              BucketArn: bucket.bucketArn,
              Format: 'CSV',
              Prefix: 'analytics-reports/'
            },
            OutputSchemaVersion: 'V_1'
          }
        }
      }
    ]);
  }

  private configureAdvancedLifecyclePolicies(bucket: s3.Bucket, config: EnvironmentConfig) {
    const cfnBucket = bucket.node.defaultChild as s3.CfnBucket;

    // Enhanced lifecycle rules based on access patterns
    const lifecycleRules = [
      {
        Id: 'VideoContentOptimization',
        Status: 'Enabled',
        Filter: {
          Prefix: 'videos/'
        },
        Transitions: [
          {
            Days: 7,
            StorageClass: 'STANDARD_IA'
          },
          {
            Days: 30,
            StorageClass: 'GLACIER_IR' // Glacier Instant Retrieval for faster access
          },
          {
            Days: 90,
            StorageClass: 'GLACIER'
          },
          {
            Days: 365,
            StorageClass: 'DEEP_ARCHIVE'
          }
        ],
        Expiration: {
          Days: config.env === 'prod' ? 1095 : config.retentionDays // 3 years for prod, config for others
        },
        AbortIncompleteMultipartUpload: {
          DaysAfterInitiation: 1
        },
        NoncurrentVersionTransitions: [
          {
            NoncurrentDays: 1,
            StorageClass: 'STANDARD_IA'
          },
          {
            NoncurrentDays: 7,
            StorageClass: 'GLACIER'
          }
        ],
        NoncurrentVersionExpiration: {
          NoncurrentDays: 30
        }
      },
      {
        Id: 'TempUploadsCleanup',
        Status: 'Enabled',
        Filter: {
          Prefix: 'temp-uploads/'
        },
        Expiration: {
          Days: 1
        },
        AbortIncompleteMultipartUpload: {
          DaysAfterInitiation: 1
        }
      },
      {
        Id: 'LogsCleanup',
        Status: 'Enabled',
        Filter: {
          Prefix: 'logs/'
        },
        Transitions: [
          {
            Days: 7,
            StorageClass: 'STANDARD_IA'
          },
          {
            Days: 30,
            StorageClass: 'GLACIER'
          }
        ],
        Expiration: {
          Days: 90
        }
      },
      {
        Id: 'AnalyticsReportsCleanup',
        Status: 'Enabled',
        Filter: {
          And: {
            Prefix: 'analytics-reports/',
            Tags: [
              {
                Key: 'Type',
                Value: 'Analytics'
              }
            ]
          }
        },
        Transitions: [
          {
            Days: 30,
            StorageClass: 'STANDARD_IA'
          },
          {
            Days: 90,
            StorageClass: 'GLACIER'
          }
        ],
        Expiration: {
          Days: 365
        }
      }
    ];

    cfnBucket.addPropertyOverride('LifecycleConfiguration.Rules', lifecycleRules);
  }

  private createStorageAnalyzer(bucket: s3.Bucket, config: EnvironmentConfig): lambda.Function {
    const storageAnalyzer = new nodejs.NodejsFunction(this, 'StorageAnalyzer', {
      functionName: `apexshare-storage-analyzer-${config.env}`,
      entry: 'lambda/storage-analyzer/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        BUCKET_NAME: bucket.bucketName,
        ENVIRONMENT: config.env
      }
    });

    // Grant permissions to analyze bucket and publish metrics
    storageAnalyzer.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:ListBucket',
          's3:GetBucketLocation',
          's3:GetBucketInventoryConfiguration',
          's3:GetBucketAnalyticsConfiguration',
          's3:GetObjectTagging',
          's3:GetObject',
          's3:GetObjectVersion',
          'cloudwatch:PutMetricData',
          'ce:GetCostAndUsage'
        ],
        resources: [
          bucket.bucketArn,
          `${bucket.bucketArn}/*`
        ]
      })
    );

    // Schedule analyzer to run daily
    const analysisRule = new events.Rule(this, 'StorageAnalysisSchedule', {
      ruleName: `apexshare-storage-analysis-${config.env}`,
      description: 'Daily S3 storage cost analysis',
      schedule: events.Schedule.rate(cdk.Duration.days(1))
    });

    analysisRule.addTarget(new targets.LambdaFunction(storageAnalyzer));

    return storageAnalyzer;
  }

  private createS3CostDashboard(bucket: s3.Bucket, config: EnvironmentConfig): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'S3CostDashboard', {
      dashboardName: `ApexShare-S3-Cost-Optimization-${config.env}`,
      defaultInterval: cdk.Duration.hours(24)
    });

    // Storage cost breakdown by class
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Storage Cost by Class',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/S3',
            metricName: 'StandardStorageCost',
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/S3',
            metricName: 'StandardIACost',
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/S3',
            metricName: 'GlacierCost',
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/S3',
            metricName: 'DeepArchiveCost',
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          })
        ]
      })
    );

    // Storage utilization by class
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Storage Utilization by Class (GB)',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/S3',
            metricName: 'BucketSizeBytes',
            dimensionsMap: {
              BucketName: bucket.bucketName,
              StorageType: 'StandardStorage'
            },
            statistic: 'Average',
            period: cdk.Duration.days(1)
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/S3',
            metricName: 'BucketSizeBytes',
            dimensionsMap: {
              BucketName: bucket.bucketName,
              StorageType: 'StandardIAStorage'
            },
            statistic: 'Average',
            period: cdk.Duration.days(1)
          })
        ]
      })
    );

    // Request costs
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Request Costs',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/S3',
            metricName: 'PutRequestCost',
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/S3',
            metricName: 'GetRequestCost',
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          })
        ]
      }),
      new cloudwatch.GraphWidget({
        title: 'Data Transfer Costs',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/S3',
            metricName: 'DataTransferOutCost',
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          })
        ]
      }),
      new cloudwatch.GraphWidget({
        title: 'Lifecycle Transition Savings',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/S3',
            metricName: 'LifecycleSavings',
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          })
        ]
      })
    );

    // Cost efficiency metrics
    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Average Cost per GB/Month',
        width: 6,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/S3',
            metricName: 'CostPerGBMonth',
            statistic: 'Average',
            period: cdk.Duration.days(30)
          })
        ]
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Intelligent Tiering Savings',
        width: 6,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/S3',
            metricName: 'IntelligentTieringSavings',
            statistic: 'Sum',
            period: cdk.Duration.days(30)
          })
        ]
      })
    );

    return dashboard;
  }

  private createAccessPatternAnalyzer(bucket: s3.Bucket, config: EnvironmentConfig) {
    const accessAnalyzer = new nodejs.NodejsFunction(this, 'AccessPatternAnalyzer', {
      functionName: `apexshare-access-pattern-analyzer-${config.env}`,
      entry: 'lambda/access-pattern-analyzer/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      environment: {
        BUCKET_NAME: bucket.bucketName,
        ENVIRONMENT: config.env
      }
    });

    // Grant permissions to analyze CloudTrail logs and S3 access patterns
    accessAnalyzer.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:GetBucketLogging',
          's3:GetBucketNotification',
          's3:ListBucket',
          'cloudtrail:LookupEvents',
          'cloudwatch:PutMetricData',
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents'
        ],
        resources: ['*']
      })
    );

    // Weekly access pattern analysis
    const accessAnalysisRule = new events.Rule(this, 'AccessPatternAnalysisSchedule', {
      ruleName: `apexshare-access-pattern-analysis-${config.env}`,
      description: 'Weekly S3 access pattern analysis for optimization',
      schedule: events.Schedule.rate(cdk.Duration.days(7))
    });

    accessAnalysisRule.addTarget(new targets.LambdaFunction(accessAnalyzer));
  }

  private createCostOptimizationRecommendations(bucket: s3.Bucket, config: EnvironmentConfig) {
    const recommendationEngine = new nodejs.NodejsFunction(this, 'CostOptimizationRecommendations', {
      functionName: `apexshare-cost-recommendations-${config.env}`,
      entry: 'lambda/cost-recommendations/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      environment: {
        BUCKET_NAME: bucket.bucketName,
        ENVIRONMENT: config.env
      }
    });

    // Grant permissions for cost analysis and recommendations
    recommendationEngine.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:ListBucket',
          's3:GetBucketLocation',
          's3:GetBucketAnalyticsConfiguration',
          's3:GetBucketInventoryConfiguration',
          'ce:GetCostAndUsage',
          'ce:GetRightsizingRecommendation',
          'cloudwatch:PutMetricData',
          'sns:Publish'
        ],
        resources: ['*']
      })
    );

    // Monthly cost optimization recommendations
    const recommendationRule = new events.Rule(this, 'CostRecommendationSchedule', {
      ruleName: `apexshare-cost-recommendation-${config.env}`,
      description: 'Monthly S3 cost optimization recommendations',
      schedule: events.Schedule.rate(cdk.Duration.days(30))
    });

    recommendationRule.addTarget(new targets.LambdaFunction(recommendationEngine));
  }
}