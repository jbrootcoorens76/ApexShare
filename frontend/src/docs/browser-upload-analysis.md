# Browser-Specific Upload Issues Analysis

## Overview

This document analyzes the different upload behaviors observed between Chrome macOS (400 Bad Request) and Mobile Safari (upload halt at 56%) and provides debugging tools to identify the root causes.

## Key Findings from Code Analysis

### 1. Chrome 400 Bad Request on `/sessions/{id}/upload`

**Potential Causes:**

#### A. Request Header Differences
- **Chrome-specific headers**: Chrome automatically adds `sec-fetch-*` headers that other browsers don't send
  - `sec-fetch-dest: empty`
  - `sec-fetch-mode: cors`
  - `sec-fetch-site: cross-site`
- **API Gateway sensitivity**: AWS API Gateway may be configured to reject requests with unexpected headers
- **CORS preflight variations**: Chrome's CORS handling is more strict and may trigger different preflight requests

#### B. Payload Format Issues
```typescript
// In apiService.files.getUploadUrl()
const response = await apiClient.post(`/sessions/${sessionId}/upload`, {
  // API Gateway model expects exactly these 3 fields
  fileName,
  fileSize,
  contentType: mimeType,
})
```
- **Field naming**: The backend expects `contentType` but other browsers might send `content-type`
- **Data types**: Chrome may serialize numbers differently (fileSize as string vs number)
- **Character encoding**: Chrome might handle special characters in filenames differently

#### C. Authentication Token Issues
```typescript
// In api.ts request interceptor
const token = getAuthToken()
if (token) {
  config.headers['X-Auth-Token'] = token  // No 'Bearer ' prefix needed
}

// Public access for unauthenticated requests
if (!token && (config.url?.includes('/sessions') || config.url?.includes('/upload'))) {
  config.headers['X-Public-Access'] = 'true'
}
```
- **LocalStorage access**: Chrome might have stricter localStorage access policies
- **Header case sensitivity**: Chrome might send headers in different case
- **Token format**: Different token encoding between browsers

### 2. Safari Upload Halt at 56% Progress

**Potential Causes:**

#### A. S3 Upload Timeout/Connection Issues
```typescript
// In DirectUploadPage.tsx - upload implementation
xhr.open('PUT', uploadResponse.data!.uploadUrl)
xhr.setRequestHeader('Content-Type', state.selectedFile!.type)
xhr.send(state.selectedFile)
```
- **Connection pooling**: Safari's connection management differs from Chrome
- **Keep-alive timeouts**: Safari may close connections earlier
- **Memory management**: Large files might cause Safari to pause/garbage collect

#### B. Presigned URL Expiration
- **Clock skew**: Safari might have different system time causing early expiration
- **URL parsing**: Safari handles presigned URLs with special characters differently
- **Request signing**: Safari's HTTP implementation might affect AWS signature validation

#### C. File Chunking Issues
- **Blob handling**: Safari processes large blobs differently
- **Memory limits**: Mobile Safari has stricter memory constraints
- **Background tab suspension**: Mobile Safari suspends background uploads

#### D. Network API Differences
```typescript
// Safari-specific network monitoring
const connection = (navigator as any).connection ||
                  (navigator as any).mozConnection ||
                  (navigator as any).webkitConnection
```
- **Network change detection**: Safari handles network transitions differently
- **Cellular vs WiFi**: Mobile Safari may pause uploads during network switches

### 3. Browser-Specific Code Paths

#### Current Implementation Issues:
1. **Single upload strategy**: No browser-specific handling
2. **No chunked uploads**: Large files uploaded as single blob
3. **Limited error recovery**: Basic retry without browser-specific logic
4. **No progress validation**: Progress events not verified for accuracy

## Debugging Tools Created

### 1. `uploadDebugger.ts`
- **Browser detection**: Comprehensive browser capability detection
- **Network diagnostics**: Connection type, speed, and reliability monitoring
- **Upload monitoring**: Progress tracking with stuck detection
- **Request/response logging**: Detailed HTTP interaction logging

### 2. `DirectUploadPageDebug.tsx`
- **Real-time debugging**: Live debug panel with browser info
- **Phase tracking**: Upload broken into distinct phases for precise error localization
- **Progress anomaly detection**: Specific detection for Safari 56% stall
- **Request payload logging**: Exact request/response capture
- **Export functionality**: Debug data export for analysis

## Recommended Investigation Steps

### For Chrome 400 Bad Request:

1. **Enable debug mode** and compare request payloads:
   ```typescript
   // Check exact headers sent
   'X-Browser-Debug': `${browserInfo.name}/${browserInfo.version}`
   'X-File-Info': `${fileName}|${fileSize}|${fileType}`
   ```

2. **Test with minimal payload**:
   ```typescript
   // Verify exact API Gateway model requirements
   {
     fileName: file.name,
     fileSize: file.size,
     contentType: file.type
   }
   ```

3. **Check authentication header format**:
   ```typescript
   // Verify token format and headers
   'X-Auth-Token': token  // No Bearer prefix
   'X-Public-Access': 'true'  // For unauthenticated
   ```

### For Safari 56% Upload Halt:

1. **Monitor progress events**:
   ```typescript
   // Detect stuck progress
   if (Math.abs(progress - 56) < 5 && browserInfo.isSafari) {
     // Safari-specific stuck detection
   }
   ```

2. **Implement chunked uploads**:
   ```typescript
   // Break large files into chunks
   const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
   const chunks = Math.ceil(file.size / CHUNK_SIZE);
   ```

3. **Add Safari-specific error handling**:
   ```typescript
   if (browserInfo.isSafari) {
     // Retry with smaller chunks
     // Check for memory pressure
     // Handle background suspension
   }
   ```

## Browser Compatibility Matrix

| Feature | Chrome | Safari | Potential Issues |
|---------|--------|--------|------------------|
| XMLHttpRequest | ✅ | ✅ | Progress event differences |
| FormData | ✅ | ✅ | Field ordering variations |
| Blob handling | ✅ | ⚠️ | Memory limits on large files |
| CORS headers | ✅ | ✅ | Chrome sends extra sec-fetch-* |
| LocalStorage | ✅ | ⚠️ | Private browsing restrictions |
| Background uploads | ✅ | ❌ | Safari suspends background tabs |
| Large file uploads | ✅ | ⚠️ | Safari memory management issues |

## Implementation Recommendations

### 1. Add Browser-Specific Request Handling
```typescript
// Different request strategies per browser
if (browserInfo.isChrome) {
  // Handle Chrome's strict CORS requirements
  xhr.setRequestHeader('sec-fetch-dest', 'empty')
} else if (browserInfo.isSafari) {
  // Handle Safari's connection limitations
  xhr.timeout = 120000 // Longer timeout
}
```

### 2. Implement Chunked Upload Strategy
```typescript
// Especially important for Safari
const shouldUseChunkedUpload = (file: File, browser: BrowserInfo): boolean => {
  if (browser.isSafari && file.size > 100 * 1024 * 1024) return true
  if (browser.isMobile && file.size > 50 * 1024 * 1024) return true
  return false
}
```

### 3. Add Progress Validation
```typescript
// Detect and handle progress anomalies
const validateProgress = (current: number, previous: number, browser: BrowserInfo): boolean => {
  if (browser.isSafari && Math.abs(current - 56) < 1) {
    // Known Safari issue point
    return false
  }
  return true
}
```

### 4. Enhanced Error Recovery
```typescript
// Browser-specific retry strategies
const getRetryStrategy = (error: Error, browser: BrowserInfo) => {
  if (browser.isChrome && error.message.includes('400')) {
    return 'modify_headers'
  } else if (browser.isSafari && error.message.includes('progress')) {
    return 'chunked_upload'
  }
  return 'standard_retry'
}
```

## Next Steps

1. **Deploy the debug version** to test environments
2. **Collect browser-specific data** from both Chrome and Safari users
3. **Analyze the exported debug logs** to identify exact differences
4. **Implement targeted fixes** based on findings
5. **Add automated testing** for different browser scenarios

The debugging tools will provide concrete data about:
- Exact request/response payloads
- Browser-specific header differences
- Progress event patterns
- Network timing issues
- Authentication token variations

This will enable precise identification and resolution of the browser-specific upload issues.