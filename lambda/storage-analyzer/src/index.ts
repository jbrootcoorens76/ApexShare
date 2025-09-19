// /lambda/storage-analyzer/src/index.ts
import { ScheduledEvent } from 'aws-lambda';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  GetBucketAnalyticsConfigurationCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import {
  CloudWatchClient,
  PutMetricDataCommand,
  MetricDatum
} from '@aws-sdk/client-cloudwatch';
import {
  CostExplorerClient,
  GetCostAndUsageCommand
} from '@aws-sdk/client-cost-explorer';

interface StorageMetrics {
  totalSizeBytes: number;
  objectCount: number;
  storageClasses: Record<string, { size: number; count: number; cost?: number }>;
  accessPatterns: {
    frequentlyAccessed: number;
    infrequentlyAccessed: number;
    rarelyAccessed: number;
  };
  costOptimizationOpportunities: {
    potentialSavings: number;
    recommendedActions: string[];
  };
}

interface S3Object {
  key: string;
  size: number;
  lastModified: Date;
  storageClass: string;
  accessCount?: number;
  lastAccessed?: Date;
}

export const handler = async (event: ScheduledEvent): Promise<void> => {
  const s3Client = new S3Client({ region: process.env.AWS_REGION });
  const cwClient = new CloudWatchClient({ region: process.env.AWS_REGION });
  const ceClient = new CostExplorerClient({ region: 'us-east-1' });

  const bucketName = process.env.BUCKET_NAME!;
  const environment = process.env.ENVIRONMENT!;

  try {
    console.log(`Starting storage analysis for bucket: ${bucketName}`);

    // Analyze storage usage and patterns
    const storageMetrics = await analyzeStorageUsage(s3Client, bucketName);

    // Get cost data for S3 services
    const costData = await getS3CostData(ceClient);

    // Calculate cost optimization opportunities
    const optimizationOpportunities = await calculateOptimizationOpportunities(
      storageMetrics,
      costData
    );

    // Publish metrics to CloudWatch
    await publishStorageMetrics(cwClient, storageMetrics, optimizationOpportunities, environment);

    console.log('Storage analysis completed successfully');

  } catch (error) {
    console.error('Error in storage analysis:', error);
    throw error;
  }
};

async function analyzeStorageUsage(s3Client: S3Client, bucketName: string): Promise<StorageMetrics> {
  const metrics: StorageMetrics = {
    totalSizeBytes: 0,
    objectCount: 0,
    storageClasses: {},
    accessPatterns: {
      frequentlyAccessed: 0,
      infrequentlyAccessed: 0,
      rarelyAccessed: 0
    },
    costOptimizationOpportunities: {
      potentialSavings: 0,
      recommendedActions: []
    }
  };

  let continuationToken: string | undefined;

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    });

    const response = await s3Client.send(listCommand);

    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.Key && object.Size && object.LastModified) {
          const storageClass = object.StorageClass || 'STANDARD';

          // Update total metrics
          metrics.totalSizeBytes += object.Size;
          metrics.objectCount++;

          // Update storage class metrics
          if (!metrics.storageClasses[storageClass]) {
            metrics.storageClasses[storageClass] = { size: 0, count: 0 };
          }
          metrics.storageClasses[storageClass].size += object.Size;
          metrics.storageClasses[storageClass].count++;

          // Analyze access patterns based on age
          const daysSinceModified = (Date.now() - object.LastModified.getTime()) / (1000 * 60 * 60 * 24);

          if (daysSinceModified <= 7) {
            metrics.accessPatterns.frequentlyAccessed += object.Size;
          } else if (daysSinceModified <= 30) {
            metrics.accessPatterns.infrequentlyAccessed += object.Size;
          } else {
            metrics.accessPatterns.rarelyAccessed += object.Size;
          }

          // Identify optimization opportunities
          await identifyOptimizationOpportunities(object, storageClass, daysSinceModified, metrics);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return metrics;
}

async function identifyOptimizationOpportunities(
  object: any,
  storageClass: string,
  daysSinceModified: number,
  metrics: StorageMetrics
): Promise<void> {
  const sizeMB = object.Size / (1024 * 1024);

  // Objects in Standard storage that could be moved to IA
  if (storageClass === 'STANDARD' && daysSinceModified > 30 && sizeMB > 0.128) {
    const potentialSavings = sizeMB * 0.0045; // Approximate monthly savings per MB
    metrics.costOptimizationOpportunities.potentialSavings += potentialSavings;

    if (!metrics.costOptimizationOpportunities.recommendedActions.includes('Move old objects to Standard-IA')) {
      metrics.costOptimizationOpportunities.recommendedActions.push('Move old objects to Standard-IA');
    }
  }

  // Objects in Standard-IA that could be moved to Glacier
  if (storageClass === 'STANDARD_IA' && daysSinceModified > 90) {
    const potentialSavings = sizeMB * 0.003; // Approximate monthly savings per MB
    metrics.costOptimizationOpportunities.potentialSavings += potentialSavings;

    if (!metrics.costOptimizationOpportunities.recommendedActions.includes('Move rarely accessed objects to Glacier')) {
      metrics.costOptimizationOpportunities.recommendedActions.push('Move rarely accessed objects to Glacier');
    }
  }

  // Very old objects that could be moved to Deep Archive
  if ((storageClass === 'GLACIER' || storageClass === 'STANDARD_IA') && daysSinceModified > 365) {
    const potentialSavings = sizeMB * 0.0018; // Approximate monthly savings per MB
    metrics.costOptimizationOpportunities.potentialSavings += potentialSavings;

    if (!metrics.costOptimizationOpportunities.recommendedActions.includes('Move archival data to Deep Archive')) {
      metrics.costOptimizationOpportunities.recommendedActions.push('Move archival data to Deep Archive');
    }
  }

  // Small objects that should be aggregated
  if (sizeMB < 0.128 && storageClass !== 'STANDARD') {
    if (!metrics.costOptimizationOpportunities.recommendedActions.includes('Aggregate small objects to reduce storage overhead')) {
      metrics.costOptimizationOpportunities.recommendedActions.push('Aggregate small objects to reduce storage overhead');
    }
  }
}

async function getS3CostData(ceClient: CostExplorerClient): Promise<Record<string, number>> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30); // Last 30 days

  try {
    const command = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate.toISOString().split('T')[0],
        End: endDate.toISOString().split('T')[0]
      },
      Granularity: 'MONTHLY',
      Metrics: ['BlendedCost'],
      GroupBy: [
        {
          Type: 'DIMENSION',
          Key: 'USAGE_TYPE'
        }
      ],
      Filter: {
        And: [
          {
            Dimensions: {
              Key: 'SERVICE',
              Values: ['Amazon Simple Storage Service']
            }
          },
          {
            Tags: {
              Key: 'Project',
              Values: ['ApexShare']
            }
          }
        ]
      }
    });

    const response = await ceClient.send(command);
    const costs: Record<string, number> = {};

    if (response.ResultsByTime && response.ResultsByTime.length > 0) {
      const result = response.ResultsByTime[0];
      if (result.Groups) {
        for (const group of result.Groups) {
          const usageType = group.Keys?.[0] || 'Unknown';
          const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');
          costs[usageType] = cost;
        }
      }
    }

    return costs;
  } catch (error) {
    console.error('Error fetching S3 cost data:', error);
    return {};
  }
}

async function calculateOptimizationOpportunities(
  metrics: StorageMetrics,
  costData: Record<string, number>
): Promise<any> {
  const opportunities = {
    currentMonthlyCost: Object.values(costData).reduce((sum, cost) => sum + cost, 0),
    potentialMonthlySavings: metrics.costOptimizationOpportunities.potentialSavings,
    optimizationScore: 0,
    recommendations: metrics.costOptimizationOpportunities.recommendedActions
  };

  // Calculate optimization score (0-100)
  const totalSize = metrics.totalSizeBytes;
  const efficientStorageSize = metrics.storageClasses['STANDARD_IA']?.size || 0 +
                               metrics.storageClasses['GLACIER']?.size || 0 +
                               metrics.storageClasses['DEEP_ARCHIVE']?.size || 0;

  opportunities.optimizationScore = totalSize > 0 ? Math.min(100, (efficientStorageSize / totalSize) * 100) : 0;

  // Add intelligent tiering recommendations
  const standardStorageSize = metrics.storageClasses['STANDARD']?.size || 0;
  if (standardStorageSize > totalSize * 0.5) {
    opportunities.recommendations.push('Enable S3 Intelligent Tiering for automatic optimization');
  }

  // Add multipart upload optimization
  const avgObjectSize = totalSize / metrics.objectCount;
  if (avgObjectSize > 100 * 1024 * 1024) { // 100MB
    opportunities.recommendations.push('Use multipart uploads for large files to reduce costs and improve performance');
  }

  return opportunities;
}

async function publishStorageMetrics(
  cwClient: CloudWatchClient,
  metrics: StorageMetrics,
  opportunities: any,
  environment: string
): Promise<void> {
  const metricData: MetricDatum[] = [];

  // Basic storage metrics
  metricData.push(
    {
      MetricName: 'TotalStorageSize',
      Value: metrics.totalSizeBytes / (1024 * 1024 * 1024), // Convert to GB
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: environment }
      ],
      Timestamp: new Date()
    },
    {
      MetricName: 'TotalObjectCount',
      Value: metrics.objectCount,
      Unit: 'Count',
      Dimensions: [
        { Name: 'Environment', Value: environment }
      ],
      Timestamp: new Date()
    }
  );

  // Storage class distribution
  for (const [storageClass, data] of Object.entries(metrics.storageClasses)) {
    metricData.push(
      {
        MetricName: `${storageClass}StorageSize`,
        Value: data.size / (1024 * 1024 * 1024), // Convert to GB
        Unit: 'None',
        Dimensions: [
          { Name: 'Environment', Value: environment },
          { Name: 'StorageClass', Value: storageClass }
        ],
        Timestamp: new Date()
      },
      {
        MetricName: `${storageClass}ObjectCount`,
        Value: data.count,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Environment', Value: environment },
          { Name: 'StorageClass', Value: storageClass }
        ],
        Timestamp: new Date()
      }
    );
  }

  // Access pattern metrics
  metricData.push(
    {
      MetricName: 'FrequentlyAccessedStorage',
      Value: metrics.accessPatterns.frequentlyAccessed / (1024 * 1024 * 1024), // Convert to GB
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: environment },
        { Name: 'AccessPattern', Value: 'Frequent' }
      ],
      Timestamp: new Date()
    },
    {
      MetricName: 'InfrequentlyAccessedStorage',
      Value: metrics.accessPatterns.infrequentlyAccessed / (1024 * 1024 * 1024), // Convert to GB
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: environment },
        { Name: 'AccessPattern', Value: 'Infrequent' }
      ],
      Timestamp: new Date()
    },
    {
      MetricName: 'RarelyAccessedStorage',
      Value: metrics.accessPatterns.rarelyAccessed / (1024 * 1024 * 1024), // Convert to GB
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: environment },
        { Name: 'AccessPattern', Value: 'Rare' }
      ],
      Timestamp: new Date()
    }
  );

  // Cost optimization metrics
  metricData.push(
    {
      MetricName: 'PotentialMonthlySavings',
      Value: opportunities.potentialMonthlySavings,
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: environment }
      ],
      Timestamp: new Date()
    },
    {
      MetricName: 'OptimizationScore',
      Value: opportunities.optimizationScore,
      Unit: 'Percent',
      Dimensions: [
        { Name: 'Environment', Value: environment }
      ],
      Timestamp: new Date()
    },
    {
      MetricName: 'CurrentMonthlyCost',
      Value: opportunities.currentMonthlyCost,
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: environment }
      ],
      Timestamp: new Date()
    }
  );

  // Storage efficiency ratios
  const totalSize = metrics.totalSizeBytes;
  if (totalSize > 0) {
    const standardPercentage = ((metrics.storageClasses['STANDARD']?.size || 0) / totalSize) * 100;
    const iaPercentage = ((metrics.storageClasses['STANDARD_IA']?.size || 0) / totalSize) * 100;
    const glacierPercentage = ((metrics.storageClasses['GLACIER']?.size || 0) / totalSize) * 100;

    metricData.push(
      {
        MetricName: 'StandardStoragePercentage',
        Value: standardPercentage,
        Unit: 'Percent',
        Dimensions: [
          { Name: 'Environment', Value: environment }
        ],
        Timestamp: new Date()
      },
      {
        MetricName: 'IAStoragePercentage',
        Value: iaPercentage,
        Unit: 'Percent',
        Dimensions: [
          { Name: 'Environment', Value: environment }
        ],
        Timestamp: new Date()
      },
      {
        MetricName: 'GlacierStoragePercentage',
        Value: glacierPercentage,
        Unit: 'Percent',
        Dimensions: [
          { Name: 'Environment', Value: environment }
        ],
        Timestamp: new Date()
      }
    );
  }

  // Publish metrics in batches
  const batchSize = 20;
  for (let i = 0; i < metricData.length; i += batchSize) {
    const batch = metricData.slice(i, i + batchSize);

    await cwClient.send(new PutMetricDataCommand({
      Namespace: 'ApexShare/S3',
      MetricData: batch
    }));
  }

  console.log(`Published ${metricData.length} storage metrics to CloudWatch`);
}