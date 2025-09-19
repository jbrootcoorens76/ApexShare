// /lib/stacks/cost-optimization-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../shared/config';
import { CostForecastingConstruct } from '../constructs/cost-forecasting-construct';

export interface CostOptimizationStackProps extends cdk.StackProps {
  alertEmail: string;
  accountId: string;
  usageScenario: 'small' | 'medium' | 'large'; // 50, 200, 1000 uploads/month
}

export class CostOptimizationStack extends cdk.Stack {
  public readonly budgetAlerts: sns.Topic;
  public readonly costMonitoringDashboard: cloudwatch.Dashboard;
  public readonly costAnomalyDetector: lambda.Function;
  public readonly costDataBucket: s3.Bucket;
  public readonly costForecasting: CostForecastingConstruct;

  constructor(
    scope: Construct,
    id: string,
    config: EnvironmentConfig,
    props: CostOptimizationStackProps
  ) {
    super(scope, id, props);

    // Define budget amounts based on usage scenarios
    const budgetLimits = {
      small: { monthly: 5, annual: 60 },     // 50 uploads/month
      medium: { monthly: 16, annual: 192 },   // 200 uploads/month
      large: { monthly: 80, annual: 960 }     // 1000 uploads/month
    };

    const currentBudget = budgetLimits[props.usageScenario];

    // SNS Topic for budget alerts
    this.budgetAlerts = new sns.Topic(this, 'BudgetAlerts', {
      topicName: `apexshare-budget-alerts-${config.env}`,
      displayName: `ApexShare Budget Alerts - ${config.env.toUpperCase()}`
    });

    // Subscribe email to budget alerts
    this.budgetAlerts.addSubscription(
      new subscriptions.EmailSubscription(props.alertEmail)
    );

    // Monthly Budget with multiple alert thresholds
    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: `ApexShare-Monthly-Budget-${config.env}`,
        budgetLimit: {
          amount: currentBudget.monthly,
          unit: 'USD'
        },
        timeUnit: 'MONTHLY',
        budgetType: 'COST',
        costFilters: {
          TagKey: ['Project'],
          TagValue: ['ApexShare']
        }
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 50,
            thresholdType: 'PERCENTAGE'
          },
          subscribers: [
            {
              subscriptionType: 'SNS',
              address: this.budgetAlerts.topicArn
            }
          ]
        },
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 75,
            thresholdType: 'PERCENTAGE'
          },
          subscribers: [
            {
              subscriptionType: 'SNS',
              address: this.budgetAlerts.topicArn
            }
          ]
        },
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 90,
            thresholdType: 'PERCENTAGE'
          },
          subscribers: [
            {
              subscriptionType: 'SNS',
              address: this.budgetAlerts.topicArn
            }
          ]
        },
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100,
            thresholdType: 'PERCENTAGE'
          },
          subscribers: [
            {
              subscriptionType: 'SNS',
              address: this.budgetAlerts.topicArn
            }
          ]
        }
      ]
    });

    // Service-specific budgets for granular tracking
    this.createServiceBudgets(config, currentBudget, props.accountId);

    // Cost anomaly detection Lambda
    this.costAnomalyDetector = new nodejs.NodejsFunction(this, 'CostAnomalyDetector', {
      functionName: `apexshare-cost-anomaly-detector-${config.env}`,
      entry: 'lambda/cost-anomaly-detector/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        SNS_TOPIC_ARN: this.budgetAlerts.topicArn,
        ENVIRONMENT: config.env,
        ACCOUNT_ID: props.accountId,
        BUDGET_THRESHOLD: currentBudget.monthly.toString()
      }
    });

    // Grant permissions for cost anomaly detector
    this.costAnomalyDetector.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ce:GetCostAndUsage',
          'ce:GetDimensionValues',
          'ce:GetUsageReport',
          'ce:GetRightsizingRecommendation',
          'sns:Publish',
          'cloudwatch:PutMetricData'
        ],
        resources: ['*']
      })
    );

    // Schedule cost anomaly detection to run every 4 hours
    const anomalyDetectionRule = new events.Rule(this, 'CostAnomalyDetectionSchedule', {
      ruleName: `apexshare-cost-anomaly-schedule-${config.env}`,
      description: 'Triggers cost anomaly detection every 4 hours',
      schedule: events.Schedule.rate(cdk.Duration.hours(4))
    });

    anomalyDetectionRule.addTarget(
      new targets.LambdaFunction(this.costAnomalyDetector)
    );

    // Create comprehensive cost monitoring dashboard
    this.costMonitoringDashboard = this.createCostMonitoringDashboard(config);

    // Custom metrics for cost tracking
    this.createCustomCostMetrics(config);

    // Cost allocation tags
    this.applyCostAllocationTags(config);

    // Create S3 bucket for cost data storage
    this.costDataBucket = new s3.Bucket(this, 'CostDataBucket', {
      bucketName: `apexshare-cost-data-${config.env}-${cdk.Aws.ACCOUNT_ID}`,
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          id: 'CostDataLifecycle',
          enabled: true,
          expiration: cdk.Duration.days(config.env === 'prod' ? 1095 : 365), // 3 years prod, 1 year others
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30)
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90)
            }
          ]
        }
      ],
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
    });

    // Cost forecasting and ROI analysis
    this.costForecasting = new CostForecastingConstruct(this, 'CostForecasting', {
      config,
      alertTopic: this.budgetAlerts,
      costDataBucket: this.costDataBucket
    });

    // Outputs
    new cdk.CfnOutput(this, 'BudgetAlertsTopicArn', {
      value: this.budgetAlerts.topicArn,
      description: 'SNS Topic ARN for budget alerts'
    });

    new cdk.CfnOutput(this, 'CostDashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.costMonitoringDashboard.dashboardName}`,
      description: 'URL to the cost monitoring dashboard'
    });

    new cdk.CfnOutput(this, 'MonthlyBudgetLimit', {
      value: `$${currentBudget.monthly}`,
      description: 'Monthly budget limit for the current usage scenario'
    });

    new cdk.CfnOutput(this, 'CostDataBucketName', {
      value: this.costDataBucket.bucketName,
      description: 'S3 bucket for storing cost analysis data'
    });

    new cdk.CfnOutput(this, 'ForecastingDashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.costForecasting.forecastingDashboard.dashboardName}`,
      description: 'URL to the cost forecasting dashboard'
    });
  }

  private createServiceBudgets(
    config: EnvironmentConfig,
    budgetLimit: { monthly: number; annual: number },
    accountId: string
  ) {
    // S3 Storage Budget (typically 60% of total cost)
    new budgets.CfnBudget(this, 'S3Budget', {
      budget: {
        budgetName: `ApexShare-S3-Budget-${config.env}`,
        budgetLimit: {
          amount: budgetLimit.monthly * 0.6,
          unit: 'USD'
        },
        timeUnit: 'MONTHLY',
        budgetType: 'COST',
        costFilters: {
          Service: ['Amazon Simple Storage Service'],
          TagKey: ['Project'],
          TagValue: ['ApexShare']
        }
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 80,
            thresholdType: 'PERCENTAGE'
          },
          subscribers: [
            {
              subscriptionType: 'SNS',
              address: this.budgetAlerts.topicArn
            }
          ]
        }
      ]
    });

    // Lambda Budget (typically 15% of total cost)
    new budgets.CfnBudget(this, 'LambdaBudget', {
      budget: {
        budgetName: `ApexShare-Lambda-Budget-${config.env}`,
        budgetLimit: {
          amount: budgetLimit.monthly * 0.15,
          unit: 'USD'
        },
        timeUnit: 'MONTHLY',
        budgetType: 'COST',
        costFilters: {
          Service: ['AWS Lambda'],
          TagKey: ['Project'],
          TagValue: ['ApexShare']
        }
      }
    });

    // Data Transfer Budget (CloudFront + S3 Transfer)
    new budgets.CfnBudget(this, 'DataTransferBudget', {
      budget: {
        budgetName: `ApexShare-DataTransfer-Budget-${config.env}`,
        budgetLimit: {
          amount: budgetLimit.monthly * 0.20,
          unit: 'USD'
        },
        timeUnit: 'MONTHLY',
        budgetType: 'COST',
        costFilters: {
          Service: ['Amazon CloudFront', 'Amazon Simple Storage Service'],
          UsageType: ['DataTransfer-Out-Bytes', 'CloudFront-Out-Bytes']
        }
      }
    });
  }

  private createCostMonitoringDashboard(config: EnvironmentConfig): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'CostMonitoringDashboard', {
      dashboardName: `ApexShare-Cost-Monitoring-${config.env}`,
      defaultInterval: cdk.Duration.hours(24)
    });

    // Daily cost widget
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Daily Cost Trend',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Billing',
            metricName: 'EstimatedCharges',
            dimensionsMap: {
              Currency: 'USD'
            },
            statistic: 'Maximum',
            period: cdk.Duration.days(1)
          })
        ]
      })
    );

    // Service breakdown widget
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Cost by Service',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/Costs',
            metricName: 'S3Cost',
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/Costs',
            metricName: 'LambdaCost',
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/Costs',
            metricName: 'DataTransferCost',
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          })
        ]
      })
    );

    // Usage metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Storage Usage (GB)',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/S3',
            metricName: 'BucketSizeBytes',
            dimensionsMap: {
              BucketName: `apexshare-videos-${config.env}`,
              StorageType: 'StandardStorage'
            },
            statistic: 'Average',
            period: cdk.Duration.days(1)
          })
        ]
      }),
      new cloudwatch.GraphWidget({
        title: 'Upload Volume',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/Usage',
            metricName: 'VideoUploads',
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          })
        ]
      }),
      new cloudwatch.GraphWidget({
        title: 'Download Volume',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/Usage',
            metricName: 'VideoDownloads',
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          })
        ]
      })
    );

    // Cost per upload/download metrics
    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Cost per Upload (Last 30 days)',
        width: 6,
        height: 4,
        metrics: [
          new cloudwatch.MathExpression({
            expression: 'm1/m2',
            usingMetrics: {
              m1: new cloudwatch.Metric({
                namespace: 'AWS/Billing',
                metricName: 'EstimatedCharges',
                dimensionsMap: { Currency: 'USD' },
                statistic: 'Maximum',
                period: cdk.Duration.days(30)
              }),
              m2: new cloudwatch.Metric({
                namespace: 'ApexShare/Usage',
                metricName: 'VideoUploads',
                statistic: 'Sum',
                period: cdk.Duration.days(30)
              })
            }
          })
        ]
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Cost per Download (Last 30 days)',
        width: 6,
        height: 4,
        metrics: [
          new cloudwatch.MathExpression({
            expression: 'm1/m2',
            usingMetrics: {
              m1: new cloudwatch.Metric({
                namespace: 'AWS/Billing',
                metricName: 'EstimatedCharges',
                dimensionsMap: { Currency: 'USD' },
                statistic: 'Maximum',
                period: cdk.Duration.days(30)
              }),
              m2: new cloudwatch.Metric({
                namespace: 'ApexShare/Usage',
                metricName: 'VideoDownloads',
                statistic: 'Sum',
                period: cdk.Duration.days(30)
              })
            }
          })
        ]
      })
    );

    // Budget utilization widget
    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Monthly Budget Utilization',
        width: 12,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/Budget',
            metricName: 'BudgetUtilization',
            statistic: 'Maximum',
            period: cdk.Duration.hours(1)
          })
        ]
      })
    );

    return dashboard;
  }

  private createCustomCostMetrics(config: EnvironmentConfig) {
    // Lambda function to calculate and publish custom cost metrics
    const costMetricsPublisher = new nodejs.NodejsFunction(this, 'CostMetricsPublisher', {
      functionName: `apexshare-cost-metrics-publisher-${config.env}`,
      entry: 'lambda/cost-metrics-publisher/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        ENVIRONMENT: config.env
      }
    });

    // Grant permissions to read billing data and publish metrics
    costMetricsPublisher.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ce:GetCostAndUsage',
          'ce:GetDimensionValues',
          'cloudwatch:PutMetricData'
        ],
        resources: ['*']
      })
    );

    // Schedule to run every hour
    const metricsRule = new events.Rule(this, 'CostMetricsSchedule', {
      ruleName: `apexshare-cost-metrics-schedule-${config.env}`,
      description: 'Publishes custom cost metrics every hour',
      schedule: events.Schedule.rate(cdk.Duration.hours(1))
    });

    metricsRule.addTarget(
      new targets.LambdaFunction(costMetricsPublisher)
    );
  }

  private applyCostAllocationTags(config: EnvironmentConfig) {
    // Apply cost allocation tags to the stack
    const tags = [
      { key: 'Project', value: 'ApexShare' },
      { key: 'Environment', value: config.env },
      { key: 'CostCenter', value: 'VideoSharing' },
      { key: 'Owner', value: 'ApexShareTeam' },
      { key: 'Purpose', value: 'MotorcycleTraining' }
    ];

    tags.forEach(tag => {
      cdk.Tags.of(this).add(tag.key, tag.value);
    });
  }
}