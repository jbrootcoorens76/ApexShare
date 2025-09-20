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
    this.createOutputs();
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
      // Delivery options
      deliveryOptions: {
        // Use dedicated IP pool for production
        dedicatedIpPool: config.env === 'prod' ? undefined : undefined, // Can be configured later
      },
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

    // Add CloudWatch event destination for detailed metrics
    if (config.monitoring.detailedMetrics) {
      configSet.addEventDestination('CloudWatchDestination', {
        destination: ses.EventDestination.cloudWatchDimensions({
          source: ses.CloudWatchDimension.emailAddress(),
          messageTag: ses.CloudWatchDimension.defaultDimensions(),
          linkTag: ses.CloudWatchDimension.defaultDimensions(),
        }),
        events: [
          ses.EmailSendingEvent.SEND,
          ses.EmailSendingEvent.DELIVERY,
          ses.EmailSendingEvent.BOUNCE,
          ses.EmailSendingEvent.COMPLAINT,
          ses.EmailSendingEvent.CLICK,
          ses.EmailSendingEvent.OPEN,
        ],
        enabled: true,
      });
    }

    return configSet;
  }

  /**
   * Create domain identity for email sending
   */
  private createDomainIdentity(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>
  ): ses.EmailIdentity {
    const identity = new ses.EmailIdentity(this, 'DomainIdentity', {
      identity: ses.Identity.domain(config.domain),
      configurationSet: this.configurationSet,
      dkimSigning: true, // Enable DKIM signing
      dkimIdentity: config.domain,
      feedbackForwarding: false, // We handle bounces/complaints via SNS
      mailFromDomain: `mail.${config.domain}`,
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
  private createOutputs(): void {
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
    new cdk.CfnOutput(this, 'DkimRecords', {
      value: 'Configure DKIM records in Route 53 after domain verification',
      description: 'DKIM DNS records for email authentication',
    });

    new cdk.CfnOutput(this, 'MxRecord', {
      value: 'Configure MX record for bounce handling',
      description: 'MX record configuration for mail-from domain',
    });
  }
}