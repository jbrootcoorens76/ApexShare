// /lambda/roi-analyzer/src/index.ts
import { Handler, ScheduledEvent } from 'aws-lambda';
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetReservationPurchaseRecommendationCommand,
  GetSavingsPlansUtilizationCommand,
  Granularity
} from '@aws-sdk/client-cost-explorer';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

interface ROIAnalysis {
  optimization: string;
  investmentCost: number;
  projectedAnnualSavings: number;
  breakEvenMonths: number;
  roi: number;
  confidence: number;
  implementation: {
    effort: 'Low' | 'Medium' | 'High';
    timeline: string;
    risk: 'Low' | 'Medium' | 'High';
  };
}

interface OptimizationOpportunity {
  category: string;
  service: string;
  description: string;
  currentCost: number;
  optimizedCost: number;
  savingsPercent: number;
  implementation: string[];
}

interface CostTrend {
  service: string;
  monthlyTrend: number;
  yearlyProjection: number;
  optimizationPotential: number;
}

const costExplorer = new CostExplorerClient({ region: process.env.AWS_REGION });
const cloudWatch = new CloudWatchClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const snsClient = new SNSClient({ region: process.env.AWS_REGION });

export const handler: Handler<ScheduledEvent> = async (event) => {
  try {
    console.log('Starting ROI analysis...');

    // Analyze current cost structure
    const costStructure = await analyzeCostStructure();

    // Identify optimization opportunities
    const opportunities = await identifyOptimizationOpportunities(costStructure);

    // Calculate ROI for each opportunity
    const roiAnalyses = await calculateROIAnalyses(opportunities);

    // Analyze cost trends
    const costTrends = await analyzeCostTrends();

    // Generate comprehensive ROI report
    const roiReport = await generateROIReport(roiAnalyses, costTrends, opportunities);

    // Publish ROI metrics
    await publishROIMetrics(roiAnalyses, roiReport);

    // Store ROI analysis data
    await storeROIAnalysis(roiReport);

    // Send recommendations if significant opportunities found
    await sendROIRecommendations(roiAnalyses);

    console.log('ROI analysis completed successfully');
    return {
      statusCode: 200,
      opportunities: opportunities.length,
      totalPotentialSavings: roiReport.totalPotentialSavings,
      recommendedActions: roiReport.recommendedActions.length
    };

  } catch (error) {
    console.error('Error in ROI analysis:', error);
    await sendErrorAlert(error as Error);
    throw error;
  }
};

async function analyzeCostStructure(): Promise<Record<string, number>> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(endDate.getMonth() - 3); // Last 3 months

  const command = new GetCostAndUsageCommand({
    TimePeriod: {
      Start: startDate.toISOString().split('T')[0],
      End: endDate.toISOString().split('T')[0]
    },
    Granularity: Granularity.MONTHLY,
    Metrics: ['BlendedCost'],
    GroupBy: [
      {
        Type: 'DIMENSION',
        Key: 'SERVICE'
      }
    ]
  });

  const response = await costExplorer.send(command);
  const costStructure: Record<string, number> = {};

  if (response.ResultsByTime) {
    for (const result of response.ResultsByTime) {
      if (result.Groups) {
        for (const group of result.Groups) {
          const service = group.Keys?.[0] || 'Unknown';
          const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');
          costStructure[service] = (costStructure[service] || 0) + cost;
        }
      }
    }
  }

  // Average over 3 months
  Object.keys(costStructure).forEach(service => {
    costStructure[service] = costStructure[service] / 3;
  });

  console.log('Cost structure analyzed:', Object.keys(costStructure).length, 'services');
  return costStructure;
}

async function identifyOptimizationOpportunities(costStructure: Record<string, number>): Promise<OptimizationOpportunity[]> {
  const opportunities: OptimizationOpportunity[] = [];

  // S3 optimization opportunities
  if (costStructure['Amazon Simple Storage Service']) {
    const s3Cost = costStructure['Amazon Simple Storage Service'];
    opportunities.push({
      category: 'Storage',
      service: 'S3',
      description: 'Implement Intelligent Tiering and lifecycle policies',
      currentCost: s3Cost,
      optimizedCost: s3Cost * 0.7, // 30% savings potential
      savingsPercent: 30,
      implementation: [
        'Enable S3 Intelligent Tiering',
        'Configure lifecycle policies to transition to IA after 30 days',
        'Move old files to Glacier after 90 days',
        'Enable multi-part upload cleanup'
      ]
    });

    if (s3Cost > 10) {
      opportunities.push({
        category: 'Storage',
        service: 'S3',
        description: 'Optimize storage classes and compression',
        currentCost: s3Cost,
        optimizedCost: s3Cost * 0.65, // 35% additional savings
        savingsPercent: 35,
        implementation: [
          'Implement video compression optimization',
          'Use S3 Transfer Acceleration selectively',
          'Optimize CloudFront caching policies',
          'Implement duplicate file detection'
        ]
      });
    }
  }

  // Lambda optimization opportunities
  if (costStructure['AWS Lambda']) {
    const lambdaCost = costStructure['AWS Lambda'];
    opportunities.push({
      category: 'Compute',
      service: 'Lambda',
      description: 'Optimize memory allocation and execution time',
      currentCost: lambdaCost,
      optimizedCost: lambdaCost * 0.75, // 25% savings potential
      savingsPercent: 25,
      implementation: [
        'Use Lambda Power Tuning to optimize memory',
        'Implement connection pooling',
        'Optimize cold start performance',
        'Set appropriate timeout values'
      ]
    });

    if (lambdaCost > 5) {
      opportunities.push({
        category: 'Compute',
        service: 'Lambda',
        description: 'Implement provisioned concurrency strategically',
        currentCost: lambdaCost,
        optimizedCost: lambdaCost * 0.85, // 15% savings with better performance
        savingsPercent: 15,
        implementation: [
          'Use provisioned concurrency for critical functions',
          'Implement auto-scaling policies',
          'Optimize function packaging',
          'Consider Lambda@Edge for global functions'
        ]
      });
    }
  }

  // DynamoDB optimization opportunities
  if (costStructure['Amazon DynamoDB']) {
    const dynamodbCost = costStructure['Amazon DynamoDB'];
    opportunities.push({
      category: 'Database',
      service: 'DynamoDB',
      description: 'Optimize capacity mode and implement auto-scaling',
      currentCost: dynamodbCost,
      optimizedCost: dynamodbCost * 0.6, // 40% savings potential
      savingsPercent: 40,
      implementation: [
        'Switch to on-demand for variable workloads',
        'Implement auto-scaling for provisioned tables',
        'Enable DynamoDB TTL for temporary data',
        'Optimize partition key distribution'
      ]
    });
  }

  // CloudFront optimization opportunities
  if (costStructure['Amazon CloudFront']) {
    const cloudfrontCost = costStructure['Amazon CloudFront'];
    opportunities.push({
      category: 'CDN',
      service: 'CloudFront',
      description: 'Optimize caching and compression policies',
      currentCost: cloudfrontCost,
      optimizedCost: cloudfrontCost * 0.8, // 20% savings potential
      savingsPercent: 20,
      implementation: [
        'Optimize cache TTL policies',
        'Enable compression for text assets',
        'Implement origin shield for popular content',
        'Use price class optimization'
      ]
    });
  }

  // API Gateway optimization
  if (costStructure['Amazon API Gateway']) {
    const apiGatewayCost = costStructure['Amazon API Gateway'];
    opportunities.push({
      category: 'API',
      service: 'API Gateway',
      description: 'Implement caching and optimize request/response',
      currentCost: apiGatewayCost,
      optimizedCost: apiGatewayCost * 0.7, // 30% savings potential
      savingsPercent: 30,
      implementation: [
        'Enable API Gateway caching',
        'Optimize request/response transformations',
        'Implement request validation',
        'Use compression for large responses'
      ]
    });
  }

  console.log(`Identified ${opportunities.length} optimization opportunities`);
  return opportunities;
}

async function calculateROIAnalyses(opportunities: OptimizationOpportunity[]): Promise<ROIAnalysis[]> {
  const roiAnalyses: ROIAnalysis[] = [];

  for (const opportunity of opportunities) {
    const annualSavings = (opportunity.currentCost - opportunity.optimizedCost) * 12;

    // Estimate implementation costs based on complexity
    let implementationCost = 0;
    let effort: 'Low' | 'Medium' | 'High' = 'Low';
    let timeline = '1-2 weeks';
    let risk: 'Low' | 'Medium' | 'High' = 'Low';

    switch (opportunity.service) {
      case 'S3':
        implementationCost = opportunity.savingsPercent > 30 ? 800 : 400;
        effort = opportunity.savingsPercent > 30 ? 'Medium' : 'Low';
        timeline = opportunity.savingsPercent > 30 ? '2-4 weeks' : '1-2 weeks';
        risk = 'Low';
        break;
      case 'Lambda':
        implementationCost = opportunity.savingsPercent > 20 ? 1200 : 600;
        effort = opportunity.savingsPercent > 20 ? 'High' : 'Medium';
        timeline = opportunity.savingsPercent > 20 ? '3-6 weeks' : '2-3 weeks';
        risk = opportunity.savingsPercent > 20 ? 'Medium' : 'Low';
        break;
      case 'DynamoDB':
        implementationCost = 1000;
        effort = 'Medium';
        timeline = '2-4 weeks';
        risk = 'Medium';
        break;
      case 'CloudFront':
        implementationCost = 500;
        effort = 'Low';
        timeline = '1-2 weeks';
        risk = 'Low';
        break;
      case 'API Gateway':
        implementationCost = 700;
        effort = 'Medium';
        timeline = '2-3 weeks';
        risk = 'Low';
        break;
    }

    const breakEvenMonths = implementationCost / (annualSavings / 12);
    const roi = ((annualSavings - implementationCost) / implementationCost) * 100;

    roiAnalyses.push({
      optimization: `${opportunity.service} - ${opportunity.description}`,
      investmentCost: implementationCost,
      projectedAnnualSavings: annualSavings,
      breakEvenMonths: Math.ceil(breakEvenMonths),
      roi: Math.round(roi),
      confidence: opportunity.savingsPercent > 30 ? 0.8 : 0.9,
      implementation: {
        effort,
        timeline,
        risk
      }
    });
  }

  // Sort by ROI descending
  roiAnalyses.sort((a, b) => b.roi - a.roi);

  return roiAnalyses;
}

async function analyzeCostTrends(): Promise<CostTrend[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(endDate.getMonth() - 6); // Last 6 months

  const command = new GetCostAndUsageCommand({
    TimePeriod: {
      Start: startDate.toISOString().split('T')[0],
      End: endDate.toISOString().split('T')[0]
    },
    Granularity: Granularity.MONTHLY,
    Metrics: ['BlendedCost'],
    GroupBy: [
      {
        Type: 'DIMENSION',
        Key: 'SERVICE'
      }
    ]
  });

  const response = await costExplorer.send(command);
  const costTrends: CostTrend[] = [];

  if (response.ResultsByTime) {
    const serviceData: Record<string, number[]> = {};

    // Collect monthly data for each service
    for (const result of response.ResultsByTime) {
      if (result.Groups) {
        for (const group of result.Groups) {
          const service = group.Keys?.[0] || 'Unknown';
          const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');

          if (!serviceData[service]) {
            serviceData[service] = [];
          }
          serviceData[service].push(cost);
        }
      }
    }

    // Calculate trends for each service
    for (const [service, costs] of Object.entries(serviceData)) {
      if (costs.length >= 3) {
        const monthlyTrend = calculateTrend(costs);
        const currentCost = costs[costs.length - 1];
        const yearlyProjection = currentCost * 12 * (1 + monthlyTrend);

        // Estimate optimization potential based on service type
        let optimizationPotential = 0.1; // Default 10%
        if (service.includes('Storage')) optimizationPotential = 0.3;
        else if (service.includes('Lambda')) optimizationPotential = 0.25;
        else if (service.includes('DynamoDB')) optimizationPotential = 0.4;
        else if (service.includes('CloudFront')) optimizationPotential = 0.2;

        costTrends.push({
          service,
          monthlyTrend,
          yearlyProjection,
          optimizationPotential
        });
      }
    }
  }

  return costTrends.sort((a, b) => b.yearlyProjection - a.yearlyProjection);
}

function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;

  let totalGrowth = 0;
  let periods = 0;

  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) {
      const growth = (values[i] - values[i - 1]) / values[i - 1];
      totalGrowth += growth;
      periods++;
    }
  }

  return periods > 0 ? totalGrowth / periods : 0;
}

async function generateROIReport(
  roiAnalyses: ROIAnalysis[],
  costTrends: CostTrend[],
  opportunities: OptimizationOpportunity[]
): Promise<any> {
  const totalPotentialSavings = roiAnalyses.reduce((sum, roi) => sum + roi.projectedAnnualSavings, 0);
  const totalInvestment = roiAnalyses.reduce((sum, roi) => sum + roi.investmentCost, 0);
  const averageROI = roiAnalyses.reduce((sum, roi) => sum + roi.roi, 0) / roiAnalyses.length;

  // Quick wins (high ROI, low effort)
  const quickWins = roiAnalyses.filter(roi =>
    roi.roi > 100 && roi.implementation.effort === 'Low'
  );

  // High impact opportunities (high savings)
  const highImpact = roiAnalyses.filter(roi =>
    roi.projectedAnnualSavings > totalPotentialSavings * 0.2
  );

  return {
    summary: {
      totalPotentialSavings: Math.round(totalPotentialSavings),
      totalInvestment: Math.round(totalInvestment),
      averageROI: Math.round(averageROI),
      paybackPeriod: Math.round(totalInvestment / (totalPotentialSavings / 12)),
      confidence: roiAnalyses.reduce((sum, roi) => sum + roi.confidence, 0) / roiAnalyses.length
    },
    quickWins: quickWins.length,
    highImpactOpportunities: highImpact.length,
    recommendedActions: roiAnalyses.slice(0, 3).map(roi => ({
      optimization: roi.optimization,
      priority: roi.roi > 200 ? 'High' : roi.roi > 100 ? 'Medium' : 'Low',
      expectedSavings: Math.round(roi.projectedAnnualSavings),
      timeline: roi.implementation.timeline,
      effort: roi.implementation.effort
    })),
    costTrends: costTrends.slice(0, 5),
    detailedAnalyses: roiAnalyses,
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT
  };
}

async function publishROIMetrics(roiAnalyses: ROIAnalysis[], roiReport: any): Promise<void> {
  const metricData = [];

  // Summary metrics
  metricData.push(
    {
      MetricName: 'TotalProjectedSavings',
      Value: roiReport.summary.totalPotentialSavings,
      Unit: 'None',
      Dimensions: [
        { Name: 'Environment', Value: process.env.ENVIRONMENT || 'unknown' }
      ]
    },
    {
      MetricName: 'AverageROI',
      Value: roiReport.summary.averageROI,
      Unit: 'Percent',
      Dimensions: [
        { Name: 'Environment', Value: process.env.ENVIRONMENT || 'unknown' }
      ]
    },
    {
      MetricName: 'PaybackPeriod',
      Value: roiReport.summary.paybackPeriod,
      Unit: 'Count',
      Dimensions: [
        { Name: 'Environment', Value: process.env.ENVIRONMENT || 'unknown' }
      ]
    }
  );

  // Individual optimization metrics
  for (const roi of roiAnalyses.slice(0, 10)) { // Top 10
    const optimizationName = roi.optimization.split(' - ')[0];

    metricData.push(
      {
        MetricName: 'OptimizationSavings',
        Value: roi.projectedAnnualSavings,
        Unit: 'None',
        Dimensions: [
          { Name: 'Environment', Value: process.env.ENVIRONMENT || 'unknown' },
          { Name: 'Optimization', Value: optimizationName }
        ]
      },
      {
        MetricName: 'BreakEvenMonths',
        Value: roi.breakEvenMonths,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Environment', Value: process.env.ENVIRONMENT || 'unknown' },
          { Name: 'Optimization', Value: optimizationName }
        ]
      }
    );
  }

  // Publish in batches
  const chunks = [];
  for (let i = 0; i < metricData.length; i += 20) {
    chunks.push(metricData.slice(i, i + 20));
  }

  for (const chunk of chunks) {
    await cloudWatch.send(new PutMetricDataCommand({
      Namespace: 'ApexShare/ROI',
      MetricData: chunk
    }));
  }

  console.log(`Published ${metricData.length} ROI metrics`);
}

async function storeROIAnalysis(roiReport: any): Promise<void> {
  const bucketName = process.env.COST_DATA_BUCKET;
  if (!bucketName) return;

  const key = `roi-analysis/${process.env.ENVIRONMENT}/${new Date().toISOString().split('T')[0]}.json`;

  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: JSON.stringify(roiReport, null, 2),
    ContentType: 'application/json'
  }));

  console.log(`Stored ROI analysis to s3://${bucketName}/${key}`);
}

async function sendROIRecommendations(roiAnalyses: ROIAnalysis[]): Promise<void> {
  const highROIOpportunities = roiAnalyses.filter(roi =>
    roi.roi > 150 && roi.breakEvenMonths <= 6
  );

  if (highROIOpportunities.length === 0) return;

  const message = {
    alert: 'High ROI Optimization Opportunities',
    environment: process.env.ENVIRONMENT,
    opportunitiesCount: highROIOpportunities.length,
    totalPotentialSavings: highROIOpportunities.reduce((sum, roi) => sum + roi.projectedAnnualSavings, 0),
    recommendations: highROIOpportunities.slice(0, 3).map(roi => ({
      optimization: roi.optimization,
      roi: `${roi.roi}%`,
      annualSavings: `$${Math.round(roi.projectedAnnualSavings)}`,
      breakEven: `${roi.breakEvenMonths} months`,
      effort: roi.implementation.effort,
      timeline: roi.implementation.timeline
    })),
    timestamp: new Date().toISOString()
  };

  await snsClient.send(new PublishCommand({
    TopicArn: process.env.SNS_TOPIC_ARN,
    Subject: `ROI Optimization Recommendations - ${process.env.ENVIRONMENT?.toUpperCase()}`,
    Message: JSON.stringify(message, null, 2)
  }));

  console.log(`Sent ROI recommendations for ${highROIOpportunities.length} opportunities`);
}

async function sendErrorAlert(error: Error): Promise<void> {
  if (!process.env.SNS_TOPIC_ARN) return;

  const message = {
    error: 'ROI Analysis Failed',
    environment: process.env.ENVIRONMENT,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };

  try {
    await snsClient.send(new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Subject: `ROI Analysis Error - ${process.env.ENVIRONMENT?.toUpperCase()}`,
      Message: JSON.stringify(message, null, 2)
    }));
  } catch (snsError) {
    console.error('Failed to send error alert:', snsError);
  }
}