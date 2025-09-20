/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

import { jest } from '@jest/globals';

// Mock AWS SDK clients globally
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-ses');
jest.mock('@aws-sdk/s3-request-presigner');

// Set up environment variables for testing
process.env.AWS_REGION = 'us-east-1';
process.env.S3_BUCKET_NAME = 'test-apexshare-bucket';
process.env.DYNAMODB_TABLE = 'test-apexshare-table';
process.env.SES_FROM_EMAIL = 'test@apexshare.be';
process.env.SES_REGION = 'us-east-1';
process.env.CORS_ORIGINS = '*';
process.env.LOG_LEVEL = 'ERROR';
process.env.ENVIRONMENT = 'test';
process.env.DOWNLOAD_BASE_URL = 'https://test-api.apexshare.be/download';
process.env.MAX_FILE_SIZE = '5368709120'; // 5GB
process.env.PRESIGNED_URL_EXPIRY = '3600';
process.env.DOWNLOAD_EXPIRY_HOURS = '24';
process.env.ALLOWED_MIME_TYPES = 'video/mp4,video/quicktime,video/x-msvideo,video/x-matroska';

// Global test utilities
global.testUtils = {
  // Common test data
  validFileId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  validEmail: 'test@example.com',
  validFileName: 'test-video.mp4',
  validFileSize: 1024 * 1024 * 100, // 100MB
  validContentType: 'video/mp4',
  validSessionDate: '2025-01-20',

  // Mock context
  createMockContext: (requestId = 'test-request-id') => ({
    awsRequestId: requestId,
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2025/01/20/test-stream',
    functionName: 'test-function',
    functionVersion: '$LATEST',
    memoryLimitInMB: '128',
    getRemainingTimeInMillis: () => 300000,
    callbackWaitsForEmptyEventLoop: true,
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn()
  }),

  // Mock API Gateway event
  createMockAPIGatewayEvent: (overrides = {}) => ({
    httpMethod: 'POST',
    path: '/api/upload',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Test Browser)',
      ...overrides.headers
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      requestId: 'test-request-id',
      stage: 'test',
      requestTime: '2025-01-20T10:00:00.000Z',
      requestTimeEpoch: Date.now(),
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Test Browser)',
        cognitoIdentityPoolId: null,
        cognitoIdentityId: null,
        cognitoAuthenticationType: null,
        cognitoAuthenticationProvider: null,
        userArn: null,
        user: null,
        caller: null,
        accessKey: null,
        accountId: '123456789012',
        apiKey: null,
        apiKeyId: null,
        cognitoUserPoolId: null,
        principalOrgId: null
      },
      path: '/api/upload',
      resourcePath: '/api/upload',
      httpMethod: 'POST',
      apiId: 'test-api-id',
      protocol: 'HTTP/1.1',
      resourceId: 'test-resource-id',
      accountId: '123456789012'
    },
    body: null,
    isBase64Encoded: false,
    ...overrides
  }),

  // Mock S3 event
  createMockS3Event: (overrides = {}) => ({
    Records: [{
      eventVersion: '2.1',
      eventSource: 'aws:s3',
      awsRegion: 'us-east-1',
      eventTime: '2025-01-20T10:00:00.000Z',
      eventName: 'ObjectCreated:Put',
      userIdentity: {
        principalId: 'AWS:AIDAII23NWRZ4GPJMJIB2'
      },
      requestParameters: {
        sourceIPAddress: '127.0.0.1'
      },
      responseElements: {
        'x-amz-request-id': 'C2E9F5F9D1B3F5F9',
        'x-amz-id-2': 'test-id-2'
      },
      s3: {
        s3SchemaVersion: '1.0',
        configurationId: 'test-config',
        bucket: {
          name: 'test-apexshare-bucket',
          ownerIdentity: {
            principalId: 'AWS:AIDAII23NWRZ4GPJMJIB2'
          },
          arn: 'arn:aws:s3:::test-apexshare-bucket'
        },
        object: {
          key: 'videos/2025-01-20/f47ac10b-58cc-4372-a567-0e02b2c3d479-test-video.mp4',
          size: 1024 * 1024 * 100,
          eTag: 'd41d8cd98f00b204e9800998ecf8427e',
          sequencer: '00626F6F5F5F5F5F5F5F'
        }
      },
      ...overrides
    }]
  }),

  // Create mock upload request
  createMockUploadRequest: (overrides = {}) => ({
    studentEmail: 'test@example.com',
    studentName: 'Test Student',
    trainerName: 'Test Trainer',
    sessionDate: '2025-01-20',
    notes: 'Test session notes',
    fileName: 'test-video.mp4',
    fileSize: 1024 * 1024 * 100, // 100MB
    contentType: 'video/mp4',
    ...overrides
  }),

  // Create mock DynamoDB item
  createMockDynamoDBItem: (overrides = {}) => ({
    PK: { S: 'UPLOAD#f47ac10b-58cc-4372-a567-0e02b2c3d479' },
    SK: { S: 'METADATA#2025-01-20T10:00:00.000Z' },
    GSI1PK: { S: 'STUDENT#test@example.com' },
    GSI1SK: { S: 'DATE#2025-01-20T10:00:00.000Z' },
    GSI2PK: { S: 'DATE#2025-01-20' },
    GSI2SK: { S: 'UPLOAD#2025-01-20T10:00:00.000Z#f47ac10b-58cc-4372-a567-0e02b2c3d479' },
    fileId: { S: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
    studentEmail: { S: 'test@example.com' },
    studentName: { S: 'Test Student' },
    trainerName: { S: 'Test Trainer' },
    sessionDate: { S: '2025-01-20' },
    notes: { S: 'Test session notes' },
    fileName: { S: 'test-video.mp4' },
    originalFileName: { S: 'test-video.mp4' },
    fileSize: { N: '104857600' },
    contentType: { S: 'video/mp4' },
    s3Key: { S: 'videos/2025-01-20/f47ac10b-58cc-4372-a567-0e02b2c3d479-test-video.mp4' },
    s3Bucket: { S: 'test-apexshare-bucket' },
    uploadDate: { S: '2025-01-20T10:00:00.000Z' },
    status: { S: 'completed' },
    downloadCount: { N: '0' },
    ttl: { N: String(Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60)) },
    ...overrides
  })
};

// Suppress console.log in tests unless LOG_LEVEL is DEBUG
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args: any[]) => {
  if (process.env.LOG_LEVEL === 'DEBUG') {
    originalConsoleLog(...args);
  }
};

console.error = (...args: any[]) => {
  if (process.env.LOG_LEVEL === 'DEBUG') {
    originalConsoleError(...args);
  }
};

// Set longer timeout for integration tests
if (process.env.TEST_TYPE === 'integration') {
  jest.setTimeout(60000);
}