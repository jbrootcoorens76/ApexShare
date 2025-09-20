/**
 * Monitoring Stack for ApexShare Infrastructure
 *
 * Creates and configures:
 * - CloudWatch dashboards for operational visibility
 * - CloudWatch alarms for critical metrics
 * - SNS topics for notifications
 * - Custom metrics and log insights queries
 * - X-Ray tracing configuration
 * - Cost monitoring and budget alerts
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { ApexShareStackProps, AlarmConfig, DashboardConfig, CrossStackRefs } from '../shared/types';
import { getResourceNames } from '../shared/config';
import { MONITORING_CONFIG, COST_CONFIG, PERFORMANCE_CONFIG } from '../shared/constants';

export interface MonitoringStackProps extends ApexShareStackProps {
  crossStackRefs: CrossStackRefs;
}

export interface MonitoringStackOutputs {
  dashboard: cloudwatch.Dashboard;
  alarmTopic: sns.Topic;
  costAlarmTopic: sns.Topic;
  dashboardUrl: string;
  logGroups: string[];
}

export class MonitoringStack extends cdk.Stack {
  public readonly outputs: MonitoringStackOutputs;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { config, crossStackRefs } = props;
    const resourceNames = getResourceNames(config);
    const tags = resourceNames.getTags();

    // Apply tags to the entire stack
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });

    // Create SNS topics for notifications
    const { alarmTopic, costAlarmTopic } = this.createNotificationTopics(config, resourceNames);

    // Create CloudWatch dashboard
    const dashboard = this.createDashboard(config, resourceNames, crossStackRefs);

    // Create CloudWatch alarms
    this.createAlarms(config, resourceNames, alarmTopic, crossStackRefs);

    // Create cost monitoring and budgets
    this.createCostMonitoring(config, resourceNames, costAlarmTopic);

    // Create log insights queries
    this.createLogInsightsQueries(config, resourceNames);

    // Create custom metrics Lambda function
    this.createCustomMetricsFunction(config, resourceNames, crossStackRefs);

    // Collect log group names
    const logGroups = this.getLogGroups(config, resourceNames);

    // Set outputs
    this.outputs = {
      dashboard,
      alarmTopic,
      costAlarmTopic,
      dashboardUrl: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      logGroups,
    };

    // Create CloudFormation outputs
    this.createOutputs();
  }

  /**
   * Create SNS topics for alarm notifications
   */
  private createNotificationTopics(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>
  ): { alarmTopic: sns.Topic; costAlarmTopic: sns.Topic } {
    // General alarm notifications
    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `${resourceNames.getResourceName('alarms')}`,
      displayName: 'ApexShare Operational Alarms',
      fifo: false,
    });

    // Cost alarm notifications
    const costAlarmTopic = new sns.Topic(this, 'CostAlarmTopic', {
      topicName: `${resourceNames.getResourceName('cost-alarms')}`,
      displayName: 'ApexShare Cost Alarms',
      fifo: false,
    });

    // Add email subscriptions for production
    if (config.env === 'prod') {
      alarmTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(COST_CONFIG.BUDGET_ALERTS.NOTIFICATION_EMAIL)
      );
      costAlarmTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(COST_CONFIG.BUDGET_ALERTS.NOTIFICATION_EMAIL)
      );
    }

    return { alarmTopic, costAlarmTopic };
  }

  /**
   * Create comprehensive CloudWatch dashboard
   */
  private createDashboard(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>,
    crossStackRefs: CrossStackRefs
  ): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'ApexShareDashboard', {
      dashboardName: `${resourceNames.getResourceName('dashboard')}`,
      periodOverride: cloudwatch.PeriodOverride.AUTO,
    });

    // API Gateway metrics
    const apiMetricsWidget = new cloudwatch.GraphWidget({
      title: 'API Gateway Metrics',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Count',
          dimensionsMap: {
            ApiName: `${resourceNames.getResourceName('api')}`,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: 'Request Count',
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '4XXError',
          dimensionsMap: {
            ApiName: `${resourceNames.getResourceName('api')}`,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: '4XX Errors',
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '5XXError',
          dimensionsMap: {
            ApiName: `${resourceNames.getResourceName('api')}`,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: '5XX Errors',
        }),
      ],
      right: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Latency',
          dimensionsMap: {
            ApiName: `${resourceNames.getResourceName('api')}`,
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
          label: 'Average Latency',
        }),
      ],
    });

    // Lambda metrics
    const lambdaMetricsWidget = new cloudwatch.GraphWidget({
      title: 'Lambda Function Metrics',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Invocations',
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: 'Invocations',
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Errors',
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: 'Errors',
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Throttles',
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: 'Throttles',
        }),
      ],
      right: [
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Duration',
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
          label: 'Average Duration',
        }),
      ],
    });

    // DynamoDB metrics
    const dynamoMetricsWidget = new cloudwatch.GraphWidget({
      title: 'DynamoDB Metrics',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ConsumedReadCapacityUnits',
          dimensionsMap: {
            TableName: `${resourceNames.getResourceName('uploads-table')}`,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: 'Read Capacity Units',
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ConsumedWriteCapacityUnits',
          dimensionsMap: {
            TableName: `${resourceNames.getResourceName('uploads-table')}`,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: 'Write Capacity Units',
        }),
      ],
      right: [
        new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ItemCount',
          dimensionsMap: {
            TableName: `${resourceNames.getResourceName('uploads-table')}`,
          },
          statistic: 'Average',
          period: cdk.Duration.hours(1),
          label: 'Item Count',
        }),
      ],
    });

    // S3 metrics
    const s3MetricsWidget = new cloudwatch.GraphWidget({
      title: 'S3 Storage Metrics',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/S3',
          metricName: 'BucketSizeBytes',
          dimensionsMap: {
            BucketName: `${resourceNames.getResourceName('videos-bucket')}`,
            StorageType: 'StandardStorage',
          },
          statistic: 'Average',
          period: cdk.Duration.days(1),
          label: 'Bucket Size (Bytes)',
        }),
      ],
      right: [
        new cloudwatch.Metric({
          namespace: 'AWS/S3',
          metricName: 'NumberOfObjects',
          dimensionsMap: {
            BucketName: `${resourceNames.getResourceName('videos-bucket')}`,
            StorageType: 'AllStorageTypes',
          },
          statistic: 'Average',
          period: cdk.Duration.days(1),
          label: 'Object Count',
        }),
      ],
    });

    // CloudFront metrics
    const cloudFrontMetricsWidget = new cloudwatch.GraphWidget({
      title: 'CloudFront Distribution Metrics',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/CloudFront',
          metricName: 'Requests',
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: 'Requests',
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/CloudFront',
          metricName: '4xxErrorRate',
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
          label: '4XX Error Rate',
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/CloudFront',
          metricName: '5xxErrorRate',
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
          label: '5XX Error Rate',
        }),
      ],
      right: [
        new cloudwatch.Metric({
          namespace: 'AWS/CloudFront',
          metricName: 'CacheHitRate',
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
          label: 'Cache Hit Rate',
        }),
      ],
    });

    // Custom metrics
    const customMetricsWidget = new cloudwatch.GraphWidget({
      title: 'ApexShare Custom Metrics',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: MONITORING_CONFIG.METRICS.NAMESPACE,
          metricName: MONITORING_CONFIG.METRICS.CUSTOM_METRICS.UPLOAD_SUCCESS,
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: 'Successful Uploads',
        }),
        new cloudwatch.Metric({
          namespace: MONITORING_CONFIG.METRICS.NAMESPACE,
          metricName: MONITORING_CONFIG.METRICS.CUSTOM_METRICS.DOWNLOAD_SUCCESS,
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: 'Successful Downloads',
        }),
        new cloudwatch.Metric({
          namespace: MONITORING_CONFIG.METRICS.NAMESPACE,
          metricName: MONITORING_CONFIG.METRICS.CUSTOM_METRICS.EMAIL_SENT,
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: 'Emails Sent',
        }),
      ],
      right: [
        new cloudwatch.Metric({
          namespace: MONITORING_CONFIG.METRICS.NAMESPACE,
          metricName: MONITORING_CONFIG.METRICS.CUSTOM_METRICS.SECURITY_EVENT,
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: 'Security Events',
        }),
      ],
    });

    // Add widgets to dashboard
    dashboard.addWidgets(
      apiMetricsWidget,
      lambdaMetricsWidget,
      dynamoMetricsWidget,
      s3MetricsWidget,
      cloudFrontMetricsWidget,
      customMetricsWidget
    );

    return dashboard;
  }

  /**
   * Create CloudWatch alarms for critical metrics
   */
  private createAlarms(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>,
    alarmTopic: sns.Topic,
    crossStackRefs: CrossStackRefs
  ): void {
    // API Gateway error rate alarm
    new cloudwatch.Alarm(this, 'ApiGateway5xxErrorAlarm', {
      alarmName: `${resourceNames.getResourceName('api-5xx-errors')}`,
      alarmDescription: 'High 5XX error rate in API Gateway',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: {
          ApiName: `${resourceNames.getResourceName('api')}`,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: MONITORING_CONFIG.ALARMS.API_ERROR_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatch.SnsAction(alarmTopic));

    // API Gateway latency alarm
    new cloudwatch.Alarm(this, 'ApiGatewayLatencyAlarm', {
      alarmName: `${resourceNames.getResourceName('api-latency')}`,
      alarmDescription: 'High latency in API Gateway',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        dimensionsMap: {
          ApiName: `${resourceNames.getResourceName('api')}`,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: MONITORING_CONFIG.ALARMS.API_LATENCY_THRESHOLD,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatch.SnsAction(alarmTopic));

    // Lambda error rate alarm
    const lambdaFunctions = [
      'upload-handler',
      'download-handler',
      'email-sender',
    ];

    lambdaFunctions.forEach((functionName) => {
      new cloudwatch.Alarm(this, `${functionName}ErrorAlarm`, {
        alarmName: `${resourceNames.getResourceName(`${functionName}-errors`)}`,
        alarmDescription: `High error rate in ${functionName} Lambda function`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Errors',
          dimensionsMap: {
            FunctionName: `${resourceNames.getResourceName(functionName)}`,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: MONITORING_CONFIG.ALARMS.LAMBDA_ERROR_THRESHOLD,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }).addAlarmAction(new cloudwatch.SnsAction(alarmTopic));

      // Lambda duration alarm
      new cloudwatch.Alarm(this, `${functionName}DurationAlarm`, {
        alarmName: `${resourceNames.getResourceName(`${functionName}-duration`)}`,
        alarmDescription: `High duration in ${functionName} Lambda function`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Duration',
          dimensionsMap: {
            FunctionName: `${resourceNames.getResourceName(functionName)}`,
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: MONITORING_CONFIG.ALARMS.LAMBDA_DURATION_THRESHOLD,
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }).addAlarmAction(new cloudwatch.SnsAction(alarmTopic));
    });

    // DynamoDB throttle alarm
    new cloudwatch.Alarm(this, 'DynamoDBThrottleAlarm', {
      alarmName: `${resourceNames.getResourceName('dynamodb-throttles')}`,
      alarmDescription: 'DynamoDB throttling detected',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ThrottledRequests',
        dimensionsMap: {
          TableName: `${resourceNames.getResourceName('uploads-table')}`,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: MONITORING_CONFIG.ALARMS.DYNAMODB_THROTTLE_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatch.SnsAction(alarmTopic));

    // S3 error alarm
    new cloudwatch.Alarm(this, 'S3ErrorAlarm', {
      alarmName: `${resourceNames.getResourceName('s3-errors')}`,
      alarmDescription: 'High S3 error rate',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/S3',
        metricName: '4xxErrors',
        dimensionsMap: {
          BucketName: `${resourceNames.getResourceName('videos-bucket')}`,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: MONITORING_CONFIG.ALARMS.S3_ERROR_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatch.SnsAction(alarmTopic));
  }

  /**
   * Create cost monitoring and budget alerts
   */
  private createCostMonitoring(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>,
    costAlarmTopic: sns.Topic
  ): void {
    if (config.env !== 'prod') return; // Only monitor costs in production

    // Create budget for monthly spending
    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: `${resourceNames.getResourceName('monthly-budget')}`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: {
          amount: 100, // $100 monthly budget
          unit: 'USD',
        },
        costFilters: {
          TagKey: ['Project'],
          TagValue: ['ApexShare'],
        },
      },
      notificationsWithSubscribers: COST_CONFIG.BUDGET_ALERTS.THRESHOLDS.map((threshold) => ({
        notification: {
          notificationType: 'ACTUAL',
          comparisonOperator: 'GREATER_THAN',
          threshold,
          thresholdType: 'PERCENTAGE',
        },
        subscribers: [
          {
            subscriptionType: 'EMAIL',
            address: COST_CONFIG.BUDGET_ALERTS.NOTIFICATION_EMAIL,
          },
        ],
      })),
    });

    // Create budget for daily spending
    new budgets.CfnBudget(this, 'DailyBudget', {
      budget: {
        budgetName: `${resourceNames.getResourceName('daily-budget')}`,
        budgetType: 'COST',
        timeUnit: 'DAILY',
        budgetLimit: {
          amount: 5, // $5 daily budget
          unit: 'USD',
        },
        costFilters: {
          TagKey: ['Project'],
          TagValue: ['ApexShare'],
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 80,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            {
              subscriptionType: 'EMAIL',
              address: COST_CONFIG.BUDGET_ALERTS.NOTIFICATION_EMAIL,
            },
          ],
        },
      ],
    });
  }

  /**
   * Create Log Insights queries for troubleshooting
   */
  private createLogInsightsQueries(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>
  ): void {
    // API Gateway access logs query
    new logs.CfnQueryDefinition(this, 'ApiGatewayErrorsQuery', {
      name: `${resourceNames.getResourceName('api-errors-query')}`,
      queryString: `
        fields @timestamp, @message, @requestId
        | filter @message like /ERROR/
        | sort @timestamp desc
        | limit 100
      `,
      logGroupNames: [`/aws/apigateway/${resourceNames.getResourceName('api')}`],
    });

    // Lambda function errors query
    new logs.CfnQueryDefinition(this, 'LambdaErrorsQuery', {
      name: `${resourceNames.getResourceName('lambda-errors-query')}`,
      queryString: `
        fields @timestamp, @message, @requestId, @type
        | filter @type = "ERROR"
        | sort @timestamp desc
        | limit 100
      `,
      logGroupNames: [
        `/aws/lambda/${resourceNames.getResourceName('upload-handler')}`,
        `/aws/lambda/${resourceNames.getResourceName('download-handler')}`,
        `/aws/lambda/${resourceNames.getResourceName('email-sender')}`,
      ],
    });

    // Security events query
    new logs.CfnQueryDefinition(this, 'SecurityEventsQuery', {
      name: `${resourceNames.getResourceName('security-events-query')}`,
      queryString: `
        fields @timestamp, @message, eventType, severity, sourceIp
        | filter @message like /SecurityEvent/
        | sort @timestamp desc
        | limit 100
      `,
      logGroupNames: [`/aws/security/${resourceNames.getResourceName('events')}`],
    });
  }

  /**
   * Create custom metrics Lambda function
   */
  private createCustomMetricsFunction(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>,
    crossStackRefs: CrossStackRefs
  ): lambda.Function {
    const customMetricsFunction = new lambda.Function(this, 'CustomMetricsFunction', {
      functionName: `${resourceNames.getResourceName('custom-metrics')}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

        const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });

        exports.handler = async (event) => {
          try {
            const metrics = [];

            // Example custom metric - this would be expanded based on requirements
            metrics.push({
              MetricName: 'CustomHealthCheck',
              Value: 1,
              Unit: 'Count',
              Timestamp: new Date(),
              Dimensions: [
                {
                  Name: 'Environment',
                  Value: process.env.ENVIRONMENT
                }
              ]
            });

            await cloudwatch.send(new PutMetricDataCommand({
              Namespace: '${MONITORING_CONFIG.METRICS.NAMESPACE}',
              MetricData: metrics
            }));

            return { statusCode: 200, body: 'Metrics published successfully' };
          } catch (error) {
            console.error('Error publishing metrics:', error);
            return { statusCode: 500, body: 'Error publishing metrics' };
          }
        };
      `),
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        ENVIRONMENT: config.env,
      },
    });

    // Grant permissions to publish metrics
    customMetricsFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      })
    );

    return customMetricsFunction;
  }

  /**
   * Get list of log groups for monitoring
   */
  private getLogGroups(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>
  ): string[] {
    return [
      `/aws/apigateway/${resourceNames.getResourceName('api')}`,
      `/aws/lambda/${resourceNames.getResourceName('upload-handler')}`,
      `/aws/lambda/${resourceNames.getResourceName('download-handler')}`,
      `/aws/lambda/${resourceNames.getResourceName('email-sender')}`,
      `/aws/lambda/${resourceNames.getResourceName('custom-metrics')}`,
      `/aws/cloudtrail/${resourceNames.getResourceName('cloudtrail')}`,
      `/aws/security/${resourceNames.getResourceName('events')}`,
      `/aws/ses/apexshare-bounces-${config.env}`,
      `/aws/ses/apexshare-complaints-${config.env}`,
    ];
  }

  /**
   * Create CloudFormation outputs
   */
  private createOutputs(): void {
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: this.outputs.dashboardUrl,
      description: 'CloudWatch Dashboard URL',
      exportName: `${this.stackName}-DashboardUrl`,
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.outputs.alarmTopic.topicArn,
      description: 'Alarm Notification Topic ARN',
      exportName: `${this.stackName}-AlarmTopicArn`,
    });

    new cdk.CfnOutput(this, 'CostAlarmTopicArn', {
      value: this.outputs.costAlarmTopic.topicArn,
      description: 'Cost Alarm Notification Topic ARN',
      exportName: `${this.stackName}-CostAlarmTopicArn`,
    });

    new cdk.CfnOutput(this, 'LogGroups', {
      value: this.outputs.logGroups.join(','),
      description: 'CloudWatch Log Groups',
      exportName: `${this.stackName}-LogGroups`,
    });

    // Output monitoring setup instructions
    new cdk.CfnOutput(this, 'MonitoringSetupInstructions', {
      value: 'CloudWatch Dashboard and alarms configured - check dashboard for operational insights',
      description: 'Monitoring setup instructions',
    });
  }
}