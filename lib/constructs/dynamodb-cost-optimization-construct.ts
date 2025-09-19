// /lib/constructs/dynamodb-cost-optimization-construct.ts
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as applicationautoscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../shared/config';

export interface DynamoDBCostOptimizationProps {
  table: dynamodb.Table;
  config: EnvironmentConfig;
  alertTopic: sns.Topic;
  expectedUsagePattern: 'LOW' | 'MEDIUM' | 'HIGH' | 'VARIABLE';
}

export interface CapacityRecommendation {
  tableName: string;
  currentMode: 'ON_DEMAND' | 'PROVISIONED';
  recommendedMode: 'ON_DEMAND' | 'PROVISIONED';
  currentReadCapacity?: number;
  currentWriteCapacity?: number;
  recommendedReadCapacity?: number;
  recommendedWriteCapacity?: number;
  estimatedMonthlySavings: number;
  reasoning: string[];
}

export class DynamoDBCostOptimizationConstruct extends Construct {
  public readonly capacityAnalyzer: lambda.Function;
  public readonly autoScalingTarget?: applicationautoscaling.ScalableTarget;
  public readonly costDashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: DynamoDBCostOptimizationProps) {
    super(scope, id);

    // Configure optimal billing mode and capacity
    this.configureOptimalCapacity(props.table, props.config, props.expectedUsagePattern);

    // Set up auto-scaling if using provisioned capacity
    if (props.expectedUsagePattern === 'VARIABLE') {
      this.autoScalingTarget = this.configureAutoScaling(props.table, props.config);
    }

    // Create capacity analyzer
    this.capacityAnalyzer = this.createCapacityAnalyzer(props.table, props.config, props.alertTopic);

    // Create cost monitoring dashboard
    this.costDashboard = this.createCostDashboard(props.table, props.config);

    // Set up cost alarms
    this.setupCostAlarms(props.table, props.config, props.alertTopic);

    // Configure TTL optimization
    this.configureTTLOptimization(props.table, props.config);
  }

  private configureOptimalCapacity(
    table: dynamodb.Table,
    config: EnvironmentConfig,
    usagePattern: 'LOW' | 'MEDIUM' | 'HIGH' | 'VARIABLE'
  ) {
    const cfnTable = table.node.defaultChild as dynamodb.CfnTable;

    // Determine optimal billing mode based on usage pattern
    switch (usagePattern) {
      case 'LOW':
        // On-demand is typically better for low, unpredictable traffic
        cfnTable.addPropertyOverride('BillingMode', 'ON_DEMAND');
        break;

      case 'MEDIUM':
      case 'HIGH':
        // Provisioned mode with auto-scaling for predictable traffic
        cfnTable.addPropertyOverride('BillingMode', 'PROVISIONED');
        cfnTable.addPropertyOverride('ProvisionedThroughput', {
          ReadCapacityUnits: this.getInitialReadCapacity(usagePattern),
          WriteCapacityUnits: this.getInitialWriteCapacity(usagePattern)
        });
        break;

      case 'VARIABLE':
        // Start with on-demand, analyzer will recommend switching if beneficial
        cfnTable.addPropertyOverride('BillingMode', 'ON_DEMAND');
        break;
    }

    // Configure Global Secondary Index capacity
    const gsiBillingMode = usagePattern === 'LOW' ? 'ON_DEMAND' : 'PROVISIONED';
    cfnTable.addPropertyOverride('GlobalSecondaryIndexes.0.BillingMode', gsiBillingMode);
    cfnTable.addPropertyOverride('GlobalSecondaryIndexes.1.BillingMode', gsiBillingMode);

    if (gsiBillingMode === 'PROVISIONED') {
      cfnTable.addPropertyOverride('GlobalSecondaryIndexes.0.ProvisionedThroughput', {
        ReadCapacityUnits: Math.ceil(this.getInitialReadCapacity(usagePattern) * 0.3),
        WriteCapacityUnits: Math.ceil(this.getInitialWriteCapacity(usagePattern) * 0.3)
      });
      cfnTable.addPropertyOverride('GlobalSecondaryIndexes.1.ProvisionedThroughput', {
        ReadCapacityUnits: Math.ceil(this.getInitialReadCapacity(usagePattern) * 0.2),
        WriteCapacityUnits: Math.ceil(this.getInitialWriteCapacity(usagePattern) * 0.2)
      });
    }
  }

  private getInitialReadCapacity(usagePattern: 'LOW' | 'MEDIUM' | 'HIGH' | 'VARIABLE'): number {
    switch (usagePattern) {
      case 'LOW': return 5;
      case 'MEDIUM': return 25;
      case 'HIGH': return 100;
      case 'VARIABLE': return 15;
      default: return 5;
    }
  }

  private getInitialWriteCapacity(usagePattern: 'LOW' | 'MEDIUM' | 'HIGH' | 'VARIABLE'): number {
    switch (usagePattern) {
      case 'LOW': return 5;
      case 'MEDIUM': return 15;
      case 'HIGH': return 50;
      case 'VARIABLE': return 10;
      default: return 5;
    }
  }

  private configureAutoScaling(
    table: dynamodb.Table,
    config: EnvironmentConfig
  ): applicationautoscaling.ScalableTarget {
    // Create scalable target for the main table
    const readScalingTarget = new applicationautoscaling.ScalableTarget(this, 'TableReadScalingTarget', {
      serviceNamespace: applicationautoscaling.ServiceNamespace.DYNAMODB,
      scalableDimension: 'dynamodb:table:ReadCapacityUnits',
      resourceId: `table/${table.tableName}`,
      minCapacity: 5,
      maxCapacity: config.env === 'prod' ? 1000 : 100
    });

    const writeScalingTarget = new applicationautoscaling.ScalableTarget(this, 'TableWriteScalingTarget', {
      serviceNamespace: applicationautoscaling.ServiceNamespace.DYNAMODB,
      scalableDimension: 'dynamodb:table:WriteCapacityUnits',
      resourceId: `table/${table.tableName}`,
      minCapacity: 5,
      maxCapacity: config.env === 'prod' ? 500 : 50
    });

    // Configure target tracking scaling policies
    readScalingTarget.scaleToTrackMetric('ReadScaling', {
      targetValue: 70, // Target 70% utilization
      predefinedMetric: applicationautoscaling.PredefinedMetric.DYNAMODB_READ_CAPACITY_UTILIZATION,
      scaleOutCooldown: cdk.Duration.seconds(60),
      scaleInCooldown: cdk.Duration.seconds(300)
    });

    writeScalingTarget.scaleToTrackMetric('WriteScaling', {
      targetValue: 70, // Target 70% utilization
      predefinedMetric: applicationautoscaling.PredefinedMetric.DYNAMODB_WRITE_CAPACITY_UTILIZATION,
      scaleOutCooldown: cdk.Duration.seconds(60),
      scaleInCooldown: cdk.Duration.seconds(300)
    });

    // Configure GSI auto-scaling
    this.configureGSIAutoScaling(table, config);

    return readScalingTarget;
  }

  private configureGSIAutoScaling(table: dynamodb.Table, config: EnvironmentConfig) {
    // GSI1 auto-scaling
    const gsi1ReadTarget = new applicationautoscaling.ScalableTarget(this, 'GSI1ReadScalingTarget', {
      serviceNamespace: applicationautoscaling.ServiceNamespace.DYNAMODB,
      scalableDimension: 'dynamodb:index:ReadCapacityUnits',
      resourceId: `table/${table.tableName}/index/GSI1`,
      minCapacity: 5,
      maxCapacity: config.env === 'prod' ? 300 : 30
    });

    const gsi1WriteTarget = new applicationautoscaling.ScalableTarget(this, 'GSI1WriteScalingTarget', {
      serviceNamespace: applicationautoscaling.ServiceNamespace.DYNAMODB,
      scalableDimension: 'dynamodb:index:WriteCapacityUnits',
      resourceId: `table/${table.tableName}/index/GSI1`,
      minCapacity: 5,
      maxCapacity: config.env === 'prod' ? 150 : 15
    });

    gsi1ReadTarget.scaleToTrackMetric('GSI1ReadScaling', {
      targetValue: 70,
      predefinedMetric: applicationautoscaling.PredefinedMetric.DYNAMODB_READ_CAPACITY_UTILIZATION,
      scaleOutCooldown: cdk.Duration.seconds(60),
      scaleInCooldown: cdk.Duration.seconds(300)
    });

    gsi1WriteTarget.scaleToTrackMetric('GSI1WriteScaling', {
      targetValue: 70,
      predefinedMetric: applicationautoscaling.PredefinedMetric.DYNAMODB_WRITE_CAPACITY_UTILIZATION,
      scaleOutCooldown: cdk.Duration.seconds(60),
      scaleInCooldown: cdk.Duration.seconds(300)
    });

    // GSI2 auto-scaling (similar configuration)
    const gsi2ReadTarget = new applicationautoscaling.ScalableTarget(this, 'GSI2ReadScalingTarget', {
      serviceNamespace: applicationautoscaling.ServiceNamespace.DYNAMODB,
      scalableDimension: 'dynamodb:index:ReadCapacityUnits',
      resourceId: `table/${table.tableName}/index/GSI2`,
      minCapacity: 5,
      maxCapacity: config.env === 'prod' ? 200 : 20
    });

    const gsi2WriteTarget = new applicationautoscaling.ScalableTarget(this, 'GSI2WriteScalingTarget', {
      serviceNamespace: applicationautoscaling.ServiceNamespace.DYNAMODB,
      scalableDimension: 'dynamodb:index:WriteCapacityUnits',
      resourceId: `table/${table.tableName}/index/GSI2`,
      minCapacity: 5,
      maxCapacity: config.env === 'prod' ? 100 : 10
    });

    gsi2ReadTarget.scaleToTrackMetric('GSI2ReadScaling', {
      targetValue: 70,
      predefinedMetric: applicationautoscaling.PredefinedMetric.DYNAMODB_READ_CAPACITY_UTILIZATION,
      scaleOutCooldown: cdk.Duration.seconds(60),
      scaleInCooldown: cdk.Duration.seconds(300)
    });

    gsi2WriteTarget.scaleToTrackMetric('GSI2WriteScaling', {
      targetValue: 70,
      predefinedMetric: applicationautoscaling.PredefinedMetric.DYNAMODB_WRITE_CAPACITY_UTILIZATION,
      scaleOutCooldown: cdk.Duration.seconds(60),
      scaleInCooldown: cdk.Duration.seconds(300)
    });
  }

  private createCapacityAnalyzer(
    table: dynamodb.Table,
    config: EnvironmentConfig,
    alertTopic: sns.Topic
  ): lambda.Function {
    const capacityAnalyzer = new nodejs.NodejsFunction(this, 'CapacityAnalyzer', {
      functionName: `apexshare-dynamodb-capacity-analyzer-${config.env}`,
      entry: 'lambda/dynamodb-capacity-analyzer/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      environment: {
        TABLE_NAME: table.tableName,
        ENVIRONMENT: config.env,
        SNS_TOPIC_ARN: alertTopic.topicArn
      }
    });

    // Grant permissions for capacity analysis
    capacityAnalyzer.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:DescribeTable',
          'dynamodb:DescribeTimeToLive',
          'dynamodb:ListTagsOfResource',
          'dynamodb:DescribeContributorInsights',
          'cloudwatch:GetMetricStatistics',
          'cloudwatch:GetMetricData',
          'cloudwatch:PutMetricData',
          'ce:GetCostAndUsage',
          'application-autoscaling:DescribeScalingActivities',
          'application-autoscaling:DescribeScalingPolicies',
          'sns:Publish'
        ],
        resources: ['*']
      })
    );

    // Schedule capacity analysis twice daily
    const analysisRule = new events.Rule(this, 'CapacityAnalysisSchedule', {
      ruleName: `apexshare-dynamodb-capacity-analysis-${config.env}`,
      description: 'DynamoDB capacity optimization analysis',
      schedule: events.Schedule.rate(cdk.Duration.hours(12))
    });

    analysisRule.addTarget(new targets.LambdaFunction(capacityAnalyzer));

    return capacityAnalyzer;
  }

  private createCostDashboard(table: dynamodb.Table, config: EnvironmentConfig): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'DynamoDBCostDashboard', {
      dashboardName: `ApexShare-DynamoDB-Cost-Optimization-${config.env}`,
      defaultInterval: cdk.Duration.hours(24)
    });

    // Cost and capacity utilization
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Cost Trend',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/DynamoDB',
            metricName: 'TableCost',
            dimensionsMap: {
              TableName: table.tableName
            },
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          })
        ]
      }),
      new cloudwatch.GraphWidget({
        title: 'Capacity Utilization',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedReadCapacityUnits',
            dimensionsMap: {
              TableName: table.tableName
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedWriteCapacityUnits',
            dimensionsMap: {
              TableName: table.tableName
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          })
        ]
      })
    );

    // Throttling and errors
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Throttled Requests',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ReadThrottles',
            dimensionsMap: {
              TableName: table.tableName
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'WriteThrottles',
            dimensionsMap: {
              TableName: table.tableName
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          })
        ]
      }),
      new cloudwatch.GraphWidget({
        title: 'System Errors',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'SystemErrors',
            dimensionsMap: {
              TableName: table.tableName
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          })
        ]
      }),
      new cloudwatch.GraphWidget({
        title: 'Average Item Size',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/DynamoDB',
            metricName: 'AverageItemSize',
            dimensionsMap: {
              TableName: table.tableName
            },
            statistic: 'Average',
            period: cdk.Duration.hours(1)
          })
        ]
      })
    );

    // GSI metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'GSI1 Capacity Utilization',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedReadCapacityUnits',
            dimensionsMap: {
              TableName: table.tableName,
              GlobalSecondaryIndexName: 'GSI1'
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedWriteCapacityUnits',
            dimensionsMap: {
              TableName: table.tableName,
              GlobalSecondaryIndexName: 'GSI1'
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          })
        ]
      }),
      new cloudwatch.GraphWidget({
        title: 'GSI2 Capacity Utilization',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedReadCapacityUnits',
            dimensionsMap: {
              TableName: table.tableName,
              GlobalSecondaryIndexName: 'GSI2'
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedWriteCapacityUnits',
            dimensionsMap: {
              TableName: table.tableName,
              GlobalSecondaryIndexName: 'GSI2'
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          })
        ]
      })
    );

    // Cost efficiency metrics
    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Cost per Item Read',
        width: 6,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/DynamoDB',
            metricName: 'CostPerRead',
            dimensionsMap: {
              TableName: table.tableName
            },
            statistic: 'Average',
            period: cdk.Duration.days(1)
          })
        ]
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Cost per Item Write',
        width: 6,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/DynamoDB',
            metricName: 'CostPerWrite',
            dimensionsMap: {
              TableName: table.tableName
            },
            statistic: 'Average',
            period: cdk.Duration.days(1)
          })
        ]
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Potential Monthly Savings',
        width: 6,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/DynamoDB',
            metricName: 'PotentialMonthlySavings',
            dimensionsMap: {
              TableName: table.tableName
            },
            statistic: 'Maximum',
            period: cdk.Duration.days(1)
          })
        ]
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Capacity Efficiency Score',
        width: 6,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/DynamoDB',
            metricName: 'CapacityEfficiencyScore',
            dimensionsMap: {
              TableName: table.tableName
            },
            statistic: 'Average',
            period: cdk.Duration.hours(1)
          })
        ]
      })
    );

    return dashboard;
  }

  private setupCostAlarms(table: dynamodb.Table, config: EnvironmentConfig, alertTopic: sns.Topic) {
    // High cost alarm
    const costAlarm = new cloudwatch.Alarm(this, 'DynamoDBHighCostAlarm', {
      alarmName: `ApexShare-DynamoDB-HighCost-${table.tableName}-${config.env}`,
      alarmDescription: `High DynamoDB costs for table ${table.tableName}`,
      metric: new cloudwatch.Metric({
        namespace: 'ApexShare/DynamoDB',
        metricName: 'TableCost',
        dimensionsMap: {
          TableName: table.tableName
        },
        statistic: 'Sum',
        period: cdk.Duration.days(1)
      }),
      threshold: config.env === 'prod' ? 10 : 2, // $10 for prod, $2 for others
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    costAlarm.addAlarmAction({
      bind: () => ({ alarmActionArn: alertTopic.topicArn })
    });

    // Throttling alarm
    const throttleAlarm = new cloudwatch.Alarm(this, 'DynamoDBThrottleAlarm', {
      alarmName: `ApexShare-DynamoDB-Throttles-${table.tableName}-${config.env}`,
      alarmDescription: `Throttling detected for DynamoDB table ${table.tableName}`,
      metric: new cloudwatch.MathExpression({
        expression: 'm1 + m2',
        usingMetrics: {
          m1: new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ReadThrottles',
            dimensionsMap: {
              TableName: table.tableName
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          }),
          m2: new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'WriteThrottles',
            dimensionsMap: {
              TableName: table.tableName
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          })
        }
      }),
      threshold: 10,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    throttleAlarm.addAlarmAction({
      bind: () => ({ alarmActionArn: alertTopic.topicArn })
    });

    // Low utilization alarm for provisioned capacity
    const lowUtilizationAlarm = new cloudwatch.Alarm(this, 'DynamoDBLowUtilizationAlarm', {
      alarmName: `ApexShare-DynamoDB-LowUtilization-${table.tableName}-${config.env}`,
      alarmDescription: `Low capacity utilization for DynamoDB table ${table.tableName}`,
      metric: new cloudwatch.Metric({
        namespace: 'ApexShare/DynamoDB',
        metricName: 'CapacityEfficiencyScore',
        dimensionsMap: {
          TableName: table.tableName
        },
        statistic: 'Average',
        period: cdk.Duration.hours(1)
      }),
      threshold: 30, // Below 30% efficiency
      evaluationPeriods: 6, // 6 hours of low utilization
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    lowUtilizationAlarm.addAlarmAction({
      bind: () => ({ alarmActionArn: alertTopic.topicArn })
    });
  }

  private configureTTLOptimization(table: dynamodb.Table, config: EnvironmentConfig) {
    // TTL is already configured in the main table definition
    // Here we add monitoring for TTL effectiveness

    const ttlMonitor = new nodejs.NodejsFunction(this, 'TTLMonitor', {
      functionName: `apexshare-dynamodb-ttl-monitor-${config.env}`,
      entry: 'lambda/dynamodb-ttl-monitor/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        TABLE_NAME: table.tableName,
        ENVIRONMENT: config.env
      }
    });

    ttlMonitor.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:Scan',
          'dynamodb:Query',
          'dynamodb:DescribeTable',
          'cloudwatch:PutMetricData'
        ],
        resources: [table.tableArn, `${table.tableArn}/index/*`]
      })
    );

    // Schedule TTL monitoring daily
    const ttlRule = new events.Rule(this, 'TTLMonitorSchedule', {
      ruleName: `apexshare-dynamodb-ttl-monitor-${config.env}`,
      description: 'Monitor TTL effectiveness for cost optimization',
      schedule: events.Schedule.rate(cdk.Duration.days(1))
    });

    ttlRule.addTarget(new targets.LambdaFunction(ttlMonitor));
  }

  public static calculateOptimalBillingMode(
    readPattern: { avg: number; peak: number; variability: number },
    writePattern: { avg: number; peak: number; variability: number },
    currentCosts: { onDemand: number; provisioned: number }
  ): { recommendedMode: 'ON_DEMAND' | 'PROVISIONED'; reasoning: string[]; estimatedSavings: number } {
    const reasoning: string[] = [];

    // Calculate predictability score (0-100, higher = more predictable)
    const readPredictability = 100 - (readPattern.variability * 100);
    const writePredictability = 100 - (writePattern.variability * 100);
    const overallPredictability = (readPredictability + writePredictability) / 2;

    // Calculate traffic intensity
    const readIntensity = readPattern.avg;
    const writeIntensity = writePattern.avg;
    const totalIntensity = readIntensity + writeIntensity;

    let recommendedMode: 'ON_DEMAND' | 'PROVISIONED' = 'ON_DEMAND';
    let estimatedSavings = 0;

    if (overallPredictability > 70 && totalIntensity > 40) {
      // High predictability and moderate-to-high traffic: Provisioned is likely better
      recommendedMode = 'PROVISIONED';
      estimatedSavings = currentCosts.onDemand - currentCosts.provisioned;
      reasoning.push(`High traffic predictability (${overallPredictability.toFixed(1)}%) with substantial volume`);
      reasoning.push(`Provisioned capacity can provide ${(estimatedSavings/currentCosts.onDemand*100).toFixed(1)}% cost savings`);
    } else if (overallPredictability < 30 || totalIntensity < 10) {
      // Low predictability or low traffic: On-demand is likely better
      recommendedMode = 'ON_DEMAND';
      estimatedSavings = currentCosts.provisioned - currentCosts.onDemand;
      reasoning.push(`Low traffic predictability (${overallPredictability.toFixed(1)}%) or low volume`);
      reasoning.push('On-demand billing eliminates capacity planning overhead');
    } else {
      // Borderline case: Keep current mode or slight preference for on-demand
      recommendedMode = 'ON_DEMAND';
      estimatedSavings = Math.max(0, currentCosts.provisioned - currentCosts.onDemand);
      reasoning.push('Traffic patterns are borderline - on-demand provides operational simplicity');
    }

    if (readPattern.peak > readPattern.avg * 5 || writePattern.peak > writePattern.avg * 5) {
      reasoning.push('High burst traffic detected - consider auto-scaling with provisioned mode');
    }

    return {
      recommendedMode,
      reasoning,
      estimatedSavings
    };
  }
}