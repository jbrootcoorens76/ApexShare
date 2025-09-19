// /lib/constructs/automated-cost-control-construct.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as sfnTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../shared/config';

export interface AutomatedCostControlProps {
  config: EnvironmentConfig;
  alertTopic: sns.Topic;
  budgetThreshold: number;
  resources: {
    lambdaFunctions: lambda.Function[];
    s3BucketName: string;
    dynamoTableName: string;
  };
}

export interface CostControlAction {
  action: string;
  target: string;
  parameters: Record<string, any>;
  estimatedSavings: number;
  risk: 'Low' | 'Medium' | 'High';
  reversible: boolean;
}

export class AutomatedCostControlConstruct extends Construct {
  public readonly costAnomalyDetector: lambda.Function;
  public readonly emergencyShutdownWorkflow: stepfunctions.StateMachine;
  public readonly costOptimizationEngine: lambda.Function;
  public readonly resourceThrottler: lambda.Function;

  constructor(scope: Construct, id: string, props: AutomatedCostControlProps) {
    super(scope, id);

    // Create cost anomaly detection system
    this.costAnomalyDetector = this.createCostAnomalyDetector(props);

    // Create emergency shutdown workflow
    this.emergencyShutdownWorkflow = this.createEmergencyShutdownWorkflow(props);

    // Create automated cost optimization engine
    this.costOptimizationEngine = this.createCostOptimizationEngine(props);

    // Create resource throttling system
    this.resourceThrottler = this.createResourceThrottler(props);

    // Set up automated cost control rules
    this.setupCostControlRules(props);

    // Create cost breach response system
    this.createCostBreachResponseSystem(props);
  }

  private createCostAnomalyDetector(props: AutomatedCostControlProps): lambda.Function {
    const anomalyDetector = new nodejs.NodejsFunction(this, 'CostAnomalyDetector', {
      functionName: `apexshare-cost-anomaly-detector-${props.config.env}`,
      entry: 'lambda/cost-anomaly-detector-v2/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        ENVIRONMENT: props.config.env,
        SNS_TOPIC_ARN: props.alertTopic.topicArn,
        BUDGET_THRESHOLD: props.budgetThreshold.toString(),
        EMERGENCY_SHUTDOWN_STATE_MACHINE_ARN: '', // Will be set after creation
        LAMBDA_FUNCTIONS: JSON.stringify(props.resources.lambdaFunctions.map(f => f.functionName)),
        S3_BUCKET: props.resources.s3BucketName,
        DYNAMODB_TABLE: props.resources.dynamoTableName
      }
    });

    // Grant comprehensive cost monitoring and control permissions
    anomalyDetector.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          // Cost and billing
          'ce:GetCostAndUsage',
          'ce:GetDimensionValues',
          'ce:GetAnomalyDetectors',
          'ce:GetAnomalyMonitors',
          'ce:GetCostCategories',
          'budgets:ViewBudget',
          'budgets:DescribeBudgets',

          // Resource monitoring
          'cloudwatch:GetMetricStatistics',
          'cloudwatch:GetMetricData',
          'cloudwatch:PutMetricData',
          'cloudwatch:PutAnomalyDetector',

          // Resource control
          'lambda:UpdateFunctionConfiguration',
          'lambda:PutConcurrency',
          'lambda:GetFunction',
          'dynamodb:DescribeTable',
          'dynamodb:UpdateTable',
          's3:GetBucketPolicyStatus',
          's3:PutBucketPolicy',

          // Step Functions
          'states:StartExecution',
          'states:DescribeExecution',

          // Notifications
          'sns:Publish',

          // Auto Scaling
          'application-autoscaling:RegisterScalableTarget',
          'application-autoscaling:DeregisterScalableTarget',
          'application-autoscaling:PutScalingPolicy',
          'application-autoscaling:DeleteScalingPolicy'
        ],
        resources: ['*']
      })
    );

    // Schedule anomaly detection every 15 minutes
    const anomalyDetectionRule = new events.Rule(this, 'CostAnomalyDetectionSchedule', {
      ruleName: `apexshare-cost-anomaly-detection-${props.config.env}`,
      description: 'Real-time cost anomaly detection with automated response',
      schedule: events.Schedule.rate(cdk.Duration.minutes(15))
    });

    anomalyDetectionRule.addTarget(new targets.LambdaFunction(anomalyDetector));

    return anomalyDetector;
  }

  private createEmergencyShutdownWorkflow(props: AutomatedCostControlProps): stepfunctions.StateMachine {
    // Define emergency shutdown steps
    const validateEmergency = new sfnTasks.LambdaInvoke(this, 'ValidateEmergency', {
      lambdaFunction: new nodejs.NodejsFunction(this, 'EmergencyValidator', {
        functionName: `apexshare-emergency-validator-${props.config.env}`,
        entry: 'lambda/emergency-validator/src/index.ts',
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.minutes(5),
        memorySize: 256,
        environment: {
          ENVIRONMENT: props.config.env,
          BUDGET_THRESHOLD: props.budgetThreshold.toString()
        }
      }),
      outputPath: '$.Payload'
    });

    const notifyStakeholders = new sfnTasks.SnsPublish(this, 'NotifyStakeholders', {
      topic: props.alertTopic,
      subject: stepfunctions.JsonPath.stringAt('$.notificationSubject'),
      message: stepfunctions.JsonPath.stringAt('$.notificationMessage')
    });

    const throttleLambdas = new sfnTasks.LambdaInvoke(this, 'ThrottleLambdas', {
      lambdaFunction: new nodejs.NodejsFunction(this, 'LambdaThrottler', {
        functionName: `apexshare-lambda-throttler-${props.config.env}`,
        entry: 'lambda/lambda-throttler/src/index.ts',
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.minutes(5),
        memorySize: 256,
        environment: {
          ENVIRONMENT: props.config.env,
          LAMBDA_FUNCTIONS: JSON.stringify(props.resources.lambdaFunctions.map(f => f.functionName))
        }
      }),
      outputPath: '$.Payload'
    });

    const enableS3CostControls = new sfnTasks.LambdaInvoke(this, 'EnableS3CostControls', {
      lambdaFunction: new nodejs.NodejsFunction(this, 'S3CostController', {
        functionName: `apexshare-s3-cost-controller-${props.config.env}`,
        entry: 'lambda/s3-cost-controller/src/index.ts',
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.minutes(5),
        memorySize: 256,
        environment: {
          ENVIRONMENT: props.config.env,
          S3_BUCKET: props.resources.s3BucketName
        }
      }),
      outputPath: '$.Payload'
    });

    const adjustDynamoDBCapacity = new sfnTasks.LambdaInvoke(this, 'AdjustDynamoDBCapacity', {
      lambdaFunction: new nodejs.NodejsFunction(this, 'DynamoDBCapacityController', {
        functionName: `apexshare-dynamodb-capacity-controller-${props.config.env}`,
        entry: 'lambda/dynamodb-capacity-controller/src/index.ts',
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.minutes(5),
        memorySize: 256,
        environment: {
          ENVIRONMENT: props.config.env,
          DYNAMODB_TABLE: props.resources.dynamoTableName
        }
      }),
      outputPath: '$.Payload'
    });

    // Create parallel execution for resource controls
    const parallelControls = new stepfunctions.Parallel(this, 'ParallelCostControls')
      .branch(throttleLambdas)
      .branch(enableS3CostControls)
      .branch(adjustDynamoDBCapacity);

    const generateReport = new sfnTasks.LambdaInvoke(this, 'GenerateReport', {
      lambdaFunction: new nodejs.NodejsFunction(this, 'EmergencyReportGenerator', {
        functionName: `apexshare-emergency-report-generator-${props.config.env}`,
        entry: 'lambda/emergency-report-generator/src/index.ts',
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.minutes(5),
        memorySize: 512,
        environment: {
          ENVIRONMENT: props.config.env,
          SNS_TOPIC_ARN: props.alertTopic.topicArn
        }
      }),
      outputPath: '$.Payload'
    });

    // Define workflow
    const definition = validateEmergency
      .next(
        new stepfunctions.Choice(this, 'ShouldTakeAction')
          .when(
            stepfunctions.Condition.booleanEquals('$.emergencyConfirmed', true),
            notifyStakeholders
              .next(parallelControls)
              .next(generateReport)
          )
          .otherwise(
            new stepfunctions.Pass(this, 'NoActionRequired', {
              result: stepfunctions.Result.fromObject({
                status: 'No emergency action required'
              })
            })
          )
      );

    const stateMachine = new stepfunctions.StateMachine(this, 'EmergencyShutdownWorkflow', {
      stateMachineName: `apexshare-emergency-shutdown-${props.config.env}`,
      definition,
      timeout: cdk.Duration.minutes(30)
    });

    // Grant permissions to all Lambda functions in the workflow
    [validateEmergency, throttleLambdas, enableS3CostControls, adjustDynamoDBCapacity, generateReport]
      .forEach(task => {
        if (task instanceof sfnTasks.LambdaInvoke) {
          task.lambdaFunction.addToRolePolicy(
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'lambda:UpdateFunctionConfiguration',
                'lambda:PutConcurrency',
                'lambda:GetFunction',
                's3:PutBucketPolicy',
                's3:GetBucketPolicy',
                'dynamodb:UpdateTable',
                'dynamodb:DescribeTable',
                'sns:Publish',
                'ce:GetCostAndUsage',
                'cloudwatch:PutMetricData'
              ],
              resources: ['*']
            })
          );
        }
      });

    return stateMachine;
  }

  private createCostOptimizationEngine(props: AutomatedCostControlProps): lambda.Function {
    const optimizationEngine = new nodejs.NodejsFunction(this, 'CostOptimizationEngine', {
      functionName: `apexshare-cost-optimization-engine-${props.config.env}`,
      entry: 'lambda/cost-optimization-engine/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        ENVIRONMENT: props.config.env,
        SNS_TOPIC_ARN: props.alertTopic.topicArn,
        BUDGET_THRESHOLD: props.budgetThreshold.toString(),
        AUTO_OPTIMIZE: props.config.env !== 'prod' ? 'true' : 'false',
        LAMBDA_FUNCTIONS: JSON.stringify(props.resources.lambdaFunctions.map(f => f.functionName)),
        S3_BUCKET: props.resources.s3BucketName,
        DYNAMODB_TABLE: props.resources.dynamoTableName
      }
    });

    optimizationEngine.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          // Cost analysis
          'ce:GetCostAndUsage',
          'ce:GetRightsizingRecommendation',
          'ce:GetReservationRecommendations',
          'ce:GetUsageReport',

          // Resource optimization
          'lambda:UpdateFunctionConfiguration',
          'lambda:GetFunction',
          'lambda:PutConcurrency',
          'dynamodb:UpdateTable',
          'dynamodb:DescribeTable',
          's3:PutBucketLifecycleConfiguration',
          's3:GetBucketLifecycleConfiguration',
          's3:PutIntelligentTieringConfiguration',

          // Auto Scaling
          'application-autoscaling:PutScalingPolicy',
          'application-autoscaling:RegisterScalableTarget',
          'application-autoscaling:DescribeScalingPolicies',

          // Monitoring
          'cloudwatch:GetMetricStatistics',
          'cloudwatch:PutMetricData',

          // Notifications
          'sns:Publish'
        ],
        resources: ['*']
      })
    );

    // Schedule optimization engine to run every 6 hours
    const optimizationRule = new events.Rule(this, 'CostOptimizationSchedule', {
      ruleName: `apexshare-cost-optimization-${props.config.env}`,
      description: 'Automated cost optimization and resource right-sizing',
      schedule: events.Schedule.rate(cdk.Duration.hours(6))
    });

    optimizationRule.addTarget(new targets.LambdaFunction(optimizationEngine));

    return optimizationEngine;
  }

  private createResourceThrottler(props: AutomatedCostControlProps): lambda.Function {
    const resourceThrottler = new nodejs.NodejsFunction(this, 'ResourceThrottler', {
      functionName: `apexshare-resource-throttler-${props.config.env}`,
      entry: 'lambda/resource-throttler/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      environment: {
        ENVIRONMENT: props.config.env,
        SNS_TOPIC_ARN: props.alertTopic.topicArn,
        LAMBDA_FUNCTIONS: JSON.stringify(props.resources.lambdaFunctions.map(f => f.functionName))
      }
    });

    resourceThrottler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'lambda:PutConcurrency',
          'lambda:GetFunction',
          'lambda:UpdateFunctionConfiguration',
          'dynamodb:UpdateTable',
          'dynamodb:DescribeTable',
          'apigateway:PUT',
          'apigateway:GET',
          'cloudwatch:PutMetricData',
          'sns:Publish'
        ],
        resources: ['*']
      })
    );

    return resourceThrottler;
  }

  private setupCostControlRules(props: AutomatedCostControlProps): void {
    // Create CloudWatch alarms for various cost thresholds

    // Daily cost alarm (50% of monthly budget)
    const dailyCostAlarm = new cloudwatch.Alarm(this, 'DailyCostAlarm', {
      alarmName: `ApexShare-DailyCost-${props.config.env}`,
      alarmDescription: 'Daily cost exceeds safe threshold',
      metric: new cloudwatch.Metric({
        namespace: 'ApexShare/Costs',
        metricName: 'TotalCost',
        statistic: 'Sum',
        period: cdk.Duration.days(1)
      }),
      threshold: props.budgetThreshold * 0.5 / 30, // 50% of monthly budget / 30 days
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    // Emergency cost alarm (80% of monthly budget)
    const emergencyCostAlarm = new cloudwatch.Alarm(this, 'EmergencyCostAlarm', {
      alarmName: `ApexShare-EmergencyCost-${props.config.env}`,
      alarmDescription: 'Emergency cost threshold reached - automated controls activated',
      metric: new cloudwatch.Metric({
        namespace: 'ApexShare/CostAnalytics',
        metricName: 'ProjectedMonthlyCost',
        statistic: 'Maximum',
        period: cdk.Duration.hours(1)
      }),
      threshold: props.budgetThreshold * 0.8,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    // Cost growth rate alarm
    const costGrowthAlarm = new cloudwatch.Alarm(this, 'CostGrowthAlarm', {
      alarmName: `ApexShare-CostGrowth-${props.config.env}`,
      alarmDescription: 'Unusual cost growth rate detected',
      metric: new cloudwatch.Metric({
        namespace: 'ApexShare/CostAnalytics',
        metricName: 'CostGrowthRate',
        statistic: 'Average',
        period: cdk.Duration.hours(1)
      }),
      threshold: 100, // 100% growth rate
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    // Add alarm actions
    const costControlAction = new cdk.CfnOutput(this, 'CostControlActionArn', {
      value: props.alertTopic.topicArn,
      description: 'SNS Topic for cost control notifications'
    });

    // For production, trigger emergency shutdown workflow
    if (props.config.env === 'prod') {
      emergencyCostAlarm.addAlarmAction({
        bind: () => ({
          alarmActionArn: `arn:aws:sns:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:trigger-emergency-shutdown`
        })
      });
    }

    // Add notification actions for all alarms
    [dailyCostAlarm, emergencyCostAlarm, costGrowthAlarm].forEach(alarm => {
      alarm.addAlarmAction({
        bind: () => ({ alarmActionArn: props.alertTopic.topicArn })
      });
    });
  }

  private createCostBreachResponseSystem(props: AutomatedCostControlProps): void {
    // Create cost breach responder
    const costBreachResponder = new nodejs.NodejsFunction(this, 'CostBreachResponder', {
      functionName: `apexshare-cost-breach-responder-${props.config.env}`,
      entry: 'lambda/cost-breach-responder/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      environment: {
        ENVIRONMENT: props.config.env,
        SNS_TOPIC_ARN: props.alertTopic.topicArn,
        EMERGENCY_WORKFLOW_ARN: this.emergencyShutdownWorkflow.stateMachineArn,
        BUDGET_THRESHOLD: props.budgetThreshold.toString(),
        OPTIMIZATION_ENGINE_ARN: this.costOptimizationEngine.functionArn,
        RESOURCE_THROTTLER_ARN: this.resourceThrottler.functionArn
      }
    });

    costBreachResponder.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'states:StartExecution',
          'lambda:InvokeFunction',
          'sns:Publish',
          'ce:GetCostAndUsage',
          'cloudwatch:PutMetricData'
        ],
        resources: [
          this.emergencyShutdownWorkflow.stateMachineArn,
          this.costOptimizationEngine.functionArn,
          this.resourceThrottler.functionArn,
          props.alertTopic.topicArn
        ]
      })
    );

    // Create EventBridge rule to trigger on CloudWatch alarms
    const costBreachRule = new events.Rule(this, 'CostBreachRule', {
      ruleName: `apexshare-cost-breach-response-${props.config.env}`,
      description: 'Responds to cost breach CloudWatch alarms',
      eventPattern: {
        source: ['aws.cloudwatch'],
        detailType: ['CloudWatch Alarm State Change'],
        detail: {
          state: {
            value: ['ALARM']
          },
          alarmName: [
            { prefix: 'ApexShare-' }
          ]
        }
      }
    });

    costBreachRule.addTarget(new targets.LambdaFunction(costBreachResponder));
  }

  public createCostControlPolicy(): iam.PolicyDocument {
    return new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'lambda:PutConcurrency',
            'lambda:UpdateFunctionConfiguration',
            'dynamodb:UpdateTable',
            's3:PutBucketPolicy',
            'application-autoscaling:*',
            'cloudwatch:PutAnomalyDetector'
          ],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'aws:RequestedRegion': cdk.Stack.of(this).region
            }
          }
        })
      ]
    });
  }

  public getCostControlActions(): CostControlAction[] {
    return [
      {
        action: 'Reduce Lambda Memory',
        target: 'All Lambda Functions',
        parameters: { memoryReduction: 0.5 },
        estimatedSavings: 30,
        risk: 'Medium',
        reversible: true
      },
      {
        action: 'Enable Lambda Concurrency Limits',
        target: 'High-Traffic Functions',
        parameters: { concurrencyLimit: 10 },
        estimatedSavings: 25,
        risk: 'High',
        reversible: true
      },
      {
        action: 'Switch DynamoDB to On-Demand',
        target: 'DynamoDB Tables',
        parameters: { billingMode: 'ON_DEMAND' },
        estimatedSavings: 40,
        risk: 'Low',
        reversible: true
      },
      {
        action: 'Accelerate S3 Lifecycle Transitions',
        target: 'S3 Storage',
        parameters: { transitionDays: 1 },
        estimatedSavings: 50,
        risk: 'Medium',
        reversible: false
      },
      {
        action: 'Disable Non-Essential Features',
        target: 'All Services',
        parameters: { features: ['detailed-monitoring', 'enhanced-logging'] },
        estimatedSavings: 15,
        risk: 'Low',
        reversible: true
      }
    ];
  }
}