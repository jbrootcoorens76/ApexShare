# ApexShare API Documentation

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Base URLs](#base-urls)
4. [Request/Response Format](#requestresponse-format)
5. [Rate Limiting](#rate-limiting)
6. [Error Handling](#error-handling)
7. [API Endpoints](#api-endpoints)
8. [Code Examples](#code-examples)
9. [Testing](#testing)
10. [Changelog](#changelog)

---

## API Overview

The ApexShare API is a RESTful service that enables secure video upload and download functionality for motorcycle training instructors. The API is built on AWS API Gateway with Lambda backend functions.

### Key Features

- **Secure File Upload**: Generate presigned URLs for direct S3 uploads
- **Controlled Access**: Time-limited download links with email verification
- **Automatic Notifications**: Email notifications when videos are ready
- **CORS Support**: Cross-origin requests for web applications
- **Rate Limiting**: Protection against abuse and excessive usage

### API Version

- **Current Version**: v1
- **Last Updated**: September 2025
- **Base Path**: `/api/v1`

---

## Authentication

ApexShare API currently uses **no authentication** for public endpoints to maintain simplicity for end users. Security is achieved through:

- **CORS restrictions**: Limited to allowed origins
- **WAF protection**: Rate limiting and common attack prevention
- **Unique tokens**: File access requires unique, non-guessable tokens
- **Time-based expiration**: All access links expire after 7 days

### Future Authentication

A future version may include:
- API key authentication for trainer accounts
- OAuth 2.0 integration
- JWT tokens for session management

---

## Base URLs

### Production
```
https://api.apexshare.be
```

### Staging
```
https://staging-api.apexshare.be
```

### Development
```
https://dev-api.apexshare.be
```

---

## Request/Response Format

### Content Types

**Request Headers:**
```http
Content-Type: application/json
Accept: application/json
```

**CORS Headers:**
```http
Access-Control-Allow-Origin: https://apexshare.be
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### Response Structure

All API responses follow this structure:

```json
{
  "success": true,
  "data": { /* Response data */ },
  "error": null,
  "timestamp": "2025-03-15T10:30:00Z",
  "requestId": "abc123-def456-ghi789"
}
```

**Error Response:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "studentEmail",
      "value": "invalid-email"
    }
  },
  "timestamp": "2025-03-15T10:30:00Z",
  "requestId": "abc123-def456-ghi789"
}
```

---

## Rate Limiting

### Limits by Environment

| Environment | Requests/Minute | Burst Limit |
|-------------|----------------|-------------|
| Production  | 100            | 500         |
| Staging     | 100            | 300         |
| Development | 50             | 100         |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1615804260
X-RateLimit-Retry-After: 60
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in 60 seconds.",
    "retryAfter": 60
  },
  "timestamp": "2025-03-15T10:30:00Z",
  "requestId": "rate-limit-abc123"
}
```

---

## Error Handling

### HTTP Status Codes

| Status Code | Meaning | Description |
|-------------|---------|-------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid request format or parameters |
| 404 | Not Found | Resource not found or expired |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | System maintenance or overload |

### Error Codes

| Error Code | Description | Typical Status |
|------------|-------------|----------------|
| `VALIDATION_ERROR` | Request validation failed | 400 |
| `FILE_NOT_FOUND` | File ID not found or expired | 404 |
| `FILE_TOO_LARGE` | File exceeds size limit | 400 |
| `INVALID_FILE_TYPE` | Unsupported file format | 400 |
| `UPLOAD_FAILED` | S3 upload preparation failed | 500 |
| `EMAIL_INVALID` | Email format validation failed | 400 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Unexpected system error | 500 |

---

## API Endpoints

### Health Check

#### GET /api/v1/health

Check API service health and availability.

**Request:**
```http
GET /api/v1/health HTTP/1.1
Host: api.apexshare.be
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "timestamp": "2025-03-15T10:30:00Z",
    "services": {
      "database": "healthy",
      "storage": "healthy",
      "email": "healthy"
    }
  },
  "error": null,
  "timestamp": "2025-03-15T10:30:00Z",
  "requestId": "health-check-123"
}
```

---

### Upload Video

#### POST /api/v1/upload

Generate a presigned URL for video upload and create upload metadata.

**Request:**
```http
POST /api/v1/upload HTTP/1.1
Host: api.apexshare.be
Content-Type: application/json

{
  "trainerName": "John Smith",
  "trainerEmail": "john.smith@example.com",
  "studentEmail": "student@example.com",
  "videoTitle": "Week 1: Basic Controls",
  "videoDescription": "Introduction to motorcycle controls and basic operation",
  "fileName": "week1-basic-controls.mp4",
  "fileSize": 157286400,
  "fileType": "video/mp4"
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `trainerName` | string | Yes | Full name of the instructor |
| `trainerEmail` | string | Yes | Valid email address of instructor |
| `studentEmail` | string | Yes | Valid email address of student |
| `videoTitle` | string | Yes | Descriptive title for the video |
| `videoDescription` | string | No | Optional description or notes |
| `fileName` | string | Yes | Original filename with extension |
| `fileSize` | number | Yes | File size in bytes (max 5GB) |
| `fileType` | string | Yes | MIME type (e.g., video/mp4) |

**Validation Rules:**
- `trainerName`: 2-100 characters, letters and spaces only
- `trainerEmail`: Valid email format, max 255 characters
- `studentEmail`: Valid email format, max 255 characters, different from trainer email
- `videoTitle`: 5-200 characters
- `videoDescription`: Max 1000 characters (optional)
- `fileName`: Valid filename with supported extension
- `fileSize`: 1 byte to 5GB (5,368,709,120 bytes)
- `fileType`: Must be video/mp4, video/avi, video/mov, or video/x-ms-wmv

**Response:**
```json
{
  "success": true,
  "data": {
    "fileId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "uploadUrl": "https://apexshare-videos-prod.s3.amazonaws.com/uploads/f47ac10b-58cc-4372-a567-0e02b2c3d479?AWSAccessKeyId=...",
    "uploadFields": {
      "key": "uploads/f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "Content-Type": "video/mp4",
      "policy": "eyJleHBpcmF0aW9uIjoiMjAyNS0wMy0xNVQxMTo...",
      "x-amz-algorithm": "AWS4-HMAC-SHA256",
      "x-amz-credential": "AKIAIOSFODNN7EXAMPLE/20250315/us-east-1/s3/aws4_request",
      "x-amz-date": "20250315T103000Z",
      "x-amz-signature": "9b2ae1a7dc8e9c8df8a8bc9f8f8f8f8f8f8f8f8f"
    },
    "expiresAt": "2025-03-15T11:30:00Z",
    "maxFileSize": 5368709120
  },
  "error": null,
  "timestamp": "2025-03-15T10:30:00Z",
  "requestId": "upload-request-123"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `fileId` | string | Unique identifier for this upload |
| `uploadUrl` | string | S3 presigned URL for file upload |
| `uploadFields` | object | Required form fields for S3 upload |
| `expiresAt` | string | When the upload URL expires (ISO 8601) |
| `maxFileSize` | number | Maximum allowed file size in bytes |

**Upload Implementation Example:**

```javascript
// Using the response to upload via XMLHttpRequest
const formData = new FormData();
Object.keys(response.data.uploadFields).forEach(key => {
  formData.append(key, response.data.uploadFields[key]);
});
formData.append('file', fileBlob);

const xhr = new XMLHttpRequest();
xhr.open('POST', response.data.uploadUrl);
xhr.send(formData);
```

**Error Responses:**

```json
// Validation Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "File size exceeds maximum limit",
    "details": {
      "field": "fileSize",
      "limit": 5368709120,
      "provided": 6000000000
    }
  },
  "timestamp": "2025-03-15T10:30:00Z",
  "requestId": "upload-error-123"
}

// Invalid File Type
{
  "success": false,
  "error": {
    "code": "INVALID_FILE_TYPE",
    "message": "Unsupported file type",
    "details": {
      "provided": "image/jpeg",
      "supported": ["video/mp4", "video/avi", "video/mov", "video/x-ms-wmv"]
    }
  },
  "timestamp": "2025-03-15T10:30:00Z",
  "requestId": "upload-error-124"
}
```

---

### Access Video

#### GET /api/v1/download/{fileId}

Get video information and download access for a specific file.

**Request:**
```http
GET /api/v1/download/f47ac10b-58cc-4372-a567-0e02b2c3d479 HTTP/1.1
Host: api.apexshare.be
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fileId` | string | Yes | Unique file identifier from upload response |

**Response:**
```json
{
  "success": true,
  "data": {
    "fileId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "videoTitle": "Week 1: Basic Controls",
    "videoDescription": "Introduction to motorcycle controls and basic operation",
    "trainerName": "John Smith",
    "fileName": "week1-basic-controls.mp4",
    "fileSize": 157286400,
    "fileType": "video/mp4",
    "uploadedAt": "2025-03-15T10:30:00Z",
    "expiresAt": "2025-03-22T10:30:00Z",
    "downloadUrl": "https://apexshare-videos-prod.s3.amazonaws.com/videos/f47ac10b-58cc-4372-a567-0e02b2c3d479?AWSAccessKeyId=...",
    "downloadExpiresAt": "2025-03-15T12:30:00Z",
    "status": "ready"
  },
  "error": null,
  "timestamp": "2025-03-15T10:30:00Z",
  "requestId": "download-request-123"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `fileId` | string | Unique file identifier |
| `videoTitle` | string | Title provided during upload |
| `videoDescription` | string | Description provided during upload |
| `trainerName` | string | Name of the instructor |
| `fileName` | string | Original filename |
| `fileSize` | number | File size in bytes |
| `fileType` | string | MIME type of the file |
| `uploadedAt` | string | When the file was uploaded (ISO 8601) |
| `expiresAt` | string | When the file access expires (ISO 8601) |
| `downloadUrl` | string | Presigned URL for downloading the file |
| `downloadExpiresAt` | string | When the download URL expires (ISO 8601) |
| `status` | string | File status: "processing", "ready", "expired" |

**Status Values:**

| Status | Description |
|--------|-------------|
| `processing` | File is being processed after upload |
| `ready` | File is ready for download |
| `expired` | File has expired and is no longer available |

**Error Responses:**

```json
// File Not Found
{
  "success": false,
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "File not found or has expired",
    "details": {
      "fileId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
    }
  },
  "timestamp": "2025-03-15T10:30:00Z",
  "requestId": "download-error-123"
}

// File Still Processing
{
  "success": true,
  "data": {
    "fileId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "status": "processing",
    "estimatedReadyTime": "2025-03-15T10:35:00Z",
    "message": "Your video is being processed. You'll receive an email when it's ready."
  },
  "error": null,
  "timestamp": "2025-03-15T10:30:00Z",
  "requestId": "download-processing-123"
}
```

---

### CORS Preflight

#### OPTIONS /api/v1/{+proxy}

Handle CORS preflight requests for all endpoints.

**Request:**
```http
OPTIONS /api/v1/upload HTTP/1.1
Host: api.apexshare.be
Origin: https://apexshare.be
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type
```

**Response:**
```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://apexshare.be
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
Content-Length: 0
```

---

## Code Examples

### JavaScript/TypeScript

#### Upload Video Example

```javascript
class ApexShareClient {
  constructor(baseUrl = 'https://api.apexshare.be') {
    this.baseUrl = baseUrl;
  }

  async uploadVideo(videoData, file, onProgress) {
    try {
      // Step 1: Get upload URL
      const uploadResponse = await fetch(`${this.baseUrl}/api/v1/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trainerName: videoData.trainerName,
          trainerEmail: videoData.trainerEmail,
          studentEmail: videoData.studentEmail,
          videoTitle: videoData.videoTitle,
          videoDescription: videoData.videoDescription,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        })
      });

      const uploadData = await uploadResponse.json();

      if (!uploadData.success) {
        throw new Error(uploadData.error.message);
      }

      // Step 2: Upload file to S3
      const formData = new FormData();
      Object.keys(uploadData.data.uploadFields).forEach(key => {
        formData.append(key, uploadData.data.uploadFields[key]);
      });
      formData.append('file', file);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 204) {
            resolve({
              success: true,
              fileId: uploadData.data.fileId
            });
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload error'));
        });

        xhr.open('POST', uploadData.data.uploadUrl);
        xhr.send(formData);
      });

    } catch (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async getVideoInfo(fileId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/download/${fileId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error.message);
      }

      return data.data;
    } catch (error) {
      throw new Error(`Failed to get video info: ${error.message}`);
    }
  }
}

// Usage Example
const client = new ApexShareClient();

// Upload a video
const videoData = {
  trainerName: "John Smith",
  trainerEmail: "john@example.com",
  studentEmail: "student@example.com",
  videoTitle: "Basic Riding Skills",
  videoDescription: "Introduction to motorcycle riding"
};

const fileInput = document.getElementById('videoFile');
const file = fileInput.files[0];

client.uploadVideo(videoData, file, (progress) => {
  console.log(`Upload progress: ${progress.toFixed(2)}%`);
})
.then(result => {
  console.log('Upload successful:', result.fileId);
})
.catch(error => {
  console.error('Upload failed:', error.message);
});

// Get video information
client.getVideoInfo('f47ac10b-58cc-4372-a567-0e02b2c3d479')
.then(videoInfo => {
  console.log('Video info:', videoInfo);
})
.catch(error => {
  console.error('Error:', error.message);
});
```

### Python Example

```python
import requests
import json
from typing import Optional, Dict, Any

class ApexShareClient:
    def __init__(self, base_url: str = "https://api.apexshare.be"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'ApexShare-Python-Client/1.0'
        })

    def upload_video(self, video_data: Dict[str, Any], file_path: str) -> Dict[str, Any]:
        """
        Upload a video file to ApexShare

        Args:
            video_data: Dictionary containing upload metadata
            file_path: Path to the video file

        Returns:
            Dictionary with upload result
        """
        # Get file information
        import os
        file_size = os.path.getsize(file_path)
        file_name = os.path.basename(file_path)

        # Determine file type
        file_type_map = {
            '.mp4': 'video/mp4',
            '.avi': 'video/avi',
            '.mov': 'video/mov',
            '.wmv': 'video/x-ms-wmv'
        }

        file_ext = os.path.splitext(file_name)[1].lower()
        file_type = file_type_map.get(file_ext, 'video/mp4')

        # Prepare upload request
        upload_request = {
            **video_data,
            'fileName': file_name,
            'fileSize': file_size,
            'fileType': file_type
        }

        # Get upload URL
        response = self.session.post(
            f"{self.base_url}/api/v1/upload",
            json=upload_request
        )
        response.raise_for_status()

        upload_data = response.json()
        if not upload_data['success']:
            raise Exception(f"Upload preparation failed: {upload_data['error']['message']}")

        # Upload file to S3
        upload_fields = upload_data['data']['uploadFields']
        upload_url = upload_data['data']['uploadUrl']

        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = upload_fields

            upload_response = requests.post(upload_url, data=data, files=files)
            upload_response.raise_for_status()

        return {
            'success': True,
            'fileId': upload_data['data']['fileId']
        }

    def get_video_info(self, file_id: str) -> Dict[str, Any]:
        """
        Get information about a video

        Args:
            file_id: Unique file identifier

        Returns:
            Dictionary with video information
        """
        response = self.session.get(f"{self.base_url}/api/v1/download/{file_id}")
        response.raise_for_status()

        data = response.json()
        if not data['success']:
            raise Exception(f"Failed to get video info: {data['error']['message']}")

        return data['data']

    def health_check(self) -> Dict[str, Any]:
        """Check API health status"""
        response = self.session.get(f"{self.base_url}/api/v1/health")
        response.raise_for_status()
        return response.json()

# Usage Example
if __name__ == "__main__":
    client = ApexShareClient()

    # Check API health
    health = client.health_check()
    print(f"API Status: {health['data']['status']}")

    # Upload a video
    video_data = {
        "trainerName": "John Smith",
        "trainerEmail": "john@example.com",
        "studentEmail": "student@example.com",
        "videoTitle": "Basic Riding Skills",
        "videoDescription": "Introduction to motorcycle riding"
    }

    try:
        result = client.upload_video(video_data, "path/to/video.mp4")
        print(f"Upload successful: {result['fileId']}")

        # Get video information
        video_info = client.get_video_info(result['fileId'])
        print(f"Video status: {video_info['status']}")

    except Exception as e:
        print(f"Error: {e}")
```

### cURL Examples

```bash
# Health Check
curl -X GET https://api.apexshare.be/api/v1/health

# Upload Video (Step 1: Get Upload URL)
curl -X POST https://api.apexshare.be/api/v1/upload \
  -H "Content-Type: application/json" \
  -d '{
    "trainerName": "John Smith",
    "trainerEmail": "john@example.com",
    "studentEmail": "student@example.com",
    "videoTitle": "Basic Riding Skills",
    "videoDescription": "Introduction to motorcycle riding",
    "fileName": "riding-basics.mp4",
    "fileSize": 157286400,
    "fileType": "video/mp4"
  }'

# Upload Video (Step 2: Upload to S3 - example with response from step 1)
curl -X POST "https://apexshare-videos-prod.s3.amazonaws.com/" \
  -F "key=uploads/f47ac10b-58cc-4372-a567-0e02b2c3d479" \
  -F "Content-Type=video/mp4" \
  -F "policy=eyJleHBpcmF0aW9uIjoiMjAyNS0wMy0xNVQxMTo..." \
  -F "x-amz-algorithm=AWS4-HMAC-SHA256" \
  -F "x-amz-credential=AKIAIOSFODNN7EXAMPLE/20250315/us-east-1/s3/aws4_request" \
  -F "x-amz-date=20250315T103000Z" \
  -F "x-amz-signature=9b2ae1a7dc8e9c8df8a8bc9f8f8f8f8f8f8f8f8f" \
  -F "file=@riding-basics.mp4"

# Get Video Information
curl -X GET https://api.apexshare.be/api/v1/download/f47ac10b-58cc-4372-a567-0e02b2c3d479

# CORS Preflight Check
curl -X OPTIONS https://api.apexshare.be/api/v1/upload \
  -H "Origin: https://apexshare.be" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```

---

## Testing

### Unit Testing

Test individual API endpoints using automated testing frameworks:

```javascript
// Jest test example
describe('ApexShare API', () => {
  const client = new ApexShareClient('https://staging-api.apexshare.be');

  test('health check returns success', async () => {
    const health = await client.healthCheck();
    expect(health.success).toBe(true);
    expect(health.data.status).toBe('healthy');
  });

  test('upload validation rejects invalid email', async () => {
    const invalidData = {
      trainerName: "John Smith",
      trainerEmail: "invalid-email",
      studentEmail: "student@example.com",
      videoTitle: "Test Video",
      fileName: "test.mp4",
      fileSize: 1000000,
      fileType: "video/mp4"
    };

    await expect(client.uploadVideo(invalidData, mockFile))
      .rejects.toThrow('VALIDATION_ERROR');
  });
});
```

### Integration Testing

Test complete workflows:

```bash
#!/bin/bash
# Integration test script

API_BASE="https://staging-api.apexshare.be"

# Test 1: Health Check
echo "Testing health check..."
curl -f "$API_BASE/api/v1/health" || exit 1

# Test 2: Upload Request
echo "Testing upload request..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_BASE/api/v1/upload" \
  -H "Content-Type: application/json" \
  -d '{
    "trainerName": "Test Trainer",
    "trainerEmail": "trainer@test.com",
    "studentEmail": "student@test.com",
    "videoTitle": "Integration Test Video",
    "fileName": "test.mp4",
    "fileSize": 1000000,
    "fileType": "video/mp4"
  }')

FILE_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.data.fileId')

# Test 3: Video Info (should show processing)
echo "Testing video info retrieval..."
curl -f "$API_BASE/api/v1/download/$FILE_ID" || exit 1

echo "All integration tests passed!"
```

### Load Testing

Use tools like Artillery or Apache Bench for load testing:

```yaml
# artillery-config.yml
config:
  target: 'https://staging-api.apexshare.be'
  phases:
    - duration: 60
      arrivalRate: 5
    - duration: 120
      arrivalRate: 10

scenarios:
  - name: "API Health Check"
    weight: 30
    requests:
      - get:
          url: "/api/v1/health"

  - name: "Upload Request"
    weight: 70
    requests:
      - post:
          url: "/api/v1/upload"
          json:
            trainerName: "Load Test Trainer"
            trainerEmail: "trainer@loadtest.com"
            studentEmail: "student@loadtest.com"
            videoTitle: "Load Test Video"
            fileName: "loadtest.mp4"
            fileSize: 50000000
            fileType: "video/mp4"
```

---

## Changelog

### Version 1.0.0 (September 2025)

**Initial Release**
- Upload endpoint with S3 presigned URL generation
- Download endpoint with secure file access
- Health check endpoint
- CORS support for web applications
- Rate limiting and basic security measures
- Email notification integration
- 7-day file expiration policy

**Features:**
- Support for MP4, AVI, MOV, and WMV file formats
- Maximum file size of 5GB
- Automatic file cleanup after 7 days
- Email notifications when videos are ready
- Mobile-friendly access pages

**Security:**
- WAF protection against common attacks
- Rate limiting to prevent abuse
- Secure presigned URLs for file access
- No authentication required for simplicity

---

*ApexShare API Documentation v1.0 - September 2025*

*For the latest API updates and additional examples, visit: https://api.apexshare.be/docs*