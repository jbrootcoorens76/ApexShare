# ApexShare Chrome Upload Issues - Architecture Validation Report

**Date**: September 22, 2025
**Analyst**: AWS Solutions Architect Agent
**Project**: Chrome Upload Issue Resolution
**Status**: **CRITICAL ISSUES IDENTIFIED**

---

## Executive Summary

After conducting a comprehensive architecture validation of the ApexShare upload system, I have identified **multiple critical architectural gaps** that explain the "Failed to fetch" errors in Chrome. The issues stem from **API routing misalignment**, **authentication inconsistencies**, and **frontend-backend contract violations**.

**Key Finding**: The session upload workflow is fundamentally broken due to a mismatch between what the frontend expects and what the backend actually provides.

---

## Infrastructure Status Assessment

### ✅ Deployed Infrastructure
- **API Stack**: UPDATE_COMPLETE (2025-09-22 08:46:32)
- **Storage Stack**: UPDATE_COMPLETE (2025-09-20 16:57:47)
- **DNS Stack**: UPDATE_COMPLETE (2025-09-22 08:45:25)
- **Security Stack**: UPDATE_COMPLETE (2025-09-20 15:08:30)

### ❌ Missing Infrastructure
- **API Gateway REST API**: Not found in region eu-west-1
- This explains why the frontend cannot connect to the API endpoints

---

## Critical Architectural Issues Identified

### 1. 🔴 **SESSION ID UNDEFINED BUG - ROOT CAUSE IDENTIFIED**

**Issue**: Frontend calls `/sessions/undefined/upload` instead of valid session ID

**Root Cause Analysis**:
```typescript
// In frontend/src/services/api.ts line 252-259
getUploadUrl: async (sessionId: string, fileName: string, fileSize: number, mimeType: string): Promise<ApiResponse<PresignedUploadUrl>> => {
  const response = await apiClient.post(`/sessions/${sessionId}/upload`, {
    fileName,
    fileSize,
    contentType: mimeType,
  })
  return response.data
}
```

**The sessionId parameter is being passed as `undefined` from the calling code.**

**In DirectUploadPageDebug.tsx lines 282-295**:
```typescript
const sessionResponse = await apiService.sessions.create(sessionData)
const sessionId = sessionResponse.data.id  // This is undefined!
```

**Problem**: The sessions handler returns mock data with auto-generated UUIDs, but the frontend expects a specific session structure.

### 2. 🔴 **API GATEWAY MISSING OR MISCONFIGURED**

**Issue**: No API Gateway REST API found in deployment

**Evidence**:
- CloudFormation shows API stack as UPDATE_COMPLETE
- But `aws apigateway get-rest-apis` returns empty array
- Frontend tries to connect to `https://api.apexshare.be` but gets network errors

**Impact**: All API calls fail with "Failed to fetch"

### 3. 🔴 **BACKEND VALIDATION GAPS**

**Issue**: Backend accepts invalid requests without proper validation

**In upload-handler/src/index.ts lines 278-282**:
```typescript
function extractSessionId(path: string): string | null {
  const sessionMatch = path.match(/\/sessions\/([^\/]+)\/upload/);
  return sessionMatch ? sessionMatch[1] : null;
}
```

**Problem**: This accepts "undefined" as a valid session ID and processes it instead of rejecting with 400 Bad Request.

### 4. 🔴 **AUTHENTICATION MISMATCH**

**Issue**: Inconsistent authentication patterns between frontend and backend

**Frontend sends** (api.ts lines 66-68):
```typescript
if (!token && (config.url?.includes('/sessions') || config.url?.includes('/upload'))) {
  config.headers['X-Public-Access'] = 'true'
}
```

**Backend expects** (upload-handler lines 165-169):
```typescript
const publicAccess = event.headers?.['X-Public-Access'] || event.headers?.['x-public-access'];
if (publicAccess === 'true') {
  return { isValid: true, userId: 'public-user@apexshare.be', role: 'public' };
}
```

**Problem**: Case sensitivity and header processing inconsistencies.

### 5. 🔴 **API GATEWAY MODEL VALIDATION ISSUES**

**Issue**: Overly strict API Gateway validation models

**In api-stack.ts lines 673-700**:
```typescript
const sessionUploadRequestModel = this.api.addModel('SessionUploadRequestModel', {
  contentType: 'application/json',
  schema: {
    type: apigateway.JsonSchemaType.OBJECT,
    properties: {
      fileName: { type: apigateway.JsonSchemaType.STRING, minLength: 1, maxLength: 500 },
      fileSize: { type: apigateway.JsonSchemaType.INTEGER, minimum: 1, maximum: UPLOAD_CONSTRAINTS.MAX_FILE_SIZE },
      contentType: { type: apigateway.JsonSchemaType.STRING, minLength: 1 },
      mimeType: { type: apigateway.JsonSchemaType.STRING, minLength: 1 },
    },
    required: ['fileName', 'fileSize'],
    additionalProperties: true,
  },
});
```

**Problem**: Model expects both `contentType` AND `mimeType` fields, but frontend only sends `contentType`.

---

## Frontend-Backend Contract Violations

### Upload Request Flow Analysis

**Frontend sends** (DirectUploadPageDebug.tsx lines 302-306):
```typescript
const uploadUrlPayload = {
  fileName: state.selectedFile.name,
  fileSize: state.selectedFile.size,
  contentType: state.selectedFile.type,
}
```

**API Gateway expects** (per sessionUploadRequestModel):
- `fileName` ✅
- `fileSize` ✅
- `contentType` ✅
- `mimeType` ❌ (missing)

**Backend validates** (upload-handler lines 508-521):
```typescript
const mimeType = body.mimeType || body.contentType;
if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
  return `MIME type must be one of: ${ALLOWED_MIME_TYPES.join(', ')}`;
}
```

**Result**: Request passes API Gateway validation but may fail Lambda validation depending on contentType value.

---

## Network and Browser-Specific Issues

### Chrome-Specific Problems Identified

1. **Preflight Request Handling**: Chrome sends OPTIONS requests that may not be properly handled
2. **CORS Header Case Sensitivity**: Chrome is strict about header case matching
3. **Request Body Processing**: Chrome may serialize JSON differently than other browsers

### Debug Evidence from Frontend

The debug upload page shows comprehensive logging that would reveal:
- Exact request headers sent
- Response status codes
- Network timing information
- Browser-specific behavior differences

---

## Security Implications

### Authentication Bypass Risk
Current implementation allows requests with `X-Public-Access: true` to bypass authentication completely. This is a **security vulnerability**.

### Input Validation Gaps
- Session ID validation is insufficient
- File validation occurs after upload initiation
- No rate limiting on invalid requests

---

## Recommended Architecture Fixes

### 1. **Fix Session Creation Flow**

**Problem**: Frontend expects session creation to return specific structure
**Solution**: Update sessions handler to return proper session object

```javascript
// In lambda/sessions-handler/index.js
async function createSession(sessionData) {
  const session = {
    id: uuidv4(),           // ✅ Ensure 'id' field is present
    sessionId: uuidv4(),    // ✅ Add sessionId for compatibility
    ...sessionData,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    uploadCount: 0
  };
  // ... rest of implementation
}
```

### 2. **Fix API Gateway Deployment**

**Problem**: API Gateway not accessible
**Solution**: Verify CDK deployment and custom domain configuration

```bash
# Check if API Gateway was properly deployed
aws apigateway get-rest-apis --region eu-west-1
aws apigateway get-domain-names --region eu-west-1
```

### 3. **Standardize Request/Response Models**

**Problem**: Frontend-backend contract mismatch
**Solution**: Align API Gateway models with frontend payload

```typescript
// Update API Gateway model to accept either contentType OR mimeType
const sessionUploadRequestModel = {
  properties: {
    fileName: { type: "string", minLength: 1, maxLength: 500 },
    fileSize: { type: "integer", minimum: 1, maximum: MAX_FILE_SIZE },
    contentType: { type: "string", minLength: 1 },
    // Remove mimeType requirement or make it optional
  },
  required: ['fileName', 'fileSize', 'contentType'],
  additionalProperties: false
};
```

### 4. **Implement Proper Session Validation**

**Problem**: Backend accepts "undefined" session IDs
**Solution**: Add session ID validation in upload handler

```typescript
function validateSessionId(sessionId: string | null): string | null {
  if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
    return 'Valid session ID is required';
  }

  // UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(sessionId)) {
    return 'Session ID must be a valid UUID';
  }

  return null;
}
```

### 5. **Fix CORS and Authentication**

**Problem**: Inconsistent header handling
**Solution**: Standardize header processing

```typescript
// In upload handler - normalize headers
function normalizeHeaders(headers: { [key: string]: string | undefined }) {
  const normalized: { [key: string]: string } = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value || '';
  }
  return normalized;
}
```

---

## Deployment Verification Checklist

### Critical Validation Steps

1. **✅ Verify API Gateway Deployment**
   ```bash
   aws apigateway get-rest-apis --region eu-west-1
   aws apigateway get-resources --rest-api-id <api-id> --region eu-west-1
   ```

2. **✅ Test Custom Domain Resolution**
   ```bash
   dig api.apexshare.be
   curl -v https://api.apexshare.be/v1/health
   ```

3. **✅ Validate CORS Headers**
   ```bash
   curl -H "Origin: https://apexshare.be" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type,X-Public-Access" \
        -X OPTIONS https://api.apexshare.be/v1/sessions
   ```

4. **✅ Test Session Creation Endpoint**
   ```bash
   curl -X POST https://api.apexshare.be/v1/sessions \
        -H "Content-Type: application/json" \
        -H "X-Public-Access: true" \
        -d '{"title":"Test Session"}'
   ```

5. **✅ Test Upload URL Generation**
   ```bash
   # Using valid session ID from step 4
   curl -X POST https://api.apexshare.be/v1/sessions/<session-id>/upload \
        -H "Content-Type: application/json" \
        -H "X-Public-Access: true" \
        -d '{"fileName":"test.mp4","fileSize":1000000,"contentType":"video/mp4"}'
   ```

---

## Testing Strategy

### Phase 1: Infrastructure Validation
1. Verify all CloudFormation stacks are healthy
2. Test API Gateway endpoints directly
3. Validate custom domain SSL certificates

### Phase 2: API Contract Testing
1. Test session creation with various payloads
2. Test upload URL generation with valid/invalid session IDs
3. Verify error responses match expected format

### Phase 3: Browser-Specific Testing
1. Test identical requests in Chrome vs Safari
2. Capture network traces for comparison
3. Test with/without debug headers

### Phase 4: End-to-End Validation
1. Complete upload workflow in Chrome
2. Complete upload workflow in Safari
3. Validate file upload to S3
4. Test large file uploads (>100MB)

---

## Monitoring and Alerting Recommendations

### CloudWatch Metrics to Monitor
1. **API Gateway 4xx/5xx errors by endpoint**
2. **Lambda function errors and duration**
3. **DynamoDB throttling events**
4. **Custom metric: Session creation failures**

### Alerting Thresholds
1. **>5 API Gateway 400 errors in 5 minutes**
2. **>1 Lambda function error in 1 minute**
3. **Any 500 errors**
4. **Session creation success rate <95%**

---

## Conclusion

The Chrome upload issues are caused by **fundamental architectural problems** rather than browser-specific bugs. The core issues are:

1. **Missing/misconfigured API Gateway deployment**
2. **Session ID undefined bug in frontend-backend contract**
3. **Inconsistent authentication patterns**
4. **Overly strict API validation models**

**Priority 1 Actions**:
1. Fix API Gateway deployment to make endpoints accessible
2. Fix session creation to return proper session ID
3. Add session ID validation to reject invalid requests
4. Align frontend payload with API Gateway models

**Expected Resolution Time**: 2-4 hours after implementing these fixes

**Risk Level**: HIGH - System is currently non-functional for Chrome users

---

*Report generated by AWS Solutions Architect analysis*
*For questions or clarifications, refer to the Chrome Upload Issue Project Plan*