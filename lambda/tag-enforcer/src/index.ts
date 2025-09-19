// /lambda/tag-enforcer/src/index.ts
import { ScheduledEvent } from 'aws-lambda';
import {
  ResourceGroupsTaggingAPIClient,
  GetResourcesCommand,
  TagResourcesCommand,
  GetTagKeysCommand,
  GetTagValuesCommand
} from '@aws-sdk/client-resource-groups-tagging-api';
import {
  CloudWatchClient,
  PutMetricDataCommand,
  MetricDatum
} from '@aws-sdk/client-cloudwatch';
import {
  SNSClient,
  PublishCommand
} from '@aws-sdk/client-sns';

interface TagComplianceReport {
  totalResources: number;
  compliantResources: number;
  nonCompliantResources: number;
  compliancePercentage: number;
  missingTags: Record<string, string[]>;
  resourcesWithIssues: ResourceIssue[];
  tagUtilization: Record<string, number>;
  recommendations: string[];
}

interface ResourceIssue {
  resourceArn: string;
  resourceType: string;
  missingMandatoryTags: string[];
  invalidTagValues: string[];
  severity: 'High' | 'Medium' | 'Low';
}

interface TagValidationResult {
  isCompliant: boolean;
  missingTags: string[];
  invalidTags: string[];
  score: number;
}

export const handler = async (event: ScheduledEvent): Promise<void> => {
  const taggingClient = new ResourceGroupsTaggingAPIClient({ region: process.env.AWS_REGION });
  const cwClient = new CloudWatchClient({ region: process.env.AWS_REGION });
  const snsClient = new SNSClient({ region: process.env.AWS_REGION });

  const environment = process.env.ENVIRONMENT!;
  const snsTopicArn = process.env.SNS_TOPIC_ARN!;
  const mandatoryTags = JSON.parse(process.env.MANDATORY_TAGS!);
  const optionalTags = JSON.parse(process.env.OPTIONAL_TAGS!);

  try {
    console.log('Starting tag enforcement and compliance checking');

    // Get all resources for the project
    const resources = await getAllProjectResources(taggingClient);

    // Validate tag compliance for each resource
    const complianceReport = await validateTagCompliance(resources, mandatoryTags, optionalTags);

    // Enforce tags on non-compliant resources
    const remediationResults = await enforceTagCompliance(
      taggingClient,
      complianceReport.resourcesWithIssues,
      mandatoryTags
    );

    // Publish compliance metrics
    await publishComplianceMetrics(cwClient, complianceReport, remediationResults, environment);

    // Send alert if compliance is below threshold
    if (complianceReport.compliancePercentage < 90) {
      await sendComplianceAlert(snsClient, snsTopicArn, complianceReport, environment);
    }

    console.log(`Tag enforcement completed. Compliance: ${complianceReport.compliancePercentage.toFixed(1)}%`);

  } catch (error) {
    console.error('Error in tag enforcement:', error);
    throw error;
  }
};

async function getAllProjectResources(client: ResourceGroupsTaggingAPIClient): Promise<any[]> {
  const resources: any[] = [];
  let paginationToken: string | undefined;

  try {
    do {
      const response = await client.send(new GetResourcesCommand({
        TagFilters: [
          {
            Key: 'Project',
            Values: ['ApexShare']
          }
        ],
        IncludeComplianceDetails: true,
        ResourcesPerPage: 100,
        PaginationToken: paginationToken
      }));

      if (response.ResourceTagMappingList) {
        resources.push(...response.ResourceTagMappingList);
      }

      paginationToken = response.PaginationToken;
    } while (paginationToken);

    return resources;
  } catch (error) {
    console.error('Error getting project resources:', error);
    return [];
  }
}

async function validateTagCompliance(
  resources: any[],
  mandatoryTags: Record<string, string>,
  optionalTags: Record<string, string>
): Promise<TagComplianceReport> {
  const report: TagComplianceReport = {
    totalResources: resources.length,
    compliantResources: 0,
    nonCompliantResources: 0,
    compliancePercentage: 0,
    missingTags: {},
    resourcesWithIssues: [],
    tagUtilization: {},
    recommendations: []
  };

  const mandatoryTagKeys = Object.keys(mandatoryTags);
  const allTagKeys = [...mandatoryTagKeys, ...Object.keys(optionalTags)];

  // Initialize tag utilization tracking
  allTagKeys.forEach(key => {
    report.tagUtilization[key] = 0;
  });

  for (const resource of resources) {
    const resourceTags = resource.Tags || [];
    const resourceTagKeys = resourceTags.map((tag: any) => tag.Key);

    // Validate mandatory tags
    const validation = validateResourceTags(resource, mandatoryTags, resourceTags);

    if (validation.isCompliant) {
      report.compliantResources++;
    } else {
      report.nonCompliantResources++;

      const issue: ResourceIssue = {
        resourceArn: resource.ResourceARN,
        resourceType: getResourceTypeFromArn(resource.ResourceARN),
        missingMandatoryTags: validation.missingTags,
        invalidTagValues: validation.invalidTags,
        severity: calculateIssueSeverity(validation.missingTags.length, validation.invalidTags.length)
      };

      report.resourcesWithIssues.push(issue);

      // Track missing tags
      validation.missingTags.forEach(tag => {
        if (!report.missingTags[tag]) {
          report.missingTags[tag] = [];
        }
        report.missingTags[tag].push(resource.ResourceARN);
      });
    }

    // Track tag utilization
    resourceTagKeys.forEach(key => {
      if (report.tagUtilization.hasOwnProperty(key)) {
        report.tagUtilization[key]++;
      }
    });
  }

  // Calculate compliance percentage
  report.compliancePercentage = resources.length > 0
    ? (report.compliantResources / resources.length) * 100
    : 100;

  // Generate recommendations
  report.recommendations = generateRecommendations(report, mandatoryTagKeys);

  return report;
}

function validateResourceTags(
  resource: any,
  mandatoryTags: Record<string, string>,
  resourceTags: any[]
): TagValidationResult {
  const result: TagValidationResult = {
    isCompliant: true,
    missingTags: [],
    invalidTags: [],
    score: 100
  };

  const resourceTagMap = new Map();
  resourceTags.forEach(tag => {
    resourceTagMap.set(tag.Key, tag.Value);
  });

  // Check mandatory tags
  for (const [tagKey, expectedValue] of Object.entries(mandatoryTags)) {
    if (!resourceTagMap.has(tagKey)) {
      result.missingTags.push(tagKey);
      result.isCompliant = false;
      result.score -= 20; // Deduct 20 points per missing mandatory tag
    } else {
      const actualValue = resourceTagMap.get(tagKey);

      // For some tags, we allow different values (like dynamic dates)
      if (tagKey === 'CreatedDate' || tagKey === 'LastModified') {
        // Validate date format
        if (!isValidDate(actualValue)) {
          result.invalidTags.push(tagKey);
          result.score -= 10;
        }
      } else if (expectedValue !== actualValue && expectedValue !== '') {
        // For non-empty expected values, check exact match
        result.invalidTags.push(tagKey);
        result.score -= 10; // Deduct 10 points per invalid tag value
      }
    }
  }

  // Additional validations
  const additionalValidations = performAdditionalValidations(resource, resourceTagMap);
  result.invalidTags.push(...additionalValidations.invalidTags);
  result.score -= additionalValidations.scoreDeduction;

  if (result.invalidTags.length > 0) {
    result.isCompliant = false;
  }

  result.score = Math.max(0, result.score); // Ensure score doesn't go below 0

  return result;
}

function performAdditionalValidations(resource: any, tagMap: Map<string, string>): any {
  const invalidTags: string[] = [];
  let scoreDeduction = 0;

  // Validate email format for technical contact
  if (tagMap.has('TechnicalContact')) {
    const email = tagMap.get('TechnicalContact');
    if (email && !isValidEmail(email)) {
      invalidTags.push('TechnicalContact');
      scoreDeduction += 5;
    }
  }

  // Validate cost center format
  if (tagMap.has('CostCenter')) {
    const costCenter = tagMap.get('CostCenter');
    if (costCenter && costCenter.length < 3) {
      invalidTags.push('CostCenter');
      scoreDeduction += 5;
    }
  }

  // Validate environment values
  if (tagMap.has('Environment')) {
    const env = tagMap.get('Environment');
    if (env && !['dev', 'staging', 'prod'].includes(env)) {
      invalidTags.push('Environment');
      scoreDeduction += 10;
    }
  }

  // Validate backup requirements
  if (tagMap.has('Backup')) {
    const backup = tagMap.get('Backup');
    if (backup && !['Required', 'Optional', 'NotRequired'].includes(backup)) {
      invalidTags.push('Backup');
      scoreDeduction += 5;
    }
  }

  return { invalidTags, scoreDeduction };
}

function calculateIssueSeverity(missingTagsCount: number, invalidTagsCount: number): 'High' | 'Medium' | 'Low' {
  const totalIssues = missingTagsCount + invalidTagsCount;

  if (missingTagsCount >= 3 || totalIssues >= 5) {
    return 'High';
  } else if (missingTagsCount >= 1 || totalIssues >= 2) {
    return 'Medium';
  } else {
    return 'Low';
  }
}

async function enforceTagCompliance(
  client: ResourceGroupsTaggingAPIClient,
  resourcesWithIssues: ResourceIssue[],
  mandatoryTags: Record<string, string>
): Promise<any> {
  const remediationResults = {
    attempted: 0,
    successful: 0,
    failed: 0,
    errors: []
  };

  // Only attempt remediation for high-priority issues and missing mandatory tags
  const highPriorityIssues = resourcesWithIssues.filter(
    issue => issue.severity === 'High' && issue.missingMandatoryTags.length > 0
  );

  for (const issue of highPriorityIssues) {
    try {
      remediationResults.attempted++;

      // Prepare tags to add
      const tagsToAdd: Record<string, string> = {};

      issue.missingMandatoryTags.forEach(tagKey => {
        if (mandatoryTags[tagKey]) {
          let tagValue = mandatoryTags[tagKey];

          // Handle dynamic tag values
          if (tagKey === 'CreatedDate' || tagKey === 'LastModified') {
            tagValue = new Date().toISOString().split('T')[0];
          } else if (tagKey === 'AutoRemediated') {
            tagValue = 'Yes';
          }

          tagsToAdd[tagKey] = tagValue;
        }
      });

      // Add remediation metadata
      tagsToAdd['AutoRemediated'] = 'Yes';
      tagsToAdd['RemediationDate'] = new Date().toISOString().split('T')[0];

      if (Object.keys(tagsToAdd).length > 0) {
        await client.send(new TagResourcesCommand({
          ResourceARNList: [issue.resourceArn],
          Tags: tagsToAdd
        }));

        remediationResults.successful++;
        console.log(`Successfully remediated tags for resource: ${issue.resourceArn}`);
      }

    } catch (error) {
      remediationResults.failed++;
      remediationResults.errors.push({
        resourceArn: issue.resourceArn,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error(`Failed to remediate tags for ${issue.resourceArn}:`, error);
    }
  }

  return remediationResults;
}

function generateRecommendations(
  report: TagComplianceReport,
  mandatoryTagKeys: string[]
): string[] {
  const recommendations: string[] = [];

  // Compliance-based recommendations
  if (report.compliancePercentage < 50) {
    recommendations.push('URGENT: Implement automated tagging policies to improve compliance');
    recommendations.push('Review and update resource creation templates to include mandatory tags');
  } else if (report.compliancePercentage < 80) {
    recommendations.push('Enhance tag governance processes and training');
    recommendations.push('Consider implementing preventive controls for resource creation');
  }

  // Missing tag recommendations
  const mostMissingTags = Object.entries(report.missingTags)
    .sort(([,a], [,b]) => b.length - a.length)
    .slice(0, 3);

  mostMissingTags.forEach(([tagKey, resources]) => {
    recommendations.push(`Focus on adding '${tagKey}' tag - missing from ${resources.length} resources`);
  });

  // Utilization-based recommendations
  const lowUtilizationTags = Object.entries(report.tagUtilization)
    .filter(([key, count]) => mandatoryTagKeys.includes(key) && count < report.totalResources * 0.8)
    .map(([key]) => key);

  if (lowUtilizationTags.length > 0) {
    recommendations.push(`Improve utilization of tags: ${lowUtilizationTags.join(', ')}`);
  }

  // Resource-specific recommendations
  const highSeverityIssues = report.resourcesWithIssues.filter(issue => issue.severity === 'High');
  if (highSeverityIssues.length > 0) {
    recommendations.push(`Prioritize fixing ${highSeverityIssues.length} high-severity tag compliance issues`);
  }

  return recommendations;
}

async function publishComplianceMetrics(
  cwClient: CloudWatchClient,
  report: TagComplianceReport,
  remediationResults: any,
  environment: string
): Promise<void> {
  const metricData: MetricDatum[] = [
    {
      MetricName: 'TagCompliancePercentage',
      Value: report.compliancePercentage,
      Unit: 'Percent',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'CompliantResources',
      Value: report.compliantResources,
      Unit: 'Count',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'NonCompliantResources',
      Value: report.nonCompliantResources,
      Unit: 'Count',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'TotalResources',
      Value: report.totalResources,
      Unit: 'Count',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'HighSeverityIssues',
      Value: report.resourcesWithIssues.filter(issue => issue.severity === 'High').length,
      Unit: 'Count',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'AutoRemediationAttempts',
      Value: remediationResults.attempted,
      Unit: 'Count',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    },
    {
      MetricName: 'AutoRemediationSuccesses',
      Value: remediationResults.successful,
      Unit: 'Count',
      Dimensions: [{ Name: 'Environment', Value: environment }],
      Timestamp: new Date()
    }
  ];

  // Add tag utilization metrics
  Object.entries(report.tagUtilization).forEach(([tagKey, count]) => {
    metricData.push({
      MetricName: 'TagUtilization',
      Value: report.totalResources > 0 ? (count / report.totalResources) * 100 : 0,
      Unit: 'Percent',
      Dimensions: [
        { Name: 'Environment', Value: environment },
        { Name: 'TagKey', Value: tagKey }
      ],
      Timestamp: new Date()
    });
  });

  // Publish metrics in batches
  const batchSize = 20;
  for (let i = 0; i < metricData.length; i += batchSize) {
    const batch = metricData.slice(i, i + batchSize);
    await cwClient.send(new PutMetricDataCommand({
      Namespace: 'ApexShare/TagCompliance',
      MetricData: batch
    }));
  }
}

async function sendComplianceAlert(
  snsClient: SNSClient,
  topicArn: string,
  report: TagComplianceReport,
  environment: string
): Promise<void> {
  const subject = `🏷️ Tag Compliance Alert - ${environment.toUpperCase()}`;

  let message = `Tag Compliance Report - ${environment.toUpperCase()}\n`;
  message += `Generated: ${new Date().toISOString()}\n\n`;

  message += `COMPLIANCE SUMMARY:\n`;
  message += '─'.repeat(40) + '\n';
  message += `Overall Compliance: ${report.compliancePercentage.toFixed(1)}%\n`;
  message += `Total Resources: ${report.totalResources}\n`;
  message += `Compliant Resources: ${report.compliantResources}\n`;
  message += `Non-Compliant Resources: ${report.nonCompliantResources}\n\n`;

  if (report.resourcesWithIssues.length > 0) {
    message += `TOP ISSUES:\n`;
    message += '─'.repeat(20) + '\n';

    const severityCounts = {
      High: report.resourcesWithIssues.filter(i => i.severity === 'High').length,
      Medium: report.resourcesWithIssues.filter(i => i.severity === 'Medium').length,
      Low: report.resourcesWithIssues.filter(i => i.severity === 'Low').length
    };

    message += `High Severity: ${severityCounts.High}\n`;
    message += `Medium Severity: ${severityCounts.Medium}\n`;
    message += `Low Severity: ${severityCounts.Low}\n\n`;
  }

  if (Object.keys(report.missingTags).length > 0) {
    message += `MOST MISSING TAGS:\n`;
    message += '─'.repeat(30) + '\n';

    const topMissingTags = Object.entries(report.missingTags)
      .sort(([,a], [,b]) => b.length - a.length)
      .slice(0, 5);

    topMissingTags.forEach(([tag, resources]) => {
      message += `• ${tag}: Missing from ${resources.length} resources\n`;
    });
    message += '\n';
  }

  if (report.recommendations.length > 0) {
    message += `RECOMMENDATIONS:\n`;
    message += '─'.repeat(25) + '\n';
    report.recommendations.slice(0, 5).forEach(rec => {
      message += `• ${rec}\n`;
    });
    message += '\n';
  }

  message += `IMMEDIATE ACTIONS:\n`;
  message += '─'.repeat(25) + '\n';
  message += '• Review non-compliant resources and apply missing tags\n';
  message += '• Update resource creation templates to include mandatory tags\n';
  message += '• Consider implementing AWS Config rules for tag compliance\n';
  message += `• View detailed metrics: https://console.aws.amazon.com/cloudwatch/home#dashboards:name=ApexShare-Tag-Compliance-${environment}\n`;

  await snsClient.send(new PublishCommand({
    TopicArn: topicArn,
    Subject: subject,
    Message: message
  }));
}

// Utility functions
function getResourceTypeFromArn(arn: string): string {
  const parts = arn.split(':');
  if (parts.length >= 3) {
    return parts[2]; // Service name
  }
  return 'unknown';
}

function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}