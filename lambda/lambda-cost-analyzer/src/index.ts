// /lambda/lambda-cost-analyzer/src/index.ts
import { ScheduledEvent } from 'aws-lambda';
import {
  LambdaClient,
  GetFunctionCommand,
  ListFunctionsCommand,
  GetAccountSettingsCommand
} from '@aws-sdk/client-lambda';
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  PutMetricDataCommand,
  MetricDatum
} from '@aws-sdk/client-cloudwatch';
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
  DescribeLogGroupsCommand
} from '@aws-sdk/client-cloudwatch-logs';
import {
  SNSClient,
  PublishCommand
} from '@aws-sdk/client-sns';

interface FunctionMetrics {
  functionName: string;
  memorySize: number;
  timeout: number;
  invocations: number;
  duration: number;
  errors: number;
  throttles: number;
  concurrentExecutions: number;
  memoryUtilization: number;
  cost: number;
  coldStarts: number;
}

interface OptimizationRecommendation {
  functionName: string;
  currentMemory: number;
  recommendedMemory: number;
  currentTimeout: number;
  recommendedTimeout: number;
  estimatedMonthlySavings: number;
  reasoning: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export const handler = async (event: ScheduledEvent): Promise<void> => {
  const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });
  const cwClient = new CloudWatchClient({ region: process.env.AWS_REGION });
  const logsClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION });
  const snsClient = new SNSClient({ region: process.env.AWS_REGION });

  const environment = process.env.ENVIRONMENT!;
  const snsTopicArn = process.env.SNS_TOPIC_ARN!;
  const functionNames = process.env.FUNCTION_NAMES?.split(',') || [];

  try {
    console.log('Starting Lambda cost analysis');

    // Get function configurations and metrics
    const functionMetrics = await analyzeFunctions(lambdaClient, cwClient, logsClient, functionNames);

    // Generate optimization recommendations
    const recommendations = await generateOptimizationRecommendations(functionMetrics);

    // Publish metrics to CloudWatch
    await publishMetrics(cwClient, functionMetrics, recommendations, environment);

    // Send recommendations if any high-priority ones exist
    const highPriorityRecommendations = recommendations.filter(r => r.priority === 'HIGH');
    if (highPriorityRecommendations.length > 0) {
      await sendRecommendations(snsClient, snsTopicArn, highPriorityRecommendations, environment);
    }

    console.log(`Lambda cost analysis completed. Generated ${recommendations.length} recommendations.`);

  } catch (error) {
    console.error('Error in Lambda cost analysis:', error);
    throw error;
  }
};

async function analyzeFunctions(
  lambdaClient: LambdaClient,
  cwClient: CloudWatchClient,
  logsClient: CloudWatchLogsClient,
  functionNames: string[]
): Promise<FunctionMetrics[]> {
  const metrics: FunctionMetrics[] = [];

  for (const functionName of functionNames) {
    try {
      // Get function configuration
      const functionConfig = await lambdaClient.send(
        new GetFunctionCommand({ FunctionName: functionName })
      );

      if (!functionConfig.Configuration) {
        console.warn(`No configuration found for function: ${functionName}`);
        continue;
      }

      const config = functionConfig.Configuration;

      // Get CloudWatch metrics for the last 24 hours
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

      // Get invocation count
      const invocations = await getMetricValue(
        cwClient,
        'AWS/Lambda',
        'Invocations',
        'Sum',
        functionName,
        startTime,
        endTime
      );

      // Get average duration
      const duration = await getMetricValue(
        cwClient,
        'AWS/Lambda',
        'Duration',
        'Average',
        functionName,
        startTime,
        endTime
      );

      // Get error count
      const errors = await getMetricValue(
        cwClient,
        'AWS/Lambda',
        'Errors',
        'Sum',
        functionName,
        startTime,
        endTime
      );

      // Get throttle count
      const throttles = await getMetricValue(
        cwClient,
        'AWS/Lambda',
        'Throttles',
        'Sum',
        functionName,
        startTime,
        endTime
      );

      // Get concurrent executions
      const concurrentExecutions = await getMetricValue(
        cwClient,
        'AWS/Lambda',
        'ConcurrentExecutions',
        'Maximum',
        functionName,
        startTime,
        endTime
      );

      // Get memory utilization from logs
      const memoryUtilization = await getMemoryUtilizationFromLogs(
        logsClient,
        functionName,
        startTime,
        endTime
      );

      // Calculate cold starts from logs
      const coldStarts = await getColdStartsFromLogs(
        logsClient,
        functionName,
        startTime,
        endTime
      );

      // Calculate cost
      const cost = calculateLambdaCost(
        config.MemorySize || 128,
        duration,
        invocations
      );

      metrics.push({
        functionName,
        memorySize: config.MemorySize || 128,
        timeout: config.Timeout || 3,
        invocations,
        duration,
        errors,
        throttles,
        concurrentExecutions,
        memoryUtilization,
        cost,
        coldStarts
      });

    } catch (error) {
      console.error(`Error analyzing function ${functionName}:`, error);
    }
  }

  return metrics;
}

async function getMetricValue(
  cwClient: CloudWatchClient,
  namespace: string,
  metricName: string,
  statistic: string,
  functionName: string,
  startTime: Date,
  endTime: Date
): Promise<number> {
  try {
    const params = {
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: [
        {
          Name: 'FunctionName',
          Value: functionName
        }
      ],
      StartTime: startTime,
      EndTime: endTime,
      Period: 3600, // 1 hour
      Statistics: [statistic]
    };

    const response = await cwClient.send(new GetMetricStatisticsCommand(params));

    if (response.Datapoints && response.Datapoints.length > 0) {
      const values = response.Datapoints
        .map(dp => {
          switch (statistic) {
            case 'Sum': return dp.Sum || 0;
            case 'Average': return dp.Average || 0;
            case 'Maximum': return dp.Maximum || 0;
            case 'Minimum': return dp.Minimum || 0;
            default: return dp.Average || 0;
          }
        })
        .filter(v => v > 0);

      if (values.length > 0) {
        return statistic === 'Sum'
          ? values.reduce((sum, val) => sum + val, 0)
          : values.reduce((sum, val) => sum + val, 0) / values.length;
      }
    }

    return 0;
  } catch (error) {
    console.error(`Error getting metric ${metricName} for ${functionName}:`, error);
    return 0;
  }
}

async function getMemoryUtilizationFromLogs(
  logsClient: CloudWatchLogsClient,
  functionName: string,
  startTime: Date,
  endTime: Date
): Promise<number> {
  try {
    const logGroupName = `/aws/lambda/${functionName}`;

    const response = await logsClient.send(new FilterLogEventsCommand({
      logGroupName,
      startTime: startTime.getTime(),
      endTime: endTime.getTime(),
      filterPattern: 'REPORT',
      limit: 100
    }));

    if (response.events && response.events.length > 0) {
      const memoryUtilizations: number[] = [];

      for (const event of response.events) {
        if (event.message) {
          // Parse REPORT line to extract memory usage
          // Example: REPORT RequestId: ... Duration: 1000.00 ms Billed Duration: 1000 ms Memory Size: 512 MB Max Memory Used: 256 MB
          const memoryMatch = event.message.match(/Max Memory Used: (\d+) MB.*Memory Size: (\d+) MB/);
          if (memoryMatch) {
            const usedMemory = parseInt(memoryMatch[1]);
            const allocatedMemory = parseInt(memoryMatch[2]);
            const utilization = (usedMemory / allocatedMemory) * 100;
            memoryUtilizations.push(utilization);
          }
        }
      }

      if (memoryUtilizations.length > 0) {
        return memoryUtilizations.reduce((sum, util) => sum + util, 0) / memoryUtilizations.length;
      }
    }

    return 0;
  } catch (error) {
    console.error(`Error getting memory utilization for ${functionName}:`, error);
    return 0;
  }
}

async function getColdStartsFromLogs(
  logsClient: CloudWatchLogsClient,
  functionName: string,
  startTime: Date,
  endTime: Date
): Promise<number> {
  try {
    const logGroupName = `/aws/lambda/${functionName}`;

    const response = await logsClient.send(new FilterLogEventsCommand({
      logGroupName,
      startTime: startTime.getTime(),
      endTime: endTime.getTime(),
      filterPattern: 'INIT_START',
      limit: 1000
    }));

    return response.events?.length || 0;
  } catch (error) {
    console.error(`Error getting cold starts for ${functionName}:`, error);
    return 0;
  }
}

function calculateLambdaCost(memoryMB: number, avgDurationMs: number, invocations: number): number {
  if (invocations === 0) return 0;

  // Lambda pricing (as of 2024)
  const requestCost = 0.0000002; // $0.0000002 per request
  const gbSecondCost = 0.0000166667; // $0.0000166667 per GB-second

  // Calculate request cost
  const totalRequestCost = invocations * requestCost;

  // Calculate compute cost
  const memoryGB = memoryMB / 1024;
  const durationSeconds = avgDurationMs / 1000;
  const totalGBSeconds = memoryGB * durationSeconds * invocations;
  const totalComputeCost = totalGBSeconds * gbSecondCost;

  return totalRequestCost + totalComputeCost;
}

async function generateOptimizationRecommendations(
  metrics: FunctionMetrics[]
): Promise<OptimizationRecommendation[]> {
  const recommendations: OptimizationRecommendation[] = [];

  for (const metric of metrics) {
    const recommendation = analyzeFunction(metric);
    if (recommendation) {
      recommendations.push(recommendation);
    }
  }

  return recommendations;
}

function analyzeFunction(metric: FunctionMetrics): OptimizationRecommendation | null {
  const reasoning: string[] = [];
  let recommendedMemory = metric.memorySize;
  let recommendedTimeout = metric.timeout;
  let estimatedMonthlySavings = 0;
  let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

  // Analyze memory allocation
  if (metric.memoryUtilization > 0) {
    if (metric.memoryUtilization < 25 && metric.memorySize > 128) {
      // Over-allocated memory
      const newMemory = Math.max(128, Math.floor(metric.memorySize * 0.6 / 64) * 64);
      const currentMonthlyCost = metric.cost * 30; // Extrapolate to monthly
      const newCost = calculateLambdaCost(newMemory, metric.duration, metric.invocations) * 30;

      recommendedMemory = newMemory;
      estimatedMonthlySavings = currentMonthlyCost - newCost;
      priority = estimatedMonthlySavings > 1 ? 'HIGH' : 'MEDIUM';

      reasoning.push(`Memory utilization is only ${metric.memoryUtilization.toFixed(1)}%`);
      reasoning.push(`Reducing memory from ${metric.memorySize}MB to ${newMemory}MB`);
      reasoning.push(`Estimated monthly savings: $${estimatedMonthlySavings.toFixed(4)}`);
    } else if (metric.memoryUtilization > 85 && metric.duration > 5000) {
      // Under-allocated memory causing long execution times
      const newMemory = Math.min(10240, metric.memorySize * 2);
      const newDuration = metric.duration * 0.7; // Assume 30% reduction in duration
      const currentMonthlyCost = metric.cost * 30;
      const newCost = calculateLambdaCost(newMemory, newDuration, metric.invocations) * 30;

      recommendedMemory = newMemory;
      estimatedMonthlySavings = currentMonthlyCost - newCost;
      priority = metric.duration > 10000 ? 'HIGH' : 'MEDIUM';

      reasoning.push(`High memory utilization (${metric.memoryUtilization.toFixed(1)}%) with long duration (${metric.duration.toFixed(0)}ms)`);
      reasoning.push(`Increasing memory from ${metric.memorySize}MB to ${newMemory}MB may improve performance`);

      if (estimatedMonthlySavings > 0) {
        reasoning.push(`Estimated monthly savings: $${estimatedMonthlySavings.toFixed(4)} through reduced execution time`);
      } else {
        reasoning.push(`Estimated additional cost: $${Math.abs(estimatedMonthlySavings).toFixed(4)} for improved performance`);
      }
    }
  }

  // Analyze timeout settings
  if (metric.duration > 0 && metric.timeout > metric.duration / 1000 + 30) {
    // Timeout is much higher than needed
    recommendedTimeout = Math.ceil((metric.duration / 1000) * 1.5); // 50% buffer
    reasoning.push(`Timeout is too high (${metric.timeout}s) for average duration (${(metric.duration/1000).toFixed(1)}s)`);
    reasoning.push(`Recommended timeout: ${recommendedTimeout}s`);
  }

  // Analyze cold starts
  if (metric.coldStarts > metric.invocations * 0.1) {
    // High cold start ratio
    priority = 'HIGH';
    reasoning.push(`High cold start ratio: ${metric.coldStarts}/${metric.invocations} (${((metric.coldStarts/metric.invocations)*100).toFixed(1)}%)`);
    reasoning.push('Consider provisioned concurrency for consistent performance');
  }

  // Analyze error rates
  if (metric.errors > metric.invocations * 0.05) {
    // High error rate
    priority = 'HIGH';
    reasoning.push(`High error rate: ${metric.errors}/${metric.invocations} (${((metric.errors/metric.invocations)*100).toFixed(1)}%)`);
    reasoning.push('Investigate error causes to reduce costs from failed invocations');
  }

  // Analyze throttling
  if (metric.throttles > 0) {
    priority = 'HIGH';
    reasoning.push(`Function is being throttled (${metric.throttles} throttles)`);
    reasoning.push('Consider reserved concurrency or investigate traffic patterns');
  }

  // Only return recommendation if there are actual suggestions
  if (reasoning.length === 0) {
    return null;
  }

  return {
    functionName: metric.functionName,
    currentMemory: metric.memorySize,
    recommendedMemory,
    currentTimeout: metric.timeout,
    recommendedTimeout,
    estimatedMonthlySavings,
    reasoning,
    priority
  };
}

async function publishMetrics(
  cwClient: CloudWatchClient,
  metrics: FunctionMetrics[],
  recommendations: OptimizationRecommendation[],
  environment: string
): Promise<void> {
  const metricData: MetricDatum[] = [];

  // Aggregate metrics
  const totalCost = metrics.reduce((sum, m) => sum + m.cost, 0);
  const totalInvocations = metrics.reduce((sum, m) => sum + m.invocations, 0);
  const totalErrors = metrics.reduce((sum, m) => sum + m.errors, 0);
  const totalColdStarts = metrics.reduce((sum, m) => sum + m.coldStarts, 0);

  // Overall metrics
  metricData.push(
    {
      MetricName: 'TotalCost',
      Value: totalCost,
      Unit: 'None',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'TotalInvocations',
      Value: totalInvocations,
      Unit: 'Count',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'ErrorRate',
      Value: totalInvocations > 0 ? (totalErrors / totalInvocations) * 100 : 0,
      Unit: 'Percent',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'ColdStartRate',
      Value: totalInvocations > 0 ? (totalColdStarts / totalInvocations) * 100 : 0,
      Unit: 'Percent',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    }
  );

  // Function-specific metrics
  for (const metric of metrics) {
    metricData.push(
      {
        MetricName: 'FunctionCost',
        Value: metric.cost,
        Unit: 'None',
        Dimensions: [
          { Name: 'Environment', Value: environment },
          { Name: 'FunctionName', Value: metric.functionName }
        ],
        Timestamp: new Date()
      },
      {
        MetricName: 'MemoryUtilization',
        Value: metric.memoryUtilization,
        Unit: 'Percent',
        Dimensions: [
          { Name: 'Environment', Value: environment },
          { Name: 'FunctionName', Value: metric.functionName }
        ],
        Timestamp: new Date()
      },
      {
        MetricName: 'ColdStarts',
        Value: metric.coldStarts,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Environment', Value: environment },
          { Name: 'FunctionName', Value: metric.functionName }
        ],
        Timestamp: new Date()
      }
    );

    // Cost efficiency score
    const efficiencyScore = calculateEfficiencyScore(metric);
    metricData.push({
      MetricName: 'CostEfficiencyScore',
      Value: efficiencyScore,
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: environment },
        { Name: 'FunctionName', Value: metric.functionName }
      ],
      Timestamp: new Date()
    });
  }

  // Optimization metrics
  const potentialSavings = recommendations.reduce((sum, r) => sum + r.estimatedMonthlySavings, 0);
  const functionsNeedingOptimization = recommendations.filter(r => r.priority === 'HIGH').length;

  metricData.push(
    {
      MetricName: 'PotentialMonthlySavings',
      Value: potentialSavings,
      Unit: 'None',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'FunctionsNeedingOptimization',
      Value: functionsNeedingOptimization,
      Unit: 'Count',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    }
  );

  // Publish in batches
  const batchSize = 20;
  for (let i = 0; i < metricData.length; i += batchSize) {
    const batch = metricData.slice(i, i + batchSize);
    await cwClient.send(new PutMetricDataCommand({
      Namespace: 'ApexShare/Lambda',
      MetricData: batch
    }));
  }
}

function calculateEfficiencyScore(metric: FunctionMetrics): number {
  let score = 100;

  // Deduct for poor memory utilization
  if (metric.memoryUtilization > 0) {
    if (metric.memoryUtilization < 25) {
      score -= 30; // Over-allocated
    } else if (metric.memoryUtilization > 85) {
      score -= 20; // Under-allocated
    }
  }

  // Deduct for high error rate
  if (metric.invocations > 0) {
    const errorRate = metric.errors / metric.invocations;
    score -= errorRate * 100; // 1% error rate = 1 point deduction
  }

  // Deduct for high cold start rate
  if (metric.invocations > 0) {
    const coldStartRate = metric.coldStarts / metric.invocations;
    score -= coldStartRate * 50; // 1% cold start rate = 0.5 point deduction
  }

  // Deduct for throttling
  if (metric.throttles > 0) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

async function sendRecommendations(
  snsClient: SNSClient,
  topicArn: string,
  recommendations: OptimizationRecommendation[],
  environment: string
): Promise<void> {
  const subject = `🔧 Lambda Optimization Recommendations - ${environment.toUpperCase()}`;

  let message = `Lambda Cost Optimization Recommendations - ${environment.toUpperCase()}\n`;
  message += `Generated: ${new Date().toISOString()}\n\n`;

  message += `HIGH PRIORITY RECOMMENDATIONS (${recommendations.length}):\n`;
  message += '═'.repeat(60) + '\n\n';

  for (const rec of recommendations) {
    message += `Function: ${rec.functionName}\n`;
    message += `Priority: ${rec.priority}\n`;
    message += `Current Memory: ${rec.currentMemory}MB → Recommended: ${rec.recommendedMemory}MB\n`;
    message += `Current Timeout: ${rec.currentTimeout}s → Recommended: ${rec.recommendedTimeout}s\n`;
    message += `Estimated Monthly Savings: $${rec.estimatedMonthlySavings.toFixed(4)}\n`;
    message += `\nRecommendations:\n`;
    rec.reasoning.forEach(reason => {
      message += `  • ${reason}\n`;
    });
    message += '\n' + '─'.repeat(40) + '\n\n';
  }

  message += 'IMMEDIATE ACTIONS:\n';
  message += '─'.repeat(30) + '\n';
  message += '• Review function configurations in AWS Console\n';
  message += '• Test proposed memory changes in non-production first\n';
  message += '• Monitor performance after optimization\n';
  message += `• View detailed metrics: https://console.aws.amazon.com/cloudwatch/home#dashboards:name=ApexShare-Lambda-Cost-Optimization-${environment}\n`;

  await snsClient.send(new PublishCommand({
    TopicArn: topicArn,
    Subject: subject,
    Message: message
  }));
}