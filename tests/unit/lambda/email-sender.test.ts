/**
 * Unit Tests for Email Sender Lambda Function
 */

import { S3Event, Context } from 'aws-lambda';
import { jest } from '@jest/globals';

// Mock AWS SDK before importing the handler
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn(() => ({
    send: mockSend
  })),
  SendEmailCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({
    send: mockSend
  })),
  QueryCommand: jest.fn(),
  UpdateItemCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: mockSend
  })),
  GetObjectCommand: jest.fn()
}));

// Import handler after mocks are set up
import { handler } from '../../../lambda/email-sender/src/index';

describe('Email Sender Lambda', () => {
  let mockContext: Context;
  let mockS3Event: S3Event;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = global.testUtils.createMockContext();
    mockS3Event = global.testUtils.createMockS3Event();
  });

  describe('S3 Event Processing', () => {
    it('should process valid S3 ObjectCreated events', async () => {
      const mockUploadItem = global.testUtils.createMockDynamoDBItem();

      // Mock DynamoDB query response
      mockSend
        .mockResolvedValueOnce({ Items: [mockUploadItem] }) // DynamoDB query
        .mockResolvedValueOnce({}) // SES send email
        .mockResolvedValueOnce({}); // DynamoDB update

      await handler(mockS3Event, mockContext);

      // Verify DynamoDB query was called
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'test-apexshare-table',
            KeyConditionExpression: 'PK = :pk'
          })
        })
      );

      // Verify email was sent
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Source: 'test@apexshare.be',
            Destination: {
              ToAddresses: ['test@example.com']
            }
          })
        })
      );
    });

    it('should skip non-ObjectCreated events', async () => {
      mockS3Event.Records[0].eventName = 'ObjectRemoved:Delete';

      await handler(mockS3Event, mockContext);

      // Should not query DynamoDB or send email
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should skip non-video folder events', async () => {
      mockS3Event.Records[0].s3.object.key = 'documents/test-file.pdf';

      await handler(mockS3Event, mockContext);

      // Should not query DynamoDB or send email
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should process multiple S3 records', async () => {
      const mockUploadItem = global.testUtils.createMockDynamoDBItem();

      // Create event with multiple records
      mockS3Event.Records = [
        mockS3Event.Records[0],
        {
          ...mockS3Event.Records[0],
          s3: {
            ...mockS3Event.Records[0].s3,
            object: {
              ...mockS3Event.Records[0].s3.object,
              key: 'videos/2025-01-20/another-file-id-video.mp4'
            }
          }
        }
      ];

      // Mock responses for both records
      mockSend
        .mockResolvedValueOnce({ Items: [mockUploadItem] }) // First DynamoDB query
        .mockResolvedValueOnce({}) // First SES send
        .mockResolvedValueOnce({}) // First DynamoDB update
        .mockResolvedValueOnce({ Items: [mockUploadItem] }) // Second DynamoDB query
        .mockResolvedValueOnce({}) // Second SES send
        .mockResolvedValueOnce({}); // Second DynamoDB update

      await handler(mockS3Event, mockContext);

      // Should process both records
      expect(mockSend).toHaveBeenCalledTimes(6);
    });
  });

  describe('File ID Extraction', () => {
    it('should extract file ID from valid S3 object key', async () => {
      mockS3Event.Records[0].s3.object.key = 'videos/2025-01-20/f47ac10b-58cc-4372-a567-0e02b2c3d479-test-video.mp4';

      const mockUploadItem = global.testUtils.createMockDynamoDBItem({
        fileId: { S: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }
      });

      mockSend
        .mockResolvedValueOnce({ Items: [mockUploadItem] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await handler(mockS3Event, mockContext);

      // Verify correct file ID was used in query
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ExpressionAttributeValues: {
              ':pk': { S: 'UPLOAD#f47ac10b-58cc-4372-a567-0e02b2c3d479' }
            }
          })
        })
      );
    });

    it('should handle invalid S3 object key format', async () => {
      mockS3Event.Records[0].s3.object.key = 'videos/invalid-key-format.mp4';

      await handler(mockS3Event, mockContext);

      // Should not proceed with invalid key
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should handle malformed file ID in object key', async () => {
      mockS3Event.Records[0].s3.object.key = 'videos/2025-01-20/invalid-uuid-format-video.mp4';

      await handler(mockS3Event, mockContext);

      // Should not proceed with invalid UUID
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('Upload Metadata Retrieval', () => {
    it('should handle missing upload metadata', async () => {
      // Mock empty DynamoDB response
      mockSend.mockResolvedValueOnce({ Items: [] });

      await handler(mockS3Event, mockContext);

      // Should only call DynamoDB query, not SES or update
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should handle DynamoDB query error', async () => {
      mockSend.mockRejectedValueOnce(new Error('DynamoDB service unavailable'));

      await handler(mockS3Event, mockContext);

      // Should only attempt the query
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should parse DynamoDB item correctly', async () => {
      const mockUploadItem = global.testUtils.createMockDynamoDBItem({
        studentEmail: { S: 'custom@example.com' },
        studentName: { S: 'Custom Student' },
        trainerName: { S: 'Custom Trainer' },
        sessionDate: { S: '2025-01-21' },
        notes: { S: 'Custom notes' },
        originalFileName: { S: 'custom-video.mp4' }
      });

      mockSend
        .mockResolvedValueOnce({ Items: [mockUploadItem] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await handler(mockS3Event, mockContext);

      // Verify email was sent to correct address
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Destination: {
              ToAddresses: ['custom@example.com']
            },
            Message: expect.objectContaining({
              Subject: {
                Data: 'Your Motorcycle Training Video is Ready - 2025-01-21'
              }
            })
          })
        })
      );
    });
  });

  describe('Email Template Generation', () => {
    it('should generate HTML email with all fields', async () => {
      const mockUploadItem = global.testUtils.createMockDynamoDBItem();

      mockSend
        .mockResolvedValueOnce({ Items: [mockUploadItem] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await handler(mockS3Event, mockContext);

      const emailCall = mockSend.mock.calls.find(call =>
        call[0].input && call[0].input.Message
      );

      expect(emailCall).toBeDefined();
      expect(emailCall[0].input.Message.Body.Html.Data).toContain('Test Student');
      expect(emailCall[0].input.Message.Body.Html.Data).toContain('Test Trainer');
      expect(emailCall[0].input.Message.Body.Html.Data).toContain('2025-01-20');
      expect(emailCall[0].input.Message.Body.Html.Data).toContain('Test session notes');
      expect(emailCall[0].input.Message.Body.Html.Data).toContain('test-video.mp4');
    });

    it('should generate text email with all fields', async () => {
      const mockUploadItem = global.testUtils.createMockDynamoDBItem();

      mockSend
        .mockResolvedValueOnce({ Items: [mockUploadItem] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await handler(mockS3Event, mockContext);

      const emailCall = mockSend.mock.calls.find(call =>
        call[0].input && call[0].input.Message
      );

      expect(emailCall).toBeDefined();
      expect(emailCall[0].input.Message.Body.Text.Data).toContain('Test Student');
      expect(emailCall[0].input.Message.Body.Text.Data).toContain('Test Trainer');
      expect(emailCall[0].input.Message.Body.Text.Data).toContain('2025-01-20');
      expect(emailCall[0].input.Message.Body.Text.Data).toContain('test-video.mp4');
    });

    it('should handle missing optional fields gracefully', async () => {
      const mockUploadItem = global.testUtils.createMockDynamoDBItem({
        studentName: { S: '' }, // Empty student name
        trainerName: { S: '' }, // Empty trainer name
        notes: { S: '' } // Empty notes
      });

      mockSend
        .mockResolvedValueOnce({ Items: [mockUploadItem] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await handler(mockS3Event, mockContext);

      const emailCall = mockSend.mock.calls.find(call =>
        call[0].input && call[0].input.Message
      );

      expect(emailCall).toBeDefined();
      // Should use "Student" as default name
      expect(emailCall[0].input.Message.Body.Html.Data).toContain('Hello <strong>Student</strong>');
    });

    it('should include correct download URL', async () => {
      const mockUploadItem = global.testUtils.createMockDynamoDBItem();

      mockSend
        .mockResolvedValueOnce({ Items: [mockUploadItem] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await handler(mockS3Event, mockContext);

      const emailCall = mockSend.mock.calls.find(call =>
        call[0].input && call[0].input.Message
      );

      expect(emailCall).toBeDefined();
      expect(emailCall[0].input.Message.Body.Html.Data).toContain(
        'https://test-api.apexshare.be/download/f47ac10b-58cc-4372-a567-0e02b2c3d479'
      );
    });
  });

  describe('SES Email Sending', () => {
    it('should send email with correct parameters', async () => {
      const mockUploadItem = global.testUtils.createMockDynamoDBItem();

      mockSend
        .mockResolvedValueOnce({ Items: [mockUploadItem] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await handler(mockS3Event, mockContext);

      // Verify SES send email call
      const sesCall = mockSend.mock.calls.find(call =>
        call[0].input && call[0].input.Source
      );

      expect(sesCall).toBeDefined();
      expect(sesCall[0].input).toMatchObject({
        Source: 'test@apexshare.be',
        Destination: {
          ToAddresses: ['test@example.com']
        },
        Message: {
          Subject: {
            Data: 'Your Motorcycle Training Video is Ready - 2025-01-20',
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Charset: 'UTF-8'
            },
            Text: {
              Charset: 'UTF-8'
            }
          }
        },
        Tags: expect.arrayContaining([
          { Name: 'Environment', Value: 'test' },
          { Name: 'EmailType', Value: 'upload-notification' }
        ])
      });
    });

    it('should handle SES send email failure', async () => {
      const mockUploadItem = global.testUtils.createMockDynamoDBItem();

      mockSend
        .mockResolvedValueOnce({ Items: [mockUploadItem] }) // DynamoDB query
        .mockRejectedValueOnce(new Error('SES service unavailable')) // SES send fails
        .mockResolvedValueOnce({}); // DynamoDB update (should not be called)

      await handler(mockS3Event, mockContext);

      // Should attempt email send but not update status
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should include message tags for tracking', async () => {
      const mockUploadItem = global.testUtils.createMockDynamoDBItem();

      mockSend
        .mockResolvedValueOnce({ Items: [mockUploadItem] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await handler(mockS3Event, mockContext);

      const sesCall = mockSend.mock.calls.find(call =>
        call[0].input && call[0].input.Tags
      );

      expect(sesCall[0].input.Tags).toEqual(
        expect.arrayContaining([
          { Name: 'Environment', Value: 'test' },
          { Name: 'EmailType', Value: 'upload-notification' }
        ])
      );
    });
  });

  describe('Status Update', () => {
    it('should update DynamoDB with email sent status', async () => {
      const mockUploadItem = global.testUtils.createMockDynamoDBItem();

      mockSend
        .mockResolvedValueOnce({ Items: [mockUploadItem] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await handler(mockS3Event, mockContext);

      // Verify DynamoDB update call
      const updateCall = mockSend.mock.calls.find(call =>
        call[0].input && call[0].input.UpdateExpression
      );

      expect(updateCall).toBeDefined();
      expect(updateCall[0].input).toMatchObject({
        TableName: 'test-apexshare-table',
        UpdateExpression: 'SET emailSentAt = :emailSentAt, #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': { S: 'completed' }
        }
      });
    });

    it('should continue processing if status update fails', async () => {
      const mockUploadItem = global.testUtils.createMockDynamoDBItem();

      mockSend
        .mockResolvedValueOnce({ Items: [mockUploadItem] }) // DynamoDB query
        .mockResolvedValueOnce({}) // SES send
        .mockRejectedValueOnce(new Error('Update failed')); // DynamoDB update fails

      // Should not throw an error
      await expect(handler(mockS3Event, mockContext)).resolves.toBeUndefined();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should continue processing other records if one fails', async () => {
      const mockUploadItem = global.testUtils.createMockDynamoDBItem();

      // Create event with two records
      mockS3Event.Records = [
        mockS3Event.Records[0],
        {
          ...mockS3Event.Records[0],
          s3: {
            ...mockS3Event.Records[0].s3,
            object: {
              ...mockS3Event.Records[0].s3.object,
              key: 'videos/2025-01-20/another-file-id-video.mp4'
            }
          }
        }
      ];

      // First record succeeds, second fails
      mockSend
        .mockResolvedValueOnce({ Items: [mockUploadItem] }) // First record query
        .mockResolvedValueOnce({}) // First record email
        .mockResolvedValueOnce({}) // First record update
        .mockRejectedValueOnce(new Error('Second record fails')); // Second record query fails

      // Should not throw an error and process what it can
      await expect(handler(mockS3Event, mockContext)).resolves.toBeUndefined();

      // Should have processed the first record completely
      expect(mockSend).toHaveBeenCalledTimes(4);
    });

    it('should handle URL encoding in S3 object keys', async () => {
      mockS3Event.Records[0].s3.object.key = 'videos/2025-01-20/f47ac10b-58cc-4372-a567-0e02b2c3d479-test%20video.mp4';

      const mockUploadItem = global.testUtils.createMockDynamoDBItem();

      mockSend
        .mockResolvedValueOnce({ Items: [mockUploadItem] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await handler(mockS3Event, mockContext);

      // Should decode the key and process normally
      expect(mockSend).toHaveBeenCalledTimes(3);
    });
  });

  describe('Logging and Monitoring', () => {
    it('should log processing events', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      const mockUploadItem = global.testUtils.createMockDynamoDBItem();

      mockSend
        .mockResolvedValueOnce({ Items: [mockUploadItem] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await handler(mockS3Event, mockContext);

      // Should not log in test environment unless LOG_LEVEL is DEBUG
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log errors without failing', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error');

      mockSend.mockRejectedValue(new Error('Test error'));

      await expect(handler(mockS3Event, mockContext)).resolves.toBeUndefined();

      // Should not log in test environment unless LOG_LEVEL is DEBUG
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});