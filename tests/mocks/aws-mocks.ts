/**
 * AWS Service Mocks for Testing
 * Provides mock implementations of AWS services for unit and integration testing
 */

import { jest } from '@jest/globals';

// S3 Client Mock
export const mockS3Client = {
  send: jest.fn(),
  destroy: jest.fn(),
  middlewareStack: {
    add: jest.fn(),
    remove: jest.fn(),
    removeByTag: jest.fn(),
    concat: jest.fn(),
    applyToStack: jest.fn(),
    identify: jest.fn(),
    identifyOnResolve: jest.fn(),
    resolve: jest.fn()
  }
};

// DynamoDB Client Mock
export const mockDynamoDBClient = {
  send: jest.fn(),
  destroy: jest.fn(),
  middlewareStack: {
    add: jest.fn(),
    remove: jest.fn(),
    removeByTag: jest.fn(),
    concat: jest.fn(),
    applyToStack: jest.fn(),
    identify: jest.fn(),
    identifyOnResolve: jest.fn(),
    resolve: jest.fn()
  }
};

// SES Client Mock
export const mockSESClient = {
  send: jest.fn(),
  destroy: jest.fn(),
  middlewareStack: {
    add: jest.fn(),
    remove: jest.fn(),
    removeByTag: jest.fn(),
    concat: jest.fn(),
    applyToStack: jest.fn(),
    identify: jest.fn(),
    identifyOnResolve: jest.fn(),
    resolve: jest.fn()
  }
};

// Mock S3 Commands
export const mockPutObjectCommand = jest.fn();
export const mockGetObjectCommand = jest.fn();
export const mockDeleteObjectCommand = jest.fn();
export const mockHeadObjectCommand = jest.fn();
export const mockListObjectsV2Command = jest.fn();

// Mock DynamoDB Commands
export const mockPutItemCommand = jest.fn();
export const mockGetItemCommand = jest.fn();
export const mockQueryCommand = jest.fn();
export const mockScanCommand = jest.fn();
export const mockUpdateItemCommand = jest.fn();
export const mockDeleteItemCommand = jest.fn();

// Mock SES Commands
export const mockSendEmailCommand = jest.fn();
export const mockSendBulkTemplatedEmailCommand = jest.fn();

// Mock presigned URL functions
export const mockCreatePresignedPost = jest.fn();
export const mockGetSignedUrl = jest.fn();

// Mock responses for successful operations
export const mockResponses = {
  s3: {
    putObject: { ETag: 'mock-etag', VersionId: 'mock-version' },
    getObject: {
      Body: Buffer.from('mock file content'),
      ContentType: 'video/mp4',
      ContentLength: 1024,
      LastModified: new Date(),
      ETag: 'mock-etag'
    },
    headObject: {
      ContentType: 'video/mp4',
      ContentLength: 1024,
      LastModified: new Date(),
      ETag: 'mock-etag'
    },
    listObjectsV2: {
      Contents: [
        {
          Key: 'videos/2025-01-20/test-file-id-video.mp4',
          Size: 1024,
          LastModified: new Date(),
          ETag: 'mock-etag'
        }
      ]
    },
    presignedPost: {
      url: 'https://mock-bucket.s3.amazonaws.com',
      fields: {
        key: 'videos/2025-01-20/test-file-id-video.mp4',
        'Content-Type': 'video/mp4',
        'x-amz-meta-file-id': 'test-file-id',
        'x-amz-server-side-encryption': 'AES256'
      }
    },
    signedUrl: 'https://mock-bucket.s3.amazonaws.com/videos/test.mp4?signed=true'
  },

  dynamodb: {
    putItem: { Attributes: {} },
    getItem: {
      Item: {
        PK: { S: 'UPLOAD#test-file-id' },
        SK: { S: 'METADATA#2025-01-20T10:00:00.000Z' },
        fileId: { S: 'test-file-id' },
        studentEmail: { S: 'test@example.com' },
        fileName: { S: 'test-video.mp4' },
        status: { S: 'completed' }
      }
    },
    query: {
      Items: [{
        PK: { S: 'UPLOAD#test-file-id' },
        SK: { S: 'METADATA#2025-01-20T10:00:00.000Z' },
        fileId: { S: 'test-file-id' },
        studentEmail: { S: 'test@example.com' },
        studentName: { S: 'Test Student' },
        trainerName: { S: 'Test Trainer' },
        sessionDate: { S: '2025-01-20' },
        notes: { S: 'Test session notes' },
        fileName: { S: 'test-video.mp4' },
        originalFileName: { S: 'test-video.mp4' },
        fileSize: { N: '1048576' },
        contentType: { S: 'video/mp4' },
        s3Key: { S: 'videos/2025-01-20/test-file-id-test-video.mp4' },
        s3Bucket: { S: 'test-bucket' },
        uploadDate: { S: '2025-01-20T10:00:00.000Z' },
        status: { S: 'completed' },
        downloadCount: { N: '0' },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 86400) }
      }],
      Count: 1,
      ScannedCount: 1
    },
    updateItem: { Attributes: {} }
  },

  ses: {
    sendEmail: {
      MessageId: 'mock-message-id',
      ResponseMetadata: {
        RequestId: 'mock-request-id'
      }
    }
  }
};

// Mock error responses for testing error handling
export const mockErrors = {
  s3: {
    notFound: { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } },
    accessDenied: { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } },
    serviceUnavailable: { name: 'ServiceUnavailable', $metadata: { httpStatusCode: 503 } }
  },
  dynamodb: {
    notFound: { name: 'ResourceNotFoundException' },
    throttling: { name: 'ProvisionedThroughputExceededException' },
    validation: { name: 'ValidationException' }
  },
  ses: {
    messageRejected: { name: 'MessageRejected' },
    sendingQuotaExceeded: { name: 'SendingQuotaExceededException' },
    invalidEmail: { name: 'InvalidParameterValueException' }
  }
};

/**
 * Set up default mock implementations
 */
export function setupAWSMocks() {
  // S3 Client mocks
  jest.doMock('@aws-sdk/client-s3', () => ({
    S3Client: jest.fn(() => mockS3Client),
    PutObjectCommand: mockPutObjectCommand,
    GetObjectCommand: mockGetObjectCommand,
    DeleteObjectCommand: mockDeleteObjectCommand,
    HeadObjectCommand: mockHeadObjectCommand,
    ListObjectsV2Command: mockListObjectsV2Command
  }));

  // DynamoDB Client mocks
  jest.doMock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: jest.fn(() => mockDynamoDBClient),
    PutItemCommand: mockPutItemCommand,
    GetItemCommand: mockGetItemCommand,
    QueryCommand: mockQueryCommand,
    ScanCommand: mockScanCommand,
    UpdateItemCommand: mockUpdateItemCommand,
    DeleteItemCommand: mockDeleteItemCommand
  }));

  // SES Client mocks
  jest.doMock('@aws-sdk/client-ses', () => ({
    SESClient: jest.fn(() => mockSESClient),
    SendEmailCommand: mockSendEmailCommand,
    SendBulkTemplatedEmailCommand: mockSendBulkTemplatedEmailCommand
  }));

  // S3 presigned URL mocks
  jest.doMock('@aws-sdk/s3-presigned-post', () => ({
    createPresignedPost: mockCreatePresignedPost
  }));

  jest.doMock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: mockGetSignedUrl
  }));

  // Set up default successful responses
  mockS3Client.send.mockResolvedValue(mockResponses.s3.putObject);
  mockDynamoDBClient.send.mockResolvedValue(mockResponses.dynamodb.putItem);
  mockSESClient.send.mockResolvedValue(mockResponses.ses.sendEmail);
  mockCreatePresignedPost.mockResolvedValue(mockResponses.s3.presignedPost);
  mockGetSignedUrl.mockResolvedValue(mockResponses.s3.signedUrl);
}

/**
 * Reset all mocks to their default state
 */
export function resetAWSMocks() {
  jest.clearAllMocks();

  // Reset to default successful responses
  mockS3Client.send.mockResolvedValue(mockResponses.s3.putObject);
  mockDynamoDBClient.send.mockResolvedValue(mockResponses.dynamodb.putItem);
  mockSESClient.send.mockResolvedValue(mockResponses.ses.sendEmail);
  mockCreatePresignedPost.mockResolvedValue(mockResponses.s3.presignedPost);
  mockGetSignedUrl.mockResolvedValue(mockResponses.s3.signedUrl);
}

/**
 * Mock successful S3 operations
 */
export function mockS3Success(operation: string, customResponse?: any) {
  const response = customResponse || mockResponses.s3[operation as keyof typeof mockResponses.s3];
  mockS3Client.send.mockResolvedValue(response);
}

/**
 * Mock S3 errors
 */
export function mockS3Error(errorType: keyof typeof mockErrors.s3) {
  const error = mockErrors.s3[errorType];
  mockS3Client.send.mockRejectedValue(error);
}

/**
 * Mock successful DynamoDB operations
 */
export function mockDynamoDBSuccess(operation: string, customResponse?: any) {
  const response = customResponse || mockResponses.dynamodb[operation as keyof typeof mockResponses.dynamodb];
  mockDynamoDBClient.send.mockResolvedValue(response);
}

/**
 * Mock DynamoDB errors
 */
export function mockDynamoDBError(errorType: keyof typeof mockErrors.dynamodb) {
  const error = mockErrors.dynamodb[errorType];
  mockDynamoDBClient.send.mockRejectedValue(error);
}

/**
 * Mock successful SES operations
 */
export function mockSESSuccess(operation: string, customResponse?: any) {
  const response = customResponse || mockResponses.ses[operation as keyof typeof mockResponses.ses];
  mockSESClient.send.mockResolvedValue(response);
}

/**
 * Mock SES errors
 */
export function mockSESError(errorType: keyof typeof mockErrors.ses) {
  const error = mockErrors.ses[errorType];
  mockSESClient.send.mockRejectedValue(error);
}

/**
 * Create a mock upload record for testing
 */
export function createMockUploadRecord(overrides: any = {}) {
  return {
    PK: { S: overrides.fileId ? `UPLOAD#${overrides.fileId}` : 'UPLOAD#test-file-id' },
    SK: { S: 'METADATA#2025-01-20T10:00:00.000Z' },
    fileId: { S: overrides.fileId || 'test-file-id' },
    studentEmail: { S: overrides.studentEmail || 'test@example.com' },
    studentName: { S: overrides.studentName || 'Test Student' },
    trainerName: { S: overrides.trainerName || 'Test Trainer' },
    sessionDate: { S: overrides.sessionDate || '2025-01-20' },
    notes: { S: overrides.notes || 'Test notes' },
    fileName: { S: overrides.fileName || 'test-video.mp4' },
    originalFileName: { S: overrides.originalFileName || 'test-video.mp4' },
    fileSize: { N: String(overrides.fileSize || 1048576) },
    contentType: { S: overrides.contentType || 'video/mp4' },
    s3Key: { S: overrides.s3Key || 'videos/2025-01-20/test-file-id-test-video.mp4' },
    s3Bucket: { S: overrides.s3Bucket || 'test-bucket' },
    uploadDate: { S: overrides.uploadDate || '2025-01-20T10:00:00.000Z' },
    status: { S: overrides.status || 'completed' },
    downloadCount: { N: String(overrides.downloadCount || 0) },
    ttl: { N: String(overrides.ttl || Math.floor(Date.now() / 1000) + 86400) },
    ...overrides
  };
}

/**
 * Create a mock S3 event for testing
 */
export function createMockS3Event(overrides: any = {}) {
  return {
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
          name: 'test-bucket',
          ownerIdentity: {
            principalId: 'AWS:AIDAII23NWRZ4GPJMJIB2'
          },
          arn: 'arn:aws:s3:::test-bucket'
        },
        object: {
          key: 'videos/2025-01-20/test-file-id-test-video.mp4',
          size: 1048576,
          eTag: 'd41d8cd98f00b204e9800998ecf8427e',
          sequencer: '00626F6F5F5F5F5F5F5F'
        }
      },
      ...overrides
    }]
  };
}

/**
 * Utility to wait for async operations in tests
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate test data for various scenarios
 */
export const testData = {
  validUploadRequest: {
    studentEmail: 'test@example.com',
    studentName: 'Test Student',
    trainerName: 'Test Trainer',
    sessionDate: '2025-01-20',
    notes: 'Test session notes',
    fileName: 'test-video.mp4',
    fileSize: 1048576,
    contentType: 'video/mp4'
  },

  invalidUploadRequests: [
    {
      name: 'Invalid email',
      data: {
        studentEmail: 'invalid-email',
        fileName: 'test.mp4',
        fileSize: 1024,
        contentType: 'video/mp4',
        sessionDate: '2025-01-20'
      },
      expectedError: 'Valid student email is required'
    },
    {
      name: 'Missing file name',
      data: {
        studentEmail: 'test@example.com',
        fileName: '',
        fileSize: 1024,
        contentType: 'video/mp4',
        sessionDate: '2025-01-20'
      },
      expectedError: 'File name is required'
    },
    {
      name: 'Invalid content type',
      data: {
        studentEmail: 'test@example.com',
        fileName: 'test.jpg',
        fileSize: 1024,
        contentType: 'image/jpeg',
        sessionDate: '2025-01-20'
      },
      expectedError: 'Content type must be one of'
    },
    {
      name: 'File too large',
      data: {
        studentEmail: 'test@example.com',
        fileName: 'huge.mp4',
        fileSize: 10 * 1024 * 1024 * 1024, // 10GB
        contentType: 'video/mp4',
        sessionDate: '2025-01-20'
      },
      expectedError: 'File size must be between'
    }
  ],

  securityPayloads: {
    sql: [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM information_schema.tables --"
    ],
    xss: [
      '<script>alert("XSS")</script>',
      'javascript:alert("XSS")',
      '"><script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>'
    ],
    pathTraversal: [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\hosts',
      '/etc/passwd',
      'C:\\windows\\system32\\drivers\\etc\\hosts'
    ]
  }
};

// Export setup function to be called in test setup
export { setupAWSMocks as default };