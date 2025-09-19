// /lambda/cost-anomaly-detector/src/index.ts
import { ScheduledEvent } from 'aws-lambda';
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetAnomalyDetectorsCommand,
  GetAnomaliesCommand
} from '@aws-sdk/client-cost-explorer';
import {
  CloudWatchClient,
  PutMetricDataCommand
} from '@aws-sdk/client-cloudwatch';
import {
  SNSClient,
  PublishCommand
} from '@aws-sdk/client-sns';

interface CostData {
  date: string;
  cost: number;
  service: string;
}

interface AnomalyAlert {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  currentCost: number;
  expectedCost: number;
  variance: number;
  service?: string;
}

export const handler = async (event: ScheduledEvent): Promise<void> => {
  const ceClient = new CostExplorerClient({ region: 'us-east-1' }); // Cost Explorer is only in us-east-1
  const cwClient = new CloudWatchClient({ region: process.env.AWS_REGION });
  const snsClient = new SNSClient({ region: process.env.AWS_REGION });

  const environment = process.env.ENVIRONMENT!;
  const budgetThreshold = parseFloat(process.env.BUDGET_THRESHOLD!);
  const snsTopicArn = process.env.SNS_TOPIC_ARN!;

  try {
    console.log('Starting cost anomaly detection');

    // Get current month's cost data
    const currentMonthCosts = await getCurrentMonthCosts(ceClient);
    const previousMonthCosts = await getPreviousMonthCosts(ceClient);

    // Analyze costs and detect anomalies
    const anomalies = await detectAnomalies(currentMonthCosts, previousMonthCosts, budgetThreshold);

    // Publish metrics to CloudWatch
    await publishMetrics(cwClient, currentMonthCosts, environment);

    // Send alerts if anomalies detected
    if (anomalies.length > 0) {
      await sendAnomalyAlerts(snsClient, snsTopicArn, anomalies, environment);
    }

    console.log(`Cost anomaly detection completed. Found ${anomalies.length} anomalies.`);

  } catch (error) {
    console.error('Error in cost anomaly detection:', error);

    // Send error notification
    await snsClient.send(new PublishCommand({
      TopicArn: snsTopicArn,
      Subject: `Cost Anomaly Detection Error - ${environment.toUpperCase()}`,
      Message: `Cost anomaly detection failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }));

    throw error;
  }
};

async function getCurrentMonthCosts(ceClient: CostExplorerClient): Promise<CostData[]> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const params = {
    TimePeriod: {
      Start: startOfMonth.toISOString().split('T')[0],
      End: endOfMonth.toISOString().split('T')[0]
    },
    Granularity: 'DAILY',
    Metrics: ['BlendedCost'],
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

  const costs: CostData[] = [];

  if (response.ResultsByTime) {
    for (const result of response.ResultsByTime) {
      if (result.Groups) {
        for (const group of result.Groups) {
          const service = group.Keys?.[0] || 'Unknown';
          const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');

          costs.push({
            date: result.TimePeriod?.Start || '',
            cost,
            service
          });
        }
      }
    }
  }

  return costs;
}

async function getPreviousMonthCosts(ceClient: CostExplorerClient): Promise<CostData[]> {
  const now = new Date();
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const params = {
    TimePeriod: {
      Start: startOfPrevMonth.toISOString().split('T')[0],
      End: endOfPrevMonth.toISOString().split('T')[0]
    },
    Granularity: 'MONTHLY',
    Metrics: ['BlendedCost'],
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

  const costs: CostData[] = [];

  if (response.ResultsByTime) {
    for (const result of response.ResultsByTime) {
      if (result.Groups) {
        for (const group of result.Groups) {
          const service = group.Keys?.[0] || 'Unknown';
          const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');

          costs.push({
            date: result.TimePeriod?.Start || '',
            cost,
            service
          });
        }
      }
    }
  }

  return costs;
}

async function detectAnomalies(
  currentCosts: CostData[],
  previousCosts: CostData[],
  budgetThreshold: number
): Promise<AnomalyAlert[]> {
  const anomalies: AnomalyAlert[] = [];

  // Calculate total current month cost
  const totalCurrentCost = currentCosts.reduce((sum, cost) => sum + cost.cost, 0);

  // Calculate total previous month cost for comparison
  const totalPreviousCost = previousCosts.reduce((sum, cost) => sum + cost.cost, 0);

  // Check budget threshold
  const budgetUtilization = (totalCurrentCost / budgetThreshold) * 100;

  if (budgetUtilization > 90) {
    anomalies.push({
      severity: 'CRITICAL',
      message: `Budget utilization is ${budgetUtilization.toFixed(1)}% (${totalCurrentCost.toFixed(2)}/${budgetThreshold.toFixed(2)})`,
      currentCost: totalCurrentCost,
      expectedCost: budgetThreshold,
      variance: budgetUtilization - 100
    });
  } else if (budgetUtilization > 75) {
    anomalies.push({
      severity: 'HIGH',
      message: `Budget utilization is ${budgetUtilization.toFixed(1)}% (${totalCurrentCost.toFixed(2)}/${budgetThreshold.toFixed(2)})`,
      currentCost: totalCurrentCost,
      expectedCost: budgetThreshold,
      variance: budgetUtilization - 75
    });
  }

  // Check month-over-month variance
  if (totalPreviousCost > 0) {
    const monthOverMonthChange = ((totalCurrentCost - totalPreviousCost) / totalPreviousCost) * 100;

    if (Math.abs(monthOverMonthChange) > 50) {
      anomalies.push({
        severity: monthOverMonthChange > 0 ? 'HIGH' : 'MEDIUM',
        message: `Month-over-month cost change: ${monthOverMonthChange > 0 ? '+' : ''}${monthOverMonthChange.toFixed(1)}%`,
        currentCost: totalCurrentCost,
        expectedCost: totalPreviousCost,
        variance: monthOverMonthChange
      });
    }
  }

  // Check service-specific anomalies
  const serviceAnomalies = detectServiceAnomalies(currentCosts, previousCosts);
  anomalies.push(...serviceAnomalies);

  return anomalies;
}

function detectServiceAnomalies(currentCosts: CostData[], previousCosts: CostData[]): AnomalyAlert[] {
  const anomalies: AnomalyAlert[] = [];

  // Group costs by service
  const currentServiceCosts = groupCostsByService(currentCosts);
  const previousServiceCosts = groupCostsByService(previousCosts);

  for (const [service, currentCost] of Object.entries(currentServiceCosts)) {
    const previousCost = previousServiceCosts[service] || 0;

    if (previousCost > 0) {
      const serviceChange = ((currentCost - previousCost) / previousCost) * 100;

      // Flag significant service-specific changes
      if (Math.abs(serviceChange) > 100 && currentCost > 1) { // Only alert if cost > $1
        anomalies.push({
          severity: serviceChange > 0 ? 'MEDIUM' : 'LOW',
          message: `${service} cost changed by ${serviceChange > 0 ? '+' : ''}${serviceChange.toFixed(1)}%`,
          currentCost,
          expectedCost: previousCost,
          variance: serviceChange,
          service
        });
      }
    } else if (currentCost > 5) { // New service with significant cost
      anomalies.push({
        severity: 'MEDIUM',
        message: `New service cost detected: ${service} ($${currentCost.toFixed(2)})`,
        currentCost,
        expectedCost: 0,
        variance: 100,
        service
      });
    }
  }

  return anomalies;
}

function groupCostsByService(costs: CostData[]): Record<string, number> {
  return costs.reduce((acc, cost) => {
    acc[cost.service] = (acc[cost.service] || 0) + cost.cost;
    return acc;
  }, {} as Record<string, number>);
}

async function publishMetrics(
  cwClient: CloudWatchClient,
  costs: CostData[],
  environment: string
): Promise<void> {
  const totalCost = costs.reduce((sum, cost) => sum + cost.cost, 0);
  const serviceCosts = groupCostsByService(costs);

  // Publish total cost metric
  await cwClient.send(new PutMetricDataCommand({
    Namespace: 'ApexShare/Costs',
    MetricData: [
      {
        MetricName: 'TotalCost',
        Value: totalCost,
        Unit: 'None',
        Dimensions: [
          {
            Name: 'Environment',
            Value: environment
          }
        ],
        Timestamp: new Date()
      }
    ]
  }));

  // Publish service-specific costs
  const serviceMetrics = Object.entries(serviceCosts).map(([service, cost]) => ({
    MetricName: `${service.replace(/[^a-zA-Z0-9]/g, '')}Cost`,
    Value: cost,
    Unit: 'None',
    Dimensions: [
      {
        Name: 'Environment',
        Value: environment
      },
      {
        Name: 'Service',
        Value: service
      }
    ],
    Timestamp: new Date()
  }));

  if (serviceMetrics.length > 0) {
    await cwClient.send(new PutMetricDataCommand({
      Namespace: 'ApexShare/Costs',
      MetricData: serviceMetrics
    }));
  }
}

async function sendAnomalyAlerts(
  snsClient: SNSClient,
  topicArn: string,
  anomalies: AnomalyAlert[],
  environment: string
): Promise<void> {
  const criticalAnomalies = anomalies.filter(a => a.severity === 'CRITICAL');
  const highAnomalies = anomalies.filter(a => a.severity === 'HIGH');
  const mediumAnomalies = anomalies.filter(a => a.severity === 'MEDIUM');

  let subject = `Cost Anomaly Alert - ${environment.toUpperCase()}`;
  if (criticalAnomalies.length > 0) {
    subject = `🚨 CRITICAL ${subject}`;
  } else if (highAnomalies.length > 0) {
    subject = `⚠️ HIGH ${subject}`;
  }

  const message = formatAnomalyMessage(anomalies, environment);

  await snsClient.send(new PublishCommand({
    TopicArn: topicArn,
    Subject: subject,
    Message: message
  }));
}

function formatAnomalyMessage(anomalies: AnomalyAlert[], environment: string): string {
  let message = `Cost Anomaly Detection Report - ${environment.toUpperCase()}\n`;
  message += `Timestamp: ${new Date().toISOString()}\n\n`;

  const severityGroups = {
    CRITICAL: anomalies.filter(a => a.severity === 'CRITICAL'),
    HIGH: anomalies.filter(a => a.severity === 'HIGH'),
    MEDIUM: anomalies.filter(a => a.severity === 'MEDIUM'),
    LOW: anomalies.filter(a => a.severity === 'LOW')
  };

  for (const [severity, alerts] of Object.entries(severityGroups)) {
    if (alerts.length > 0) {
      message += `${severity} ALERTS (${alerts.length}):\n`;
      message += '─'.repeat(50) + '\n';

      for (const alert of alerts) {
        message += `• ${alert.message}\n`;
        if (alert.service) {
          message += `  Service: ${alert.service}\n`;
        }
        message += `  Current: $${alert.currentCost.toFixed(2)}\n`;
        message += `  Expected: $${alert.expectedCost.toFixed(2)}\n`;
        message += `  Variance: ${alert.variance > 0 ? '+' : ''}${alert.variance.toFixed(1)}%\n\n`;
      }
    }
  }

  message += '\nRecommended Actions:\n';
  message += '─'.repeat(50) + '\n';

  if (anomalies.some(a => a.severity === 'CRITICAL')) {
    message += '• Review and optimize high-cost services immediately\n';
    message += '• Consider implementing temporary cost controls\n';
  }

  if (anomalies.some(a => a.service?.includes('S3'))) {
    message += '• Review S3 storage classes and lifecycle policies\n';
  }

  if (anomalies.some(a => a.service?.includes('Lambda'))) {
    message += '• Optimize Lambda memory allocation and timeout settings\n';
  }

  message += '• Check CloudWatch dashboard for detailed cost breakdown\n';
  message += `• Dashboard: https://console.aws.amazon.com/cloudwatch/home#dashboards:name=ApexShare-Cost-Monitoring-${environment}\n`;

  return message;
}