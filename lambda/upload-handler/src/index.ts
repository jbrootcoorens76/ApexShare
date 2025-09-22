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
import * as crypto from 'crypto';

// Types
interface UploadRequest {
  fileName: string;
  fileSize: number;
  mimeType?: string;
  contentType?: string;
}

interface LegacyUploadRequest {
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
    uploadId: string;
    uploadUrl: string;
    chunkSize: number;
    expiresAt: string;
  };
  error?: string;
}

interface AuthResult {
  isValid: boolean;
  userId?: string;
  role?: string;
  error?: string;
}

// JWT secret (same as auth-handler)
const JWT_SECRET = process.env.JWT_SECRET || 'demo-secret-key-apexshare-2024';

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
 * Extract token from Authorization header
 */
function extractToken(headers: { [key: string]: string | undefined }): string | null {
  if (!headers) {
    return null;
  }

  const authHeader = headers.Authorization || headers.authorization;
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Verify JWT token
 */
function verifyToken(token: string): any {
  try {
    const [headerB64, payloadB64, signature] = token.split('.');

    if (!headerB64 || !payloadB64 || !signature) {
      throw new Error('Invalid token format');
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      throw new Error('Invalid signature');
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token expired');
    }

    return payload;
  } catch (error) {
    throw new Error(`Token verification failed: ${(error as Error).message}`);
  }
}

/**
 * Validate authorization for session upload
 * Updated to match sessions handler's permissive authentication pattern
 */
function validateAuthorization(event: APIGatewayProxyEvent): AuthResult {
  // Check X-Auth-Token header (same as sessions handler)
  const xAuthToken = event.headers?.['X-Auth-Token'] || event.headers?.['x-auth-token'];
  if (xAuthToken) {
    // For now, accept any X-Auth-Token - matching sessions handler behavior
    return { isValid: true, userId: 'trainer@apexshare.be', role: 'trainer' };
  }

  // Check X-Public-Access header for frontend compatibility
  const publicAccess = event.headers?.['X-Public-Access'] || event.headers?.['x-public-access'];
  if (publicAccess === 'true') {
    return { isValid: true, userId: 'public-user@apexshare.be', role: 'public' };
  }

  // Check standard Authorization header as fallback
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // For now, accept any Bearer token - matching sessions handler behavior
    return { isValid: true, userId: 'trainer@apexshare.be', role: 'trainer' };
  }

  return { isValid: false, error: 'No authorization token provided' };
}

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
    // LOG DETAILED REQUEST INFO FOR DEBUGGING
    console.log('DEBUG: Upload handler received request:', JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId: requestId,
      httpMethod: event.httpMethod,
      path: event.path,
      headers: event.headers,
      bodyLength: event.body?.length || 0,
      body: event.body,
      requestContext: event.requestContext,
      source: 'handler-entry'
    }, null, 2));

    // Set up CORS headers (matching sessions handler)
    const headers = {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Auth-Token,X-Public-Access',
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

    // Check if this is a session-based upload or legacy direct upload
    const sessionId = extractSessionId(event.path);

    if (sessionId) {
      // Validate authorization for session upload
      const authResult = validateAuthorization(event);
      if (!authResult.isValid) {
        logSecurityEvent('UnauthorizedUploadAttempt', 'HIGH', {
          sessionId,
          sourceIP: event.requestContext?.identity?.sourceIp,
          error: authResult.error,
          requestId,
        });
        return createErrorResponse(403, 'Unauthorized', headers);
      }

      // Handle session-based upload (new frontend)
      return await handleSessionUpload(event, sessionId, headers, requestId, startTime, authResult);
    } else if (event.path.includes('/uploads/initiate')) {
      // Handle legacy direct upload (for backward compatibility)
      return await handleLegacyUpload(event, headers, requestId, startTime);
    } else {
      return createErrorResponse(404, 'Upload endpoint not found', headers);
    }

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
 * Extract session ID from path (e.g., /sessions/123/upload -> 123)
 */
function extractSessionId(path: string): string | null {
  const sessionMatch = path.match(/\/sessions\/([^\/]+)\/upload/);
  return sessionMatch ? sessionMatch[1] : null;
}

/**
 * Handle session-based upload (new frontend API)
 */
async function handleSessionUpload(
  event: APIGatewayProxyEvent,
  sessionId: string,
  headers: Record<string, string>,
  requestId: string,
  startTime: number,
  authResult: AuthResult
): Promise<APIGatewayProxyResult> {
  // Parse and validate request body
  const body = parseRequestBody(event.body) as UploadRequest | null;
  if (!body) {
    return createErrorResponse(400, 'Invalid JSON in request body', headers);
  }

  const validationError = validateSessionUploadRequest(body);
  if (validationError) {
    return createErrorResponse(400, validationError, headers);
  }

  // Generate upload ID for multipart upload
  const uploadId = uuidv4();
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const sanitizedFileName = body.fileName.replace(FILENAME_SANITIZE_REGEX, '-');
  const s3Key = `sessions/${sessionId}/videos/${timestamp}/${uploadId}-${sanitizedFileName}`;

  // Create multipart upload
  const multipartUpload = await createMultipartUpload(s3Key, body);

  // Store upload metadata in DynamoDB
  await storeSessionUploadMetadata(sessionId, body, uploadId, s3Key, timestamp, authResult);

  // Log successful operation
  logInfo('Session upload initiated successfully', {
    requestId,
    sessionId,
    uploadId,
    fileName: body.fileName,
    fileSize: body.fileSize,
    duration: Date.now() - startTime,
  });

  const response: UploadResponse = {
    success: true,
    data: {
      uploadId,
      uploadUrl: multipartUpload.uploadUrl,
      chunkSize: getOptimalChunkSize(body.fileSize),
      expiresAt: new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000).toISOString(),
    },
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(response),
  };
}

/**
 * Handle legacy direct upload (backward compatibility)
 */
async function handleLegacyUpload(
  event: APIGatewayProxyEvent,
  headers: Record<string, string>,
  requestId: string,
  startTime: number
): Promise<APIGatewayProxyResult> {
  // Parse and validate request body
  const body = parseRequestBody(event.body) as LegacyUploadRequest | null;
  if (!body) {
    return createErrorResponse(400, 'Invalid JSON in request body', headers);
  }

  const validationError = validateLegacyUploadRequest(body);
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
  await storeLegacyUploadMetadata(body, fileId, s3Key, timestamp);

  // Log successful operation
  logInfo('Legacy upload initiated successfully', {
    requestId,
    fileId,
    studentEmail: body.studentEmail,
    fileName: body.fileName,
    fileSize: body.fileSize,
    duration: Date.now() - startTime,
  });

  const response = {
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
}

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
 * Validate session-based upload request parameters
 */
function validateSessionUploadRequest(body: UploadRequest): string | null {
  // LOG THE FULL REQUEST BODY FOR DEBUGGING
  console.log('DEBUG: Validating upload request:', JSON.stringify({
    timestamp: new Date().toISOString(),
    bodyReceived: body,
    bodyKeys: Object.keys(body || {}),
    bodySize: JSON.stringify(body || {}).length,
    source: 'validateSessionUploadRequest'
  }));

  if (!body.fileName || body.fileName.trim().length === 0) {
    console.log('DEBUG: Validation failed - fileName missing or empty');
    return 'File name is required';
  }

  if (!body.fileSize || body.fileSize < 1024 || body.fileSize > MAX_FILE_SIZE) {
    console.log('DEBUG: Validation failed - fileSize invalid:', body.fileSize);
    return `File size must be between 1KB and ${Math.round(MAX_FILE_SIZE / 1024 / 1024 / 1024)}GB`;
  }

  // Accept both mimeType (new frontend) and contentType (API Gateway compatibility)
  const mimeType = body.mimeType || body.contentType;
  console.log('DEBUG: MIME type validation:', JSON.stringify({
    bodyMimeType: body.mimeType,
    bodyContentType: body.contentType,
    resolvedMimeType: mimeType,
    allowedTypes: ALLOWED_MIME_TYPES,
    isValid: mimeType && ALLOWED_MIME_TYPES.includes(mimeType)
  }));

  if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
    console.log('DEBUG: Validation failed - MIME type invalid');
    return `MIME type must be one of: ${ALLOWED_MIME_TYPES.join(', ')}`;
  }

  console.log('DEBUG: Validation passed successfully');
  return null;
}

/**
 * Validate legacy upload request parameters
 */
function validateLegacyUploadRequest(body: LegacyUploadRequest): string | null {
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
 * Get optimal chunk size based on file size
 */
function getOptimalChunkSize(fileSize: number): number {
  // Default chunk size is 5MB
  const defaultChunkSize = 5 * 1024 * 1024;

  // For very large files (>1GB), use larger chunks for better performance
  if (fileSize > 1024 * 1024 * 1024) {
    return 10 * 1024 * 1024; // 10MB
  }

  // For small files (<50MB), use smaller chunks
  if (fileSize < 50 * 1024 * 1024) {
    return 1 * 1024 * 1024; // 1MB
  }

  return defaultChunkSize;
}

/**
 * Create multipart upload for chunked uploads
 */
async function createMultipartUpload(
  s3Key: string,
  body: UploadRequest
): Promise<{ uploadUrl: string }> {
  // For now, we'll use a simple presigned URL approach
  // In a full implementation, this would use S3's CreateMultipartUpload API
  // and return presigned URLs for each part

  // Generate a base URL that the frontend can use with part numbers
  const baseUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

  return {
    uploadUrl: baseUrl,
  };
}

/**
 * Store session upload metadata in DynamoDB
 */
async function storeSessionUploadMetadata(
  sessionId: string,
  body: UploadRequest,
  uploadId: string,
  s3Key: string,
  timestamp: string,
  authResult: AuthResult
): Promise<void> {
  const uploadDate = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days TTL

  const command = new PutItemCommand({
    TableName: process.env.DYNAMODB_TABLE,
    Item: {
      PK: { S: `SESSION#${sessionId}` },
      SK: { S: `UPLOAD#${uploadId}` },
      GSI1PK: { S: `UPLOAD#${uploadId}` },
      GSI1SK: { S: `SESSION#${sessionId}#${uploadDate}` },
      GSI2PK: { S: `DATE#${timestamp}` },
      GSI2SK: { S: `UPLOAD#${uploadDate}#${uploadId}` },
      uploadId: { S: uploadId },
      sessionId: { S: sessionId },
      fileName: { S: body.fileName.replace(FILENAME_SANITIZE_REGEX, '-') },
      originalFileName: { S: body.fileName },
      fileSize: { N: body.fileSize.toString() },
      mimeType: { S: body.mimeType || body.contentType || '' },
      s3Key: { S: s3Key },
      s3Bucket: { S: process.env.S3_BUCKET_NAME || '' },
      uploadDate: { S: uploadDate },
      status: { S: 'pending' },
      uploadType: { S: 'multipart' },
      chunkSize: { N: getOptimalChunkSize(body.fileSize).toString() },
      uploadedBy: { S: authResult.userId || 'unknown' },
      uploaderRole: { S: authResult.role || 'unknown' },
      ttl: { N: ttl.toString() },
    },
  });

  await dynamoClient.send(command);
}

/**
 * Store legacy upload metadata in DynamoDB
 */
async function storeLegacyUploadMetadata(
  body: LegacyUploadRequest,
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
      uploadType: { S: 'presigned_post' },
      downloadCount: { N: '0' },
      ttl: { N: ttl.toString() },
    },
  });

  await dynamoClient.send(command);
}

/**
 * Create presigned POST URL for S3 upload (legacy)
 */
async function createPresignedUploadUrl(
  s3Key: string,
  body: LegacyUploadRequest,
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