// /lambda/cost-metrics-publisher/src/index.ts
import { ScheduledEvent } from 'aws-lambda';
import {
  CostExplorerClient,
  GetCostAndUsageCommand
} from '@aws-sdk/client-cost-explorer';
import {
  CloudWatchClient,
  PutMetricDataCommand,
  MetricDatum
} from '@aws-sdk/client-cloudwatch';

interface ServiceCostMetric {
  service: string;
  cost: number;
  usageQuantity?: number;
  usageUnit?: string;
}

export const handler = async (event: ScheduledEvent): Promise<void> => {
  const ceClient = new CostExplorerClient({ region: 'us-east-1' });
  const cwClient = new CloudWatchClient({ region: process.env.AWS_REGION });
  const environment = process.env.ENVIRONMENT!;

  try {
    console.log('Starting cost metrics publishing');

    // Get today's costs
    const todayCosts = await getTodayCosts(ceClient);

    // Get month-to-date costs
    const monthToDateCosts = await getMonthToDateCosts(ceClient);

    // Publish metrics to CloudWatch
    await publishCostMetrics(cwClient, todayCosts, monthToDateCosts, environment);

    // Calculate and publish derived metrics
    await publishDerivedMetrics(cwClient, monthToDateCosts, environment);

    console.log('Cost metrics published successfully');

  } catch (error) {
    console.error('Error publishing cost metrics:', error);
    throw error;
  }
};

async function getTodayCosts(ceClient: CostExplorerClient): Promise<ServiceCostMetric[]> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const params = {
    TimePeriod: {
      Start: yesterday.toISOString().split('T')[0],
      End: today.toISOString().split('T')[0]
    },
    Granularity: 'DAILY',
    Metrics: ['BlendedCost', 'UsageQuantity'],
    GroupBy: [
      {
        Type: 'DIMENSION',
        Key: 'SERVICE'
      }
    ],
    Filter: {
      Tags: {
        Key: 'Project',
        Values: ['ApexShare']
      }
    }
  };

  const command = new GetCostAndUsageCommand(params);
  const response = await ceClient.send(command);

  const costs: ServiceCostMetric[] = [];

  if (response.ResultsByTime && response.ResultsByTime.length > 0) {
    const result = response.ResultsByTime[0];
    if (result.Groups) {
      for (const group of result.Groups) {
        const service = group.Keys?.[0] || 'Unknown';
        const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');
        const usageQuantity = parseFloat(group.Metrics?.UsageQuantity?.Amount || '0');
        const usageUnit = group.Metrics?.UsageQuantity?.Unit;

        costs.push({
          service,
          cost,
          usageQuantity,
          usageUnit
        });
      }
    }
  }

  return costs;
}

async function getMonthToDateCosts(ceClient: CostExplorerClient): Promise<ServiceCostMetric[]> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const params = {
    TimePeriod: {
      Start: startOfMonth.toISOString().split('T')[0],
      End: now.toISOString().split('T')[0]
    },
    Granularity: 'MONTHLY',
    Metrics: ['BlendedCost', 'UsageQuantity'],
    GroupBy: [
      {
        Type: 'DIMENSION',
        Key: 'SERVICE'
      }
    ],
    Filter: {
      Tags: {
        Key: 'Project',
        Values: ['ApexShare']
      }
    }
  };

  const command = new GetCostAndUsageCommand(params);
  const response = await ceClient.send(command);

  const costs: ServiceCostMetric[] = [];

  if (response.ResultsByTime && response.ResultsByTime.length > 0) {
    const result = response.ResultsByTime[0];
    if (result.Groups) {
      for (const group of result.Groups) {
        const service = group.Keys?.[0] || 'Unknown';
        const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');
        const usageQuantity = parseFloat(group.Metrics?.UsageQuantity?.Amount || '0');
        const usageUnit = group.Metrics?.UsageQuantity?.Unit;

        costs.push({
          service,
          cost,
          usageQuantity,
          usageUnit
        });
      }
    }
  }

  return costs;
}

async function publishCostMetrics(
  cwClient: CloudWatchClient,
  todayCosts: ServiceCostMetric[],
  monthToDateCosts: ServiceCostMetric[],
  environment: string
): Promise<void> {
  const metrics: MetricDatum[] = [];

  // Daily total cost
  const dailyTotal = todayCosts.reduce((sum, cost) => sum + cost.cost, 0);
  metrics.push({
    MetricName: 'DailyCost',
    Value: dailyTotal,
    Unit: 'None',
    Dimensions: [
      { Name: 'Environment', Value: environment }
    ],
    Timestamp: new Date()
  });

  // Month-to-date total cost
  const monthToDateTotal = monthToDateCosts.reduce((sum, cost) => sum + cost.cost, 0);
  metrics.push({
    MetricName: 'MonthToDateCost',
    Value: monthToDateTotal,
    Unit: 'None',
    Dimensions: [
      { Name: 'Environment', Value: environment }
    ],
    Timestamp: new Date()
  });

  // Service-specific daily costs
  for (const serviceCost of todayCosts) {
    if (serviceCost.cost > 0) {
      const serviceName = serviceCost.service.replace(/[^a-zA-Z0-9]/g, '');
      metrics.push({
        MetricName: `${serviceName}DailyCost`,
        Value: serviceCost.cost,
        Unit: 'None',
        Dimensions: [
          { Name: 'Environment', Value: environment },
          { Name: 'Service', Value: serviceCost.service }
        ],
        Timestamp: new Date()
      });

      // Usage metrics where available
      if (serviceCost.usageQuantity && serviceCost.usageQuantity > 0) {
        metrics.push({
          MetricName: `${serviceName}Usage`,
          Value: serviceCost.usageQuantity,
          Unit: serviceCost.usageUnit || 'Count',
          Dimensions: [
            { Name: 'Environment', Value: environment },
            { Name: 'Service', Value: serviceCost.service }
          ],
          Timestamp: new Date()
        });
      }
    }
  }

  // Service-specific month-to-date costs
  for (const serviceCost of monthToDateCosts) {
    if (serviceCost.cost > 0) {
      const serviceName = serviceCost.service.replace(/[^a-zA-Z0-9]/g, '');
      metrics.push({
        MetricName: `${serviceName}MonthToDateCost`,
        Value: serviceCost.cost,
        Unit: 'None',
        Dimensions: [
          { Name: 'Environment', Value: environment },
          { Name: 'Service', Value: serviceCost.service }
        ],
        Timestamp: new Date()
      });
    }
  }

  // Publish metrics in batches (CloudWatch limit is 20 metrics per call)
  const batchSize = 20;
  for (let i = 0; i < metrics.length; i += batchSize) {
    const batch = metrics.slice(i, i + batchSize);

    await cwClient.send(new PutMetricDataCommand({
      Namespace: 'ApexShare/Costs',
      MetricData: batch
    }));
  }
}

async function publishDerivedMetrics(
  cwClient: CloudWatchClient,
  monthToDateCosts: ServiceCostMetric[],
  environment: string
): Promise<void> {
  const metrics: MetricDatum[] = [];

  // Calculate cost breakdown percentages
  const totalCost = monthToDateCosts.reduce((sum, cost) => sum + cost.cost, 0);

  if (totalCost > 0) {
    // S3 cost percentage
    const s3Costs = monthToDateCosts
      .filter(cost => cost.service.includes('Simple Storage Service'))
      .reduce((sum, cost) => sum + cost.cost, 0);

    metrics.push({
      MetricName: 'S3CostPercentage',
      Value: (s3Costs / totalCost) * 100,
      Unit: 'Percent',
      Dimensions: [
        { Name: 'Environment', Value: environment }
      ],
      Timestamp: new Date()
    });

    // Lambda cost percentage
    const lambdaCosts = monthToDateCosts
      .filter(cost => cost.service.includes('Lambda'))
      .reduce((sum, cost) => sum + cost.cost, 0);

    metrics.push({
      MetricName: 'LambdaCostPercentage',
      Value: (lambdaCosts / totalCost) * 100,
      Unit: 'Percent',
      Dimensions: [
        { Name: 'Environment', Value: environment }
      ],
      Timestamp: new Date()
    });

    // CloudFront cost percentage
    const cloudFrontCosts = monthToDateCosts
      .filter(cost => cost.service.includes('CloudFront'))
      .reduce((sum, cost) => sum + cost.cost, 0);

    metrics.push({
      MetricName: 'CloudFrontCostPercentage',
      Value: (cloudFrontCosts / totalCost) * 100,
      Unit: 'Percent',
      Dimensions: [
        { Name: 'Environment', Value: environment }
      ],
      Timestamp: new Date()
    });

    // DynamoDB cost percentage
    const dynamoDBCosts = monthToDateCosts
      .filter(cost => cost.service.includes('DynamoDB'))
      .reduce((sum, cost) => sum + cost.cost, 0);

    metrics.push({
      MetricName: 'DynamoDBCostPercentage',
      Value: (dynamoDBCosts / totalCost) * 100,
      Unit: 'Percent',
      Dimensions: [
        { Name: 'Environment', Value: environment }
      ],
      Timestamp: new Date()
    });

    // API Gateway cost percentage
    const apiGatewayCosts = monthToDateCosts
      .filter(cost => cost.service.includes('API Gateway'))
      .reduce((sum, cost) => sum + cost.cost, 0);

    metrics.push({
      MetricName: 'APIGatewayCostPercentage',
      Value: (apiGatewayCosts / totalCost) * 100,
      Unit: 'Percent',
      Dimensions: [
        { Name: 'Environment', Value: environment }
      ],
      Timestamp: new Date()
    });
  }

  // Projected monthly cost based on current run rate
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const projectedMonthlyCost = totalCost * (daysInMonth / dayOfMonth);

  metrics.push({
    MetricName: 'ProjectedMonthlyCost',
    Value: projectedMonthlyCost,
    Unit: 'None',
    Dimensions: [
      { Name: 'Environment', Value: environment }
    ],
    Timestamp: new Date()
  });

  // Cost efficiency metrics (cost per GB stored, cost per request, etc.)
  await calculateEfficiencyMetrics(cwClient, monthToDateCosts, environment, metrics);

  // Publish derived metrics
  if (metrics.length > 0) {
    const batchSize = 20;
    for (let i = 0; i < metrics.length; i += batchSize) {
      const batch = metrics.slice(i, i + batchSize);

      await cwClient.send(new PutMetricDataCommand({
        Namespace: 'ApexShare/CostAnalytics',
        MetricData: batch
      }));
    }
  }
}

async function calculateEfficiencyMetrics(
  cwClient: CloudWatchClient,
  costs: ServiceCostMetric[],
  environment: string,
  metrics: MetricDatum[]
): Promise<void> {
  // Note: In a real implementation, you would fetch actual usage metrics
  // from CloudWatch to calculate these efficiency ratios

  // For now, we'll create placeholder calculations
  // These would be enhanced with actual usage data

  const s3Costs = costs
    .filter(cost => cost.service.includes('Simple Storage Service'))
    .reduce((sum, cost) => sum + cost.cost, 0);

  const lambdaCosts = costs
    .filter(cost => cost.service.includes('Lambda'))
    .reduce((sum, cost) => sum + cost.cost, 0);

  // Cost per GB stored (would need actual storage metrics)
  // This is a simplified calculation
  if (s3Costs > 0) {
    metrics.push({
      MetricName: 'CostPerGBStored',
      Value: s3Costs, // Would divide by actual GB stored
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: environment }
      ],
      Timestamp: new Date()
    });
  }

  // Cost per Lambda invocation (would need actual invocation count)
  if (lambdaCosts > 0) {
    metrics.push({
      MetricName: 'CostPerLambdaInvocation',
      Value: lambdaCosts, // Would divide by actual invocation count
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: environment }
      ],
      Timestamp: new Date()
    });
  }
}