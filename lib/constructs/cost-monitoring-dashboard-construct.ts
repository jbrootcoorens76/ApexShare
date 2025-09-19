// /lib/constructs/cost-monitoring-dashboard-construct.ts
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../shared/config';

export interface CostMonitoringDashboardProps {
  config: EnvironmentConfig;
  resources: {
    videosBucket: s3.Bucket;
    uploadsTable: dynamodb.Table;
    lambdaFunctions: lambda.Function[];
  };
  budgetThreshold: number;
}

export class CostMonitoringDashboardConstruct extends Construct {
  public readonly executiveDashboard: cloudwatch.Dashboard;
  public readonly operationalDashboard: cloudwatch.Dashboard;
  public readonly forecastingDashboard: cloudwatch.Dashboard;
  public readonly usageAnalyzer: lambda.Function;

  constructor(scope: Construct, id: string, props: CostMonitoringDashboardProps) {
    super(scope, id);

    // Create executive summary dashboard for high-level cost overview
    this.executiveDashboard = this.createExecutiveDashboard(props);

    // Create operational dashboard for detailed monitoring
    this.operationalDashboard = this.createOperationalDashboard(props);

    // Create forecasting dashboard for cost predictions
    this.forecastingDashboard = this.createForecastingDashboard(props);

    // Create usage analyzer for detailed analytics
    this.usageAnalyzer = this.createUsageAnalyzer(props);

    // Create cost efficiency widgets
    this.addCostEfficiencyWidgets(props);
  }

  private createExecutiveDashboard(props: CostMonitoringDashboardProps): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'ExecutiveDashboard', {
      dashboardName: `ApexShare-Executive-Cost-Dashboard-${props.config.env}`,
      defaultInterval: cdk.Duration.days(30)
    });

    // Executive Summary Row 1: Key Financial Metrics
    dashboard.addWidgets(
      // Total Monthly Cost
      new cloudwatch.SingleValueWidget({
        title: 'Total Monthly Cost',
        width: 6,
        height: 6,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/Costs',
            metricName: 'TotalCost',
            statistic: 'Sum',
            period: cdk.Duration.days(30)
          })
        ],
        setPeriodToTimeRange: true,
        sparkline: true
      }),

      // Budget Utilization
      new cloudwatch.SingleValueWidget({
        title: 'Budget Utilization',
        width: 6,
        height: 6,
        metrics: [
          new cloudwatch.MathExpression({
            expression: '(m1 / ' + props.budgetThreshold + ') * 100',
            usingMetrics: {
              m1: new cloudwatch.Metric({
                namespace: 'ApexShare/Costs',
                metricName: 'TotalCost',
                statistic: 'Sum',
                period: cdk.Duration.days(30)
              })
            },
            label: 'Budget Utilization %'
          })
        ],
        setPeriodToTimeRange: true
      }),

      // Cost per Upload
      new cloudwatch.SingleValueWidget({
        title: 'Cost per Upload',
        width: 6,
        height: 6,
        metrics: [
          new cloudwatch.MathExpression({
            expression: 'm1 / m2',
            usingMetrics: {
              m1: new cloudwatch.Metric({
                namespace: 'ApexShare/Costs',
                metricName: 'TotalCost',
                statistic: 'Sum',
                period: cdk.Duration.days(30)
              }),
              m2: new cloudwatch.Metric({
                namespace: 'ApexShare/Usage',
                metricName: 'VideoUploads',
                statistic: 'Sum',
                period: cdk.Duration.days(30)
              })
            },
            label: 'Cost per Upload'
          })
        ],
        setPeriodToTimeRange: true
      }),

      // Month-over-Month Growth
      new cloudwatch.SingleValueWidget({
        title: 'Month-over-Month Cost Change',
        width: 6,
        height: 6,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'MonthOverMonthChange',
            statistic: 'Average',
            period: cdk.Duration.days(1)
          })
        ],
        setPeriodToTimeRange: true,
        sparkline: true
      })
    );

    // Executive Summary Row 2: Service Cost Breakdown
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Monthly Cost Trend by Service',
        width: 24,
        height: 8,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/Costs',
            metricName: 'S3Cost',
            statistic: 'Sum',
            period: cdk.Duration.days(1),
            color: cloudwatch.Color.BLUE
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/Costs',
            metricName: 'LambdaCost',
            statistic: 'Sum',
            period: cdk.Duration.days(1),
            color: cloudwatch.Color.ORANGE
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/Costs',
            metricName: 'DynamoDBCost',
            statistic: 'Sum',
            period: cdk.Duration.days(1),
            color: cloudwatch.Color.GREEN
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/Costs',
            metricName: 'CloudFrontCost',
            statistic: 'Sum',
            period: cdk.Duration.days(1),
            color: cloudwatch.Color.RED
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/Costs',
            metricName: 'APIGatewayCost',
            statistic: 'Sum',
            period: cdk.Duration.days(1),
            color: cloudwatch.Color.PURPLE
          })
        ],
        view: cloudwatch.GraphWidgetView.TIME_SERIES,
        stacked: true,
        region: props.config.env === 'prod' ? 'us-east-1' : cdk.Stack.of(this).region,
        statistic: 'Sum'
      })
    );

    // Executive Summary Row 3: Cost Distribution and Efficiency
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Service Cost Distribution (Current Month)',
        width: 12,
        height: 8,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'S3CostPercentage',
            statistic: 'Average',
            period: cdk.Duration.days(1)
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'LambdaCostPercentage',
            statistic: 'Average',
            period: cdk.Duration.days(1)
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'DynamoDBCostPercentage',
            statistic: 'Average',
            period: cdk.Duration.days(1)
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'CloudFrontCostPercentage',
            statistic: 'Average',
            period: cdk.Duration.days(1)
          })
        ],
        view: cloudwatch.GraphWidgetView.PIE
      }),

      new cloudwatch.GraphWidget({
        title: 'Cost Efficiency Trends',
        width: 12,
        height: 8,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/S3',
            metricName: 'OptimizationScore',
            statistic: 'Average',
            period: cdk.Duration.days(1),
            label: 'S3 Optimization Score'
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/Lambda',
            metricName: 'CostEfficiencyScore',
            statistic: 'Average',
            period: cdk.Duration.days(1),
            label: 'Lambda Efficiency Score'
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/DynamoDB',
            metricName: 'CapacityEfficiencyScore',
            statistic: 'Average',
            period: cdk.Duration.days(1),
            label: 'DynamoDB Efficiency Score'
          })
        ],
        yAxis: {
          left: {
            min: 0,
            max: 100
          }
        }
      })
    );

    // Executive Summary Row 4: Key Performance Indicators
    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Total Potential Savings',
        width: 8,
        height: 4,
        metrics: [
          new cloudwatch.MathExpression({
            expression: 'm1 + m2 + m3',
            usingMetrics: {
              m1: new cloudwatch.Metric({
                namespace: 'ApexShare/S3',
                metricName: 'PotentialMonthlySavings',
                statistic: 'Maximum',
                period: cdk.Duration.days(1)
              }),
              m2: new cloudwatch.Metric({
                namespace: 'ApexShare/Lambda',
                metricName: 'PotentialMonthlySavings',
                statistic: 'Maximum',
                period: cdk.Duration.days(1)
              }),
              m3: new cloudwatch.Metric({
                namespace: 'ApexShare/DynamoDB',
                metricName: 'PotentialMonthlySavings',
                statistic: 'Maximum',
                period: cdk.Duration.days(1)
              })
            },
            label: 'Total Potential Monthly Savings'
          })
        ]
      }),

      new cloudwatch.SingleValueWidget({
        title: 'ROI Score',
        width: 8,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'ROIScore',
            statistic: 'Average',
            period: cdk.Duration.days(1)
          })
        ]
      }),

      new cloudwatch.SingleValueWidget({
        title: 'Cost Optimization Actions',
        width: 8,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'OptimizationActionsRequired',
            statistic: 'Maximum',
            period: cdk.Duration.days(1)
          })
        ]
      })
    );

    return dashboard;
  }

  private createOperationalDashboard(props: CostMonitoringDashboardProps): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'OperationalDashboard', {
      dashboardName: `ApexShare-Operational-Cost-Dashboard-${props.config.env}`,
      defaultInterval: cdk.Duration.hours(24)
    });

    // Operational Row 1: Real-time Cost Monitoring
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Hourly Cost Accumulation',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/Costs',
            metricName: 'TotalCost',
            statistic: 'Sum',
            period: cdk.Duration.hours(1)
          })
        ],
        view: cloudwatch.GraphWidgetView.TIME_SERIES
      }),

      new cloudwatch.GraphWidget({
        title: 'Cost by Function (Last 24h)',
        width: 12,
        height: 6,
        left: props.resources.lambdaFunctions.map(func =>
          new cloudwatch.Metric({
            namespace: 'ApexShare/Lambda',
            metricName: 'FunctionCost',
            dimensionsMap: {
              FunctionName: func.functionName
            },
            statistic: 'Sum',
            period: cdk.Duration.hours(1)
          })
        )
      })
    );

    // Operational Row 2: Usage Metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Storage Usage and Cost',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/S3',
            metricName: 'BucketSizeBytes',
            dimensionsMap: {
              BucketName: props.resources.videosBucket.bucketName,
              StorageType: 'StandardStorage'
            },
            statistic: 'Average',
            period: cdk.Duration.hours(6)
          })
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/S3',
            metricName: 'StorageCost',
            statistic: 'Sum',
            period: cdk.Duration.hours(1)
          })
        ]
      }),

      new cloudwatch.GraphWidget({
        title: 'Request Volume and Cost',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/S3',
            metricName: 'NumberOfObjects',
            dimensionsMap: {
              BucketName: props.resources.videosBucket.bucketName,
              StorageType: 'AllStorageTypes'
            },
            statistic: 'Average',
            period: cdk.Duration.hours(6)
          })
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/S3',
            metricName: 'RequestCost',
            statistic: 'Sum',
            period: cdk.Duration.hours(1)
          })
        ]
      }),

      new cloudwatch.GraphWidget({
        title: 'Database Operations and Cost',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedReadCapacityUnits',
            dimensionsMap: {
              TableName: props.resources.uploadsTable.tableName
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedWriteCapacityUnits',
            dimensionsMap: {
              TableName: props.resources.uploadsTable.tableName
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          })
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/DynamoDB',
            metricName: 'TableCost',
            dimensionsMap: {
              TableName: props.resources.uploadsTable.tableName
            },
            statistic: 'Sum',
            period: cdk.Duration.hours(1)
          })
        ]
      })
    );

    // Operational Row 3: Performance vs Cost Analysis
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration vs Cost',
        width: 12,
        height: 6,
        left: props.resources.lambdaFunctions.map(func =>
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Duration',
            dimensionsMap: {
              FunctionName: func.functionName
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(5)
          })
        ),
        right: props.resources.lambdaFunctions.map(func =>
          new cloudwatch.Metric({
            namespace: 'ApexShare/Lambda',
            metricName: 'FunctionCost',
            dimensionsMap: {
              FunctionName: func.functionName
            },
            statistic: 'Sum',
            period: cdk.Duration.hours(1)
          })
        )
      }),

      new cloudwatch.GraphWidget({
        title: 'Error Rate vs Cost Impact',
        width: 12,
        height: 6,
        left: props.resources.lambdaFunctions.map(func =>
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Errors',
            dimensionsMap: {
              FunctionName: func.functionName
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          })
        ),
        right: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'ErrorCostImpact',
            statistic: 'Sum',
            period: cdk.Duration.hours(1)
          })
        ]
      })
    );

    // Operational Row 4: Anomaly Detection
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Cost Anomalies Detected',
        width: 24,
        height: 6,
        annotations: {
          horizontal: [
            {
              label: 'Budget Threshold',
              value: props.budgetThreshold
            }
          ]
        },
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/Costs',
            metricName: 'TotalCost',
            statistic: 'Sum',
            period: cdk.Duration.hours(1)
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'ExpectedCost',
            statistic: 'Average',
            period: cdk.Duration.hours(1)
          })
        ]
      })
    );

    return dashboard;
  }

  private createForecastingDashboard(props: CostMonitoringDashboardProps): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'ForecastingDashboard', {
      dashboardName: `ApexShare-Cost-Forecasting-Dashboard-${props.config.env}`,
      defaultInterval: cdk.Duration.days(90)
    });

    // Forecasting Row 1: Trend Analysis
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Cost Trend and Projection (90 days)',
        width: 24,
        height: 8,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/Costs',
            metricName: 'TotalCost',
            statistic: 'Sum',
            period: cdk.Duration.days(1),
            label: 'Actual Cost'
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'ProjectedCost',
            statistic: 'Average',
            period: cdk.Duration.days(1),
            label: 'Projected Cost'
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'OptimizedProjectedCost',
            statistic: 'Average',
            period: cdk.Duration.days(1),
            label: 'Optimized Projection'
          })
        ],
        annotations: {
          horizontal: [
            {
              label: 'Monthly Budget',
              value: props.budgetThreshold,
              color: cloudwatch.Color.RED
            }
          ]
        }
      })
    );

    // Forecasting Row 2: Usage Growth Patterns
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Upload Volume Growth',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/Usage',
            metricName: 'VideoUploads',
            statistic: 'Sum',
            period: cdk.Duration.days(1)
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'ProjectedUploads',
            statistic: 'Average',
            period: cdk.Duration.days(1)
          })
        ]
      }),

      new cloudwatch.GraphWidget({
        title: 'Storage Growth Forecast',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/S3',
            metricName: 'BucketSizeBytes',
            dimensionsMap: {
              BucketName: props.resources.videosBucket.bucketName,
              StorageType: 'StandardStorage'
            },
            statistic: 'Average',
            period: cdk.Duration.days(1)
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'ProjectedStorageSize',
            statistic: 'Average',
            period: cdk.Duration.days(1)
          })
        ]
      })
    );

    // Forecasting Row 3: Seasonal Patterns
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Seasonal Usage Patterns',
        width: 24,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'SeasonalityIndex',
            statistic: 'Average',
            period: cdk.Duration.days(7)
          }),
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'WeeklyTrend',
            statistic: 'Average',
            period: cdk.Duration.days(1)
          })
        ]
      })
    );

    // Forecasting Row 4: Budget Planning
    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Projected Monthly Cost',
        width: 6,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'ProjectedMonthlyCost',
            statistic: 'Maximum',
            period: cdk.Duration.days(1)
          })
        ]
      }),

      new cloudwatch.SingleValueWidget({
        title: 'Budget Variance Forecast',
        width: 6,
        height: 4,
        metrics: [
          new cloudwatch.MathExpression({
            expression: '((m1 - ' + props.budgetThreshold + ') / ' + props.budgetThreshold + ') * 100',
            usingMetrics: {
              m1: new cloudwatch.Metric({
                namespace: 'ApexShare/CostAnalytics',
                metricName: 'ProjectedMonthlyCost',
                statistic: 'Maximum',
                period: cdk.Duration.days(1)
              })
            },
            label: 'Budget Variance %'
          })
        ]
      }),

      new cloudwatch.SingleValueWidget({
        title: 'Cost Per User (Projected)',
        width: 6,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'ProjectedCostPerUser',
            statistic: 'Average',
            period: cdk.Duration.days(1)
          })
        ]
      }),

      new cloudwatch.SingleValueWidget({
        title: 'Break-even Point (Users)',
        width: 6,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'ApexShare/CostAnalytics',
            metricName: 'BreakEvenUserCount',
            statistic: 'Average',
            period: cdk.Duration.days(1)
          })
        ]
      })
    );

    return dashboard;
  }

  private createUsageAnalyzer(props: CostMonitoringDashboardProps): lambda.Function {
    const usageAnalyzer = new nodejs.NodejsFunction(this, 'UsageAnalyzer', {
      functionName: `apexshare-usage-analyzer-${props.config.env}`,
      entry: 'lambda/usage-analyzer/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        VIDEOS_BUCKET: props.resources.videosBucket.bucketName,
        UPLOADS_TABLE: props.resources.uploadsTable.tableName,
        ENVIRONMENT: props.config.env,
        BUDGET_THRESHOLD: props.budgetThreshold.toString()
      }
    });

    // Grant permissions for comprehensive analysis
    usageAnalyzer.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:ListBucket',
          's3:GetBucketLocation',
          's3:GetBucketMetricsConfiguration',
          'dynamodb:Scan',
          'dynamodb:Query',
          'dynamodb:DescribeTable',
          'lambda:GetFunction',
          'lambda:ListFunctions',
          'cloudwatch:GetMetricStatistics',
          'cloudwatch:GetMetricData',
          'cloudwatch:PutMetricData',
          'ce:GetCostAndUsage',
          'ce:GetDimensionValues',
          'ce:GetUsageReport'
        ],
        resources: ['*']
      })
    );

    // Schedule comprehensive usage analysis daily
    const analysisRule = new events.Rule(this, 'UsageAnalysisSchedule', {
      ruleName: `apexshare-usage-analysis-${props.config.env}`,
      description: 'Daily comprehensive usage and cost analysis',
      schedule: events.Schedule.rate(cdk.Duration.hours(6))
    });

    analysisRule.addTarget(new targets.LambdaFunction(usageAnalyzer));

    return usageAnalyzer;
  }

  private addCostEfficiencyWidgets(props: CostMonitoringDashboardProps) {
    // Add additional specialized widgets to the operational dashboard
    const costPerMetrics = new cloudwatch.GraphWidget({
      title: 'Unit Cost Metrics',
      width: 24,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'ApexShare/CostAnalytics',
          metricName: 'CostPerUpload',
          statistic: 'Average',
          period: cdk.Duration.days(1),
          label: 'Cost per Upload'
        }),
        new cloudwatch.Metric({
          namespace: 'ApexShare/CostAnalytics',
          metricName: 'CostPerDownload',
          statistic: 'Average',
          period: cdk.Duration.days(1),
          label: 'Cost per Download'
        }),
        new cloudwatch.Metric({
          namespace: 'ApexShare/CostAnalytics',
          metricName: 'CostPerGBStored',
          statistic: 'Average',
          period: cdk.Duration.days(1),
          label: 'Cost per GB Stored'
        }),
        new cloudwatch.Metric({
          namespace: 'ApexShare/CostAnalytics',
          metricName: 'CostPerGBTransferred',
          statistic: 'Average',
          period: cdk.Duration.days(1),
          label: 'Cost per GB Transferred'
        })
      ]
    });

    this.operationalDashboard.addWidgets(costPerMetrics);

    // Add optimization opportunity tracking
    const optimizationTracking = new cloudwatch.GraphWidget({
      title: 'Optimization Opportunities Tracking',
      width: 24,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'ApexShare/S3',
          metricName: 'PotentialMonthlySavings',
          statistic: 'Maximum',
          period: cdk.Duration.days(1),
          label: 'S3 Optimization Savings'
        }),
        new cloudwatch.Metric({
          namespace: 'ApexShare/Lambda',
          metricName: 'PotentialMonthlySavings',
          statistic: 'Maximum',
          period: cdk.Duration.days(1),
          label: 'Lambda Optimization Savings'
        }),
        new cloudwatch.Metric({
          namespace: 'ApexShare/DynamoDB',
          metricName: 'PotentialMonthlySavings',
          statistic: 'Maximum',
          period: cdk.Duration.days(1),
          label: 'DynamoDB Optimization Savings'
        })
      ]
    });

    this.operationalDashboard.addWidgets(optimizationTracking);
  }

  public addCustomMetricWidget(
    dashboard: cloudwatch.Dashboard,
    title: string,
    metrics: cloudwatch.IMetric[],
    width: number = 12,
    height: number = 6
  ): void {
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title,
        width,
        height,
        left: metrics
      })
    );
  }

  public createCostAlerts(
    alertThresholds: {
      dailyCost: number;
      weeklyCost: number;
      monthlyCost: number;
      budgetUtilization: number;
    }
  ): cloudwatch.Alarm[] {
    const alarms: cloudwatch.Alarm[] = [];

    // Daily cost alarm
    alarms.push(
      new cloudwatch.Alarm(this, 'DailyCostAlarm', {
        alarmName: `ApexShare-DailyCost-${props.config.env}`,
        alarmDescription: 'Daily cost exceeds threshold',
        metric: new cloudwatch.Metric({
          namespace: 'ApexShare/Costs',
          metricName: 'TotalCost',
          statistic: 'Sum',
          period: cdk.Duration.days(1)
        }),
        threshold: alertThresholds.dailyCost,
        evaluationPeriods: 1
      })
    );

    // Budget utilization alarm
    alarms.push(
      new cloudwatch.Alarm(this, 'BudgetUtilizationAlarm', {
        alarmName: `ApexShare-BudgetUtilization-${props.config.env}`,
        alarmDescription: 'Budget utilization exceeds threshold',
        metric: new cloudwatch.MathExpression({
          expression: '(m1 / ' + props.budgetThreshold + ') * 100',
          usingMetrics: {
            m1: new cloudwatch.Metric({
              namespace: 'ApexShare/CostAnalytics',
              metricName: 'ProjectedMonthlyCost',
              statistic: 'Maximum',
              period: cdk.Duration.days(1)
            })
          }
        }),
        threshold: alertThresholds.budgetUtilization,
        evaluationPeriods: 1
      })
    );

    return alarms;
  }
}