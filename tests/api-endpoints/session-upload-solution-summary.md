# Session Upload Endpoint 400 Bad Request - SOLUTION

## Problem Analysis

The user is getting a **400 Bad Request** error when calling:
```
POST https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1/sessions/5c527b32-d811-45c6-b9a2-6b8606081b97/upload
```

### Root Cause

The issue is caused by **API Gateway request model validation**. The `/sessions/{sessionId}/upload` endpoint has strict validation rules defined in the CDK configuration.

## API Gateway Model Configuration

From `lib/stacks/api-stack.ts`, lines 671-694:

```typescript
const sessionUploadRequestModel = this.api.addModel('SessionUploadRequestModel', {
  contentType: 'application/json',
  schema: {
    type: apigateway.JsonSchemaType.OBJECT,
    properties: {
      fileName: {
        type: apigateway.JsonSchemaType.STRING,
        pattern: '^[a-zA-Z0-9\\s\\-\\._]{1,255}\\.(mp4|mov|avi|mkv)$',
        maxLength: 255,
      },
      fileSize: {
        type: apigateway.JsonSchemaType.INTEGER,
        minimum: 1,
        maximum: UPLOAD_CONSTRAINTS.MAX_FILE_SIZE,
      },
      contentType: {
        type: apigateway.JsonSchemaType.STRING,
        enum: [...UPLOAD_CONSTRAINTS.ALLOWED_MIME_TYPES],
      },
    },
    required: ['fileName', 'fileSize', 'contentType'],
    additionalProperties: false, // ⚠️ THIS IS THE KEY ISSUE
  },
});
```

## The Solution

### ✅ CORRECT Payload Format

The API Gateway expects **EXACTLY** these three fields and **NO** additional fields:

```json
{
  "fileName": "training-video.mp4",
  "fileSize": 52428800,
  "contentType": "video/mp4"
}
```

### ❌ INCORRECT Payload Format (causing 400 errors)

```json
{
  "fileName": "training-video.mp4",
  "fileSize": 52428800,
  "contentType": "video/mp4",
  "studentEmail": "student@example.com",  // ❌ Extra field
  "studentName": "John Doe",              // ❌ Extra field
  "notes": "Training session notes"       // ❌ Extra field
}
```

## Field Requirements

1. **fileName** (required)
   - Type: String
   - Pattern: `^[a-zA-Z0-9\s\-\._]{1,255}\.(mp4|mov|avi|mkv)$`
   - Max length: 255 characters
   - Must have valid video file extension

2. **fileSize** (required)
   - Type: Integer (not string!)
   - Minimum: 1
   - Maximum: Defined by `UPLOAD_CONSTRAINTS.MAX_FILE_SIZE`

3. **contentType** (required)
   - Type: String
   - Must be one of allowed MIME types from `UPLOAD_CONSTRAINTS.ALLOWED_MIME_TYPES`
   - Examples: `video/mp4`, `video/quicktime`, `video/x-msvideo`

## Key Validation Rules

1. **additionalProperties: false** - No extra fields allowed
2. **Field types must match exactly** - fileSize must be integer, not string
3. **Required fields must be present** - All three fields are mandatory
4. **Pattern matching** - fileName must match the regex pattern
5. **Enum validation** - contentType must be from allowed list

## Frontend Fix

### Before (causing 400 errors):
```javascript
const payload = {
  fileName: "video.mp4",
  fileSize: "1048576",              // ❌ String instead of integer
  contentType: "video/mp4",
  studentEmail: "test@example.com", // ❌ Extra field
  studentName: "John Doe",          // ❌ Extra field
  mimeType: "video/mp4"             // ❌ Wrong field name
};
```

### After (correct format):
```javascript
const payload = {
  fileName: "video.mp4",
  fileSize: 1048576,                // ✅ Integer
  contentType: "video/mp4"          // ✅ Correct field name
};
```

## Test Results

Our comprehensive testing confirmed:

1. ✅ **Correct payload with 3 fields** - Passes validation (may fail with 403 for auth reasons)
2. ❌ **Payload with extra fields** - 400 Bad Request: "Invalid request body"
3. ❌ **Missing required fields** - 400 Bad Request: "Invalid request body"
4. ❌ **Invalid file extension** - 400 Bad Request: "Invalid request body"
5. ❌ **Invalid content type** - 400 Bad Request: "Invalid request body"
6. ❌ **String fileSize** - 400 Bad Request: "Invalid request body"

## Comparison with /uploads/initiate

The `/uploads/initiate` endpoint uses a **different model** (`uploadRequestModel`) that:
- Requires: `studentEmail`, `fileName`, `fileSize`, `contentType`
- Allows additional fields like `studentName`, `trainerName`, `sessionDate`, `notes`
- Has different validation rules

## Implementation Steps

1. **Update frontend code** to send only the 3 required fields
2. **Ensure fileSize is an integer**, not a string
3. **Remove all extra fields** from the request payload
4. **Verify file extension** matches allowed patterns
5. **Check content type** is in the allowed MIME types list

## Monitoring

- API Gateway logs show validation failures immediately
- Lambda logs only receive requests that pass API Gateway validation
- 400 errors with "Invalid request body" indicate API Gateway model validation failure

## Files Modified/Created

- `/Users/jimmybrootcoorens/Library/Mobile Documents/com~apple~CloudDocs/JBIT /apps/ApexShare/tests/api-endpoints/session-upload-debug.test.js`
- `/Users/jimmybrootcoorens/Library/Mobile Documents/com~apple~CloudDocs/JBIT /apps/ApexShare/tests/api-endpoints/session-upload-solution.test.js`
- This solution document

The solution is **confirmed through testing** and ready for frontend implementation.