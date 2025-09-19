// /lib/constructs/lambda-cost-optimization-construct.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../shared/config';

export interface LambdaCostOptimizationProps {
  functions: lambda.Function[];
  config: EnvironmentConfig;
  alertTopic: sns.Topic;
}

export interface OptimizationRecommendation {
  functionName: string;
  currentMemory: number;
  recommendedMemory: number;
  currentTimeout: number;
  recommendedTimeout: number;
  estimatedMonthlySavings: number;
  reasoning: string[];
}

export class LambdaCostOptimizationConstruct extends Construct {
  public readonly powerTuner: lambda.Function;
  public readonly costAnalyzer: lambda.Function;
  public readonly optimizationDashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: LambdaCostOptimizationProps) {
    super(scope, id);

    // Lambda Power Tuning implementation
    this.powerTuner = this.createPowerTuner(props.config, props.alertTopic);

    // Cost analyzer for Lambda functions
    this.costAnalyzer = this.createCostAnalyzer(props.functions, props.config, props.alertTopic);

    // Create optimization dashboard
    this.optimizationDashboard = this.createOptimizationDashboard(props.functions, props.config);

    // Configure automatic optimization rules
    this.configureOptimizationRules(props.functions, props.config);

    // Set up monitoring and alerting
    this.setupCostMonitoring(props.functions, props.config, props.alertTopic);
  }

  private createPowerTuner(config: EnvironmentConfig, alertTopic: sns.Topic): lambda.Function {
    const powerTuner = new nodejs.NodejsFunction(this, 'PowerTuner', {
      functionName: `apexshare-lambda-power-tuner-${config.env}`,
      entry: 'lambda/lambda-power-tuner/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        ENVIRONMENT: config.env,
        SNS_TOPIC_ARN: alertTopic.topicArn
      }
    });

    // Grant permissions for power tuning
    powerTuner.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'lambda:GetFunction',
          'lambda:UpdateFunctionConfiguration',
          'lambda:InvokeFunction',
          'lambda:GetFunctionConfiguration',
          'lambda:ListFunctions',
          'lambda:ListTags',
          'cloudwatch:GetMetricStatistics',
          'cloudwatch:GetMetricData',
          'cloudwatch:PutMetricData',
          'logs:DescribeLogGroups',
          'logs:DescribeLogStreams',
          'logs:GetLogEvents',
          'sns:Publish'
        ],
        resources: ['*']
      })
    );

    // Schedule power tuning analysis weekly
    const powerTuningRule = new events.Rule(this, 'PowerTuningSchedule', {
      ruleName: `apexshare-power-tuning-${config.env}`,
      description: 'Weekly Lambda power tuning analysis',
      schedule: events.Schedule.rate(cdk.Duration.days(7))
    });

    powerTuningRule.addTarget(new targets.LambdaFunction(powerTuner));

    return powerTuner;
  }

  private createCostAnalyzer(
    functions: lambda.Function[],
    config: EnvironmentConfig,
    alertTopic: sns.Topic
  ): lambda.Function {
    const costAnalyzer = new nodejs.NodejsFunction(this, 'CostAnalyzer', {
      functionName: `apexshare-lambda-cost-analyzer-${config.env}`,
      entry: 'lambda/lambda-cost-analyzer/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      environment: {
        ENVIRONMENT: config.env,
        SNS_TOPIC_ARN: alertTopic.topicArn,
        FUNCTION_NAMES: functions.map(f => f.functionName).join(',')
      }
    });

    // Grant permissions for cost analysis
    costAnalyzer.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'lambda:GetFunction',
          'lambda:GetFunctionConfiguration',
          'lambda:ListFunctions',
          'lambda:GetAccountSettings',
          'cloudwatch:GetMetricStatistics',
          'cloudwatch:GetMetricData',
          'cloudwatch:PutMetricData',
          'ce:GetCostAndUsage',
          'ce:GetDimensionValues',
          'logs:DescribeLogGroups',
          'logs:FilterLogEvents',
          'sns:Publish'
        ],
        resources: ['*']
      })
    );

    // Schedule cost analysis daily
    const costAnalysisRule = new events.Rule(this, 'CostAnalysisSchedule', {
      ruleName: `apexshare-lambda-cost-analysis-${config.env}`,
      description: 'Daily Lambda cost analysis',
      schedule: events.Schedule.rate(cdk.Duration.days(1))
    });

    costAnalysisRule.addTarget(new targets.LambdaFunction(costAnalyzer));

    return costAnalyzer;
  }

  private createOptimizationDashboard(
    functions: lambda.Function[],
    config: EnvironmentConfig
  ): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'LambdaOptimizationDashboard', {
      dashboardName: `ApexShare-Lambda-Cost-Optimization-${config.env}`,
      defaultInterval: cdk.Duration.hours(24)
    });

    // Cost overview widgets
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Cost Trend',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/Lambda',
            metricName: 'TotalCost',
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          })
        ]
      }),
      new cloudwatch.GraphWidget({
        title: 'Cost by Function',
        width: 12,
        height: 6,
        left: functions.map(func =>
          new cloudwatch.Metric({
            namespace: 'ApexShare/Lambda',
            metricName: 'FunctionCost',
            dimensionsMap: {
              FunctionName: func.functionName
            },
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          })
        )
      })
    );

    // Performance vs Cost widgets
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Duration vs Memory Allocation',
        width: 8,
        height: 6,
        left: functions.map(func =>
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Duration',
            dimensionsMap: {
              FunctionName: func.functionName
            },
            statistic: 'Average',
            period: cdk.Duration.hours(1)
          })
        )
      }),
      new cloudwatch.GraphWidget({
        title: 'Memory Utilization',
        width: 8,
        height: 6,
        left: functions.map(func =>
          new cloudwatch.Metric({
            namespace: 'ApexShare/Lambda',
            metricName: 'MemoryUtilization',
            dimensionsMap: {
              FunctionName: func.functionName
            },
            statistic: 'Average',
            period: cdk.Duration.hours(1)
          })
        )
      }),
      new cloudwatch.GraphWidget({
        title: 'Cost Efficiency Score',
        width: 8,
        height: 6,
        left: functions.map(func =>
          new cloudwatch.Metric({
            namespace: 'ApexShare/Lambda',
            metricName: 'CostEfficiencyScore',
            dimensionsMap: {
              FunctionName: func.functionName
            },
            statistic: 'Average',
            period: cdk.Duration.hours(1)
          })
        )
      })
    );

    // Optimization opportunity widgets
    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Potential Monthly Savings',
        width: 6,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/Lambda',
            metricName: 'PotentialMonthlySavings',
            statistic: 'Maximum',
            period: cdk.Duration.days(1)
          })
        ]
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Functions Requiring Optimization',
        width: 6,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/Lambda',
            metricName: 'FunctionsNeedingOptimization',
            statistic: 'Maximum',
            period: cdk.Duration.days(1)
          })
        ]
      })
    );

    // Cold start and concurrency widgets
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Cold Starts by Function',
        width: 12,
        height: 6,
        left: functions.map(func =>
          new cloudwatch.Metric({
            namespace: 'ApexShare/Lambda',
            metricName: 'ColdStarts',
            dimensionsMap: {
              FunctionName: func.functionName
            },
            statistic: 'Sum',
            period: cdk.Duration.hours(1)
          })
        )
      }),
      new cloudwatch.GraphWidget({
        title: 'Concurrent Executions',
        width: 12,
        height: 6,
        left: functions.map(func =>
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'ConcurrentExecutions',
            dimensionsMap: {
              FunctionName: func.functionName
            },
            statistic: 'Maximum',
            period: cdk.Duration.minutes(5)
          })
        )
      })
    );

    return dashboard;
  }

  private configureOptimizationRules(functions: lambda.Function[], config: EnvironmentConfig) {
    // Create optimization rule engine
    const optimizationEngine = new nodejs.NodejsFunction(this, 'OptimizationEngine', {
      functionName: `apexshare-lambda-optimization-engine-${config.env}`,
      entry: 'lambda/lambda-optimization-engine/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      environment: {
        ENVIRONMENT: config.env,
        FUNCTION_NAMES: functions.map(f => f.functionName).join(','),
        AUTO_OPTIMIZE: config.env !== 'prod' ? 'true' : 'false' // Auto-optimize in non-prod
      }
    });

    // Grant permissions for optimization
    optimizationEngine.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'lambda:UpdateFunctionConfiguration',
          'lambda:GetFunction',
          'lambda:GetFunctionConfiguration',
          'cloudwatch:GetMetricStatistics',
          'cloudwatch:PutMetricData'
        ],
        resources: ['*']
      })
    );

    // Schedule optimization checks every 4 hours
    const optimizationRule = new events.Rule(this, 'OptimizationEngineSchedule', {
      ruleName: `apexshare-lambda-optimization-${config.env}`,
      description: 'Automated Lambda optimization checks',
      schedule: events.Schedule.rate(cdk.Duration.hours(4))
    });

    optimizationRule.addTarget(new targets.LambdaFunction(optimizationEngine));
  }

  private setupCostMonitoring(
    functions: lambda.Function[],
    config: EnvironmentConfig,
    alertTopic: sns.Topic
  ) {
    // Create alarms for each function
    functions.forEach(func => {
      // High cost alarm
      const costAlarm = new cloudwatch.Alarm(this, `${func.functionName}HighCost`, {
        alarmName: `ApexShare-Lambda-HighCost-${func.functionName}-${config.env}`,
        alarmDescription: `High cost detected for ${func.functionName}`,
        metric: new cloudwatch.Metric({
          namespace: 'ApexShare/Lambda',
          metricName: 'FunctionCost',
          dimensionsMap: {
            FunctionName: func.functionName
          },
          statistic: 'Sum',
          period: cdk.Duration.days(1)
        }),
        threshold: config.env === 'prod' ? 5 : 1, // $5 for prod, $1 for others
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
      });

      costAlarm.addAlarmAction({
        bind: () => ({ alarmActionArn: alertTopic.topicArn })
      });

      // High duration alarm (potential memory under-allocation)
      const durationAlarm = new cloudwatch.Alarm(this, `${func.functionName}HighDuration`, {
        alarmName: `ApexShare-Lambda-HighDuration-${func.functionName}-${config.env}`,
        alarmDescription: `High duration detected for ${func.functionName} - check memory allocation`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Duration',
          dimensionsMap: {
            FunctionName: func.functionName
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(5)
        }),
        threshold: 10000, // 10 seconds
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
      });

      durationAlarm.addAlarmAction({
        bind: () => ({ alarmActionArn: alertTopic.topicArn })
      });

      // Throttling alarm
      const throttleAlarm = new cloudwatch.Alarm(this, `${func.functionName}Throttles`, {
        alarmName: `ApexShare-Lambda-Throttles-${func.functionName}-${config.env}`,
        alarmDescription: `Throttling detected for ${func.functionName} - consider reserved concurrency`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Throttles',
          dimensionsMap: {
            FunctionName: func.functionName
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5)
        }),
        threshold: 5,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
      });

      throttleAlarm.addAlarmAction({
        bind: () => ({ alarmActionArn: alertTopic.topicArn })
      });
    });

    // Overall Lambda cost budget alarm
    const totalCostAlarm = new cloudwatch.Alarm(this, 'LambdaTotalCostAlarm', {
      alarmName: `ApexShare-Lambda-TotalCost-${config.env}`,
      alarmDescription: 'Total Lambda costs exceeding budget',
      metric: new cloudwatch.Metric({
        namespace: 'ApexShare/Lambda',
        metricName: 'TotalCost',
        statistic: 'Sum',
        period: cdk.Duration.days(1)
      }),
      threshold: config.env === 'prod' ? 15 : 5, // 15% of total budget for Lambda
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    totalCostAlarm.addAlarmAction({
      bind: () => ({ alarmActionArn: alertTopic.topicArn })
    });
  }

  public static getOptimalMemoryConfiguration(
    averageDuration: number,
    memoryUtilization: number,
    currentMemory: number,
    invocationsPerMonth: number
  ): { recommendedMemory: number; estimatedSavings: number; reasoning: string[] } {
    const reasoning: string[] = [];
    let recommendedMemory = currentMemory;
    let estimatedSavings = 0;

    // Calculate current monthly cost
    const gbSeconds = (currentMemory / 1024) * (averageDuration / 1000) * invocationsPerMonth;
    const currentMonthlyCost = gbSeconds * 0.0000166667; // $0.0000166667 per GB-second

    // Memory optimization logic
    if (memoryUtilization < 50 && currentMemory > 128) {
      // Over-allocated memory
      const reductionFactor = Math.max(0.5, memoryUtilization / 100);
      recommendedMemory = Math.max(128, Math.floor(currentMemory * reductionFactor / 64) * 64);
      reasoning.push(`Memory utilization is only ${memoryUtilization}%, reducing from ${currentMemory}MB to ${recommendedMemory}MB`);
    } else if (averageDuration > 5000 && memoryUtilization > 80) {
      // Under-allocated memory causing long duration
      recommendedMemory = Math.min(10240, currentMemory * 2);
      reasoning.push(`High duration (${averageDuration}ms) with high memory utilization (${memoryUtilization}%), increasing memory`);
    } else if (averageDuration < 1000 && memoryUtilization < 30) {
      // Fast function with low memory usage
      recommendedMemory = Math.max(128, Math.floor(currentMemory * 0.75 / 64) * 64);
      reasoning.push(`Fast execution with low memory usage, optimizing for cost`);
    }

    // Calculate estimated savings
    if (recommendedMemory !== currentMemory) {
      const newGbSeconds = (recommendedMemory / 1024) * (averageDuration / 1000) * invocationsPerMonth;
      const newMonthlyCost = newGbSeconds * 0.0000166667;
      estimatedSavings = currentMonthlyCost - newMonthlyCost;

      if (estimatedSavings < 0) {
        reasoning.push(`Estimated additional cost: $${Math.abs(estimatedSavings).toFixed(4)}/month for improved performance`);
      } else {
        reasoning.push(`Estimated savings: $${estimatedSavings.toFixed(4)}/month`);
      }
    }

    return {
      recommendedMemory,
      estimatedSavings,
      reasoning
    };
  }

  public static calculateReservedConcurrencyRecommendations(
    functions: lambda.Function[],
    invocationPatterns: Record<string, { peak: number; average: number; burstFrequency: number }>
  ): Record<string, { recommendedReservedConcurrency: number; reasoning: string[] }> {
    const recommendations: Record<string, { recommendedReservedConcurrency: number; reasoning: string[] }> = {};

    functions.forEach(func => {
      const pattern = invocationPatterns[func.functionName];
      if (!pattern) return;

      const reasoning: string[] = [];
      let recommendedReservedConcurrency = 0;

      // Determine if reserved concurrency is beneficial
      if (pattern.peak > pattern.average * 3 && pattern.burstFrequency > 0.1) {
        // High burst traffic - consider reserved concurrency
        recommendedReservedConcurrency = Math.ceil(pattern.average * 1.5);
        reasoning.push(`High burst traffic detected (peak: ${pattern.peak}, average: ${pattern.average})`);
        reasoning.push(`Recommended reserved concurrency: ${recommendedReservedConcurrency} to handle bursts`);
      } else if (pattern.peak < 10 && pattern.average < 5) {
        // Low traffic - no reserved concurrency needed
        reasoning.push(`Low traffic function (peak: ${pattern.peak}, average: ${pattern.average})`);
        reasoning.push('No reserved concurrency needed - use default scaling');
      } else {
        // Moderate traffic - evaluate based on cost vs performance
        const suggestedReserved = Math.ceil(pattern.average);
        reasoning.push(`Moderate traffic function - consider ${suggestedReserved} reserved concurrency if consistent performance is critical`);
      }

      recommendations[func.functionName] = {
        recommendedReservedConcurrency,
        reasoning
      };
    });

    return recommendations;
  }
}