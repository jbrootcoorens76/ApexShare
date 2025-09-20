/**
 * Unit Tests for Upload Handler Lambda Function
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { jest } from '@jest/globals';

// Mock AWS SDK before importing the handler
const mockSend = jest.fn();
const mockCreatePresignedPost = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: mockSend
  }))
}));

jest.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: mockCreatePresignedPost
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({
    send: mockSend
  })),
  PutItemCommand: jest.fn()
}));

// Import handler after mocks are set up
import { handler } from '../../../lambda/upload-handler/src/index';

describe('Upload Handler Lambda', () => {
  let mockContext: Context;
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = global.testUtils.createMockContext();
    mockEvent = global.testUtils.createMockAPIGatewayEvent();
  });

  describe('CORS Handling', () => {
    it('should handle OPTIONS request for CORS preflight', async () => {
      mockEvent.httpMethod = 'OPTIONS';

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toMatchObject({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
      });
    });

    it('should include CORS headers in all responses', async () => {
      mockEvent.httpMethod = 'GET';
      mockEvent.path = '/recent';

      const result = await handler(mockEvent, mockContext);

      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Headers');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
    });
  });

  describe('HTTP Method Validation', () => {
    it('should reject non-POST requests for upload', async () => {
      mockEvent.httpMethod = 'GET';
      mockEvent.path = '/upload'; // Not a recent uploads request

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(405);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Method not allowed'
      });
    });

    it('should accept POST requests for upload', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify(global.testUtils.createMockUploadRequest());

      // Mock successful S3 presigned URL creation
      mockCreatePresignedPost.mockResolvedValue({
        url: 'https://test-bucket.s3.amazonaws.com',
        fields: {
          key: 'test-key',
          'Content-Type': 'video/mp4'
        }
      });

      // Mock successful DynamoDB put
      mockSend.mockResolvedValue({});

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Security Validation', () => {
    it('should reject requests with suspicious user agents', async () => {
      mockEvent.httpMethod = 'POST';
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

    it('should detect SQL injection attempts in request body', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        studentEmail: 'test@example.com',
        fileName: 'test.mp4; DROP TABLE users; --',
        fileSize: 1024,
        contentType: 'video/mp4',
        sessionDate: '2025-01-20'
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Invalid request detected'
      });
    });

    it('should detect script injection attempts', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        studentEmail: 'test@example.com',
        notes: '<script>alert("xss")</script>',
        fileName: 'test.mp4',
        fileSize: 1024,
        contentType: 'video/mp4',
        sessionDate: '2025-01-20'
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Invalid request detected'
      });
    });
  });

  describe('Request Body Validation', () => {
    it('should reject invalid JSON in request body', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = 'invalid json {';

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Invalid JSON in request body'
      });
    });

    it('should reject null request body', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = null;

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Invalid JSON in request body'
      });
    });
  });

  describe('Upload Request Validation', () => {
    it('should validate student email format', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        ...global.testUtils.createMockUploadRequest(),
        studentEmail: 'invalid-email'
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Valid student email is required'
      });
    });

    it('should validate file name presence', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        ...global.testUtils.createMockUploadRequest(),
        fileName: ''
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'File name is required'
      });
    });

    it('should validate file size limits', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        ...global.testUtils.createMockUploadRequest(),
        fileSize: 500 // Too small
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('File size must be between');
    });

    it('should validate file size maximum', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        ...global.testUtils.createMockUploadRequest(),
        fileSize: 6 * 1024 * 1024 * 1024 // 6GB - too large
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('File size must be between');
    });

    it('should validate content type', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        ...global.testUtils.createMockUploadRequest(),
        contentType: 'image/jpeg'
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Content type must be one of');
    });

    it('should validate session date format', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        ...global.testUtils.createMockUploadRequest(),
        sessionDate: '01/20/2025'
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Session date must be in YYYY-MM-DD format'
      });
    });

    it('should validate optional field lengths', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        ...global.testUtils.createMockUploadRequest(),
        studentName: 'x'.repeat(101) // Too long
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Student name must be 100 characters or less'
      });
    });
  });

  describe('Successful Upload Flow', () => {
    beforeEach(() => {
      // Mock successful S3 presigned URL creation
      mockCreatePresignedPost.mockResolvedValue({
        url: 'https://test-bucket.s3.amazonaws.com',
        fields: {
          key: 'videos/2025-01-20/test-file-id-test-video.mp4',
          'Content-Type': 'video/mp4'
        }
      });

      // Mock successful DynamoDB put
      mockSend.mockResolvedValue({});
    });

    it('should handle valid upload request successfully', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify(global.testUtils.createMockUploadRequest());

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);

      const response = JSON.parse(result.body);
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('fileId');
      expect(response.data).toHaveProperty('uploadUrl');
      expect(response.data).toHaveProperty('fields');
      expect(response.data).toHaveProperty('expiresAt');
    });

    it('should generate unique file IDs', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify(global.testUtils.createMockUploadRequest());

      const result1 = await handler(mockEvent, mockContext);
      const result2 = await handler(mockEvent, mockContext);

      const response1 = JSON.parse(result1.body);
      const response2 = JSON.parse(result2.body);

      expect(response1.data.fileId).not.toBe(response2.data.fileId);
    });

    it('should sanitize file names for S3 keys', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        ...global.testUtils.createMockUploadRequest(),
        fileName: 'test file with spaces & special chars!.mp4'
      });

      await handler(mockEvent, mockContext);

      // Verify createPresignedPost was called with sanitized key
      expect(mockCreatePresignedPost).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          Key: expect.stringMatching(/test-file-with-spaces---special-chars-.mp4$/)
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle S3 presigned URL creation failure', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify(global.testUtils.createMockUploadRequest());

      mockCreatePresignedPost.mockRejectedValue(new Error('S3 service unavailable'));

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Internal server error'
      });
    });

    it('should handle DynamoDB write failure', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify(global.testUtils.createMockUploadRequest());

      mockCreatePresignedPost.mockResolvedValue({
        url: 'https://test-bucket.s3.amazonaws.com',
        fields: {}
      });

      mockSend.mockRejectedValue(new Error('DynamoDB service unavailable'));

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: 'Internal server error'
      });
    });
  });

  describe('Recent Uploads Endpoint', () => {
    it('should handle GET request for recent uploads', async () => {
      mockEvent.httpMethod = 'GET';
      mockEvent.path = '/recent';

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);

      const response = JSON.parse(result.body);
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('uploads');
      expect(response.data).toHaveProperty('pagination');
    });
  });

  describe('Performance and Logging', () => {
    it('should log successful operations with performance metrics', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify(global.testUtils.createMockUploadRequest());

      mockCreatePresignedPost.mockResolvedValue({
        url: 'https://test-bucket.s3.amazonaws.com',
        fields: {}
      });
      mockSend.mockResolvedValue({});

      await handler(mockEvent, mockContext);

      // Should not log in test environment unless LOG_LEVEL is DEBUG
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log security events', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      mockEvent.httpMethod = 'POST';
      mockEvent.headers = {
        ...mockEvent.headers,
        'User-Agent': 'crawler/1.0'
      };

      await handler(mockEvent, mockContext);

      // Should not log in test environment unless LOG_LEVEL is DEBUG
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});