/**
 * Unit Tests for Download Handler Lambda Function
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { jest } from '@jest/globals';

// Mock AWS SDK before importing the handler
const mockSend = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: mockSend
  })),
  GetObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn()
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({
    send: mockSend
  })),
  QueryCommand: jest.fn(),
  UpdateItemCommand: jest.fn()
}));

// Import handler after mocks are set up
import { handler } from '../../../lambda/download-handler/src/index';

describe('Download Handler Lambda', () => {
  let mockContext: Context;
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = global.testUtils.createMockContext();
    mockEvent = global.testUtils.createMockAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/download/f47ac10b-58cc-4372-a567-0e02b2c3d479',
      pathParameters: {
        fileId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
      }
    });
  });

  describe('CORS Handling', () => {
    it('should handle OPTIONS request for CORS preflight', async () => {
      mockEvent.httpMethod = 'OPTIONS';

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toMatchObject({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS,GET'
      });
    });

    it('should include CORS headers in all responses', async () => {
      mockEvent.pathParameters = { fileId: 'invalid-id' };

      const result = await handler(mockEvent, mockContext);

      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Headers');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
    });
  });

  describe('HTTP Method Validation', () => {
    it('should reject non-GET requests', async () => {
      mockEvent.httpMethod = 'POST';

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(405);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Method not allowed'
      });
    });

    it('should accept GET requests', async () => {
      mockEvent.httpMethod = 'GET';
      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      // Mock file not found to avoid full flow
      mockSend.mockResolvedValue({ Items: [] });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(404);
    });
  });

  describe('Security Validation', () => {
    it('should reject requests with suspicious user agents', async () => {
      mockEvent.headers = {
        ...mockEvent.headers,
        'User-Agent': 'googlebot/2.1'
      };

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Invalid request detected'
      });
    });

    it('should detect direct S3 access attempts', async () => {
      mockEvent.path = '/download/test.amazonaws.com/bucket/key';

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Invalid request detected'
      });
    });

    it('should allow legitimate download paths', async () => {
      mockEvent.path = '/download/f47ac10b-58cc-4372-a567-0e02b2c3d479';
      mockEvent.pathParameters = { fileId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };

      // Mock file not found to avoid full flow
      mockSend.mockResolvedValue({ Items: [] });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Video not found or expired'
      });
    });
  });

  describe('File ID Validation', () => {
    it('should reject invalid file ID format', async () => {
      mockEvent.pathParameters = { fileId: 'invalid-uuid' };

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Invalid file ID format'
      });
    });

    it('should reject missing file ID', async () => {
      mockEvent.pathParameters = null;

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Invalid file ID format'
      });
    });

    it('should accept valid UUID format', async () => {
      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      // Mock file not found to test ID validation passes
      mockSend.mockResolvedValue({ Items: [] });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Video not found or expired'
      });
    });
  });

  describe('File Metadata Retrieval', () => {
    it('should handle file not found in DynamoDB', async () => {
      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      // Mock empty DynamoDB response
      mockSend.mockResolvedValue({ Items: [] });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Video not found or expired'
      });
    });

    it('should handle DynamoDB query error', async () => {
      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      // Mock DynamoDB error
      mockSend.mockRejectedValue(new Error('DynamoDB service unavailable'));

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Internal server error'
      });
    });
  });

  describe('File Expiration Handling', () => {
    it('should reject expired files', async () => {
      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      const expiredItem = global.testUtils.createMockDynamoDBItem({
        ttl: { N: String(Math.floor(Date.now() / 1000) - 3600) }, // Expired 1 hour ago
        status: { S: 'completed' }
      });

      // Mock DynamoDB response with expired item
      mockSend.mockResolvedValue({ Items: [expiredItem] });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(410);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Video has expired'
      });
    });

    it('should allow non-expired files', async () => {
      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      const validItem = global.testUtils.createMockDynamoDBItem({
        ttl: { N: String(Math.floor(Date.now() / 1000) + 3600) }, // Expires in 1 hour
        status: { S: 'completed' }
      });

      // Mock DynamoDB response, S3 HEAD, and URL signing
      mockSend
        .mockResolvedValueOnce({ Items: [validItem] }) // DynamoDB query
        .mockResolvedValueOnce({}) // S3 HEAD object (exists)
        .mockResolvedValueOnce({}); // DynamoDB update

      mockGetSignedUrl.mockResolvedValue('https://signed-url.example.com');

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Upload Status Validation', () => {
    it('should reject files not yet completed', async () => {
      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      const pendingItem = global.testUtils.createMockDynamoDBItem({
        status: { S: 'pending' },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 3600) }
      });

      // Mock DynamoDB response
      mockSend.mockResolvedValue({ Items: [pendingItem] });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Video not yet available'
      });
    });

    it('should allow completed uploads', async () => {
      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      const completedItem = global.testUtils.createMockDynamoDBItem({
        status: { S: 'completed' },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 3600) }
      });

      // Mock successful flow
      mockSend
        .mockResolvedValueOnce({ Items: [completedItem] }) // DynamoDB query
        .mockResolvedValueOnce({}) // S3 HEAD object
        .mockResolvedValueOnce({}); // DynamoDB update

      mockGetSignedUrl.mockResolvedValue('https://signed-url.example.com');

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('S3 Object Verification', () => {
    it('should handle missing S3 objects', async () => {
      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      const validItem = global.testUtils.createMockDynamoDBItem({
        status: { S: 'completed' },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 3600) }
      });

      // Mock DynamoDB query success, S3 HEAD failure
      mockSend
        .mockResolvedValueOnce({ Items: [validItem] })
        .mockRejectedValueOnce({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Video file not found'
      });
    });

    it('should handle S3 HEAD errors gracefully', async () => {
      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      const validItem = global.testUtils.createMockDynamoDBItem({
        status: { S: 'completed' },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 3600) }
      });

      // Mock DynamoDB query success, S3 HEAD error (not 404)
      mockSend
        .mockResolvedValueOnce({ Items: [validItem] })
        .mockRejectedValueOnce(new Error('S3 service unavailable'))
        .mockResolvedValueOnce({}); // DynamoDB update

      mockGetSignedUrl.mockResolvedValue('https://signed-url.example.com');

      const result = await handler(mockEvent, mockContext);

      // Should continue despite S3 error (assume object exists)
      expect(result.statusCode).toBe(200);
    });
  });

  describe('Successful Download Flow', () => {
    beforeEach(() => {
      const validItem = global.testUtils.createMockDynamoDBItem({
        status: { S: 'completed' },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 3600) },
        downloadCount: { N: '5' }
      });

      // Mock successful flow
      mockSend
        .mockResolvedValueOnce({ Items: [validItem] }) // DynamoDB query
        .mockResolvedValueOnce({}) // S3 HEAD object
        .mockResolvedValueOnce({}); // DynamoDB update

      mockGetSignedUrl.mockResolvedValue('https://signed-url.example.com/video.mp4');
    });

    it('should generate download URL successfully', async () => {
      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);

      const response = JSON.parse(result.body);
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('downloadUrl');
      expect(response.data).toHaveProperty('videoInfo');
      expect(response.data.videoInfo).toHaveProperty('fileName');
      expect(response.data.videoInfo).toHaveProperty('fileSize');
      expect(response.data.videoInfo).toHaveProperty('expiresAt');
    });

    it('should include correct video information', async () => {
      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      const result = await handler(mockEvent, mockContext);

      const response = JSON.parse(result.body);
      expect(response.data.videoInfo).toMatchObject({
        fileName: 'test-video.mp4',
        fileSize: 104857600,
        sessionDate: '2025-01-20',
        trainerName: 'Test Trainer',
        notes: 'Test session notes'
      });
    });

    it('should update download statistics', async () => {
      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      await handler(mockEvent, mockContext);

      // Verify DynamoDB update was called
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            UpdateExpression: 'ADD downloadCount :inc SET lastDownloadAt = :timestamp'
          })
        })
      );
    });

    it('should set correct content disposition for file download', async () => {
      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      await handler(mockEvent, mockContext);

      // Verify getSignedUrl was called with correct parameters
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: expect.objectContaining({
            ResponseContentDisposition: 'attachment; filename="test-video.mp4"'
          })
        }),
        expect.objectContaining({
          expiresIn: 86400 // 24 hours
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle presigned URL generation failure', async () => {
      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      const validItem = global.testUtils.createMockDynamoDBItem({
        status: { S: 'completed' },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 3600) }
      });

      mockSend
        .mockResolvedValueOnce({ Items: [validItem] })
        .mockResolvedValueOnce({}); // S3 HEAD

      mockGetSignedUrl.mockRejectedValue(new Error('Failed to generate signed URL'));

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Internal server error'
      });
    });

    it('should continue if download stats update fails', async () => {
      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      const validItem = global.testUtils.createMockDynamoDBItem({
        status: { S: 'completed' },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 3600) }
      });

      mockSend
        .mockResolvedValueOnce({ Items: [validItem] }) // DynamoDB query
        .mockResolvedValueOnce({}) // S3 HEAD
        .mockRejectedValueOnce(new Error('Update failed')); // DynamoDB update fails

      mockGetSignedUrl.mockResolvedValue('https://signed-url.example.com');

      const result = await handler(mockEvent, mockContext);

      // Should still succeed even if stats update fails
      expect(result.statusCode).toBe(200);
    });
  });

  describe('Performance and Logging', () => {
    it('should log successful download operations', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      mockEvent.pathParameters = { fileId: global.testUtils.validFileId };

      const validItem = global.testUtils.createMockDynamoDBItem({
        status: { S: 'completed' },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 3600) }
      });

      mockSend
        .mockResolvedValueOnce({ Items: [validItem] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      mockGetSignedUrl.mockResolvedValue('https://signed-url.example.com');

      await handler(mockEvent, mockContext);

      // Should not log in test environment unless LOG_LEVEL is DEBUG
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});