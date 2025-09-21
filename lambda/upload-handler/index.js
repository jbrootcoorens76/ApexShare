"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_presigned_post_1 = require("@aws-sdk/s3-presigned-post");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const uuid_1 = require("uuid");
const crypto = __importStar(require("crypto"));
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
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    maxAttempts: 3,
    retryMode: 'adaptive',
});
const dynamoClient = new client_dynamodb_1.DynamoDBClient({
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
 * Extract token from Authorization header or X-Auth-Token header
 */
function extractToken(headers) {
    if (!headers) {
        return null;
    }

    // First check X-Auth-Token header (fallback for custom domain issues)
    const xAuthToken = headers['X-Auth-Token'] || headers['x-auth-token'];
    if (xAuthToken) {
        return xAuthToken;
    }

    // Then check standard Authorization header
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
function verifyToken(token) {
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
    }
    catch (error) {
        throw new Error(`Token verification failed: ${error.message}`);
    }
}
/**
 * Validate authorization for session upload
 */
function validateAuthorization(event) {
    const token = extractToken(event.headers);
    if (!token) {
        return { isValid: false, error: 'No authorization token provided' };
    }
    // For demo/development: simple mock validation (same as sessions handler)
    // In production, verify JWT properly
    return { isValid: true, userId: 'trainer@apexshare.be', role: 'trainer' };
}
/**
 * Main Lambda handler
 */
const handler = async (event, context) => {
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
        }
        else if (event.path.includes('/uploads/initiate')) {
            // Handle legacy direct upload (for backward compatibility)
            return await handleLegacyUpload(event, headers, requestId, startTime);
        }
        else {
            return createErrorResponse(404, 'Upload endpoint not found', headers);
        }
    }
    catch (error) {
        logError('Upload handler error', error, { requestId, duration: Date.now() - startTime });
        return createErrorResponse(500, 'Internal server error', {
            'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
            'Content-Type': 'application/json',
        });
    }
};
exports.handler = handler;
/**
 * Extract session ID from path (e.g., /sessions/123/upload -> 123)
 */
function extractSessionId(path) {
    const sessionMatch = path.match(/\/sessions\/([^\/]+)\/upload/);
    return sessionMatch ? sessionMatch[1] : null;
}
/**
 * Handle session-based upload (new frontend API)
 */
async function handleSessionUpload(event, sessionId, headers, requestId, startTime, authResult) {
    // Parse and validate request body
    const body = parseRequestBody(event.body);
    if (!body) {
        return createErrorResponse(400, 'Invalid JSON in request body', headers);
    }
    const validationError = validateSessionUploadRequest(body);
    if (validationError) {
        return createErrorResponse(400, validationError, headers);
    }
    // Generate upload ID for multipart upload
    const uploadId = (0, uuid_1.v4)();
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
    const response = {
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
async function handleLegacyUpload(event, headers, requestId, startTime) {
    // Parse and validate request body
    const body = parseRequestBody(event.body);
    if (!body) {
        return createErrorResponse(400, 'Invalid JSON in request body', headers);
    }
    const validationError = validateLegacyUploadRequest(body);
    if (validationError) {
        return createErrorResponse(400, validationError, headers);
    }
    // Generate unique file ID and S3 key
    const fileId = (0, uuid_1.v4)();
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
async function handleRecentUploads(headers, requestId) {
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
    }
    catch (error) {
        logError('Recent uploads error', error, { requestId });
        return createErrorResponse(500, 'Failed to fetch recent uploads', headers);
    }
}
/**
 * Validate incoming request for security threats
 */
function validateRequest(event, requestId) {
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
function parseRequestBody(body) {
    try {
        if (!body)
            return null;
        return JSON.parse(body);
    }
    catch {
        return null;
    }
}
/**
 * Validate session-based upload request parameters
 */
function validateSessionUploadRequest(body) {
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
function validateLegacyUploadRequest(body) {
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
function getOptimalChunkSize(fileSize) {
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
async function createMultipartUpload(s3Key, body) {
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
async function storeSessionUploadMetadata(sessionId, body, uploadId, s3Key, timestamp, authResult) {
    const uploadDate = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days TTL
    const command = new client_dynamodb_1.PutItemCommand({
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
async function storeLegacyUploadMetadata(body, fileId, s3Key, timestamp) {
    const uploadDate = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days TTL
    const command = new client_dynamodb_1.PutItemCommand({
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
async function createPresignedUploadUrl(s3Key, body, fileId) {
    const result = await (0, s3_presigned_post_1.createPresignedPost)(s3Client, {
        Bucket: process.env.S3_BUCKET_NAME,
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
function createErrorResponse(statusCode, message, headers) {
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
function logSecurityEvent(eventType, severity, details) {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        eventType,
        severity,
        details,
        source: 'ApexShare-UploadHandler',
        environment: process.env.LOG_LEVEL,
    }));
}
/**
 * Log information messages
 */
function logInfo(message, details) {
    if (process.env.LOG_LEVEL === 'DEBUG' || process.env.LOG_LEVEL === 'INFO') {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message,
            details,
            source: 'ApexShare-UploadHandler',
        }));
    }
}
/**
 * Log error messages
 */
function logError(message, error, details) {
    console.error(JSON.stringify({
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
    }));
}
//# sourceMappingURL=index.js.map