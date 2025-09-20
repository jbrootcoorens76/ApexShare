/**
 * Download Handler Lambda Function
 *
 * Handles video download link generation by:
 * 1. Validating file ID and checking access permissions
 * 2. Retrieving metadata from DynamoDB
 * 3. Generating presigned S3 download URLs
 * 4. Updating download statistics
 * 5. Implementing TTL and expiration checks
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Types
interface DownloadResponse {
  success: boolean;
  data?: {
    downloadUrl: string;
    videoInfo: {
      fileName: string;
      fileSize: number;
      sessionDate: string;
      trainerName?: string;
      notes?: string;
      expiresAt: string;
    };
  };
  error?: string;
}

interface UploadRecord {
  PK: string;
  SK: string;
  fileId: string;
  s3Key: string;
  s3Bucket: string;
  originalFileName: string;
  fileSize: number;
  sessionDate: string;
  trainerName?: string;
  notes?: string;
  uploadDate: string;
  status: string;
  ttl: number;
  downloadCount: number;
}

// Constants
const DOWNLOAD_EXPIRY_HOURS = parseInt(process.env.DOWNLOAD_EXPIRY_HOURS || '24');
const DOWNLOAD_EXPIRY_SECONDS = DOWNLOAD_EXPIRY_HOURS * 3600;

// AWS Clients (initialized outside handler for connection reuse)
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  maxAttempts: 3,
  retryMode: 'adaptive',
});

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  maxAttempts: 3,
  retryMode: 'adaptive',
});

// Pre-compiled regex for file ID validation
const FILE_ID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Main Lambda handler
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  const startTime = Date.now();

  try {
    // Set up CORS headers
    const headers = {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'OPTIONS,GET',
      'Content-Type': 'application/json',
    };

    // Handle OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'CORS preflight' }),
      };
    }

    // Validate HTTP method
    if (event.httpMethod !== 'GET') {
      return createErrorResponse(405, 'Method not allowed', headers);
    }

    // Security validation
    if (!validateRequest(event, requestId)) {
      return createErrorResponse(400, 'Invalid request detected', headers);
    }

    // Extract and validate file ID
    const fileId = event.pathParameters?.fileId;
    if (!fileId || !FILE_ID_REGEX.test(fileId)) {
      return createErrorResponse(400, 'Invalid file ID format', headers);
    }

    // Get file metadata from DynamoDB
    const uploadRecord = await getUploadRecord(fileId);
    if (!uploadRecord) {
      logInfo('File not found', { requestId, fileId });
      return createErrorResponse(404, 'Video not found or expired', headers);
    }

    // Check if file has expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (uploadRecord.ttl > 0 && currentTime > uploadRecord.ttl) {
      logInfo('File has expired', { requestId, fileId, ttl: uploadRecord.ttl, currentTime });
      return createErrorResponse(410, 'Video has expired', headers);
    }

    // Check if upload is completed
    if (uploadRecord.status !== 'completed') {
      logInfo('File not yet available', { requestId, fileId, status: uploadRecord.status });
      return createErrorResponse(404, 'Video not yet available', headers);
    }

    // Verify S3 object exists
    const s3ObjectExists = await verifyS3Object(uploadRecord.s3Bucket, uploadRecord.s3Key);
    if (!s3ObjectExists) {
      logError('S3 object not found', new Error('Object missing'), {
        requestId,
        fileId,
        s3Key: uploadRecord.s3Key,
        s3Bucket: uploadRecord.s3Bucket,
      });
      return createErrorResponse(404, 'Video file not found', headers);
    }

    // Generate presigned download URL
    const downloadUrl = await generateDownloadUrl(
      uploadRecord.s3Bucket,
      uploadRecord.s3Key,
      uploadRecord.originalFileName
    );

    // Update download count and last download timestamp
    await updateDownloadStats(uploadRecord);

    // Log successful operation
    logInfo('Download link generated successfully', {
      requestId,
      fileId,
      fileName: uploadRecord.originalFileName,
      downloadCount: uploadRecord.downloadCount + 1,
      duration: Date.now() - startTime,
    });

    const response: DownloadResponse = {
      success: true,
      data: {
        downloadUrl,
        videoInfo: {
          fileName: uploadRecord.originalFileName,
          fileSize: uploadRecord.fileSize,
          sessionDate: uploadRecord.sessionDate,
          trainerName: uploadRecord.trainerName,
          notes: uploadRecord.notes,
          expiresAt: new Date((uploadRecord.ttl) * 1000).toISOString(),
        },
      },
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    logError('Download handler error', error, { requestId, duration: Date.now() - startTime });

    return createErrorResponse(
      500,
      'Internal server error',
      {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
        'Content-Type': 'application/json',
      }
    );
  }
};

/**
 * Validate incoming request for security threats
 */
function validateRequest(event: APIGatewayProxyEvent, requestId: string): boolean {
  const sourceIP = event.requestContext?.identity?.sourceIp;
  const userAgent = event.headers?.['User-Agent'] || '';

  // Check for suspicious user agents
  if (userAgent.toLowerCase().includes('bot') || userAgent.toLowerCase().includes('crawler')) {
    logSecurityEvent('SuspiciousUserAgent', 'MEDIUM', {
      userAgent,
      sourceIP,
      requestId,
    });
    return false;
  }

  // Check for direct S3 access attempts
  if (event.path?.includes('amazonaws.com') || event.path?.includes('s3.')) {
    logSecurityEvent('DirectS3AccessAttempt', 'HIGH', {
      path: event.path,
      sourceIP,
      requestId,
    });
    return false;
  }

  return true;
}

/**
 * Get upload record from DynamoDB
 */
async function getUploadRecord(fileId: string): Promise<UploadRecord | null> {
  try {
    // Query using the partition key pattern
    const command = new QueryCommand({
      TableName: process.env.DYNAMODB_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': { S: `UPLOAD#${fileId}` },
      },
      Limit: 1,
    });

    const result = await dynamoClient.send(command);

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    const item = result.Items[0];

    return {
      PK: item.PK?.S || '',
      SK: item.SK?.S || '',
      fileId: item.fileId?.S || '',
      s3Key: item.s3Key?.S || '',
      s3Bucket: item.s3Bucket?.S || '',
      originalFileName: item.originalFileName?.S || '',
      fileSize: parseInt(item.fileSize?.N || '0'),
      sessionDate: item.sessionDate?.S || '',
      trainerName: item.trainerName?.S || undefined,
      notes: item.notes?.S || undefined,
      uploadDate: item.uploadDate?.S || '',
      status: item.status?.S || '',
      ttl: parseInt(item.ttl?.N || '0'),
      downloadCount: parseInt(item.downloadCount?.N || '0'),
    };
  } catch (error) {
    logError('Failed to get upload record', error, { fileId });
    return null;
  }
}

/**
 * Verify that S3 object exists
 */
async function verifyS3Object(bucket: string, key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    // For other errors, assume object exists to avoid false negatives
    logError('Error verifying S3 object', error, { bucket, key });
    return true;
  }
}

/**
 * Generate presigned download URL
 */
async function generateDownloadUrl(
  bucket: string,
  key: string,
  fileName: string
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, '\\"')}"`,
    ResponseCacheControl: 'no-cache, no-store, must-revalidate',
  });

  return await getSignedUrl(s3Client, command, {
    expiresIn: DOWNLOAD_EXPIRY_SECONDS,
  });
}

/**
 * Update download statistics in DynamoDB
 */
async function updateDownloadStats(uploadRecord: UploadRecord): Promise<void> {
  try {
    const command = new UpdateItemCommand({
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        PK: { S: uploadRecord.PK },
        SK: { S: uploadRecord.SK },
      },
      UpdateExpression: 'ADD downloadCount :inc SET lastDownloadAt = :timestamp',
      ExpressionAttributeValues: {
        ':inc': { N: '1' },
        ':timestamp': { S: new Date().toISOString() },
      },
      ReturnValues: 'NONE',
    });

    await dynamoClient.send(command);
  } catch (error) {
    // Log error but don't fail the request
    logError('Failed to update download stats', error, {
      fileId: uploadRecord.fileId,
      PK: uploadRecord.PK,
      SK: uploadRecord.SK,
    });
  }
}

/**
 * Create error response
 */
function createErrorResponse(
  statusCode: number,
  message: string,
  headers: Record<string, string>
): APIGatewayProxyResult {
  return {
    statusCode,
    headers,
    body: JSON.stringify({
      success: false,
      error: message,
    }),
  };
}

/**
 * Log security events
 */
function logSecurityEvent(
  eventType: string,
  severity: string,
  details: Record<string, any>
): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      eventType,
      severity,
      details,
      source: 'ApexShare-DownloadHandler',
      environment: process.env.LOG_LEVEL,
    })
  );
}

/**
 * Log information messages
 */
function logInfo(message: string, details?: Record<string, any>): void {
  if (process.env.LOG_LEVEL === 'DEBUG' || process.env.LOG_LEVEL === 'INFO') {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message,
        details,
        source: 'ApexShare-DownloadHandler',
      })
    );
  }
}

/**
 * Log error messages
 */
function logError(message: string, error: any, details?: Record<string, any>): void {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      error: {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      },
      details,
      source: 'ApexShare-DownloadHandler',
    })
  );
}