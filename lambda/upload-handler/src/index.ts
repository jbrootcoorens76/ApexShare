/**
 * Upload Handler Lambda Function
 *
 * Handles video upload initiation by:
 * 1. Validating request parameters
 * 2. Generating presigned S3 POST URLs
 * 3. Creating metadata records in DynamoDB
 * 4. Implementing security validations
 * 5. Providing structured error responses
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

// Types
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

interface UploadResponse {
  success: boolean;
  data?: {
    fileId: string;
    uploadUrl: string;
    fields: Record<string, string>;
    expiresAt: string;
  };
  error?: string;
}

// Constants
const ALLOWED_MIME_TYPES = process.env.ALLOWED_MIME_TYPES?.split(',') || [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
];

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5368709120'); // 5GB
const PRESIGNED_URL_EXPIRY = parseInt(process.env.PRESIGNED_URL_EXPIRY || '3600'); // 1 hour

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

// Pre-compiled regex patterns for performance
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const FILENAME_SANITIZE_REGEX = /[^a-zA-Z0-9.-]/g;
const SQL_INJECTION_PATTERNS = [
  /union.*select/i,
  /select.*from/i,
  /insert.*into/i,
  /delete.*from/i,
  /drop.*table/i,
  /<script.*>/i,
  /javascript:/i,
];

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
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
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

    // Handle GET request for recent uploads (dashboard)
    if (event.httpMethod === 'GET' && event.path.includes('recent')) {
      return await handleRecentUploads(headers, requestId);
    }

    // Validate HTTP method
    if (event.httpMethod !== 'POST') {
      return createErrorResponse(405, 'Method not allowed', headers);
    }

    // Security validation
    if (!validateRequest(event, requestId)) {
      return createErrorResponse(400, 'Invalid request detected', headers);
    }

    // Parse and validate request body
    const body = parseRequestBody(event.body);
    if (!body) {
      return createErrorResponse(400, 'Invalid JSON in request body', headers);
    }

    const validationError = validateUploadRequest(body);
    if (validationError) {
      return createErrorResponse(400, validationError, headers);
    }

    // Generate unique file ID and S3 key
    const fileId = uuidv4();
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitizedFileName = body.fileName.replace(FILENAME_SANITIZE_REGEX, '-');
    const s3Key = `videos/${timestamp}/${fileId}-${sanitizedFileName}`;

    // Create presigned POST URL for S3
    const presignedPost = await createPresignedUploadUrl(s3Key, body, fileId);

    // Store metadata in DynamoDB
    await storeUploadMetadata(body, fileId, s3Key, timestamp);

    // Log successful operation
    logInfo('Upload initiated successfully', {
      requestId,
      fileId,
      studentEmail: body.studentEmail,
      fileName: body.fileName,
      fileSize: body.fileSize,
      duration: Date.now() - startTime,
    });

    const response: UploadResponse = {
      success: true,
      data: {
        fileId,
        uploadUrl: presignedPost.url,
        fields: presignedPost.fields,
        expiresAt: new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000).toISOString(),
      },
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    logError('Upload handler error', error, { requestId, duration: Date.now() - startTime });

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
 * Handle recent uploads request for dashboard
 */
async function handleRecentUploads(
  headers: Record<string, string>,
  requestId: string
): Promise<APIGatewayProxyResult> {
  try {
    // This would typically query DynamoDB for recent uploads
    // For now, return a placeholder response
    const response = {
      success: true,
      data: {
        uploads: [],
        pagination: {
          total: 0,
          limit: 10,
          offset: 0,
          hasMore: false,
        },
      },
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    logError('Recent uploads error', error, { requestId });
    return createErrorResponse(500, 'Failed to fetch recent uploads', headers);
  }
}

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

  // Check for injection patterns in request body
  if (event.body) {
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(event.body)) {
        logSecurityEvent('InjectionAttempt', 'HIGH', {
          pattern: pattern.source,
          sourceIP,
          body: event.body.substring(0, 500),
          requestId,
        });
        return false;
      }
    }
  }

  return true;
}

/**
 * Parse request body with error handling
 */
function parseRequestBody(body: string | null): UploadRequest | null {
  try {
    if (!body) return null;
    return JSON.parse(body) as UploadRequest;
  } catch {
    return null;
  }
}

/**
 * Validate upload request parameters
 */
function validateUploadRequest(body: UploadRequest): string | null {
  if (!body.studentEmail || !EMAIL_REGEX.test(body.studentEmail)) {
    return 'Valid student email is required';
  }

  if (!body.fileName || body.fileName.trim().length === 0) {
    return 'File name is required';
  }

  if (!body.fileSize || body.fileSize < 1024 || body.fileSize > MAX_FILE_SIZE) {
    return `File size must be between 1KB and ${Math.round(MAX_FILE_SIZE / 1024 / 1024 / 1024)}GB`;
  }

  if (!body.contentType || !ALLOWED_MIME_TYPES.includes(body.contentType)) {
    return `Content type must be one of: ${ALLOWED_MIME_TYPES.join(', ')}`;
  }

  if (!body.sessionDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.sessionDate)) {
    return 'Session date must be in YYYY-MM-DD format';
  }

  // Optional field validations
  if (body.studentName && body.studentName.length > 100) {
    return 'Student name must be 100 characters or less';
  }

  if (body.trainerName && body.trainerName.length > 100) {
    return 'Trainer name must be 100 characters or less';
  }

  if (body.notes && body.notes.length > 1000) {
    return 'Notes must be 1000 characters or less';
  }

  return null;
}

/**
 * Create presigned POST URL for S3 upload
 */
async function createPresignedUploadUrl(
  s3Key: string,
  body: UploadRequest,
  fileId: string
): Promise<{ url: string; fields: Record<string, string> }> {
  const result = await createPresignedPost(s3Client, {
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: s3Key,
    Fields: {
      'Content-Type': body.contentType,
      'x-amz-meta-file-id': fileId,
      'x-amz-meta-student-email': body.studentEmail,
      'x-amz-server-side-encryption': 'AES256',
    },
    Conditions: [
      ['content-length-range', 0, MAX_FILE_SIZE],
      ['starts-with', '$Content-Type', 'video/'],
      ['eq', '$x-amz-meta-file-id', fileId],
    ],
    Expires: PRESIGNED_URL_EXPIRY,
  });

  return {
    url: result.url,
    fields: result.fields || {},
  };
}

/**
 * Store upload metadata in DynamoDB
 */
async function storeUploadMetadata(
  body: UploadRequest,
  fileId: string,
  s3Key: string,
  timestamp: string
): Promise<void> {
  const uploadDate = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days TTL

  const command = new PutItemCommand({
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
      fileName: { S: body.fileName.replace(FILENAME_SANITIZE_REGEX, '-') },
      originalFileName: { S: body.fileName },
      fileSize: { N: body.fileSize.toString() },
      contentType: { S: body.contentType },
      s3Key: { S: s3Key },
      s3Bucket: { S: process.env.S3_BUCKET_NAME || '' },
      uploadDate: { S: uploadDate },
      status: { S: 'pending' },
      downloadCount: { N: '0' },
      ttl: { N: ttl.toString() },
    },
  });

  await dynamoClient.send(command);
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
      source: 'ApexShare-UploadHandler',
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
        source: 'ApexShare-UploadHandler',
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
      source: 'ApexShare-UploadHandler',
    })
  );
}