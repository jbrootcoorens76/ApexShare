/**
 * API Stack for ApexShare Infrastructure
 *
 * Creates and configures:
 * - Lambda functions for upload, download, and email handling
 * - API Gateway REST API with proper routing and validation
 * - IAM roles and policies with least privilege access
 * - Dead letter queues for error handling
 * - CloudWatch log groups with appropriate retention
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';
import { ApexShareStackProps, CrossStackRefs } from '../shared/types';
import { getResourceNames } from '../shared/config';
import {
  LAMBDA_CONFIG,
  API_CONFIG,
  MONITORING_CONFIG,
  UPLOAD_CONSTRAINTS,
  ERROR_MESSAGES,
} from '../shared/constants';

export interface ApiStackProps extends ApexShareStackProps {
  crossStackRefs: CrossStackRefs;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly uploadHandler: lambda.Function;
  public readonly downloadHandler: lambda.Function;
  public readonly emailSender: lambda.Function;
  public readonly healthCheckHandler: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { config, crossStackRefs } = props;

    // Extract resources from cross-stack references
    if (!crossStackRefs.storageStack) {
      throw new Error('Storage stack references are required for API stack');
    }

    const { videosBucket, templatesBucket, uploadsTable, kmsKeys } = crossStackRefs.storageStack;
    const s3EncryptionKey = kmsKeys.s3;
    const dynamoEncryptionKey = kmsKeys.dynamodb;
    const resourceNames = getResourceNames(config);
    const tags = resourceNames.getTags();

    // Apply tags to the entire stack
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });

    // Create dead letter queues for error handling
    const uploadDlq = this.createDeadLetterQueue('UploadHandlerDLQ', resourceNames);
    const downloadDlq = this.createDeadLetterQueue('DownloadHandlerDLQ', resourceNames);
    const emailDlq = this.createDeadLetterQueue('EmailSenderDLQ', resourceNames);

    // Create Lambda functions
    this.uploadHandler = this.createUploadHandler(
      config,
      resourceNames,
      videosBucket,
      uploadsTable,
      s3EncryptionKey,
      dynamoEncryptionKey,
      uploadDlq
    );

    this.downloadHandler = this.createDownloadHandler(
      config,
      resourceNames,
      videosBucket,
      uploadsTable,
      s3EncryptionKey,
      dynamoEncryptionKey,
      downloadDlq
    );

    this.emailSender = this.createEmailSender(
      config,
      resourceNames,
      templatesBucket,
      uploadsTable,
      dynamoEncryptionKey,
      emailDlq
    );

    this.healthCheckHandler = this.createHealthCheckHandler(config, resourceNames);

    // TODO: Set up S3 event notifications (currently disabled to avoid cyclic dependencies)
    // this.setupS3EventNotifications(videosBucket, this.emailSender);

    // Create API Gateway
    this.api = this.createApiGateway(config, resourceNames);

    // Create API resources and methods
    this.setupApiRoutes();

    // Create outputs
    this.createOutputs();
  }

  /**
   * Create a dead letter queue for Lambda error handling
   */
  private createDeadLetterQueue(name: string, resourceNames: ReturnType<typeof getResourceNames>): sqs.Queue {
    return new sqs.Queue(this, name, {
      queueName: `${name}-${resourceNames.getTags().Environment}`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS_MANAGED,
    });
  }

  /**
   * Create Upload Handler Lambda function
   */
  private createUploadHandler(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>,
    videosBucket: s3.Bucket,
    uploadsTable: dynamodb.Table,
    s3EncryptionKey: kms.Key,
    dynamoEncryptionKey: kms.Key,
    deadLetterQueue: sqs.Queue
  ): lambda.Function {
    const logGroup = new logs.LogGroup(this, 'UploadHandlerLogGroup', {
      logGroupName: `/aws/lambda/${resourceNames.uploadHandler}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const func = new lambda.Function(this, 'UploadHandler', {
      functionName: resourceNames.uploadHandler,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      // TODO: Replace with proper asset bundling when Docker is available
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: 'Upload handler placeholder - needs proper implementation',
              event: event
            })
          };
        };
      `),
      timeout: cdk.Duration.seconds(config.lambda.timeout.uploadHandler),
      memorySize: config.lambda.memorySize.uploadHandler,
      logGroup,
      deadLetterQueue,
      retryAttempts: 2,
      maxEventAge: cdk.Duration.hours(1),
      environment: {
        ...LAMBDA_CONFIG.ENVIRONMENT_VARIABLES,
        S3_BUCKET_NAME: videosBucket.bucketName,
        DYNAMODB_TABLE: uploadsTable.tableName,
        CORS_ORIGINS: config.corsOrigins.join(','),
        LOG_LEVEL: config.logLevel,
        MAX_FILE_SIZE: UPLOAD_CONSTRAINTS.MAX_FILE_SIZE.toString(),
        ALLOWED_MIME_TYPES: UPLOAD_CONSTRAINTS.ALLOWED_MIME_TYPES.join(','),
        PRESIGNED_URL_EXPIRY: UPLOAD_CONSTRAINTS.PRESIGNED_URL_EXPIRY.toString(),
      },
      environmentEncryption: s3EncryptionKey,
      // TODO: Add reservedConcurrency after fixing CDK property name
      // reservedConcurrency: config.lambda.reservedConcurrency.uploadHandler,
    });

    // Grant permissions
    videosBucket.grantPut(func);
    videosBucket.grantPutAcl(func);
    uploadsTable.grantWriteData(func);
    s3EncryptionKey.grantDecrypt(func);
    dynamoEncryptionKey.grantDecrypt(func);

    return func;
  }

  /**
   * Create Download Handler Lambda function
   */
  private createDownloadHandler(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>,
    videosBucket: s3.Bucket,
    uploadsTable: dynamodb.Table,
    s3EncryptionKey: kms.Key,
    dynamoEncryptionKey: kms.Key,
    deadLetterQueue: sqs.Queue
  ): lambda.Function {
    const logGroup = new logs.LogGroup(this, 'DownloadHandlerLogGroup', {
      logGroupName: `/aws/lambda/${resourceNames.downloadHandler}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const func = new lambda.Function(this, 'DownloadHandler', {
      functionName: resourceNames.downloadHandler,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      // TODO: Replace with proper asset bundling when Docker is available
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: 'Download handler placeholder - needs proper implementation',
              event: event
            })
          };
        };
      `),
      timeout: cdk.Duration.seconds(config.lambda.timeout.downloadHandler),
      memorySize: config.lambda.memorySize.downloadHandler,
      logGroup,
      deadLetterQueue,
      retryAttempts: 2,
      maxEventAge: cdk.Duration.hours(1),
      environment: {
        ...LAMBDA_CONFIG.ENVIRONMENT_VARIABLES,
        S3_BUCKET_NAME: videosBucket.bucketName,
        DYNAMODB_TABLE: uploadsTable.tableName,
        CORS_ORIGINS: config.corsOrigins.join(','),
        LOG_LEVEL: config.logLevel,
        DOWNLOAD_EXPIRY_HOURS: UPLOAD_CONSTRAINTS.DOWNLOAD_URL_EXPIRY.toString(),
      },
      environmentEncryption: s3EncryptionKey,
      // TODO: Add reservedConcurrency after fixing CDK property name
      // reservedConcurrency: config.lambda.reservedConcurrency.downloadHandler,
    });

    // Grant permissions
    videosBucket.grantRead(func);
    uploadsTable.grantReadWriteData(func);
    s3EncryptionKey.grantDecrypt(func);
    dynamoEncryptionKey.grantDecrypt(func);

    return func;
  }

  /**
   * Create Email Sender Lambda function
   */
  private createEmailSender(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>,
    templatesBucket: s3.Bucket,
    uploadsTable: dynamodb.Table,
    dynamoEncryptionKey: kms.Key,
    deadLetterQueue: sqs.Queue
  ): lambda.Function {
    const logGroup = new logs.LogGroup(this, 'EmailSenderLogGroup', {
      logGroupName: `/aws/lambda/${resourceNames.emailSender}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const func = new lambda.Function(this, 'EmailSender', {
      functionName: resourceNames.emailSender,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      // TODO: Replace with proper asset bundling when Docker is available
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: 'Email sender placeholder - needs proper implementation',
              event: event
            })
          };
        };
      `),
      timeout: cdk.Duration.seconds(config.lambda.timeout.emailSender),
      memorySize: config.lambda.memorySize.emailSender,
      logGroup,
      deadLetterQueue,
      retryAttempts: 2,
      maxEventAge: cdk.Duration.hours(2),
      environment: {
        ...LAMBDA_CONFIG.ENVIRONMENT_VARIABLES,
        DYNAMODB_TABLE: uploadsTable.tableName,
        TEMPLATES_BUCKET: templatesBucket.bucketName,
        SES_FROM_EMAIL: `noreply@${config.domain}`,
        SES_REGION: cdk.Stack.of(this).region,
        DOWNLOAD_BASE_URL: `https://${config.domain}/download`,
        LOG_LEVEL: config.logLevel,
      },
      environmentEncryption: dynamoEncryptionKey,
      // TODO: Add reservedConcurrency after fixing CDK property name
      // reservedConcurrency: config.lambda.reservedConcurrency.emailSender,
    });

    // Grant permissions
    func.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: [
          `arn:aws:ses:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:identity/noreply@${config.domain}`,
          `arn:aws:ses:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:identity/${config.domain}`,
        ],
        conditions: {
          StringEquals: {
            'ses:FromAddress': `noreply@${config.domain}`,
          },
        },
      })
    );

    templatesBucket.grantRead(func);
    uploadsTable.grantReadWriteData(func);
    dynamoEncryptionKey.grantDecrypt(func);

    return func;
  }

  /**
   * Create Health Check Handler Lambda function
   */
  private createHealthCheckHandler(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>
  ): lambda.Function {
    const logGroup = new logs.LogGroup(this, 'HealthCheckHandlerLogGroup', {
      logGroupName: `/aws/lambda/apexshare-health-check-${config.env}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    return new lambda.Function(this, 'HealthCheckHandler', {
      functionName: `apexshare-health-check-${config.env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
              status: 'healthy',
              version: '1.0.0',
              timestamp: new Date().toISOString(),
              environment: process.env.ENVIRONMENT || 'unknown',
            }),
          };
        };
      `),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      logGroup,
      environment: {
        ENVIRONMENT: config.env,
      },
    });
  }

  /**
   * Setup S3 event notifications to trigger email sending
   */
  private setupS3EventNotifications(videosBucket: s3.Bucket, emailSender: lambda.Function): void {
    videosBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(emailSender),
      { prefix: 'videos/' }
    );
  }

  /**
   * Create API Gateway REST API
   */
  private createApiGateway(
    config: any,
    resourceNames: ReturnType<typeof getResourceNames>
  ): apigateway.RestApi {
    const logGroup = new logs.LogGroup(this, 'ApiGatewayLogGroup', {
      logGroupName: `/aws/apigateway/${resourceNames.restApi}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    return new apigateway.RestApi(this, 'ApexShareApi', {
      restApiName: resourceNames.restApi,
      description: `ApexShare API - ${config.env} environment`,
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      defaultCorsPreflightOptions: {
        allowOrigins: config.corsOrigins,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: [...API_CONFIG.CORS.ALLOWED_HEADERS],
        exposeHeaders: [...API_CONFIG.CORS.EXPOSE_HEADERS],
        maxAge: cdk.Duration.seconds(API_CONFIG.CORS.MAX_AGE),
      },
      deployOptions: {
        stageName: API_CONFIG.VERSION,
        throttlingRateLimit: config.api.throttling.rateLimit,
        throttlingBurstLimit: config.api.throttling.burstLimit,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        dataTraceEnabled: config.env !== 'prod',
        metricsEnabled: true,
      },
      policy: new iam.PolicyDocument({
        statements: [
          // Deny requests without HTTPS
          new iam.PolicyStatement({
            sid: 'DenyInsecureConnections',
            effect: iam.Effect.DENY,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['*'],
            conditions: {
              Bool: {
                'aws:SecureTransport': 'false',
              },
            },
          }),
        ],
      }),
    });
  }

  /**
   * Setup API routes and methods
   */
  private setupApiRoutes(): void {
    // Create request validators
    const requestValidator = this.api.addRequestValidator('RequestValidator', {
      validateRequestBody: true,
      validateRequestParameters: true,
    });

    // Create models for request validation
    const uploadRequestModel = this.api.addModel('UploadRequestModel', {
      contentType: 'application/json',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          studentEmail: {
            type: apigateway.JsonSchemaType.STRING,
            pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
            maxLength: 255,
          },
          studentName: {
            type: apigateway.JsonSchemaType.STRING,
            pattern: '^[a-zA-Z0-9\\s\\-\\.]{1,100}$',
            maxLength: 100,
          },
          trainerName: {
            type: apigateway.JsonSchemaType.STRING,
            pattern: '^[a-zA-Z0-9\\s\\-\\.]{1,100}$',
            maxLength: 100,
          },
          sessionDate: {
            type: apigateway.JsonSchemaType.STRING,
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          },
          notes: {
            type: apigateway.JsonSchemaType.STRING,
            maxLength: 1000,
          },
          fileName: {
            type: apigateway.JsonSchemaType.STRING,
            pattern: '^[a-zA-Z0-9\\s\\-\\._]{1,255}\\.(mp4|mov|avi|mkv)$',
            maxLength: 255,
          },
          fileSize: {
            type: apigateway.JsonSchemaType.INTEGER,
            minimum: 1,
            maximum: UPLOAD_CONSTRAINTS.MAX_FILE_SIZE,
          },
          contentType: {
            type: apigateway.JsonSchemaType.STRING,
            enum: [...UPLOAD_CONSTRAINTS.ALLOWED_MIME_TYPES],
          },
        },
        required: ['studentEmail', 'fileName', 'fileSize', 'contentType'],
        additionalProperties: false,
      },
    });

    // API v1 root
    const apiV1 = this.api.root.addResource('api').addResource(API_CONFIG.VERSION);

    // Health check endpoint
    const health = apiV1.addResource('health');
    health.addMethod('GET', new apigateway.LambdaIntegration(this.healthCheckHandler));

    // Upload endpoints
    const uploads = apiV1.addResource('uploads');
    const initiateUpload = uploads.addResource('initiate');

    initiateUpload.addMethod('POST', new apigateway.LambdaIntegration(this.uploadHandler), {
      requestValidator,
      requestModels: {
        'application/json': uploadRequestModel,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // Recent uploads endpoint (for dashboard)
    const recentUploads = uploads.addResource('recent');
    recentUploads.addMethod('GET', new apigateway.LambdaIntegration(this.uploadHandler));

    // Download endpoints
    const downloads = apiV1.addResource('downloads');
    const downloadFile = downloads.addResource('{fileId}');

    downloadFile.addMethod('GET', new apigateway.LambdaIntegration(this.downloadHandler), {
      requestParameters: {
        'method.request.path.fileId': true,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '404',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '410',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });
  }

  /**
   * Create CloudFormation outputs
   */
  private createOutputs(): void {
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: `${cdk.Stack.of(this).stackName}-ApiUrl`,
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
      exportName: `${cdk.Stack.of(this).stackName}-ApiId`,
    });

    new cdk.CfnOutput(this, 'UploadHandlerArn', {
      value: this.uploadHandler.functionArn,
      description: 'Upload Handler Lambda ARN',
      exportName: `${cdk.Stack.of(this).stackName}-UploadHandlerArn`,
    });

    new cdk.CfnOutput(this, 'DownloadHandlerArn', {
      value: this.downloadHandler.functionArn,
      description: 'Download Handler Lambda ARN',
      exportName: `${cdk.Stack.of(this).stackName}-DownloadHandlerArn`,
    });

    new cdk.CfnOutput(this, 'EmailSenderArn', {
      value: this.emailSender.functionArn,
      description: 'Email Sender Lambda ARN',
      exportName: `${cdk.Stack.of(this).stackName}-EmailSenderArn`,
    });
  }
}