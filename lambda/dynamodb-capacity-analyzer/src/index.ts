// /lambda/dynamodb-capacity-analyzer/src/index.ts
import { ScheduledEvent } from 'aws-lambda';
import {
  DynamoDBClient,
  DescribeTableCommand,
  DescribeTimeToLiveCommand
} from '@aws-sdk/client-dynamodb';
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  PutMetricDataCommand,
  MetricDatum
} from '@aws-sdk/client-cloudwatch';
import {
  ApplicationAutoScalingClient,
  DescribeScalingActivitiesCommand,
  DescribeScalingPoliciesCommand
} from '@aws-sdk/client-application-autoscaling';
import {
  SNSClient,
  PublishCommand
} from '@aws-sdk/client-sns';

interface TableMetrics {
  tableName: string;
  billingMode: 'ON_DEMAND' | 'PROVISIONED';
  provisionedReadCapacity?: number;
  provisionedWriteCapacity?: number;
  consumedReadCapacity: number;
  consumedWriteCapacity: number;
  readThrottles: number;
  writeThrottles: number;
  systemErrors: number;
  itemCount: number;
  tableSizeBytes: number;
  averageItemSize: number;
  gsiMetrics: GSIMetrics[];
}

interface GSIMetrics {
  indexName: string;
  provisionedReadCapacity?: number;
  provisionedWriteCapacity?: number;
  consumedReadCapacity: number;
  consumedWriteCapacity: number;
  readThrottles: number;
  writeThrottles: number;
}

interface CapacityRecommendation {
  tableName: string;
  currentMode: 'ON_DEMAND' | 'PROVISIONED';
  recommendedMode: 'ON_DEMAND' | 'PROVISIONED';
  currentReadCapacity?: number;
  currentWriteCapacity?: number;
  recommendedReadCapacity?: number;
  recommendedWriteCapacity?: number;
  estimatedMonthlySavings: number;
  reasoning: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export const handler = async (event: ScheduledEvent): Promise<void> => {
  const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
  const cwClient = new CloudWatchClient({ region: process.env.AWS_REGION });
  const autoScalingClient = new ApplicationAutoScalingClient({ region: process.env.AWS_REGION });
  const snsClient = new SNSClient({ region: process.env.AWS_REGION });

  const tableName = process.env.TABLE_NAME!;
  const environment = process.env.ENVIRONMENT!;
  const snsTopicArn = process.env.SNS_TOPIC_ARN!;

  try {
    console.log(`Starting DynamoDB capacity analysis for table: ${tableName}`);

    // Get table metrics and configuration
    const tableMetrics = await analyzeTableMetrics(dynamoClient, cwClient, tableName);

    // Generate capacity recommendations
    const recommendations = await generateCapacityRecommendations(tableMetrics);

    // Analyze auto-scaling effectiveness
    const autoScalingAnalysis = await analyzeAutoScalingEffectiveness(
      autoScalingClient,
      cwClient,
      tableName
    );

    // Publish metrics to CloudWatch
    await publishMetrics(cwClient, tableMetrics, recommendations, autoScalingAnalysis, environment);

    // Send recommendations if high priority
    if (recommendations.priority === 'HIGH') {
      await sendRecommendations(snsClient, snsTopicArn, recommendations, environment);
    }

    console.log('DynamoDB capacity analysis completed successfully');

  } catch (error) {
    console.error('Error in DynamoDB capacity analysis:', error);
    throw error;
  }
};

async function analyzeTableMetrics(
  dynamoClient: DynamoDBClient,
  cwClient: CloudWatchClient,
  tableName: string
): Promise<TableMetrics> {
  // Get table description
  const tableDescription = await dynamoClient.send(new DescribeTableCommand({
    TableName: tableName
  }));

  const table = tableDescription.Table!;
  const billingMode = table.BillingModeSummary?.BillingMode === 'PAY_PER_REQUEST'
    ? 'ON_DEMAND' as const
    : 'PROVISIONED' as const;

  // Get metrics for the last 24 hours
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

  // Get capacity metrics
  const consumedReadCapacity = await getMetricSum(
    cwClient, 'AWS/DynamoDB', 'ConsumedReadCapacityUnits', tableName, startTime, endTime
  );

  const consumedWriteCapacity = await getMetricSum(
    cwClient, 'AWS/DynamoDB', 'ConsumedWriteCapacityUnits', tableName, startTime, endTime
  );

  const readThrottles = await getMetricSum(
    cwClient, 'AWS/DynamoDB', 'ReadThrottles', tableName, startTime, endTime
  );

  const writeThrottles = await getMetricSum(
    cwClient, 'AWS/DynamoDB', 'WriteThrottles', tableName, startTime, endTime
  );

  const systemErrors = await getMetricSum(
    cwClient, 'AWS/DynamoDB', 'SystemErrors', tableName, startTime, endTime
  );

  const itemCount = await getMetricAverage(
    cwClient, 'AWS/DynamoDB', 'ItemCount', tableName, startTime, endTime
  );

  const tableSizeBytes = await getMetricAverage(
    cwClient, 'AWS/DynamoDB', 'TableSizeBytes', tableName, startTime, endTime
  );

  // Calculate average item size
  const averageItemSize = itemCount > 0 ? tableSizeBytes / itemCount : 0;

  // Get GSI metrics
  const gsiMetrics: GSIMetrics[] = [];
  if (table.GlobalSecondaryIndexes) {
    for (const gsi of table.GlobalSecondaryIndexes) {
      const gsiMetric = await getGSIMetrics(cwClient, tableName, gsi.IndexName!, startTime, endTime);
      gsiMetrics.push(gsiMetric);
    }
  }

  return {
    tableName,
    billingMode,
    provisionedReadCapacity: table.ProvisionedThroughput?.ReadCapacityUnits,
    provisionedWriteCapacity: table.ProvisionedThroughput?.WriteCapacityUnits,
    consumedReadCapacity,
    consumedWriteCapacity,
    readThrottles,
    writeThrottles,
    systemErrors,
    itemCount,
    tableSizeBytes,
    averageItemSize,
    gsiMetrics
  };
}

async function getMetricSum(
  cwClient: CloudWatchClient,
  namespace: string,
  metricName: string,
  tableName: string,
  startTime: Date,
  endTime: Date,
  indexName?: string
): Promise<number> {
  const dimensions: any[] = [{ Name: 'TableName', Value: tableName }];
  if (indexName) {
    dimensions.push({ Name: 'GlobalSecondaryIndexName', Value: indexName });
  }

  try {
    const response = await cwClient.send(new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      StartTime: startTime,
      EndTime: endTime,
      Period: 3600, // 1 hour
      Statistics: ['Sum']
    }));

    if (response.Datapoints && response.Datapoints.length > 0) {
      return response.Datapoints.reduce((sum, dp) => sum + (dp.Sum || 0), 0);
    }

    return 0;
  } catch (error) {
    console.error(`Error getting metric ${metricName}:`, error);
    return 0;
  }
}

async function getMetricAverage(
  cwClient: CloudWatchClient,
  namespace: string,
  metricName: string,
  tableName: string,
  startTime: Date,
  endTime: Date
): Promise<number> {
  try {
    const response = await cwClient.send(new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: [{ Name: 'TableName', Value: tableName }],
      StartTime: startTime,
      EndTime: endTime,
      Period: 3600, // 1 hour
      Statistics: ['Average']
    }));

    if (response.Datapoints && response.Datapoints.length > 0) {
      const values = response.Datapoints
        .map(dp => dp.Average || 0)
        .filter(v => v > 0);

      return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
    }

    return 0;
  } catch (error) {
    console.error(`Error getting metric ${metricName}:`, error);
    return 0;
  }
}

async function getGSIMetrics(
  cwClient: CloudWatchClient,
  tableName: string,
  indexName: string,
  startTime: Date,
  endTime: Date
): Promise<GSIMetrics> {
  const consumedReadCapacity = await getMetricSum(
    cwClient, 'AWS/DynamoDB', 'ConsumedReadCapacityUnits', tableName, startTime, endTime, indexName
  );

  const consumedWriteCapacity = await getMetricSum(
    cwClient, 'AWS/DynamoDB', 'ConsumedWriteCapacityUnits', tableName, startTime, endTime, indexName
  );

  const readThrottles = await getMetricSum(
    cwClient, 'AWS/DynamoDB', 'ReadThrottles', tableName, startTime, endTime, indexName
  );

  const writeThrottles = await getMetricSum(
    cwClient, 'AWS/DynamoDB', 'WriteThrottles', tableName, startTime, endTime, indexName
  );

  return {
    indexName,
    consumedReadCapacity,
    consumedWriteCapacity,
    readThrottles,
    writeThrottles
  };
}

async function generateCapacityRecommendations(metrics: TableMetrics): Promise<CapacityRecommendation> {
  const reasoning: string[] = [];
  let recommendedMode = metrics.billingMode;
  let recommendedReadCapacity = metrics.provisionedReadCapacity;
  let recommendedWriteCapacity = metrics.provisionedWriteCapacity;
  let estimatedMonthlySavings = 0;
  let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

  // Calculate current utilization (over 24 hours)
  const readUtilization = metrics.provisionedReadCapacity
    ? (metrics.consumedReadCapacity / (metrics.provisionedReadCapacity * 24)) * 100
    : 0;

  const writeUtilization = metrics.provisionedWriteCapacity
    ? (metrics.consumedWriteCapacity / (metrics.provisionedWriteCapacity * 24)) * 100
    : 0;

  // Check for throttling issues
  if (metrics.readThrottles > 0 || metrics.writeThrottles > 0) {
    priority = 'HIGH';
    reasoning.push(`Throttling detected: ${metrics.readThrottles} read, ${metrics.writeThrottles} write throttles`);

    if (metrics.billingMode === 'PROVISIONED') {
      // Increase provisioned capacity
      if (metrics.readThrottles > 0 && metrics.provisionedReadCapacity) {
        recommendedReadCapacity = Math.ceil(metrics.provisionedReadCapacity * 1.5);
        reasoning.push(`Increase read capacity from ${metrics.provisionedReadCapacity} to ${recommendedReadCapacity} RCU`);
      }

      if (metrics.writeThrottles > 0 && metrics.provisionedWriteCapacity) {
        recommendedWriteCapacity = Math.ceil(metrics.provisionedWriteCapacity * 1.5);
        reasoning.push(`Increase write capacity from ${metrics.provisionedWriteCapacity} to ${recommendedWriteCapacity} WCU`);
      }
    } else {
      reasoning.push('Consider switching to provisioned capacity with auto-scaling to handle burst traffic');
      recommendedMode = 'PROVISIONED';
      // Estimate required capacity based on peak usage (assume 5x average for bursts)
      recommendedReadCapacity = Math.ceil((metrics.consumedReadCapacity / 24) * 5);
      recommendedWriteCapacity = Math.ceil((metrics.consumedWriteCapacity / 24) * 5);
    }
  }

  // Analyze capacity utilization for provisioned mode
  if (metrics.billingMode === 'PROVISIONED') {
    if (readUtilization < 20 && writeUtilization < 20) {
      // Very low utilization - consider on-demand or reduce capacity
      priority = priority === 'HIGH' ? 'HIGH' : 'MEDIUM';

      const avgReadCapacityNeeded = Math.ceil(metrics.consumedReadCapacity / 24);
      const avgWriteCapacityNeeded = Math.ceil(metrics.consumedWriteCapacity / 24);

      // Calculate potential savings from switching to on-demand
      const currentProvisionedCost = calculateProvisionedCost(
        metrics.provisionedReadCapacity || 0,
        metrics.provisionedWriteCapacity || 0
      );

      const onDemandCost = calculateOnDemandCost(
        metrics.consumedReadCapacity,
        metrics.consumedWriteCapacity
      );

      if (onDemandCost < currentProvisionedCost) {
        recommendedMode = 'ON_DEMAND';
        estimatedMonthlySavings = (currentProvisionedCost - onDemandCost) * 30;
        reasoning.push(`Low utilization (Read: ${readUtilization.toFixed(1)}%, Write: ${writeUtilization.toFixed(1)}%)`);
        reasoning.push(`Switch to on-demand billing for estimated monthly savings of $${estimatedMonthlySavings.toFixed(2)}`);
      } else {
        // Reduce provisioned capacity
        recommendedReadCapacity = Math.max(5, avgReadCapacityNeeded * 2); // 2x buffer
        recommendedWriteCapacity = Math.max(5, avgWriteCapacityNeeded * 2);

        const newProvisionedCost = calculateProvisionedCost(recommendedReadCapacity, recommendedWriteCapacity);
        estimatedMonthlySavings = (currentProvisionedCost - newProvisionedCost) * 30;

        reasoning.push(`Reduce read capacity from ${metrics.provisionedReadCapacity} to ${recommendedReadCapacity} RCU`);
        reasoning.push(`Reduce write capacity from ${metrics.provisionedWriteCapacity} to ${recommendedWriteCapacity} WCU`);
        reasoning.push(`Estimated monthly savings: $${estimatedMonthlySavings.toFixed(2)}`);
      }
    } else if (readUtilization > 80 || writeUtilization > 80) {
      // High utilization - increase capacity
      priority = 'MEDIUM';
      reasoning.push(`High utilization (Read: ${readUtilization.toFixed(1)}%, Write: ${writeUtilization.toFixed(1)}%)`);
      reasoning.push('Consider increasing capacity or enabling auto-scaling to prevent throttling');
    }
  }

  // Analyze on-demand usage patterns
  if (metrics.billingMode === 'ON_DEMAND') {
    const avgReadCapacityPerSecond = metrics.consumedReadCapacity / (24 * 60 * 60);
    const avgWriteCapacityPerSecond = metrics.consumedWriteCapacity / (24 * 60 * 60);

    // If usage is consistent and high enough, provisioned might be cheaper
    if (avgReadCapacityPerSecond > 10 || avgWriteCapacityPerSecond > 5) {
      const onDemandCost = calculateOnDemandCost(
        metrics.consumedReadCapacity,
        metrics.consumedWriteCapacity
      );

      const estimatedProvisionedRead = Math.ceil(avgReadCapacityPerSecond * 2); // 2x buffer
      const estimatedProvisionedWrite = Math.ceil(avgWriteCapacityPerSecond * 2);

      const provisionedCost = calculateProvisionedCost(estimatedProvisionedRead, estimatedProvisionedWrite);

      if (provisionedCost < onDemandCost * 0.8) { // Only recommend if 20%+ savings
        recommendedMode = 'PROVISIONED';
        recommendedReadCapacity = estimatedProvisionedRead;
        recommendedWriteCapacity = estimatedProvisionedWrite;
        estimatedMonthlySavings = (onDemandCost - provisionedCost) * 30;
        priority = estimatedMonthlySavings > 10 ? 'HIGH' : 'MEDIUM';

        reasoning.push('Consistent usage pattern detected');
        reasoning.push(`Switch to provisioned capacity (${recommendedReadCapacity} RCU, ${recommendedWriteCapacity} WCU)`);
        reasoning.push(`Estimated monthly savings: $${estimatedMonthlySavings.toFixed(2)}`);
      }
    }
  }

  // Analyze GSI efficiency
  for (const gsi of metrics.gsiMetrics) {
    if (gsi.readThrottles > 0 || gsi.writeThrottles > 0) {
      priority = 'HIGH';
      reasoning.push(`GSI ${gsi.indexName} is experiencing throttling`);
    }
  }

  // Check for system errors
  if (metrics.systemErrors > 0) {
    priority = 'HIGH';
    reasoning.push(`${metrics.systemErrors} system errors detected - investigate table health`);
  }

  return {
    tableName: metrics.tableName,
    currentMode: metrics.billingMode,
    recommendedMode,
    currentReadCapacity: metrics.provisionedReadCapacity,
    currentWriteCapacity: metrics.provisionedWriteCapacity,
    recommendedReadCapacity,
    recommendedWriteCapacity,
    estimatedMonthlySavings,
    reasoning,
    priority
  };
}

function calculateProvisionedCost(readCapacity: number, writeCapacity: number): number {
  // DynamoDB pricing (as of 2024)
  const readCostPerRCU = 0.00013; // $0.00013 per RCU per hour
  const writeCostPerWCU = 0.00065; // $0.00065 per WCU per hour

  return (readCapacity * readCostPerRCU) + (writeCapacity * writeCostPerWCU);
}

function calculateOnDemandCost(readUnits: number, writeUnits: number): number {
  // DynamoDB on-demand pricing (as of 2024)
  const readCostPer1MReads = 0.25; // $0.25 per 1M read request units
  const writeCostPer1MWrites = 1.25; // $1.25 per 1M write request units

  const readCost = (readUnits / 1000000) * readCostPer1MReads;
  const writeCost = (writeUnits / 1000000) * writeCostPer1MWrites;

  return readCost + writeCost;
}

async function analyzeAutoScalingEffectiveness(
  autoScalingClient: ApplicationAutoScalingClient,
  cwClient: CloudWatchClient,
  tableName: string
): Promise<any> {
  try {
    // Get scaling activities for the table
    const scalingActivities = await autoScalingClient.send(
      new DescribeScalingActivitiesCommand({
        ServiceNamespace: 'dynamodb',
        ResourceId: `table/${tableName}`
      })
    );

    // Get scaling policies
    const scalingPolicies = await autoScalingClient.send(
      new DescribeScalingPoliciesCommand({
        ServiceNamespace: 'dynamodb',
        ResourceId: `table/${tableName}`
      })
    );

    return {
      scalingActivitiesCount: scalingActivities.ScalingActivities?.length || 0,
      scalingPoliciesCount: scalingPolicies.ScalingPolicies?.length || 0,
      recentScalingActivities: scalingActivities.ScalingActivities?.slice(0, 5) || []
    };
  } catch (error) {
    console.log('No auto-scaling configuration found for table:', tableName);
    return {
      scalingActivitiesCount: 0,
      scalingPoliciesCount: 0,
      recentScalingActivities: []
    };
  }
}

async function publishMetrics(
  cwClient: CloudWatchClient,
  metrics: TableMetrics,
  recommendations: CapacityRecommendation,
  autoScalingAnalysis: any,
  environment: string
): Promise<void> {
  const metricData: MetricDatum[] = [];

  // Basic table metrics
  metricData.push(
    {
      MetricName: 'TableCost',
      Value: calculateTableCost(metrics),
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: environment },
        { Name: 'TableName', Value: metrics.tableName }
      ],
      Timestamp: new Date()
    },
    {
      MetricName: 'ConsumedReadCapacity',
      Value: metrics.consumedReadCapacity,
      Unit: 'Count',
      Dimensions: [
        { Name: 'Environment', Value: environment },
        { Name: 'TableName', Value: metrics.tableName }
      ],
      Timestamp: new Date()
    },
    {
      MetricName: 'ConsumedWriteCapacity',
      Value: metrics.consumedWriteCapacity,
      Unit: 'Count',
      Dimensions: [
        { Name: 'Environment', Value: environment },
        { Name: 'TableName', Value: metrics.tableName }
      ],
      Timestamp: new Date()
    },
    {
      MetricName: 'AverageItemSize',
      Value: metrics.averageItemSize,
      Unit: 'Bytes',
      Dimensions: [
        { Name: 'Environment', Value: environment },
        { Name: 'TableName', Value: metrics.tableName }
      ],
      Timestamp: new Date()
    }
  );

  // Capacity efficiency metrics
  if (metrics.billingMode === 'PROVISIONED') {
    const readUtilization = metrics.provisionedReadCapacity
      ? (metrics.consumedReadCapacity / (metrics.provisionedReadCapacity * 24)) * 100
      : 0;

    const writeUtilization = metrics.provisionedWriteCapacity
      ? (metrics.consumedWriteCapacity / (metrics.provisionedWriteCapacity * 24)) * 100
      : 0;

    metricData.push(
      {
        MetricName: 'ReadCapacityUtilization',
        Value: readUtilization,
        Unit: 'Percent',
        Dimensions: [
          { Name: 'Environment', Value: environment },
          { Name: 'TableName', Value: metrics.tableName }
        ],
        Timestamp: new Date()
      },
      {
        MetricName: 'WriteCapacityUtilization',
        Value: writeUtilization,
        Unit: 'Percent',
        Dimensions: [
          { Name: 'Environment', Value: environment },
          { Name: 'TableName', Value: metrics.tableName }
        ],
        Timestamp: new Date()
      }
    );

    // Calculate efficiency score
    const efficiencyScore = calculateEfficiencyScore(readUtilization, writeUtilization, metrics);
    metricData.push({
      MetricName: 'CapacityEfficiencyScore',
      Value: efficiencyScore,
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: environment },
        { Name: 'TableName', Value: metrics.tableName }
      ],
      Timestamp: new Date()
    });
  }

  // Cost optimization metrics
  metricData.push(
    {
      MetricName: 'PotentialMonthlySavings',
      Value: recommendations.estimatedMonthlySavings,
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: environment },
        { Name: 'TableName', Value: metrics.tableName }
      ],
      Timestamp: new Date()
    },
    {
      MetricName: 'CostPerRead',
      Value: calculateCostPerRead(metrics),
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: environment },
        { Name: 'TableName', Value: metrics.tableName }
      ],
      Timestamp: new Date()
    },
    {
      MetricName: 'CostPerWrite',
      Value: calculateCostPerWrite(metrics),
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: environment },
        { Name: 'TableName', Value: metrics.tableName }
      ],
      Timestamp: new Date()
    }
  );

  // Auto-scaling metrics
  metricData.push({
    MetricName: 'AutoScalingActivities',
    Value: autoScalingAnalysis.scalingActivitiesCount,
    Unit: 'Count',
    Dimensions: [
      { Name: 'Environment', Value: environment },
      { Name: 'TableName', Value: metrics.tableName }
    ],
    Timestamp: new Date()
  });

  // Publish in batches
  const batchSize = 20;
  for (let i = 0; i < metricData.length; i += batchSize) {
    const batch = metricData.slice(i, i + batchSize);
    await cwClient.send(new PutMetricDataCommand({
      Namespace: 'ApexShare/DynamoDB',
      MetricData: batch
    }));
  }
}

function calculateTableCost(metrics: TableMetrics): number {
  if (metrics.billingMode === 'ON_DEMAND') {
    return calculateOnDemandCost(metrics.consumedReadCapacity, metrics.consumedWriteCapacity);
  } else {
    return calculateProvisionedCost(
      metrics.provisionedReadCapacity || 0,
      metrics.provisionedWriteCapacity || 0
    );
  }
}

function calculateEfficiencyScore(
  readUtilization: number,
  writeUtilization: number,
  metrics: TableMetrics
): number {
  let score = 100;

  // Deduct for low utilization
  if (readUtilization < 20) score -= 30;
  else if (readUtilization < 40) score -= 15;

  if (writeUtilization < 20) score -= 30;
  else if (writeUtilization < 40) score -= 15;

  // Deduct for throttling
  if (metrics.readThrottles > 0) score -= 40;
  if (metrics.writeThrottles > 0) score -= 40;

  // Deduct for system errors
  if (metrics.systemErrors > 0) score -= 20;

  return Math.max(0, Math.min(100, score));
}

function calculateCostPerRead(metrics: TableMetrics): number {
  if (metrics.consumedReadCapacity === 0) return 0;

  const totalCost = calculateTableCost(metrics);
  return totalCost / metrics.consumedReadCapacity;
}

function calculateCostPerWrite(metrics: TableMetrics): number {
  if (metrics.consumedWriteCapacity === 0) return 0;

  const totalCost = calculateTableCost(metrics);
  return totalCost / metrics.consumedWriteCapacity;
}

async function sendRecommendations(
  snsClient: SNSClient,
  topicArn: string,
  recommendations: CapacityRecommendation,
  environment: string
): Promise<void> {
  const subject = `🗃️ DynamoDB Optimization Alert - ${environment.toUpperCase()}`;

  let message = `DynamoDB Capacity Optimization Alert - ${environment.toUpperCase()}\n`;
  message += `Generated: ${new Date().toISOString()}\n\n`;

  message += `Table: ${recommendations.tableName}\n`;
  message += `Priority: ${recommendations.priority}\n`;
  message += `Current Mode: ${recommendations.currentMode}\n`;
  message += `Recommended Mode: ${recommendations.recommendedMode}\n\n`;

  if (recommendations.currentReadCapacity && recommendations.currentWriteCapacity) {
    message += `Current Capacity: ${recommendations.currentReadCapacity} RCU, ${recommendations.currentWriteCapacity} WCU\n`;
  }

  if (recommendations.recommendedReadCapacity && recommendations.recommendedWriteCapacity) {
    message += `Recommended Capacity: ${recommendations.recommendedReadCapacity} RCU, ${recommendations.recommendedWriteCapacity} WCU\n`;
  }

  message += `Estimated Monthly Savings: $${recommendations.estimatedMonthlySavings.toFixed(2)}\n\n`;

  message += 'Analysis:\n';
  message += '─'.repeat(30) + '\n';
  recommendations.reasoning.forEach(reason => {
    message += `• ${reason}\n`;
  });

  message += '\nImmediate Actions Required:\n';
  message += '─'.repeat(35) + '\n';
  message += '• Review table capacity settings in AWS Console\n';
  message += '• Monitor throttling and error rates\n';
  message += '• Consider implementing auto-scaling if not already enabled\n';
  message += `• View detailed metrics: https://console.aws.amazon.com/cloudwatch/home#dashboards:name=ApexShare-DynamoDB-Cost-Optimization-${environment}\n`;

  await snsClient.send(new PublishCommand({
    TopicArn: topicArn,
    Subject: subject,
    Message: message
  }));
}