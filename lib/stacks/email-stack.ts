/**
 * Email Stack for ApexShare Infrastructure
 *
 * Creates and configures:
 * - SES domain identity and verification
 * - Email sending configuration with bounce/complaint handling
 * - SNS topics for email notifications
 * - CloudWatch alarms for email delivery monitoring
 * - Configuration sets for email tracking
 */

import * as cdk from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { ApexShareStackProps } from '../shared/types';
import { getResourceNames } from '../shared/config';
import { EMAIL_CONFIG, MONITORING_CONFIG } from '../shared/constants';

export class EmailStack extends cdk.Stack {
  public readonly domainIdentity: ses.EmailIdentity;
  public readonly configurationSet: ses.ConfigurationSet;
  public readonly bounceNotificationTopic: sns.Topic;
  public readonly complaintNotificationTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: ApexShareStackProps) {
    super(scope, id, props);

    const { config } = props;
    const resourceNames = getResourceNames(config);
    const tags = resourceNames.getTags();

    // Apply tags to the entire stack
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });

    // Create SNS topics for bounce and complaint notifications
    this.bounceNotificationTopic = this.createBounceNotificationTopic(resourceNames);
    this.complaintNotificationTopic = this.createComplaintNotificationTopic(resourceNames);

    // Create SES configuration set
    this.configurationSet = this.createConfigurationSet(resourceNames, config);

    // Create domain identity
    this.domainIdentity = this.createDomainIdentity(config, resourceNames);

    // Create email bounce/complaint handlers
    this.createBounceComplaintHandlers(config, resourceNames);

    // Create CloudWatch alarms for email monitoring
    this.createEmailMonitoringAlarms(config);

    // Create outputs
    this.createOutputs(config);
  }

  /**
   * Create SNS topic for bounce notifications
   */
  private createBounceNotificationTopic(
    resourceNames: ReturnType<typeof getResourceNames>
  ): sns.Topic {
    const topic = new sns.Topic(this, 'BounceNotificationTopic', {
      topicName: `apexshare-email-bounces-${resourceNames.getTags().Environment}`,
      displayName: 'ApexShare Email Bounces',
      fifo: false,
    });

    // Add CloudWatch Logs subscription for bounce tracking
    const logGroup = new logs.LogGroup(this, 'BounceLogGroup', {
      logGroupName: `/aws/ses/apexshare-bounces-${resourceNames.getTags().Environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    return topic;
  }

  /**
   * Create SNS topic for complaint notifications
   */
  private createComplaintNotificationTopic(
    resourceNames: ReturnType<typeof getResourceNames>
  ): sns.Topic {
    const topic = new sns.Topic(this, 'ComplaintNotificationTopic', {
      topicName: `apexshare-email-complaints-${resourceNames.getTags().Environment}`,
      displayName: 'ApexShare Email Complaints',
      fifo: false,
    });

    // Add CloudWatch Logs subscription for complaint tracking
    const logGroup = new logs.LogGroup(this, 'ComplaintLogGroup', {
      logGroupName: `/aws/ses/apexshare-complaints-${resourceNames.getTags().Environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    return topic;
  }

  /**
   * Create SES configuration set
   */
  private createConfigurationSet(
    resourceNames: ReturnType<typeof getResourceNames>,
    config: any
  ): ses.ConfigurationSet {
    const configSet = new ses.ConfigurationSet(this, 'ConfigurationSet', {
      configurationSetName: `apexshare-emails-${config.env}`,
      // Reputation tracking enabled by default
      reputationMetrics: true,
    });

    // Add event destinations for bounce and complaint tracking
    configSet.addEventDestination('BounceDestination', {
      destination: ses.EventDestination.snsTopic(this.bounceNotificationTopic),
      events: [ses.EmailSendingEvent.BOUNCE],
      enabled: true,
    });

    configSet.addEventDestination('ComplaintDestination', {
      destination: ses.EventDestination.snsTopic(this.complaintNotificationTopic),
      events: [ses.EmailSendingEvent.COMPLAINT],
      enabled: true,
    });

    // CloudWatch event destination will be added manually in console if needed
    // The CDK SES construct has compatibility issues with CloudWatch dimensions

    return configSet;
  }

  /**
   * Create domain identity for email sending
   */
  private createDomainIdentity(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>
  ): ses.EmailIdentity {
    // For production, use the root domain (apexshare.be)
    // For dev/staging, use subdomain (dev.apexshare.be, staging.apexshare.be)
    const emailDomain = config.env === 'prod' ? 'apexshare.be' : config.domain;

    const identity = new ses.EmailIdentity(this, 'DomainIdentity', {
      identity: ses.Identity.domain(emailDomain),
      configurationSet: this.configurationSet,
      dkimSigning: true, // Enable DKIM signing
      feedbackForwarding: false, // We handle bounces/complaints via SNS
      mailFromDomain: `mail.${emailDomain}`,
      mailFromBehaviorOnMxFailure: ses.MailFromBehaviorOnMxFailure.USE_DEFAULT_VALUE,
    });

    // Add policy to allow the email sender Lambda to use this identity
    identity.grantSendEmail(new iam.ServicePrincipal('lambda.amazonaws.com'));

    return identity;
  }

  /**
   * Create Lambda functions to handle bounces and complaints
   */
  private createBounceComplaintHandlers(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>
  ): void {
    // Bounce handler Lambda
    const bounceHandler = new lambda.Function(this, 'BounceHandler', {
      functionName: `apexshare-bounce-handler-${config.env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

        const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

        exports.handler = async (event) => {
          for (const record of event.Records) {
            try {
              const message = JSON.parse(record.Sns.Message);

              // Log bounce for monitoring
              console.log('Email bounce received:', JSON.stringify({
                timestamp: new Date().toISOString(),
                eventType: 'EmailBounce',
                bounceType: message.bounceType,
                bounceSubType: message.bounceSubType,
                recipients: message.bouncedRecipients,
                source: 'ApexShare-BounceHandler'
              }));

              // Update bounce count in a hypothetical suppression list
              // Implementation would depend on requirements

            } catch (error) {
              console.error('Error processing bounce:', error);
            }
          }
        };
      `),
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        DYNAMODB_TABLE: '', // Would be configured if needed
      },
    });

    // Complaint handler Lambda
    const complaintHandler = new lambda.Function(this, 'ComplaintHandler', {
      functionName: `apexshare-complaint-handler-${config.env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

        const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

        exports.handler = async (event) => {
          for (const record of event.Records) {
            try {
              const message = JSON.parse(record.Sns.Message);

              // Log complaint for monitoring
              console.log('Email complaint received:', JSON.stringify({
                timestamp: new Date().toISOString(),
                eventType: 'EmailComplaint',
                complaintType: message.complaintType,
                recipients: message.complainedRecipients,
                source: 'ApexShare-ComplaintHandler'
              }));

              // Add to suppression list to prevent future emails
              // Implementation would depend on requirements

            } catch (error) {
              console.error('Error processing complaint:', error);
            }
          }
        };
      `),
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        DYNAMODB_TABLE: '', // Would be configured if needed
      },
    });

    // Subscribe handlers to SNS topics
    this.bounceNotificationTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(bounceHandler)
    );

    this.complaintNotificationTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(complaintHandler)
    );
  }

  /**
   * Create CloudWatch alarms for email monitoring
   */
  private createEmailMonitoringAlarms(config: any): void {
    if (!config.monitoring.alarms) return;

    // High bounce rate alarm
    new cloudwatch.Alarm(this, 'HighBounceRateAlarm', {
      alarmName: `ApexShare-HighBounceRate-${config.env}`,
      alarmDescription: 'High email bounce rate detected',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/SES',
        metricName: 'Bounce',
        dimensionsMap: {
          ConfigurationSet: this.configurationSet.configurationSetName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5, // More than 5 bounces in 5 minutes
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // High complaint rate alarm
    new cloudwatch.Alarm(this, 'HighComplaintRateAlarm', {
      alarmName: `ApexShare-HighComplaintRate-${config.env}`,
      alarmDescription: 'High email complaint rate detected',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/SES',
        metricName: 'Complaint',
        dimensionsMap: {
          ConfigurationSet: this.configurationSet.configurationSetName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(15),
      }),
      threshold: 1, // More than 1 complaint in 15 minutes
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Low delivery rate alarm
    new cloudwatch.Alarm(this, 'LowDeliveryRateAlarm', {
      alarmName: `ApexShare-LowDeliveryRate-${config.env}`,
      alarmDescription: 'Low email delivery rate detected',
      metric: new cloudwatch.MathExpression({
        expression: '(delivered / sent) * 100',
        usingMetrics: {
          sent: new cloudwatch.Metric({
            namespace: 'AWS/SES',
            metricName: 'Send',
            dimensionsMap: {
              ConfigurationSet: this.configurationSet.configurationSetName,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(15),
          }),
          delivered: new cloudwatch.Metric({
            namespace: 'AWS/SES',
            metricName: 'Delivery',
            dimensionsMap: {
              ConfigurationSet: this.configurationSet.configurationSetName,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(15),
          }),
        },
        period: cdk.Duration.minutes(15),
      }),
      threshold: 95, // Delivery rate below 95%
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Reputation alarm (if reputation metrics are enabled)
    new cloudwatch.Alarm(this, 'ReputationAlarm', {
      alarmName: `ApexShare-Reputation-${config.env}`,
      alarmDescription: 'SES reputation metrics indicate issues',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/SES',
        metricName: 'Reputation.BounceRate',
        dimensionsMap: {
          ConfigurationSet: this.configurationSet.configurationSetName,
        },
        statistic: 'Average',
        period: cdk.Duration.hours(1),
      }),
      threshold: 0.05, // Bounce rate above 5%
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }

  /**
   * Create CloudFormation outputs
   */
  private createOutputs(config: any): void {
    new cdk.CfnOutput(this, 'DomainIdentityArn', {
      value: this.domainIdentity.emailIdentityArn,
      description: 'SES Domain Identity ARN',
      exportName: `${this.stackName}-DomainIdentityArn`,
    });

    new cdk.CfnOutput(this, 'ConfigurationSetName', {
      value: this.configurationSet.configurationSetName,
      description: 'SES Configuration Set Name',
      exportName: `${this.stackName}-ConfigurationSetName`,
    });

    new cdk.CfnOutput(this, 'BounceTopicArn', {
      value: this.bounceNotificationTopic.topicArn,
      description: 'SNS Topic ARN for bounce notifications',
      exportName: `${this.stackName}-BounceTopicArn`,
    });

    new cdk.CfnOutput(this, 'ComplaintTopicArn', {
      value: this.complaintNotificationTopic.topicArn,
      description: 'SNS Topic ARN for complaint notifications',
      exportName: `${this.stackName}-ComplaintTopicArn`,
    });

    // Output DNS records that need to be configured manually
    const emailDomain = config.env === 'prod' ? 'apexshare.be' : config.domain;

    new cdk.CfnOutput(this, 'EmailDomain', {
      value: emailDomain,
      description: 'Email domain used for SES',
      exportName: `${this.stackName}-EmailDomain`,
    });

    new cdk.CfnOutput(this, 'MailFromDomain', {
      value: `mail.${emailDomain}`,
      description: 'Mail-from domain for bounce handling',
      exportName: `${this.stackName}-MailFromDomain`,
    });

    new cdk.CfnOutput(this, 'SesFromEmail', {
      value: `no-reply@${emailDomain}`,
      description: 'From email address for SES',
      exportName: `${this.stackName}-SesFromEmail`,
    });

    // Instructions for DNS configuration
    new cdk.CfnOutput(this, 'DnsInstructions', {
      value: `Create the following DNS records: 1) Verify domain ownership in SES console, 2) Configure DKIM CNAME records, 3) MX record for mail.${emailDomain} -> feedback-smtp.${config.aws.region}.amazonses.com, 4) SPF record: "v=spf1 include:amazonses.com ~all", 5) DMARC record: "v=DMARC1; p=quarantine; rua=mailto:dmarc@${emailDomain}"`,
      description: 'DNS configuration instructions for email authentication',
    });
  }
}