// /lambda/usage-analyzer/src/index.ts
import { ScheduledEvent } from 'aws-lambda';
import {
  S3Client,
  ListObjectsV2Command,
  GetBucketMetricsConfigurationCommand
} from '@aws-sdk/client-s3';
import {
  DynamoDBClient,
  ScanCommand,
  QueryCommand,
  DescribeTableCommand
} from '@aws-sdk/client-dynamodb';
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  GetMetricDataCommand,
  PutMetricDataCommand,
  MetricDatum
} from '@aws-sdk/client-cloudwatch';
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetUsageReportCommand
} from '@aws-sdk/client-cost-explorer';

interface UsageMetrics {
  uploads: {
    total: number;
    daily: number;
    weekly: number;
    monthly: number;
    averageFileSize: number;
    totalStorageGB: number;
  };
  downloads: {
    total: number;
    daily: number;
    weekly: number;
    monthly: number;
    averageDownloadsPerFile: number;
    totalDataTransferGB: number;
  };
  users: {
    activeStudents: number;
    activeTrainers: number;
    totalUsers: number;
    averageFilesPerUser: number;
  };
  costs: {
    daily: number;
    weekly: number;
    monthly: number;
    projected: number;
    costPerUpload: number;
    costPerDownload: number;
    costPerUser: number;
    costPerGB: number;
  };
  efficiency: {
    storageOptimizationScore: number;
    accessPatternScore: number;
    costEfficiencyScore: number;
    utilizationScore: number;
  };
}

interface ForecastingData {
  trends: {
    uploadGrowthRate: number;
    downloadGrowthRate: number;
    costGrowthRate: number;
    seasonalityFactor: number;
  };
  projections: {
    nextMonthUploads: number;
    nextMonthCost: number;
    nextQuarterCost: number;
    breakEvenUserCount: number;
  };
  recommendations: {
    optimizationOpportunities: string[];
    capacityPlanning: string[];
    costReduction: string[];
  };
}

export const handler = async (event: ScheduledEvent): Promise<void> => {
  const s3Client = new S3Client({ region: process.env.AWS_REGION });
  const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
  const cwClient = new CloudWatchClient({ region: process.env.AWS_REGION });
  const ceClient = new CostExplorerClient({ region: 'us-east-1' });

  const videosBucket = process.env.VIDEOS_BUCKET!;
  const uploadsTable = process.env.UPLOADS_TABLE!;
  const environment = process.env.ENVIRONMENT!;
  const budgetThreshold = parseFloat(process.env.BUDGET_THRESHOLD!);

  try {
    console.log('Starting comprehensive usage analysis');

    // Collect usage metrics
    const usageMetrics = await collectUsageMetrics(
      s3Client,
      dynamoClient,
      cwClient,
      ceClient,
      videosBucket,
      uploadsTable
    );

    // Generate forecasting data
    const forecastingData = await generateForecastingData(usageMetrics, budgetThreshold);

    // Calculate advanced analytics
    const advancedAnalytics = await calculateAdvancedAnalytics(usageMetrics, forecastingData);

    // Publish comprehensive metrics
    await publishComprehensiveMetrics(cwClient, usageMetrics, forecastingData, advancedAnalytics, environment);

    console.log('Usage analysis completed successfully');

  } catch (error) {
    console.error('Error in usage analysis:', error);
    throw error;
  }
};

async function collectUsageMetrics(
  s3Client: S3Client,
  dynamoClient: DynamoDBClient,
  cwClient: CloudWatchClient,
  ceClient: CostExplorerClient,
  videosBucket: string,
  uploadsTable: string
): Promise<UsageMetrics> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get upload metrics from DynamoDB
  const uploadMetrics = await getUploadMetrics(dynamoClient, uploadsTable, oneDayAgo, oneWeekAgo, oneMonthAgo);

  // Get storage metrics from S3
  const storageMetrics = await getStorageMetrics(s3Client, videosBucket);

  // Get download metrics from CloudWatch
  const downloadMetrics = await getDownloadMetrics(cwClient, oneDayAgo, oneWeekAgo, oneMonthAgo);

  // Get user metrics from DynamoDB
  const userMetrics = await getUserMetrics(dynamoClient, uploadsTable, oneMonthAgo);

  // Get cost metrics from Cost Explorer
  const costMetrics = await getCostMetrics(ceClient, oneDayAgo, oneWeekAgo, oneMonthAgo);

  // Calculate efficiency metrics
  const efficiencyMetrics = calculateEfficiencyMetrics(
    uploadMetrics,
    downloadMetrics,
    storageMetrics,
    costMetrics
  );

  return {
    uploads: uploadMetrics,
    downloads: downloadMetrics,
    users: userMetrics,
    costs: costMetrics,
    efficiency: efficiencyMetrics
  };
}

async function getUploadMetrics(
  dynamoClient: DynamoDBClient,
  tableName: string,
  oneDayAgo: Date,
  oneWeekAgo: Date,
  oneMonthAgo: Date
): Promise<any> {
  try {
    // Get all uploads for the past month
    const response = await dynamoClient.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: 'uploadDate >= :monthAgo',
      ExpressionAttributeValues: {
        ':monthAgo': { S: oneMonthAgo.toISOString() }
      }
    }));

    const uploads = response.Items || [];

    // Calculate metrics
    const totalUploads = uploads.length;
    const dailyUploads = uploads.filter(item =>
      new Date(item.uploadDate?.S || '') >= oneDayAgo
    ).length;
    const weeklyUploads = uploads.filter(item =>
      new Date(item.uploadDate?.S || '') >= oneWeekAgo
    ).length;
    const monthlyUploads = totalUploads;

    // Calculate average file size
    const fileSizes = uploads
      .map(item => parseInt(item.fileSize?.N || '0'))
      .filter(size => size > 0);

    const averageFileSize = fileSizes.length > 0
      ? fileSizes.reduce((sum, size) => sum + size, 0) / fileSizes.length
      : 0;

    const totalStorageBytes = fileSizes.reduce((sum, size) => sum + size, 0);
    const totalStorageGB = totalStorageBytes / (1024 * 1024 * 1024);

    return {
      total: totalUploads,
      daily: dailyUploads,
      weekly: weeklyUploads,
      monthly: monthlyUploads,
      averageFileSize,
      totalStorageGB
    };
  } catch (error) {
    console.error('Error getting upload metrics:', error);
    return {
      total: 0,
      daily: 0,
      weekly: 0,
      monthly: 0,
      averageFileSize: 0,
      totalStorageGB: 0
    };
  }
}

async function getStorageMetrics(s3Client: S3Client, bucketName: string): Promise<any> {
  try {
    let totalObjects = 0;
    let totalSize = 0;
    let continuationToken: string | undefined;

    do {
      const response = await s3Client.send(new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: 'videos/',
        ContinuationToken: continuationToken,
        MaxKeys: 1000
      }));

      if (response.Contents) {
        totalObjects += response.Contents.length;
        totalSize += response.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return {
      objectCount: totalObjects,
      totalSizeBytes: totalSize,
      totalSizeGB: totalSize / (1024 * 1024 * 1024),
      averageObjectSize: totalObjects > 0 ? totalSize / totalObjects : 0
    };
  } catch (error) {
    console.error('Error getting storage metrics:', error);
    return {
      objectCount: 0,
      totalSizeBytes: 0,
      totalSizeGB: 0,
      averageObjectSize: 0
    };
  }
}

async function getDownloadMetrics(
  cwClient: CloudWatchClient,
  oneDayAgo: Date,
  oneWeekAgo: Date,
  oneMonthAgo: Date
): Promise<any> {
  try {
    // Get download counts from custom metrics
    const dailyDownloads = await getMetricSum(
      cwClient, 'ApexShare/Usage', 'VideoDownloads', oneDayAgo, new Date()
    );
    const weeklyDownloads = await getMetricSum(
      cwClient, 'ApexShare/Usage', 'VideoDownloads', oneWeekAgo, new Date()
    );
    const monthlyDownloads = await getMetricSum(
      cwClient, 'ApexShare/Usage', 'VideoDownloads', oneMonthAgo, new Date()
    );

    // Get data transfer metrics
    const dataTransferGB = await getMetricSum(
      cwClient, 'ApexShare/Usage', 'DataTransferGB', oneMonthAgo, new Date()
    );

    return {
      total: monthlyDownloads,
      daily: dailyDownloads,
      weekly: weeklyDownloads,
      monthly: monthlyDownloads,
      averageDownloadsPerFile: 0, // Would need to calculate from upload count
      totalDataTransferGB: dataTransferGB
    };
  } catch (error) {
    console.error('Error getting download metrics:', error);
    return {
      total: 0,
      daily: 0,
      weekly: 0,
      monthly: 0,
      averageDownloadsPerFile: 0,
      totalDataTransferGB: 0
    };
  }
}

async function getUserMetrics(
  dynamoClient: DynamoDBClient,
  tableName: string,
  oneMonthAgo: Date
): Promise<any> {
  try {
    // Get unique students and trainers from uploads
    const response = await dynamoClient.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: 'uploadDate >= :monthAgo',
      ExpressionAttributeValues: {
        ':monthAgo': { S: oneMonthAgo.toISOString() }
      },
      ProjectionExpression: 'studentEmail, trainerName'
    }));

    const uploads = response.Items || [];

    // Count unique students
    const uniqueStudents = new Set(
      uploads.map(item => item.studentEmail?.S).filter(email => email)
    );

    // Count unique trainers
    const uniqueTrainers = new Set(
      uploads.map(item => item.trainerName?.S).filter(name => name)
    );

    const totalUploads = uploads.length;
    const totalUsers = uniqueStudents.size + uniqueTrainers.size;

    return {
      activeStudents: uniqueStudents.size,
      activeTrainers: uniqueTrainers.size,
      totalUsers,
      averageFilesPerUser: totalUsers > 0 ? totalUploads / uniqueStudents.size : 0
    };
  } catch (error) {
    console.error('Error getting user metrics:', error);
    return {
      activeStudents: 0,
      activeTrainers: 0,
      totalUsers: 0,
      averageFilesPerUser: 0
    };
  }
}

async function getCostMetrics(
  ceClient: CostExplorerClient,
  oneDayAgo: Date,
  oneWeekAgo: Date,
  oneMonthAgo: Date
): Promise<any> {
  try {
    // Get monthly costs
    const monthlyCostResponse = await ceClient.send(new GetCostAndUsageCommand({
      TimePeriod: {
        Start: oneMonthAgo.toISOString().split('T')[0],
        End: new Date().toISOString().split('T')[0]
      },
      Granularity: 'MONTHLY',
      Metrics: ['BlendedCost'],
      Filter: {
        Tags: {
          Key: 'Project',
          Values: ['ApexShare']
        }
      }
    }));

    const monthlyCost = monthlyCostResponse.ResultsByTime?.[0]?.Total?.BlendedCost?.Amount
      ? parseFloat(monthlyCostResponse.ResultsByTime[0].Total.BlendedCost.Amount)
      : 0;

    // Get daily costs
    const dailyCostResponse = await ceClient.send(new GetCostAndUsageCommand({
      TimePeriod: {
        Start: oneDayAgo.toISOString().split('T')[0],
        End: new Date().toISOString().split('T')[0]
      },
      Granularity: 'DAILY',
      Metrics: ['BlendedCost'],
      Filter: {
        Tags: {
          Key: 'Project',
          Values: ['ApexShare']
        }
      }
    }));

    const dailyCost = dailyCostResponse.ResultsByTime?.reduce((sum, period) => {
      return sum + parseFloat(period.Total?.BlendedCost?.Amount || '0');
    }, 0) || 0;

    // Estimate weekly cost
    const weeklyCost = dailyCost * 7;

    // Project monthly cost based on current daily rate
    const projectedMonthlyCost = dailyCost * 30;

    return {
      daily: dailyCost,
      weekly: weeklyCost,
      monthly: monthlyCost,
      projected: projectedMonthlyCost,
      costPerUpload: 0, // Will be calculated after upload metrics
      costPerDownload: 0, // Will be calculated after download metrics
      costPerUser: 0, // Will be calculated after user metrics
      costPerGB: 0 // Will be calculated after storage metrics
    };
  } catch (error) {
    console.error('Error getting cost metrics:', error);
    return {
      daily: 0,
      weekly: 0,
      monthly: 0,
      projected: 0,
      costPerUpload: 0,
      costPerDownload: 0,
      costPerUser: 0,
      costPerGB: 0
    };
  }
}

function calculateEfficiencyMetrics(
  uploadMetrics: any,
  downloadMetrics: any,
  storageMetrics: any,
  costMetrics: any
): any {
  // Storage optimization score (0-100)
  let storageOptimizationScore = 100;

  // Penalize if average file size is very large (>1GB) without optimization
  if (uploadMetrics.averageFileSize > 1024 * 1024 * 1024) {
    storageOptimizationScore -= 20;
  }

  // Access pattern score based on download-to-upload ratio
  const downloadToUploadRatio = uploadMetrics.monthly > 0
    ? downloadMetrics.monthly / uploadMetrics.monthly
    : 0;

  let accessPatternScore = 100;
  if (downloadToUploadRatio < 0.5) {
    accessPatternScore -= 30; // Low download activity suggests poor user engagement
  } else if (downloadToUploadRatio > 10) {
    accessPatternScore -= 20; // Very high ratio might indicate inefficient storage
  }

  // Cost efficiency score
  const costPerGBStored = storageMetrics.totalSizeGB > 0
    ? costMetrics.monthly / storageMetrics.totalSizeGB
    : 0;

  let costEfficiencyScore = 100;
  if (costPerGBStored > 0.05) { // $0.05 per GB is expensive
    costEfficiencyScore -= 40;
  } else if (costPerGBStored > 0.03) {
    costEfficiencyScore -= 20;
  }

  // Overall utilization score
  const uploadsPerDay = uploadMetrics.daily;
  const downloadsPerDay = downloadMetrics.daily;

  let utilizationScore = 100;
  if (uploadsPerDay < 1 && downloadsPerDay < 5) {
    utilizationScore -= 50; // Very low activity
  } else if (uploadsPerDay < 5 && downloadsPerDay < 25) {
    utilizationScore -= 25; // Moderate activity
  }

  return {
    storageOptimizationScore,
    accessPatternScore,
    costEfficiencyScore,
    utilizationScore
  };
}

async function generateForecastingData(
  usageMetrics: UsageMetrics,
  budgetThreshold: number
): Promise<ForecastingData> {
  // Calculate growth rates (simplified linear growth)
  const uploadGrowthRate = usageMetrics.uploads.weekly > 0
    ? ((usageMetrics.uploads.daily * 7) / usageMetrics.uploads.weekly - 1) * 100
    : 0;

  const downloadGrowthRate = usageMetrics.downloads.weekly > 0
    ? ((usageMetrics.downloads.daily * 7) / usageMetrics.downloads.weekly - 1) * 100
    : 0;

  const costGrowthRate = usageMetrics.costs.weekly > 0
    ? ((usageMetrics.costs.daily * 7) / usageMetrics.costs.weekly - 1) * 100
    : 0;

  // Simple seasonality calculation (placeholder)
  const dayOfWeek = new Date().getDay();
  const seasonalityFactor = dayOfWeek <= 5 ? 1.2 : 0.8; // Higher on weekdays

  // Project next month based on current trends
  const nextMonthUploads = usageMetrics.uploads.monthly * (1 + uploadGrowthRate / 100);
  const nextMonthCost = usageMetrics.costs.projected * (1 + costGrowthRate / 100);
  const nextQuarterCost = nextMonthCost * 3;

  // Calculate break-even user count (assuming $10 revenue per user per month)
  const revenuePerUser = 10;
  const breakEvenUserCount = Math.ceil(nextMonthCost / revenuePerUser);

  // Generate recommendations
  const optimizationOpportunities: string[] = [];
  const capacityPlanning: string[] = [];
  const costReduction: string[] = [];

  if (usageMetrics.efficiency.storageOptimizationScore < 70) {
    optimizationOpportunities.push('Implement S3 lifecycle policies for automatic tiering');
    costReduction.push('Enable S3 Intelligent Tiering to reduce storage costs');
  }

  if (usageMetrics.efficiency.costEfficiencyScore < 60) {
    costReduction.push('Review Lambda memory allocation and timeout settings');
    costReduction.push('Consider switching DynamoDB to on-demand billing');
  }

  if (uploadGrowthRate > 50) {
    capacityPlanning.push('Scale up Lambda concurrency limits');
    capacityPlanning.push('Monitor S3 request rate limits');
  }

  if (nextMonthCost > budgetThreshold * 0.8) {
    costReduction.push('Urgent: Implement cost controls before exceeding budget');
    optimizationOpportunities.push('Conduct immediate cost optimization review');
  }

  return {
    trends: {
      uploadGrowthRate,
      downloadGrowthRate,
      costGrowthRate,
      seasonalityFactor
    },
    projections: {
      nextMonthUploads,
      nextMonthCost,
      nextQuarterCost,
      breakEvenUserCount
    },
    recommendations: {
      optimizationOpportunities,
      capacityPlanning,
      costReduction
    }
  };
}

async function calculateAdvancedAnalytics(
  usageMetrics: UsageMetrics,
  forecastingData: ForecastingData
): Promise<any> {
  // Calculate advanced metrics
  const roiScore = usageMetrics.users.totalUsers > 0
    ? (usageMetrics.users.totalUsers * 10 - usageMetrics.costs.monthly) / usageMetrics.costs.monthly * 100
    : 0;

  const costPerUpload = usageMetrics.uploads.monthly > 0
    ? usageMetrics.costs.monthly / usageMetrics.uploads.monthly
    : 0;

  const costPerDownload = usageMetrics.downloads.monthly > 0
    ? usageMetrics.costs.monthly / usageMetrics.downloads.monthly
    : 0;

  const costPerUser = usageMetrics.users.totalUsers > 0
    ? usageMetrics.costs.monthly / usageMetrics.users.totalUsers
    : 0;

  const costPerGB = usageMetrics.uploads.totalStorageGB > 0
    ? usageMetrics.costs.monthly / usageMetrics.uploads.totalStorageGB
    : 0;

  const errorCostImpact = 0; // Would need error metrics to calculate

  const optimizationActionsRequired = [
    ...forecastingData.recommendations.optimizationOpportunities,
    ...forecastingData.recommendations.costReduction
  ].length;

  return {
    roiScore,
    costPerUpload,
    costPerDownload,
    costPerUser,
    costPerGB,
    errorCostImpact,
    optimizationActionsRequired,
    monthOverMonthChange: forecastingData.trends.costGrowthRate
  };
}

async function publishComprehensiveMetrics(
  cwClient: CloudWatchClient,
  usageMetrics: UsageMetrics,
  forecastingData: ForecastingData,
  advancedAnalytics: any,
  environment: string
): Promise<void> {
  const metricData: MetricDatum[] = [];

  // Usage metrics
  metricData.push(
    {
      MetricName: 'VideoUploads',
      Value: usageMetrics.uploads.daily,
      Unit: 'Count',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'VideoDownloads',
      Value: usageMetrics.downloads.daily,
      Unit: 'Count',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'ActiveUsers',
      Value: usageMetrics.users.totalUsers,
      Unit: 'Count',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    }
  );

  // Cost analytics
  metricData.push(
    {
      MetricName: 'CostPerUpload',
      Value: advancedAnalytics.costPerUpload,
      Unit: 'None',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'CostPerDownload',
      Value: advancedAnalytics.costPerDownload,
      Unit: 'None',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'CostPerUser',
      Value: advancedAnalytics.costPerUser,
      Unit: 'None',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'CostPerGB',
      Value: advancedAnalytics.costPerGB,
      Unit: 'None',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    }
  );

  // Forecasting metrics
  metricData.push(
    {
      MetricName: 'ProjectedMonthlyCost',
      Value: forecastingData.projections.nextMonthCost,
      Unit: 'None',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'ProjectedUploads',
      Value: forecastingData.projections.nextMonthUploads,
      Unit: 'Count',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'BreakEvenUserCount',
      Value: forecastingData.projections.breakEvenUserCount,
      Unit: 'Count',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    }
  );

  // Efficiency and analytics metrics
  metricData.push(
    {
      MetricName: 'ROIScore',
      Value: advancedAnalytics.roiScore,
      Unit: 'None',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'OptimizationActionsRequired',
      Value: advancedAnalytics.optimizationActionsRequired,
      Unit: 'Count',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'MonthOverMonthChange',
      Value: advancedAnalytics.monthOverMonthChange,
      Unit: 'Percent',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    }
  );

  // Growth trends
  metricData.push(
    {
      MetricName: 'UploadGrowthRate',
      Value: forecastingData.trends.uploadGrowthRate,
      Unit: 'Percent',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'CostGrowthRate',
      Value: forecastingData.trends.costGrowthRate,
      Unit: 'Percent',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'SeasonalityIndex',
      Value: forecastingData.trends.seasonalityFactor,
      Unit: 'None',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    }
  );

  // Publish metrics in batches
  const batchSize = 20;
  for (let i = 0; i < metricData.length; i += batchSize) {
    const batch = metricData.slice(i, i + batchSize);

    await cwClient.send(new PutMetricDataCommand({
      Namespace: 'ApexShare/CostAnalytics',
      MetricData: batch
    }));
  }

  console.log(`Published ${metricData.length} comprehensive metrics to CloudWatch`);
}

async function getMetricSum(
  cwClient: CloudWatchClient,
  namespace: string,
  metricName: string,
  startTime: Date,
  endTime: Date
): Promise<number> {
  try {
    const response = await cwClient.send(new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: metricName,
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