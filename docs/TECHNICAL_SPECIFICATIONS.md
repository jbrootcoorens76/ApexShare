# ApexShare - Technical Implementation Specifications
**Version:** 1.0
**Date:** September 19, 2025
**Technical Lead:** AWS Solutions Architect
**Status:** Implementation Ready

## Overview

This document provides detailed technical specifications to complement the Architecture Foundation. It includes implementation patterns, code templates, configuration details, and integration examples that specialized agents will use for implementation.

## Lambda Function Implementation Patterns

### 1. Upload Handler Implementation Template

```typescript
// /lambda/upload-handler/src/index.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, CreatePresignedPostCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

interface UploadRequest {
  studentEmail: string;
  studentName?: string;
  trainerName?: string;
  sessionDate: string;
  notes?: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
      'Content-Type': 'application/json',
    };

    // Parse request body
    const body: UploadRequest = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!body.studentEmail || !body.fileName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: studentEmail, fileName'
        })
      };
    }

    // Generate unique file ID and S3 key
    const fileId = uuidv4();
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitizedFileName = body.fileName.replace(/[^a-zA-Z0-9.-]/g, '-');
    const s3Key = `videos/${timestamp}/${fileId}-${sanitizedFileName}`;

    // Create presigned POST URL for S3
    const s3Client = new S3Client({ region: process.env.AWS_REGION });
    const presignedPostCommand = new CreatePresignedPostCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Fields: {
        'Content-Type': body.contentType,
        'x-amz-meta-file-id': fileId,
        'x-amz-meta-student-email': body.studentEmail,
      },
      Conditions: [
        ['content-length-range', 0, 5368709120], // 5GB max
        ['starts-with', '$Content-Type', 'video/'],
      ],
      Expires: 3600, // 1 hour
    });

    const presignedPost = await s3Client.send(presignedPostCommand);

    // Store metadata in DynamoDB
    const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    const uploadDate = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days

    await dynamoClient.send(new PutItemCommand({
      TableName: process.env.DYNAMODB_TABLE,
      Item: {
        PK: { S: `UPLOAD#${fileId}` },
        SK: { S: `METADATA#${uploadDate}` },
        GSI1PK: { S: `STUDENT#${body.studentEmail}` },
        GSI1SK: { S: `DATE#${uploadDate}` },
        GSI2PK: { S: `DATE#${timestamp}` },
        GSI2SK: { S: `UPLOAD#${uploadDate}#${fileId}` },
        fileId: { S: fileId },
        studentEmail: { S: body.studentEmail },
        studentName: { S: body.studentName || '' },
        trainerName: { S: body.trainerName || '' },
        sessionDate: { S: body.sessionDate },
        notes: { S: body.notes || '' },
        fileName: { S: sanitizedFileName },
        originalFileName: { S: body.fileName },
        fileSize: { N: body.fileSize.toString() },
        contentType: { S: body.contentType },
        s3Key: { S: s3Key },
        s3Bucket: { S: process.env.S3_BUCKET_NAME || '' },
        uploadDate: { S: uploadDate },
        status: { S: 'pending' },
        downloadCount: { N: '0' },
        ttl: { N: ttl.toString() }
      }
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          fileId,
          uploadUrl: presignedPost.url,
          fields: presignedPost.fields,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Upload handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
  }
};
```

### 2. Email Sender Implementation Template

```typescript
// /lambda/email-sender/src/index.ts
import { S3Event } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';

export const handler = async (event: S3Event): Promise<void> => {
  const sesClient = new SESClient({ region: process.env.AWS_REGION });
  const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

  for (const record of event.Records) {
    try {
      // Extract S3 object information
      const bucketName = record.s3.bucket.name;
      const objectKey = decodeURIComponent(record.s3.object.key);

      // Extract fileId from object key
      const keyParts = objectKey.split('/');
      const fileName = keyParts[keyParts.length - 1];
      const fileId = fileName.split('-')[0];

      // Get upload metadata from DynamoDB
      const getItemResponse = await dynamoClient.send(new GetItemCommand({
        TableName: process.env.DYNAMODB_TABLE,
        Key: {
          PK: { S: `UPLOAD#${fileId}` },
          SK: { S: `METADATA#${uploadDate}` } // This would need to be retrieved differently
        }
      }));

      if (!getItemResponse.Item) {
        console.error(`No metadata found for fileId: ${fileId}`);
        continue;
      }

      const metadata = getItemResponse.Item;
      const studentEmail = metadata.studentEmail?.S || '';
      const studentName = metadata.studentName?.S || '';
      const trainerName = metadata.trainerName?.S || '';
      const sessionDate = metadata.sessionDate?.S || '';
      const notes = metadata.notes?.S || '';

      // Generate download link
      const downloadUrl = `${process.env.DOWNLOAD_BASE_URL}/${fileId}`;

      // Prepare email content
      const emailHtml = generateEmailTemplate({
        studentName,
        trainerName,
        sessionDate,
        notes,
        downloadUrl,
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()
      });

      // Send email via SES
      await sesClient.send(new SendEmailCommand({
        Source: process.env.SES_FROM_EMAIL,
        Destination: {
          ToAddresses: [studentEmail]
        },
        Message: {
          Subject: {
            Data: `Your Motorcycle Training Video is Ready - ${sessionDate}`,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: emailHtml,
              Charset: 'UTF-8'
            },
            Text: {
              Data: generateEmailText({
                studentName,
                trainerName,
                sessionDate,
                notes,
                downloadUrl
              }),
              Charset: 'UTF-8'
            }
          }
        }
      }));

      // Update DynamoDB with email sent status
      await dynamoClient.send(new UpdateItemCommand({
        TableName: process.env.DYNAMODB_TABLE,
        Key: {
          PK: { S: `UPLOAD#${fileId}` },
          SK: { S: `METADATA#${uploadDate}` }
        },
        UpdateExpression: 'SET emailSentAt = :emailSentAt, #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':emailSentAt': { S: new Date().toISOString() },
          ':status': { S: 'completed' }
        }
      }));

      console.log(`Email sent successfully for fileId: ${fileId}`);

    } catch (error) {
      console.error('Error processing S3 event:', error);
    }
  }
};

function generateEmailTemplate(data: {
  studentName: string;
  trainerName: string;
  sessionDate: string;
  notes: string;
  downloadUrl: string;
  expirationDate: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Training Video is Ready</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a365d; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f7fafc; }
            .button { background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏍️ ApexShare Training</h1>
                <p>Your motorcycle training video is ready!</p>
            </div>
            <div class="content">
                <p>Hello ${data.studentName || 'Student'},</p>
                <p>Your training session video from <strong>${data.sessionDate}</strong> has been processed and is ready for download.</p>

                ${data.trainerName ? `<p><strong>Instructor:</strong> ${data.trainerName}</p>` : ''}
                ${data.notes ? `<p><strong>Session Notes:</strong><br>${data.notes}</p>` : ''}

                <div style="text-align: center;">
                    <a href="${data.downloadUrl}" class="button">Download Your Video</a>
                </div>

                <p><strong>Important:</strong> This download link will expire on ${data.expirationDate}. Please download your video before this date.</p>

                <p>If you have any questions about your training session, please contact your instructor.</p>
            </div>
            <div class="footer">
                <p>© 2025 ApexShare Training | Secure Video Sharing for Motorcycle Training</p>
                <p>This is an automated message. Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
  `;
}

function generateEmailText(data: {
  studentName: string;
  trainerName: string;
  sessionDate: string;
  notes: string;
  downloadUrl: string;
}): string {
  return `
ApexShare Training - Your Video is Ready

Hello ${data.studentName || 'Student'},

Your training session video from ${data.sessionDate} has been processed and is ready for download.

${data.trainerName ? `Instructor: ${data.trainerName}` : ''}
${data.notes ? `Session Notes: ${data.notes}` : ''}

Download your video: ${data.downloadUrl}

Important: This download link will expire in 30 days. Please download your video before this date.

If you have any questions about your training session, please contact your instructor.

© 2025 ApexShare Training
This is an automated message. Please do not reply to this email.
  `;
}
```

### 3. Download Handler Implementation Template

```typescript
// /lambda/download-handler/src/index.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const headers = {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'OPTIONS,GET',
      'Content-Type': 'application/json',
    };

    const fileId = event.pathParameters?.fileId;
    if (!fileId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'File ID is required'
        })
      };
    }

    // Get file metadata from DynamoDB
    const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

    // Query using GSI or scan to find the record
    const getItemResponse = await dynamoClient.send(new GetItemCommand({
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        PK: { S: `UPLOAD#${fileId}` },
        // We'd need to implement a query pattern here to get the SK
      }
    }));

    if (!getItemResponse.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Video not found or expired'
        })
      };
    }

    const metadata = getItemResponse.Item;
    const s3Key = metadata.s3Key?.S;
    const s3Bucket = metadata.s3Bucket?.S;

    if (!s3Key || !s3Bucket) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Video metadata incomplete'
        })
      };
    }

    // Check if file has expired
    const ttl = parseInt(metadata.ttl?.N || '0');
    if (ttl > 0 && Date.now() / 1000 > ttl) {
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Video has expired'
        })
      };
    }

    // Generate presigned download URL
    const s3Client = new S3Client({ region: process.env.AWS_REGION });
    const command = new GetObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      ResponseContentDisposition: `attachment; filename="${metadata.originalFileName?.S}"`
    });

    const downloadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: parseInt(process.env.DOWNLOAD_EXPIRY_HOURS || '24') * 3600
    });

    // Update download count
    await dynamoClient.send(new UpdateItemCommand({
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        PK: { S: `UPLOAD#${fileId}` },
        SK: { S: `METADATA#${metadata.uploadDate?.S}` }
      },
      UpdateExpression: 'ADD downloadCount :inc SET lastDownloadAt = :timestamp',
      ExpressionAttributeValues: {
        ':inc': { N: '1' },
        ':timestamp': { S: new Date().toISOString() }
      }
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          downloadUrl,
          videoInfo: {
            fileName: metadata.originalFileName?.S,
            fileSize: parseInt(metadata.fileSize?.N || '0'),
            sessionDate: metadata.sessionDate?.S,
            trainerName: metadata.trainerName?.S,
            notes: metadata.notes?.S,
            expiresAt: new Date((ttl) * 1000).toISOString()
          }
        }
      })
    };

  } catch (error) {
    console.error('Download handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
  }
};
```

## CDK Stack Implementation Templates

### 1. Storage Stack Implementation

```typescript
// /lib/stacks/storage-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../shared/config';

export class StorageStack extends cdk.Stack {
  public readonly videosBucket: s3.Bucket;
  public readonly uploadsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, config: EnvironmentConfig, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for video storage
    this.videosBucket = new s3.Bucket(this, 'VideosBucket', {
      bucketName: `apexshare-videos-${config.env}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          id: 'VideoLifecycle',
          enabled: true,
          prefix: 'videos/',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(7)
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(30)
            }
          ],
          expiration: cdk.Duration.days(config.retentionDays)
        },
        {
          id: 'TempCleanup',
          enabled: true,
          prefix: 'temp-uploads/',
          expiration: cdk.Duration.days(1)
        }
      ],
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE
          ],
          allowedOrigins: config.corsOrigins,
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3000
        }
      ]
    });

    // DynamoDB Table for upload metadata
    this.uploadsTable = new dynamodb.Table(this, 'UploadsTable', {
      tableName: `apexshare-uploads-${config.env}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.ON_DEMAND,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
    });

    // GSI for student email queries
    this.uploadsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING
      }
    });

    // GSI for date range queries
    this.uploadsTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: {
        name: 'GSI2PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'GSI2SK',
        type: dynamodb.AttributeType.STRING
      }
    });

    // Output important values
    new cdk.CfnOutput(this, 'VideosBucketName', {
      value: this.videosBucket.bucketName,
      description: 'Name of the S3 bucket for video storage'
    });

    new cdk.CfnOutput(this, 'UploadsTableName', {
      value: this.uploadsTable.tableName,
      description: 'Name of the DynamoDB table for upload metadata'
    });

    // Tags
    cdk.Tags.of(this).add('Environment', config.env);
    cdk.Tags.of(this).add('Project', 'ApexShare');
    cdk.Tags.of(this).add('Stack', 'Storage');
  }
}
```

### 2. API Stack Implementation

```typescript
// /lib/stacks/api-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../shared/config';

export interface ApiStackProps extends cdk.StackProps {
  videosBucket: s3.Bucket;
  uploadsTable: dynamodb.Table;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly uploadHandler: lambda.Function;
  public readonly downloadHandler: lambda.Function;

  constructor(scope: Construct, id: string, config: EnvironmentConfig, props: ApiStackProps) {
    super(scope, id, props);

    // Upload Handler Lambda
    this.uploadHandler = new nodejs.NodejsFunction(this, 'UploadHandler', {
      functionName: `apexshare-upload-handler-${config.env}`,
      entry: 'lambda/upload-handler/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        S3_BUCKET_NAME: props.videosBucket.bucketName,
        DYNAMODB_TABLE: props.uploadsTable.tableName,
        CORS_ORIGINS: config.corsOrigins.join(','),
        LOG_LEVEL: config.logLevel
      },
      bundling: {
        externalModules: ['@aws-sdk/*'],
        minify: true,
        sourceMap: true
      }
    });

    // Download Handler Lambda
    this.downloadHandler = new nodejs.NodejsFunction(this, 'DownloadHandler', {
      functionName: `apexshare-download-handler-${config.env}`,
      entry: 'lambda/download-handler/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        S3_BUCKET_NAME: props.videosBucket.bucketName,
        DYNAMODB_TABLE: props.uploadsTable.tableName,
        CORS_ORIGINS: config.corsOrigins.join(','),
        DOWNLOAD_EXPIRY_HOURS: '24',
        LOG_LEVEL: config.logLevel
      },
      bundling: {
        externalModules: ['@aws-sdk/*'],
        minify: true,
        sourceMap: true
      }
    });

    // Grant permissions
    props.videosBucket.grantPut(this.uploadHandler);
    props.videosBucket.grantRead(this.downloadHandler);
    props.uploadsTable.grantWriteData(this.uploadHandler);
    props.uploadsTable.grantReadWriteData(this.downloadHandler);

    // API Gateway
    this.api = new apigateway.RestApi(this, 'ApexShareApi', {
      restApiName: `apexshare-api-${config.env}`,
      description: `ApexShare API - ${config.env}`,
      defaultCorsPreflightOptions: {
        allowOrigins: config.corsOrigins,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization']
      },
      deployOptions: {
        stageName: 'v1',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 500,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: config.env !== 'prod'
      }
    });

    // API Resources
    const apiV1 = this.api.root.addResource('api').addResource('v1');

    // Uploads endpoints
    const uploads = apiV1.addResource('uploads');
    const initiateUpload = uploads.addResource('initiate');
    initiateUpload.addMethod('POST', new apigateway.LambdaIntegration(this.uploadHandler));

    // Downloads endpoints
    const downloads = apiV1.addResource('downloads');
    const downloadFile = downloads.addResource('{fileId}');
    downloadFile.addMethod('GET', new apigateway.LambdaIntegration(this.downloadHandler));

    // Output API URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL'
    });

    // Tags
    cdk.Tags.of(this).add('Environment', config.env);
    cdk.Tags.of(this).add('Project', 'ApexShare');
    cdk.Tags.of(this).add('Stack', 'API');
  }
}
```

## Frontend Implementation Patterns

### 1. Upload Component Template

```typescript
// /frontend/src/components/UploadForm.tsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import { uploadVideo } from '../services/api';

interface UploadFormData {
  studentEmail: string;
  studentName: string;
  trainerName: string;
  sessionDate: string;
  notes: string;
  file: File | null;
}

export const UploadForm: React.FC = () => {
  const [formData, setFormData] = useState<UploadFormData>({
    studentEmail: '',
    studentName: '',
    trainerName: '',
    sessionDate: new Date().toISOString().split('T')[0],
    notes: '',
    file: null
  });

  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const uploadMutation = useMutation({
    mutationFn: uploadVideo,
    onSuccess: (data) => {
      console.log('Upload successful:', data);
      // Reset form or show success message
    },
    onError: (error) => {
      console.error('Upload failed:', error);
      // Show error message
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      // Validate file type and size
      if (!file.type.startsWith('video/')) {
        alert('Please select a video file');
        return;
      }
      if (file.size > 5 * 1024 * 1024 * 1024) { // 5GB
        alert('File size must be less than 5GB');
        return;
      }
      setFormData(prev => ({ ...prev, file }));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv']
    },
    maxFiles: 1
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.file || !formData.studentEmail) {
      alert('Please fill in required fields and select a file');
      return;
    }

    const uploadData = {
      ...formData,
      fileName: formData.file.name,
      fileSize: formData.file.size,
      contentType: formData.file.type
    };

    try {
      await uploadMutation.mutateAsync({
        uploadData,
        file: formData.file,
        onProgress: setUploadProgress
      });
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Upload Training Video</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Student Email - Required */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Student Email *
          </label>
          <input
            type="email"
            required
            value={formData.studentEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, studentEmail: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="student@example.com"
          />
        </div>

        {/* Student Name - Optional */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Student Name
          </label>
          <input
            type="text"
            value={formData.studentName}
            onChange={(e) => setFormData(prev => ({ ...prev, studentName: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="John Doe"
          />
        </div>

        {/* Trainer Name - Optional */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Trainer Name
          </label>
          <input
            type="text"
            value={formData.trainerName}
            onChange={(e) => setFormData(prev => ({ ...prev, trainerName: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Instructor Smith"
          />
        </div>

        {/* Session Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Session Date
          </label>
          <input
            type="date"
            value={formData.sessionDate}
            onChange={(e) => setFormData(prev => ({ ...prev, sessionDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Training Notes - Optional */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Training Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Highway riding session, emergency braking practice..."
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Video File *
          </label>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            {formData.file ? (
              <div>
                <p className="text-sm text-gray-600">Selected file:</p>
                <p className="font-medium">{formData.file.name}</p>
                <p className="text-xs text-gray-500">
                  {(formData.file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-gray-600">
                  {isDragActive
                    ? 'Drop the video file here...'
                    : 'Drag & drop a video file here, or click to select'}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Supports MP4, MOV, AVI files up to 5GB
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Upload Progress */}
        {uploadProgress > 0 && (
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={uploadMutation.isPending || !formData.file || !formData.studentEmail}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {uploadMutation.isPending ? 'Uploading...' : 'Upload Video'}
        </button>
      </form>
    </div>
  );
};
```

### 2. API Service Implementation

```typescript
// /frontend/src/services/api.ts
interface UploadInitiationResponse {
  success: boolean;
  data: {
    fileId: string;
    uploadUrl: string;
    fields: Record<string, string>;
    expiresAt: string;
  };
}

interface UploadVideoParams {
  uploadData: {
    studentEmail: string;
    studentName: string;
    trainerName: string;
    sessionDate: string;
    notes: string;
    fileName: string;
    fileSize: number;
    contentType: string;
  };
  file: File;
  onProgress?: (progress: number) => void;
}

export const uploadVideo = async ({ uploadData, file, onProgress }: UploadVideoParams) => {
  // Step 1: Initiate upload and get presigned URL
  const initiateResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/uploads/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(uploadData),
  });

  if (!initiateResponse.ok) {
    throw new Error('Failed to initiate upload');
  }

  const { data }: UploadInitiationResponse = await initiateResponse.json();

  // Step 2: Upload file directly to S3
  const formData = new FormData();

  // Add all the fields from the presigned post
  Object.entries(data.fields).forEach(([key, value]) => {
    formData.append(key, value);
  });

  // Add the file last
  formData.append('file', file);

  // Upload with progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 204) {
        resolve({
          fileId: data.fileId,
          success: true
        });
      } else {
        reject(new Error(`Upload failed with status: ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Upload failed'));
    };

    xhr.open('POST', data.uploadUrl);
    xhr.send(formData);
  });
};

export const generateDownloadLink = async (fileId: string) => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/downloads/${fileId}`);

  if (!response.ok) {
    throw new Error('Failed to generate download link');
  }

  return response.json();
};

export const getRecentUploads = async () => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/uploads/recent`);

  if (!response.ok) {
    throw new Error('Failed to fetch recent uploads');
  }

  return response.json();
};
```

## Configuration Management

### Environment Configuration Template

```typescript
// /lib/shared/config.ts
export interface EnvironmentConfig {
  env: 'dev' | 'staging' | 'prod';
  domain: string;
  certificateArn?: string;
  retentionDays: number;
  emailRetentionDays: number;
  logLevel: string;
  corsOrigins: string[];
  monitoring: {
    alarms: boolean;
    detailedMetrics: boolean;
  };
  lambda: {
    reservedConcurrency: {
      uploadHandler: number;
      emailSender: number;
      downloadHandler: number;
    };
  };
  api: {
    throttling: {
      rateLimit: number;
      burstLimit: number;
    };
  };
}

const environments: Record<string, EnvironmentConfig> = {
  dev: {
    env: 'dev',
    domain: 'dev.apexshare.be',
    retentionDays: 7,
    emailRetentionDays: 7,
    logLevel: 'DEBUG',
    corsOrigins: ['https://dev.apexshare.be', 'http://localhost:3000'],
    monitoring: {
      alarms: false,
      detailedMetrics: true
    },
    lambda: {
      reservedConcurrency: {
        uploadHandler: 5,
        emailSender: 5,
        downloadHandler: 10
      }
    },
    api: {
      throttling: {
        rateLimit: 50,
        burstLimit: 100
      }
    }
  },
  staging: {
    env: 'staging',
    domain: 'staging.apexshare.be',
    retentionDays: 14,
    emailRetentionDays: 14,
    logLevel: 'INFO',
    corsOrigins: ['https://staging.apexshare.training'],
    monitoring: {
      alarms: true,
      detailedMetrics: true
    },
    lambda: {
      reservedConcurrency: {
        uploadHandler: 10,
        emailSender: 5,
        downloadHandler: 20
      }
    },
    api: {
      throttling: {
        rateLimit: 100,
        burstLimit: 300
      }
    }
  },
  prod: {
    env: 'prod',
    domain: 'apexshare.be',
    certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/...',
    retentionDays: 90,
    emailRetentionDays: 30,
    logLevel: 'WARN',
    corsOrigins: ['https://apexshare.training'],
    monitoring: {
      alarms: true,
      detailedMetrics: false
    },
    lambda: {
      reservedConcurrency: {
        uploadHandler: 20,
        emailSender: 10,
        downloadHandler: 50
      }
    },
    api: {
      throttling: {
        rateLimit: 100,
        burstLimit: 500
      }
    }
  }
};

export const getConfig = (env: string): EnvironmentConfig => {
  const config = environments[env];
  if (!config) {
    throw new Error(`Environment configuration not found for: ${env}`);
  }
  return config;
};
```

## Testing Patterns

### 1. Lambda Function Unit Tests

```typescript
// /lambda/upload-handler/test/index.test.ts
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../src/index';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-dynamodb');

describe('Upload Handler', () => {
  beforeEach(() => {
    process.env.S3_BUCKET_NAME = 'test-bucket';
    process.env.DYNAMODB_TABLE = 'test-table';
    process.env.CORS_ORIGINS = 'https://test.com';
  });

  it('should return 400 for missing required fields', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify({}),
      pathParameters: null,
      httpMethod: 'POST'
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).success).toBe(false);
  });

  it('should generate presigned URL for valid request', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify({
        studentEmail: 'test@example.com',
        fileName: 'test-video.mp4',
        fileSize: 1000000,
        contentType: 'video/mp4'
      }),
      pathParameters: null,
      httpMethod: 'POST'
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const response = JSON.parse(result.body);
    expect(response.success).toBe(true);
    expect(response.data.fileId).toBeDefined();
    expect(response.data.uploadUrl).toBeDefined();
  });
});
```

### 2. CDK Stack Tests

```typescript
// /test/storage-stack.test.ts
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { StorageStack } from '../lib/stacks/storage-stack';
import { getConfig } from '../lib/shared/config';

describe('StorageStack', () => {
  it('should create S3 bucket with correct configuration', () => {
    const app = new cdk.App();
    const config = getConfig('dev');
    const stack = new StorageStack(app, 'TestStorageStack', config);
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'apexshare-videos-dev',
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256'
            }
          }
        ]
      }
    });
  });

  it('should create DynamoDB table with correct schema', () => {
    const app = new cdk.App();
    const config = getConfig('dev');
    const stack = new StorageStack(app, 'TestStorageStack', config);
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'apexshare-uploads-dev',
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
        { AttributeName: 'GSI1PK', AttributeType: 'S' },
        { AttributeName: 'GSI1SK', AttributeType: 'S' }
      ]
    });
  });
});
```

## Deployment Scripts

### 1. CDK Deployment Script

```bash
#!/bin/bash
# /scripts/deploy.sh

set -e

ENVIRONMENT=${1:-dev}
PROFILE=${2:-default}

echo "Deploying ApexShare to environment: $ENVIRONMENT"

# Install dependencies
npm install

# Bootstrap CDK (if needed)
npx cdk bootstrap --profile $PROFILE

# Synthesize templates
npx cdk synth --profile $PROFILE

# Deploy infrastructure
if [ "$ENVIRONMENT" = "prod" ]; then
    # Require manual approval for production
    npx cdk deploy "*$ENVIRONMENT*" --profile $PROFILE --require-approval broadening
else
    # Auto-approve for dev/staging
    npx cdk deploy "*$ENVIRONMENT*" --profile $PROFILE --require-approval never
fi

echo "Deployment completed for environment: $ENVIRONMENT"

# Build and deploy frontend
cd frontend
npm run build
aws s3 sync dist/ s3://apexshare-frontend-$ENVIRONMENT --delete --profile $PROFILE

echo "Frontend deployed successfully"
```

### 2. Environment Setup Script

```bash
#!/bin/bash
# /scripts/setup-environment.sh

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <environment>"
    echo "Environments: dev, staging, prod"
    exit 1
fi

echo "Setting up environment: $ENVIRONMENT"

# Create environment-specific .env file
cat > .env.$ENVIRONMENT << EOF
VITE_API_URL=https://api-$ENVIRONMENT.apexshare.training
VITE_ENVIRONMENT=$ENVIRONMENT
VITE_SENTRY_DSN=your-sentry-dsn
EOF

echo "Environment file created: .env.$ENVIRONMENT"

# Create CDK context for environment
cat > cdk.context.$ENVIRONMENT.json << EOF
{
  "environment": "$ENVIRONMENT",
  "domain": "$ENVIRONMENT.apexshare.be",
  "certificateArn": "",
  "enableMonitoring": $([ "$ENVIRONMENT" = "prod" ] && echo "true" || echo "false")
}
EOF

echo "CDK context created: cdk.context.$ENVIRONMENT.json"
```

## Performance Optimization Guidelines

### 1. Lambda Cold Start Optimization

```typescript
// Optimize imports - only import what you need
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// Initialize clients outside handler for connection reuse
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  maxAttempts: 3,
  retryMode: 'adaptive'
});

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  maxAttempts: 3,
  retryMode: 'adaptive'
});

// Pre-compile frequently used regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FILENAME_SANITIZE_REGEX = /[^a-zA-Z0-9.-]/g;

export const handler = async (event: APIGatewayProxyEvent) => {
  // Handler logic here
};
```

### 2. S3 Upload Optimization

```typescript
// Multipart upload for large files
const uploadLargeFile = async (file: File, uploadUrl: string, fields: Record<string, string>) => {
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks

  if (file.size > CHUNK_SIZE) {
    // Use multipart upload for files > 10MB
    return uploadWithChunks(file, uploadUrl, fields);
  } else {
    // Use simple upload for smaller files
    return uploadSimple(file, uploadUrl, fields);
  }
};
```

### 3. DynamoDB Query Optimization

```typescript
// Use batch operations for multiple items
const batchGetUploads = async (fileIds: string[]) => {
  const params = {
    RequestItems: {
      [tableName]: {
        Keys: fileIds.map(id => ({
          PK: { S: `UPLOAD#${id}` },
          SK: { S: `METADATA#${uploadDate}` }
        }))
      }
    }
  };

  return dynamoClient.send(new BatchGetItemCommand(params));
};

// Use GSI for efficient queries
const getUploadsByStudent = async (studentEmail: string, limit: number = 10) => {
  return dynamoClient.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': { S: `STUDENT#${studentEmail}` }
    },
    Limit: limit,
    ScanIndexForward: false // Most recent first
  }));
};
```

This technical specifications document provides detailed implementation patterns, code templates, and best practices that specialized agents can use to build upon the architecture foundation. Each section includes working code examples and configuration patterns that ensure consistency and quality across the implementation.

The specifications cover:
- Complete Lambda function implementations with error handling
- CDK stack templates with proper resource configuration
- Frontend components with modern React patterns
- API service implementations with progress tracking
- Environment configuration management
- Testing patterns for both infrastructure and application code
- Deployment and setup automation scripts
- Performance optimization guidelines

These specifications serve as the detailed implementation guide that transforms the high-level architecture foundation into production-ready code.