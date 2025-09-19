// /lambda/cost-forecaster/src/index.ts
import { Handler, ScheduledEvent } from 'aws-lambda';
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetUsageForecastCommand,
  GetCostForecastCommand,
  Granularity,
  GroupDefinition
} from '@aws-sdk/client-cost-explorer';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

interface ForecastingModel {
  name: string;
  type: 'linear' | 'exponential' | 'seasonal' | 'machine-learning';
  accuracy: number;
  parameters: Record<string, number>;
}

interface HistoricalDataPoint {
  date: string;
  cost: number;
  uploads: number;
  downloads: number;
  storage: number;
  processing: number;
}

interface ForecastResult {
  model: string;
  period: string;
  predictedCost: number;
  confidence: number;
  factors: Record<string, number>;
}

interface CostBreakdown {
  lambda: number;
  s3: number;
  dynamodb: number;
  cloudfront: number;
  apigateway: number;
  ses: number;
  other: number;
}

const costExplorer = new CostExplorerClient({ region: process.env.AWS_REGION });
const cloudWatch = new CloudWatchClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const snsClient = new SNSClient({ region: process.env.AWS_REGION });

export const handler: Handler<ScheduledEvent> = async (event) => {
  try {
    console.log('Starting cost forecasting analysis...');

    // Load forecasting models
    const models: ForecastingModel[] = JSON.parse(process.env.FORECASTING_MODELS || '[]');

    // Get historical cost data
    const historicalData = await getHistoricalCostData();

    // Load usage metrics
    const usageMetrics = await loadUsageMetrics();

    // Generate forecasts using all models
    const forecasts = await generateForecasts(models, historicalData, usageMetrics);

    // Evaluate model accuracy
    const accuracyResults = await evaluateModelAccuracy(models, historicalData);

    // Publish forecast metrics
    await publishForecastMetrics(forecasts, accuracyResults);

    // Store forecast data
    await storeForecastData(forecasts);

    // Generate alerts if needed
    await checkForecastAlerts(forecasts);

    console.log('Cost forecasting completed successfully');
    return {
      statusCode: 200,
      forecasts: forecasts.length,
      accuracy: accuracyResults.overallAccuracy
    };

  } catch (error) {
    console.error('Error in cost forecasting:', error);
    await sendErrorAlert(error as Error);
    throw error;
  }
};

async function getHistoricalCostData(): Promise<HistoricalDataPoint[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(endDate.getMonth() - 12); // Get 12 months of data

  try {
    const command = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate.toISOString().split('T')[0],
        End: endDate.toISOString().split('T')[0]
      },
      Granularity: Granularity.MONTHLY,
      Metrics: ['BlendedCost', 'UsageQuantity'],
      GroupBy: [
        {
          Type: 'DIMENSION',
          Key: 'SERVICE'
        }
      ]
    });

    const response = await costExplorer.send(command);
    const historicalData: HistoricalDataPoint[] = [];

    if (response.ResultsByTime) {
      for (const result of response.ResultsByTime) {
        const dataPoint: HistoricalDataPoint = {
          date: result.TimePeriod?.Start || '',
          cost: 0,
          uploads: 0,
          downloads: 0,
          storage: 0,
          processing: 0
        };

        if (result.Groups) {
          for (const group of result.Groups) {
            const service = group.Keys?.[0] || '';
            const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');
            dataPoint.cost += cost;

            // Map services to categories
            if (service.includes('Lambda')) {
              dataPoint.processing += cost;
            } else if (service.includes('S3')) {
              dataPoint.storage += cost;
            }
          }
        }

        historicalData.push(dataPoint);
      }
    }

    console.log(`Retrieved ${historicalData.length} months of historical data`);
    return historicalData;

  } catch (error) {
    console.error('Error getting historical cost data:', error);
    return [];
  }
}

async function loadUsageMetrics(): Promise<Record<string, number[]>> {
  try {
    // Load usage metrics from S3 if available
    const bucketName = process.env.COST_DATA_BUCKET;
    if (!bucketName) return {};

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: `usage-metrics/${process.env.ENVIRONMENT}/monthly-metrics.json`
    });

    const response = await s3Client.send(command);
    const data = await response.Body?.transformToString();

    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.log('No existing usage metrics found, using defaults');
    return {};
  }
}

async function generateForecasts(
  models: ForecastingModel[],
  historicalData: HistoricalDataPoint[],
  usageMetrics: Record<string, number[]>
): Promise<ForecastResult[]> {
  const forecasts: ForecastResult[] = [];
  const forecastPeriods = [1, 3, 6, 12]; // months

  for (const model of models) {
    for (const months of forecastPeriods) {
      try {
        let predictedCost = 0;
        let confidence = model.accuracy;

        switch (model.type) {
          case 'linear':
            predictedCost = generateLinearForecast(model, historicalData, months);
            break;
          case 'exponential':
            predictedCost = generateExponentialForecast(model, historicalData, months);
            break;
          case 'seasonal':
            predictedCost = generateSeasonalForecast(model, historicalData, months);
            break;
          case 'machine-learning':
            predictedCost = generateMLForecast(model, historicalData, usageMetrics, months);
            confidence = Math.min(0.95, model.accuracy + (historicalData.length * 0.01));
            break;
        }

        forecasts.push({
          model: model.name,
          period: `${months}M`,
          predictedCost: Math.round(predictedCost * 100) / 100,
          confidence,
          factors: {
            baselineCost: model.parameters.baselineCost || 0,
            growthRate: model.parameters.growthRate || 0,
            seasonality: model.parameters.seasonalityFactor || 1
          }
        });

      } catch (error) {
        console.error(`Error generating forecast for ${model.name}:`, error);
      }
    }
  }

  return forecasts;
}

function generateLinearForecast(
  model: ForecastingModel,
  historicalData: HistoricalDataPoint[],
  months: number
): number {
  if (historicalData.length < 2) {
    return model.parameters.baselineCost * (1 + model.parameters.growthRate) ** months;
  }

  // Calculate trend from historical data
  const costs = historicalData.map(d => d.cost);
  const avgGrowthRate = calculateAverageGrowthRate(costs);
  const lastCost = costs[costs.length - 1] || model.parameters.baselineCost;

  return lastCost * (1 + avgGrowthRate) ** months;
}

function generateExponentialForecast(
  model: ForecastingModel,
  historicalData: HistoricalDataPoint[],
  months: number
): number {
  const baselineCost = model.parameters.baselineCost;
  const growthExponent = model.parameters.growthExponent;
  const saturationPoint = model.parameters.saturationPoint;

  const predictedCost = baselineCost * (growthExponent ** months);
  return Math.min(predictedCost, saturationPoint);
}

function generateSeasonalForecast(
  model: ForecastingModel,
  historicalData: HistoricalDataPoint[],
  months: number
): number {
  const baselineCost = model.parameters.baselineCost;
  const peakMultiplier = model.parameters.peakMultiplier;
  const troughMultiplier = model.parameters.troughMultiplier;
  const cyclePeriod = model.parameters.cyclePeriod;

  // Simple seasonal adjustment based on month of year
  const currentMonth = new Date().getMonth();
  const futureMonth = (currentMonth + months) % 12;

  // Assume peak season in summer months (June-August)
  let seasonalMultiplier = 1.0;
  if (futureMonth >= 5 && futureMonth <= 7) {
    seasonalMultiplier = peakMultiplier;
  } else if (futureMonth >= 11 || futureMonth <= 1) {
    seasonalMultiplier = troughMultiplier;
  }

  return baselineCost * seasonalMultiplier * (1.1 ** months); // 10% base growth
}

function generateMLForecast(
  model: ForecastingModel,
  historicalData: HistoricalDataPoint[],
  usageMetrics: Record<string, number[]>,
  months: number
): number {
  // Simplified ML model using weighted factors
  const weights = model.parameters;
  let predictedCost = model.parameters.baselineCost || 5.0;

  if (historicalData.length > 0) {
    const recentData = historicalData.slice(-3); // Last 3 months
    const avgCost = recentData.reduce((sum, d) => sum + d.cost, 0) / recentData.length;

    // Apply growth based on usage patterns
    const uploadGrowth = estimateUsageGrowth(usageMetrics.uploads || [], months);
    const storageGrowth = estimateUsageGrowth(usageMetrics.storage || [], months);

    predictedCost = avgCost * (
      1 +
      (uploadGrowth * weights.uploadsWeight) +
      (storageGrowth * weights.storageWeight) +
      (0.05 * weights.processingWeight * months) // 5% monthly processing growth
    );
  }

  return predictedCost;
}

function calculateAverageGrowthRate(costs: number[]): number {
  if (costs.length < 2) return 0;

  let totalGrowthRate = 0;
  let periods = 0;

  for (let i = 1; i < costs.length; i++) {
    if (costs[i - 1] > 0) {
      const growthRate = (costs[i] - costs[i - 1]) / costs[i - 1];
      totalGrowthRate += growthRate;
      periods++;
    }
  }

  return periods > 0 ? totalGrowthRate / periods : 0;
}

function estimateUsageGrowth(usageData: number[], months: number): number {
  if (usageData.length < 2) return 0.1; // Default 10% growth

  const growthRate = calculateAverageGrowthRate(usageData);
  return Math.max(0, Math.min(1.0, growthRate * months)); // Cap at 100% growth
}

async function evaluateModelAccuracy(
  models: ForecastingModel[],
  historicalData: HistoricalDataPoint[]
): Promise<{ overallAccuracy: number; modelAccuracies: Record<string, number> }> {
  const modelAccuracies: Record<string, number> = {};

  // Evaluate accuracy by comparing past predictions with actual costs
  if (historicalData.length >= 6) {
    const trainData = historicalData.slice(0, -3);
    const testData = historicalData.slice(-3);

    for (const model of models) {
      let totalError = 0;
      for (let i = 0; i < testData.length; i++) {
        const predicted = generateLinearForecast(model, trainData, i + 1);
        const actual = testData[i].cost;
        if (actual > 0) {
          const error = Math.abs(predicted - actual) / actual;
          totalError += error;
        }
      }

      const accuracy = Math.max(0, 1 - (totalError / testData.length));
      modelAccuracies[model.name] = accuracy;
    }
  } else {
    // Use predefined accuracies if insufficient data
    models.forEach(model => {
      modelAccuracies[model.name] = model.accuracy;
    });
  }

  const overallAccuracy = Object.values(modelAccuracies).reduce((sum, acc) => sum + acc, 0) / models.length;

  return { overallAccuracy, modelAccuracies };
}

async function publishForecastMetrics(
  forecasts: ForecastResult[],
  accuracyResults: { overallAccuracy: number; modelAccuracies: Record<string, number> }
): Promise<void> {
  const metricData = [];

  // Publish forecast metrics
  for (const forecast of forecasts) {
    metricData.push({
      MetricName: 'PredictedMonthlyCost',
      Value: forecast.predictedCost,
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: process.env.ENVIRONMENT || 'unknown' },
        { Name: 'Model', Value: forecast.model },
        { Name: 'Period', Value: forecast.period }
      ]
    });

    metricData.push({
      MetricName: 'ForecastConfidence',
      Value: forecast.confidence,
      Unit: 'Percent',
      Dimensions: [
        { Name: 'Environment', Value: process.env.ENVIRONMENT || 'unknown' },
        { Name: 'Model', Value: forecast.model }
      ]
    });
  }

  // Publish accuracy metrics
  for (const [model, accuracy] of Object.entries(accuracyResults.modelAccuracies)) {
    metricData.push({
      MetricName: 'ModelAccuracy',
      Value: accuracy,
      Unit: 'Percent',
      Dimensions: [
        { Name: 'Environment', Value: process.env.ENVIRONMENT || 'unknown' },
        { Name: 'Model', Value: model }
      ]
    });
  }

  // Overall accuracy
  metricData.push({
    MetricName: 'OverallForecastAccuracy',
    Value: accuracyResults.overallAccuracy,
    Unit: 'Percent',
    Dimensions: [
      { Name: 'Environment', Value: process.env.ENVIRONMENT || 'unknown' }
    ]
  });

  // Next month and annual projections
  const nextMonthForecasts = forecasts.filter(f => f.period === '1M');
  const annualForecasts = forecasts.filter(f => f.period === '12M');

  if (nextMonthForecasts.length > 0) {
    const avgNextMonth = nextMonthForecasts.reduce((sum, f) => sum + f.predictedCost, 0) / nextMonthForecasts.length;
    metricData.push({
      MetricName: 'NextMonthForecast',
      Value: avgNextMonth,
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: process.env.ENVIRONMENT || 'unknown' }
      ]
    });
  }

  if (annualForecasts.length > 0) {
    const avgAnnual = annualForecasts.reduce((sum, f) => sum + f.predictedCost, 0) / annualForecasts.length;
    metricData.push({
      MetricName: 'AnnualProjection',
      Value: avgAnnual,
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: process.env.ENVIRONMENT || 'unknown' }
      ]
    });
  }

  // Batch publish metrics
  const chunks = [];
  for (let i = 0; i < metricData.length; i += 20) {
    chunks.push(metricData.slice(i, i + 20));
  }

  for (const chunk of chunks) {
    await cloudWatch.send(new PutMetricDataCommand({
      Namespace: 'ApexShare/CostForecasting',
      MetricData: chunk
    }));
  }

  console.log(`Published ${metricData.length} forecast metrics`);
}

async function storeForecastData(forecasts: ForecastResult[]): Promise<void> {
  const bucketName = process.env.COST_DATA_BUCKET;
  if (!bucketName) return;

  const forecastData = {
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT,
    forecasts: forecasts,
    metadata: {
      generatedBy: 'cost-forecaster',
      modelsUsed: [...new Set(forecasts.map(f => f.model))],
      periodsForecasted: [...new Set(forecasts.map(f => f.period))]
    }
  };

  const key = `forecasts/${process.env.ENVIRONMENT}/${new Date().toISOString().split('T')[0]}.json`;

  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: JSON.stringify(forecastData, null, 2),
    ContentType: 'application/json'
  }));

  console.log(`Stored forecast data to s3://${bucketName}/${key}`);
}

async function checkForecastAlerts(forecasts: ForecastResult[]): Promise<void> {
  const nextMonthForecasts = forecasts.filter(f => f.period === '1M');
  if (nextMonthForecasts.length === 0) return;

  const avgNextMonthCost = nextMonthForecasts.reduce((sum, f) => sum + f.predictedCost, 0) / nextMonthForecasts.length;

  // Alert thresholds based on environment
  const alertThresholds = {
    dev: 10,
    staging: 25,
    prod: 100
  };

  const threshold = alertThresholds[process.env.ENVIRONMENT as keyof typeof alertThresholds] || 50;

  if (avgNextMonthCost > threshold) {
    const message = {
      alert: 'High Cost Forecast',
      environment: process.env.ENVIRONMENT,
      predictedCost: avgNextMonthCost,
      threshold: threshold,
      variance: ((avgNextMonthCost - threshold) / threshold * 100).toFixed(1),
      timestamp: new Date().toISOString(),
      forecasts: nextMonthForecasts.map(f => ({
        model: f.model,
        cost: f.predictedCost,
        confidence: f.confidence
      }))
    };

    await snsClient.send(new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Subject: `Cost Forecast Alert - ${process.env.ENVIRONMENT?.toUpperCase()}`,
      Message: JSON.stringify(message, null, 2)
    }));

    console.log('Sent high cost forecast alert');
  }
}

async function sendErrorAlert(error: Error): Promise<void> {
  if (!process.env.SNS_TOPIC_ARN) return;

  const message = {
    error: 'Cost Forecasting Failed',
    environment: process.env.ENVIRONMENT,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };

  try {
    await snsClient.send(new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Subject: `Cost Forecasting Error - ${process.env.ENVIRONMENT?.toUpperCase()}`,
      Message: JSON.stringify(message, null, 2)
    }));
  } catch (snsError) {
    console.error('Failed to send error alert:', snsError);
  }
}