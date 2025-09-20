/**
 * Email Sender Lambda Function
 *
 * Handles email notifications triggered by S3 events:
 * 1. Triggered when video files are uploaded to S3
 * 2. Retrieves upload metadata from DynamoDB
 * 3. Generates email content with download links
 * 4. Sends notification emails via SES
 * 5. Updates DynamoDB with email status
 */

import { S3Event, Context } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { DynamoDBClient, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// Types
interface UploadRecord {
  PK: string;
  SK: string;
  fileId: string;
  studentEmail: string;
  studentName?: string;
  trainerName?: string;
  sessionDate: string;
  notes?: string;
  originalFileName: string;
  uploadDate: string;
}

interface EmailTemplateData {
  studentName: string;
  trainerName?: string;
  sessionDate: string;
  notes?: string;
  downloadUrl: string;
  expirationDate: string;
  fileName: string;
}

// AWS Clients (initialized outside handler for connection reuse)
const sesClient = new SESClient({
  region: process.env.SES_REGION || process.env.AWS_REGION,
  maxAttempts: 3,
  retryMode: 'adaptive',
});

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  maxAttempts: 3,
  retryMode: 'adaptive',
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  maxAttempts: 3,
  retryMode: 'adaptive',
});

/**
 * Main Lambda handler
 */
export const handler = async (event: S3Event, context: Context): Promise<void> => {
  const requestId = context.awsRequestId;

  for (const record of event.Records) {
    try {
      // Extract S3 object information
      const bucketName = record.s3.bucket.name;
      const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
      const eventName = record.eventName;

      logInfo('Processing S3 event', {
        requestId,
        bucketName,
        objectKey,
        eventName,
      });

      // Only process object creation events in the videos/ folder
      if (!eventName.startsWith('ObjectCreated:') || !objectKey.startsWith('videos/')) {
        logInfo('Skipping non-video creation event', { requestId, objectKey, eventName });
        continue;
      }

      // Extract file ID from object key
      const fileId = extractFileIdFromKey(objectKey);
      if (!fileId) {
        logError('Could not extract file ID from object key', new Error('Invalid key format'), {
          requestId,
          objectKey,
        });
        continue;
      }

      // Get upload metadata from DynamoDB
      const uploadRecord = await getUploadRecord(fileId);
      if (!uploadRecord) {
        logError('No metadata found for file', new Error('Missing metadata'), {
          requestId,
          fileId,
          objectKey,
        });
        continue;
      }

      // Generate download link
      const downloadUrl = `${process.env.DOWNLOAD_BASE_URL}/${fileId}`;

      // Prepare email template data
      const templateData: EmailTemplateData = {
        studentName: uploadRecord.studentName || 'Student',
        trainerName: uploadRecord.trainerName,
        sessionDate: uploadRecord.sessionDate,
        notes: uploadRecord.notes,
        downloadUrl,
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        fileName: uploadRecord.originalFileName,
      };

      // Generate email content
      const emailHtml = generateEmailTemplate(templateData);
      const emailText = generateEmailText(templateData);

      // Send email via SES
      await sendEmail(
        uploadRecord.studentEmail,
        templateData.sessionDate,
        emailHtml,
        emailText,
        requestId
      );

      // Update DynamoDB with email sent status
      await updateEmailStatus(uploadRecord, requestId);

      logInfo('Email sent successfully', {
        requestId,
        fileId,
        studentEmail: uploadRecord.studentEmail,
        fileName: uploadRecord.originalFileName,
      });
    } catch (error) {
      logError('Error processing S3 event record', error, {
        requestId,
        record: {
          bucketName: record.s3?.bucket?.name,
          objectKey: record.s3?.object?.key,
          eventName: record.eventName,
        },
      });
      // Continue processing other records
    }
  }
};

/**
 * Extract file ID from S3 object key
 */
function extractFileIdFromKey(objectKey: string): string | null {
  try {
    // Expected format: videos/YYYY-MM-DD/fileId-filename.ext
    const pathParts = objectKey.split('/');
    if (pathParts.length < 3) return null;

    const fileName = pathParts[pathParts.length - 1];
    const fileId = fileName.split('-')[0];

    // Validate UUID format
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    return uuidRegex.test(fileId) ? fileId : null;
  } catch {
    return null;
  }
}

/**
 * Get upload record from DynamoDB
 */
async function getUploadRecord(fileId: string): Promise<UploadRecord | null> {
  try {
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
      studentEmail: item.studentEmail?.S || '',
      studentName: item.studentName?.S || undefined,
      trainerName: item.trainerName?.S || undefined,
      sessionDate: item.sessionDate?.S || '',
      notes: item.notes?.S || undefined,
      originalFileName: item.originalFileName?.S || '',
      uploadDate: item.uploadDate?.S || '',
    };
  } catch (error) {
    logError('Failed to get upload record', error, { fileId });
    return null;
  }
}

/**
 * Send email via SES
 */
async function sendEmail(
  studentEmail: string,
  sessionDate: string,
  htmlContent: string,
  textContent: string,
  requestId: string
): Promise<void> {
  const command = new SendEmailCommand({
    Source: process.env.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [studentEmail],
    },
    Message: {
      Subject: {
        Data: `Your Motorcycle Training Video is Ready - ${sessionDate}`,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: htmlContent,
          Charset: 'UTF-8',
        },
        Text: {
          Data: textContent,
          Charset: 'UTF-8',
        },
      },
    },
    // Add message tags for tracking
    Tags: [
      {
        Name: 'Environment',
        Value: process.env.ENVIRONMENT || 'unknown',
      },
      {
        Name: 'RequestId',
        Value: requestId,
      },
      {
        Name: 'EmailType',
        Value: 'upload-notification',
      },
    ],
  });

  await sesClient.send(command);
}

/**
 * Update DynamoDB with email sent status
 */
async function updateEmailStatus(uploadRecord: UploadRecord, requestId: string): Promise<void> {
  try {
    const command = new UpdateItemCommand({
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        PK: { S: uploadRecord.PK },
        SK: { S: uploadRecord.SK },
      },
      UpdateExpression: 'SET emailSentAt = :emailSentAt, #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':emailSentAt': { S: new Date().toISOString() },
        ':status': { S: 'completed' },
      },
      ReturnValues: 'NONE',
    });

    await dynamoClient.send(command);
  } catch (error) {
    logError('Failed to update email status', error, {
      requestId,
      fileId: uploadRecord.fileId,
      PK: uploadRecord.PK,
      SK: uploadRecord.SK,
    });
  }
}

/**
 * Generate HTML email template
 */
function generateEmailTemplate(data: EmailTemplateData): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Training Video is Ready</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                margin: 0;
                padding: 0;
                background-color: #f4f4f4;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
                background: linear-gradient(135deg, #1a365d 0%, #2563eb 100%);
                color: white;
                padding: 30px 20px;
                text-align: center;
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 600;
            }
            .header p {
                margin: 10px 0 0 0;
                font-size: 16px;
                opacity: 0.9;
            }
            .content {
                padding: 30px 20px;
                background: #ffffff;
            }
            .info-section {
                background: #f8fafc;
                border-left: 4px solid #2563eb;
                padding: 15px 20px;
                margin: 20px 0;
                border-radius: 0 4px 4px 0;
            }
            .info-section h3 {
                margin: 0 0 10px 0;
                color: #1e293b;
                font-size: 14px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .info-section p {
                margin: 5px 0;
                font-size: 16px;
            }
            .download-section {
                text-align: center;
                margin: 30px 0;
                padding: 20px;
                background: #f1f5f9;
                border-radius: 8px;
            }
            .button {
                background: #2563eb;
                color: white;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 6px;
                display: inline-block;
                margin: 20px 0;
                font-weight: 600;
                font-size: 16px;
                transition: background-color 0.3s ease;
            }
            .button:hover {
                background: #1d4ed8;
            }
            .warning {
                background: #fef3c7;
                border: 1px solid #f59e0b;
                color: #92400e;
                padding: 15px;
                border-radius: 6px;
                margin: 20px 0;
            }
            .footer {
                text-align: center;
                padding: 25px 20px;
                background: #f8fafc;
                border-top: 1px solid #e2e8f0;
                font-size: 12px;
                color: #64748b;
            }
            .footer p {
                margin: 5px 0;
            }
            @media (max-width: 600px) {
                .container {
                    margin: 0;
                    border-radius: 0;
                }
                .content {
                    padding: 20px 15px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏍️ ApexShare Training</h1>
                <p>Your motorcycle training video is ready!</p>
            </div>
            <div class="content">
                <p>Hello <strong>${data.studentName}</strong>,</p>
                <p>Your training session video from <strong>${data.sessionDate}</strong> has been processed and is ready for download.</p>

                <div class="info-section">
                    <h3>Session Details</h3>
                    ${data.trainerName ? `<p><strong>Instructor:</strong> ${data.trainerName}</p>` : ''}
                    <p><strong>Date:</strong> ${data.sessionDate}</p>
                    <p><strong>File:</strong> ${data.fileName}</p>
                    ${data.notes ? `<p><strong>Session Notes:</strong><br>${data.notes}</p>` : ''}
                </div>

                <div class="download-section">
                    <h3 style="margin-top: 0; color: #1e293b;">Ready to Download</h3>
                    <p>Click the button below to download your training video:</p>
                    <a href="${data.downloadUrl}" class="button">Download Your Video</a>
                </div>

                <div class="warning">
                    <strong>⚠️ Important:</strong> This download link will expire on <strong>${data.expirationDate}</strong>.
                    Please download your video before this date. The link is unique to you and should not be shared.
                </div>

                <p>If you have any questions about your training session, please contact your instructor directly.</p>

                <p>Safe riding!</p>
                <p><strong>The ApexShare Team</strong></p>
            </div>
            <div class="footer">
                <p>© 2025 ApexShare Training | Secure Video Sharing for Motorcycle Training</p>
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>If you received this email in error, please delete it immediately.</p>
            </div>
        </div>
    </body>
    </html>
  `;
}

/**
 * Generate plain text email content
 */
function generateEmailText(data: EmailTemplateData): string {
  return `
ApexShare Training - Your Video is Ready
========================================

Hello ${data.studentName},

Your training session video from ${data.sessionDate} has been processed and is ready for download.

SESSION DETAILS:
${data.trainerName ? `Instructor: ${data.trainerName}` : ''}
Date: ${data.sessionDate}
File: ${data.fileName}
${data.notes ? `Session Notes: ${data.notes}` : ''}

DOWNLOAD YOUR VIDEO:
${data.downloadUrl}

IMPORTANT: This download link will expire on ${data.expirationDate}. Please download your video before this date. The link is unique to you and should not be shared.

If you have any questions about your training session, please contact your instructor directly.

Safe riding!
The ApexShare Team

---
© 2025 ApexShare Training | Secure Video Sharing for Motorcycle Training
This is an automated message. Please do not reply to this email.
If you received this email in error, please delete it immediately.
  `.trim();
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
        source: 'ApexShare-EmailSender',
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
      source: 'ApexShare-EmailSender',
    })
  );
}