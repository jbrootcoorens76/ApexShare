// /lib/constructs/cost-allocation-tagging-construct.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../shared/config';

export interface CostAllocationTaggingProps {
  config: EnvironmentConfig;
  alertTopic: sns.Topic;
}

export interface TaggingStrategy {
  mandatory: Record<string, string>;
  optional: Record<string, string>;
  conditional: Record<string, (resource: any) => string>;
}

export class CostAllocationTaggingConstruct extends Construct {
  public readonly taggingStrategy: TaggingStrategy;
  public readonly tagEnforcer: lambda.Function;
  public readonly costAllocationReporter: lambda.Function;

  constructor(scope: Construct, id: string, props: CostAllocationTaggingProps) {
    super(scope, id);

    // Define comprehensive tagging strategy
    this.taggingStrategy = this.defineTaggingStrategy(props.config);

    // Create tag enforcement function
    this.tagEnforcer = this.createTagEnforcer(props.config, props.alertTopic);

    // Create cost allocation reporter
    this.costAllocationReporter = this.createCostAllocationReporter(props.config, props.alertTopic);

    // Apply tags to the stack
    this.applyStackTags(props.config);

    // Set up tag compliance monitoring
    this.setupTagComplianceMonitoring(props.config, props.alertTopic);
  }

  private defineTaggingStrategy(config: EnvironmentConfig): TaggingStrategy {
    return {
      mandatory: {
        // Core identification tags
        'Project': 'ApexShare',
        'Environment': config.env,
        'Owner': 'ApexShareTeam',
        'CostCenter': 'VideoSharing',
        'Purpose': 'MotorcycleTraining',

        // Financial tracking tags
        'BillingCategory': this.getBillingCategory(config.env),
        'CostAllocation': 'ApexShare-VideoSharing',
        'BudgetOwner': 'ProductTeam',

        // Operational tags
        'Backup': this.getBackupRequirement(config.env),
        'Monitoring': 'Enabled',
        'Compliance': 'Standard',

        // Lifecycle tags
        'CreatedBy': 'CDK-Deployment',
        'CreatedDate': new Date().toISOString().split('T')[0],
        'AutoShutdown': config.env === 'dev' ? 'Enabled' : 'Disabled'
      },
      optional: {
        // Business context tags
        'BusinessUnit': 'Training',
        'Application': 'VideoSharing',
        'Service': 'ApexShare',
        'Component': '', // To be set per resource
        'Version': '1.0',

        // Technical tags
        'TechnicalContact': 'devops@apexshare.training',
        'SupportLevel': config.env === 'prod' ? 'Critical' : 'Standard',
        'DataClassification': 'Internal',
        'SecurityReview': 'Completed',

        // Cost optimization tags
        'OptimizationCandidate': 'No',
        'RightsizingStatus': 'Optimized',
        'ReservedInstance': 'No',
        'SpotEligible': 'No'
      },
      conditional: {
        // Dynamic tags based on resource type and configuration
        'ResourceType': (resource: any) => this.getResourceType(resource),
        'CostCategory': (resource: any) => this.getCostCategory(resource),
        'OptimizationPriority': (resource: any) => this.getOptimizationPriority(resource, config.env),
        'UsagePattern': (resource: any) => this.getUsagePattern(resource, config.env),
        'DataRetention': (resource: any) => this.getDataRetention(resource, config),
        'ScalingBehavior': (resource: any) => this.getScalingBehavior(resource),
        'Region': () => cdk.Stack.of(this).region,
        'AccountId': () => cdk.Stack.of(this).account
      }
    };
  }

  private getBillingCategory(environment: string): string {
    switch (environment) {
      case 'prod': return 'Production-Revenue';
      case 'staging': return 'Testing-OpEx';
      case 'dev': return 'Development-OpEx';
      default: return 'Other-OpEx';
    }
  }

  private getBackupRequirement(environment: string): string {
    return environment === 'prod' ? 'Required' : 'Optional';
  }

  private getResourceType(resource: any): string {
    if (resource.cfnResourceType) {
      const type = resource.cfnResourceType;
      if (type.includes('Lambda')) return 'Compute';
      if (type.includes('S3')) return 'Storage';
      if (type.includes('DynamoDB')) return 'Database';
      if (type.includes('CloudFront')) return 'CDN';
      if (type.includes('ApiGateway')) return 'API';
      if (type.includes('CloudWatch')) return 'Monitoring';
    }
    return 'Other';
  }

  private getCostCategory(resource: any): string {
    const resourceType = this.getResourceType(resource);
    switch (resourceType) {
      case 'Storage': return 'Storage-Primary';
      case 'Compute': return 'Compute-Serverless';
      case 'Database': return 'Database-NoSQL';
      case 'CDN': return 'Network-CDN';
      case 'API': return 'Compute-API';
      case 'Monitoring': return 'Operations-Monitoring';
      default: return 'Other-Misc';
    }
  }

  private getOptimizationPriority(resource: any, environment: string): string {
    const resourceType = this.getResourceType(resource);

    // Higher priority for expensive resources in production
    if (environment === 'prod') {
      if (resourceType === 'Storage' || resourceType === 'CDN') return 'High';
      if (resourceType === 'Compute' || resourceType === 'Database') return 'Medium';
    }

    return 'Low';
  }

  private getUsagePattern(resource: any, environment: string): string {
    const resourceType = this.getResourceType(resource);

    if (environment === 'dev') return 'Intermittent';
    if (environment === 'staging') return 'Periodic';

    // Production usage patterns
    switch (resourceType) {
      case 'Storage': return 'Continuous';
      case 'CDN': return 'Variable';
      case 'Compute': return 'On-Demand';
      case 'Database': return 'Continuous';
      default: return 'Standard';
    }
  }

  private getDataRetention(resource: any, config: EnvironmentConfig): string {
    const resourceType = this.getResourceType(resource);

    if (resourceType === 'Storage') {
      return config.env === 'prod' ? '90-Days' : `${config.retentionDays}-Days`;
    }

    if (resourceType === 'Database') {
      return config.env === 'prod' ? '30-Days' : '7-Days';
    }

    return 'Standard';
  }

  private getScalingBehavior(resource: any): string {
    const resourceType = this.getResourceType(resource);

    switch (resourceType) {
      case 'Compute': return 'Auto-Scale';
      case 'Storage': return 'Elastic';
      case 'Database': return 'On-Demand';
      default: return 'Fixed';
    }
  }

  private createTagEnforcer(config: EnvironmentConfig, alertTopic: sns.Topic): lambda.Function {
    const tagEnforcer = new nodejs.NodejsFunction(this, 'TagEnforcer', {
      functionName: `apexshare-tag-enforcer-${config.env}`,
      entry: 'lambda/tag-enforcer/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      environment: {
        ENVIRONMENT: config.env,
        SNS_TOPIC_ARN: alertTopic.topicArn,
        MANDATORY_TAGS: JSON.stringify(this.taggingStrategy.mandatory),
        OPTIONAL_TAGS: JSON.stringify(this.taggingStrategy.optional)
      }
    });

    // Grant comprehensive tagging permissions
    tagEnforcer.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          // Resource tagging
          'tag:GetResources',
          'tag:TagResources',
          'tag:UntagResources',
          'tag:GetTagKeys',
          'tag:GetTagValues',

          // Service-specific tagging
          's3:GetBucketTagging',
          's3:PutBucketTagging',
          'lambda:ListTags',
          'lambda:TagResource',
          'lambda:UntagResource',
          'dynamodb:ListTagsOfResource',
          'dynamodb:TagResource',
          'dynamodb:UntagResource',
          'cloudfront:ListTagsForResource',
          'cloudfront:TagResource',
          'cloudfront:UntagResource',
          'apigateway:GET',
          'apigateway:PUT',

          // Cost and billing
          'ce:GetCostAndUsage',
          'ce:GetDimensionValues',
          'organizations:ListAccounts',
          'organizations:DescribeOrganization',

          // Notifications
          'sns:Publish',

          // CloudWatch metrics
          'cloudwatch:PutMetricData',

          // Config for compliance
          'config:GetComplianceDetailsByResource',
          'config:GetComplianceDetailsByConfigRule'
        ],
        resources: ['*']
      })
    );

    // Schedule tag enforcement daily
    const enforcementRule = new events.Rule(this, 'TagEnforcementSchedule', {
      ruleName: `apexshare-tag-enforcement-${config.env}`,
      description: 'Daily tag compliance enforcement and monitoring',
      schedule: events.Schedule.rate(cdk.Duration.days(1))
    });

    enforcementRule.addTarget(new targets.LambdaFunction(tagEnforcer));

    return tagEnforcer;
  }

  private createCostAllocationReporter(config: EnvironmentConfig, alertTopic: sns.Topic): lambda.Function {
    const costReporter = new nodejs.NodejsFunction(this, 'CostAllocationReporter', {
      functionName: `apexshare-cost-allocation-reporter-${config.env}`,
      entry: 'lambda/cost-allocation-reporter/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        ENVIRONMENT: config.env,
        SNS_TOPIC_ARN: alertTopic.topicArn
      }
    });

    // Grant cost analysis permissions
    costReporter.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ce:GetCostAndUsage',
          'ce:GetDimensionValues',
          'ce:GetReservationCoverage',
          'ce:GetReservationPurchaseRecommendation',
          'ce:GetReservationUtilization',
          'ce:GetUsageReport',
          'ce:ListCostCategoryDefinitions',
          'tag:GetResources',
          'tag:GetTagKeys',
          'tag:GetTagValues',
          'cloudwatch:PutMetricData',
          'sns:Publish'
        ],
        resources: ['*']
      })
    );

    // Schedule cost allocation reporting weekly
    const reportingRule = new events.Rule(this, 'CostAllocationReportingSchedule', {
      ruleName: `apexshare-cost-allocation-reporting-${config.env}`,
      description: 'Weekly cost allocation and chargeback reporting',
      schedule: events.Schedule.rate(cdk.Duration.days(7))
    });

    reportingRule.addTarget(new targets.LambdaFunction(costReporter));

    return costReporter;
  }

  private applyStackTags(config: EnvironmentConfig): void {
    // Apply mandatory tags to the entire stack
    Object.entries(this.taggingStrategy.mandatory).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });

    // Apply selected optional tags
    const selectedOptionalTags = {
      'BusinessUnit': this.taggingStrategy.optional['BusinessUnit'],
      'Application': this.taggingStrategy.optional['Application'],
      'TechnicalContact': this.taggingStrategy.optional['TechnicalContact'],
      'DataClassification': this.taggingStrategy.optional['DataClassification']
    };

    Object.entries(selectedOptionalTags).forEach(([key, value]) => {
      if (value) {
        cdk.Tags.of(this).add(key, value);
      }
    });

    // Apply conditional tags
    cdk.Tags.of(this).add('Region', cdk.Stack.of(this).region);
    cdk.Tags.of(this).add('StackName', cdk.Stack.of(this).stackName);
  }

  private setupTagComplianceMonitoring(config: EnvironmentConfig, alertTopic: sns.Topic): void {
    // Create Config rules for tag compliance (would be implemented separately)
    // This is a placeholder for the monitoring setup

    // Create tag compliance metrics function
    const complianceMonitor = new nodejs.NodejsFunction(this, 'TagComplianceMonitor', {
      functionName: `apexshare-tag-compliance-monitor-${config.env}`,
      entry: 'lambda/tag-compliance-monitor/src/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        ENVIRONMENT: config.env,
        SNS_TOPIC_ARN: alertTopic.topicArn
      }
    });

    complianceMonitor.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'tag:GetResources',
          'tag:GetComplianceSummary',
          'config:GetComplianceDetailsByResource',
          'cloudwatch:PutMetricData',
          'sns:Publish'
        ],
        resources: ['*']
      })
    );

    // Schedule compliance monitoring every 4 hours
    const complianceRule = new events.Rule(this, 'TagComplianceMonitoringSchedule', {
      ruleName: `apexshare-tag-compliance-monitoring-${config.env}`,
      description: 'Tag compliance monitoring and alerting',
      schedule: events.Schedule.rate(cdk.Duration.hours(4))
    });

    complianceRule.addTarget(new targets.LambdaFunction(complianceMonitor));
  }

  public static applyResourceTags(
    resource: cdk.IConstruct,
    resourceType: string,
    additionalTags: Record<string, string> = {}
  ): void {
    // Common resource-specific tags
    const resourceTags = {
      'ResourceType': resourceType,
      'Component': resourceType.toLowerCase(),
      'ManagedBy': 'CDK',
      'LastModified': new Date().toISOString().split('T')[0],
      ...additionalTags
    };

    Object.entries(resourceTags).forEach(([key, value]) => {
      cdk.Tags.of(resource).add(key, value);
    });
  }

  public static applyCostOptimizationTags(
    resource: cdk.IConstruct,
    optimizationData: {
      priority: 'High' | 'Medium' | 'Low';
      candidate: boolean;
      status: string;
      rightsizing: boolean;
    }
  ): void {
    const optimizationTags = {
      'OptimizationPriority': optimizationData.priority,
      'OptimizationCandidate': optimizationData.candidate ? 'Yes' : 'No',
      'OptimizationStatus': optimizationData.status,
      'RightsizingCandidate': optimizationData.rightsizing ? 'Yes' : 'No',
      'LastOptimizationCheck': new Date().toISOString().split('T')[0]
    };

    Object.entries(optimizationTags).forEach(([key, value]) => {
      cdk.Tags.of(resource).add(key, value);
    });
  }

  public static applyFinancialTags(
    resource: cdk.IConstruct,
    financialData: {
      costCenter: string;
      budgetOwner: string;
      chargebackCode?: string;
      projectCode?: string;
    }
  ): void {
    const financialTags = {
      'CostCenter': financialData.costCenter,
      'BudgetOwner': financialData.budgetOwner,
      'FinancialOwner': financialData.budgetOwner,
      ...(financialData.chargebackCode && { 'ChargebackCode': financialData.chargebackCode }),
      ...(financialData.projectCode && { 'ProjectCode': financialData.projectCode })
    };

    Object.entries(financialTags).forEach(([key, value]) => {
      cdk.Tags.of(resource).add(key, value);
    });
  }

  public getTaggingCompliance(): Record<string, any> {
    return {
      mandatoryTags: Object.keys(this.taggingStrategy.mandatory),
      optionalTags: Object.keys(this.taggingStrategy.optional),
      conditionalTags: Object.keys(this.taggingStrategy.conditional),
      totalTagsRequired: Object.keys(this.taggingStrategy.mandatory).length,
      complianceLevel: 'Strict', // All mandatory tags must be present
      enforcementEnabled: true,
      autoRemediationEnabled: true
    };
  }
}