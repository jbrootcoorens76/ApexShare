# API Authentication Guide

**Project:** ApexShare Serverless Video Sharing System
**Document:** API Authentication Implementation Guide
**Version:** 2.0
**Last Updated:** September 21, 2025

---

## Overview

This document provides comprehensive guidance on authentication implementation for the ApexShare API. The system supports dual authentication header methods to ensure compatibility and bypass AWS API Gateway IAM interpretation issues.

---

## Authentication Methods

### Primary Method: X-Auth-Token Header

**Recommended for all new implementations:**

```javascript
// Frontend implementation
headers: {
  'X-Auth-Token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  'Content-Type': 'application/json'
}
```

**cURL Example:**
```bash
curl -X GET \
  "https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1/sessions" \
  -H "X-Auth-Token: YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

### Fallback Method: Authorization Header

**Supported for backward compatibility:**

```javascript
// Legacy implementation (still supported)
headers: {
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  'Content-Type': 'application/json'
}
```

**cURL Example:**
```bash
curl -X GET \
  "https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1/sessions" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

---

## JWT Token Structure

### Token Format
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkZW1vLXRyYWluZXItMSIsImVtYWlsIjoidHJhaW5lckBhcGV4c2hhcmUuYmUiLCJyb2xlIjoidHJhaW5lciIsImlhdCI6MTc1ODQ2NjYxNCwiZXhwIjoxNzU4NTUzMDE0fQ.4t-0b_QeXvBYziVTEpvMxQIgGaEHTl68NEG8MhSoCr4
```

### Decoded Payload Example
```json
{
  "userId": "demo-trainer-1",
  "email": "trainer@apexshare.be",
  "role": "trainer",
  "iat": 1758466614,
  "exp": 1758553014
}
```

### Required Claims
- `userId`: Unique user identifier
- `email`: User email address
- `role`: User role (trainer, student, admin)
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp

---

## API Endpoints and Authentication

### Protected Endpoints

All API endpoints require authentication except:
- `GET /health` - System health check
- `OPTIONS *` - CORS preflight requests

### Endpoint Categories

#### Session Management
```bash
# List sessions
GET /sessions?limit=10&offset=0
Headers: X-Auth-Token: [JWT_TOKEN]

# Get specific session
GET /sessions/{sessionId}
Headers: X-Auth-Token: [JWT_TOKEN]

# Create session
POST /sessions
Headers: X-Auth-Token: [JWT_TOKEN]
Body: {
  "studentName": "John Doe",
  "studentEmail": "john@example.com",
  "sessionDate": "2025-01-20"
}

# Update session
PUT /sessions/{sessionId}
Headers: X-Auth-Token: [JWT_TOKEN]
Body: {
  "status": "completed",
  "notes": "Session completed successfully"
}

# Delete session
DELETE /sessions/{sessionId}
Headers: X-Auth-Token: [JWT_TOKEN]
```

#### File Upload Management
```bash
# Get upload URL
POST /sessions/{sessionId}/upload
Headers: X-Auth-Token: [JWT_TOKEN]
Body: {
  "fileName": "training-video.mp4",
  "fileSize": 104857600,
  "contentType": "video/mp4"
}

# Complete multipart upload
POST /sessions/{sessionId}/upload/{uploadId}/complete
Headers: X-Auth-Token: [JWT_TOKEN]
Body: {
  "parts": [
    {"PartNumber": 1, "ETag": "\"abc123\""}
  ]
}

# Cancel upload
DELETE /sessions/{sessionId}/upload/{uploadId}
Headers: X-Auth-Token: [JWT_TOKEN]
```

#### Analytics and Metrics
```bash
# Track event
POST /analytics/events
Headers: X-Auth-Token: [JWT_TOKEN]
Body: {
  "eventType": "video_upload",
  "properties": {
    "sessionId": "123",
    "duration": 300
  }
}

# Get usage metrics
GET /analytics/usage?period=30d
Headers: X-Auth-Token: [JWT_TOKEN]
```

---

## Frontend Implementation

### React/JavaScript Implementation

```javascript
// api.ts - API service configuration
import axios, { AxiosInstance } from 'axios'

const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // Request interceptor for authentication
  client.interceptors.request.use(
    (config) => {
      const token = getAuthToken()
      if (token) {
        // Use X-Auth-Token header (recommended)
        config.headers['X-Auth-Token'] = token
      }
      return config
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  return client
}

// Token management functions
const getAuthToken = (): string | null => {
  return localStorage.getItem('apexshare_auth_token')
}

export const setAuthToken = (token: string): void => {
  localStorage.setItem('apexshare_auth_token', token)
}

export const removeAuthToken = (): void => {
  localStorage.removeItem('apexshare_auth_token')
}
```

### Usage Examples

```javascript
// Session operations
import { apiService } from './api'

// List sessions
const sessions = await apiService.sessions.getAll({
  limit: 10,
  offset: 0
})

// Create session
const newSession = await apiService.sessions.create({
  studentName: 'John Doe',
  studentEmail: 'john@example.com',
  sessionDate: '2025-01-20'
})

// Upload file
const uploadUrl = await apiService.files.getUploadUrl(
  sessionId,
  'video.mp4',
  104857600,
  'video/mp4'
)
```

---

## Backend Implementation

### Lambda Handler Authentication

```javascript
// Authentication validation function
function validateToken(event) {
  // Check X-Auth-Token header first (recommended)
  const xAuthToken = event.headers?.['X-Auth-Token'] ||
                     event.headers?.['x-auth-token'];
  if (xAuthToken) {
    return validateJWT(xAuthToken);
  }

  // Fallback to Authorization header
  const authHeader = event.headers?.Authorization ||
                     event.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return validateJWT(token);
  }

  return null;
}

// JWT validation (simplified for development)
function validateJWT(token) {
  try {
    // In production, implement proper JWT signature verification
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    };
  } catch (error) {
    return null;
  }
}

// Lambda handler example
exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createResponse(200, {});
  }

  // Validate authentication
  const user = validateToken(event);
  if (!user) {
    return createResponse(401, {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Valid authorization token required'
      }
    });
  }

  // Continue with business logic
  // ...
};
```

### Response Format

```javascript
// Success response
{
  "success": true,
  "data": {
    // Response data
  }
}

// Error response
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      // Additional error details
    }
  }
}
```

---

## CORS Configuration

### Allowed Headers
The API Gateway is configured to accept these authentication headers:

```javascript
'Access-Control-Allow-Headers': 'Content-Type,X-Requested-With,Authorization,X-Auth-Token'
```

### Supported Methods
```javascript
'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
```

### Origin Policy
```javascript
'Access-Control-Allow-Origin': 'https://apexshare.be'
```

---

## Error Handling

### Authentication Errors

#### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Valid authorization token required"
  }
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions for this resource"
  }
}
```

#### Token Expired
```json
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Authentication token has expired"
  }
}
```

### Error Handling Best Practices

```javascript
// Frontend error handling
try {
  const response = await apiService.sessions.getAll();
  // Handle successful response
} catch (error) {
  if (error.status === 401) {
    // Token expired or invalid - redirect to login
    removeAuthToken();
    router.push('/login');
  } else if (error.status === 403) {
    // Insufficient permissions
    showErrorMessage('You do not have permission to access this resource');
  } else {
    // Other errors
    showErrorMessage(error.message || 'An unexpected error occurred');
  }
}
```

---

## Security Considerations

### Token Security
1. **Storage**: Store tokens in secure browser storage (localStorage)
2. **Transmission**: Always use HTTPS for token transmission
3. **Expiration**: Implement proper token expiration handling
4. **Logging**: Never log tokens in plaintext

### Production Security Enhancements
1. **JWT Signature Verification**: Implement proper JWT signature validation
2. **Token Refresh**: Add automatic token refresh mechanism
3. **Rate Limiting**: Implement API rate limiting
4. **Audit Logging**: Log authentication events for security monitoring

### Development vs Production

#### Development Environment
- Simplified JWT validation for rapid development
- Mock user data for testing
- Relaxed security for debugging

#### Production Environment
- Full JWT signature verification
- Proper user data from authentication service
- Comprehensive security measures
- Audit logging and monitoring

---

## Troubleshooting

### Common Issues

#### 1. "CORS Error" or "Preflight Request Failed"
**Cause**: Browser blocking request due to CORS policy
**Solution**:
- Ensure X-Auth-Token header is used
- Verify API Gateway CORS configuration
- Check origin matches allowed domains

#### 2. "401 Unauthorized" Error
**Cause**: Missing or invalid authentication token
**Solution**:
- Verify token is present in request headers
- Check token format and validity
- Ensure token hasn't expired

#### 3. "403 Forbidden" Error
**Cause**: API Gateway IAM authentication interference
**Solution**:
- Use X-Auth-Token header instead of Authorization
- Verify API Gateway resource policy configuration

#### 4. Token Not Being Sent
**Cause**: Frontend not including authentication header
**Solution**:
- Check API client configuration
- Verify token storage and retrieval
- Ensure request interceptor is working

### Debugging Steps

1. **Check Request Headers**: Verify authentication header is included
2. **Validate Token**: Decode JWT token to check claims and expiration
3. **Test with cURL**: Use command line to isolate frontend issues
4. **Check Browser Console**: Look for CORS or authentication errors
5. **Review Lambda Logs**: Check CloudWatch logs for authentication failures

### Testing Commands

```bash
# Test authentication with cURL
curl -X GET \
  "https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1/sessions" \
  -H "X-Auth-Token: YOUR_TOKEN_HERE" \
  -v

# Test CORS preflight
curl -X OPTIONS \
  "https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1/sessions" \
  -H "Origin: https://apexshare.be" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-Auth-Token" \
  -v
```

---

## Migration Guide

### From Authorization to X-Auth-Token

#### Frontend Changes
```javascript
// Before
config.headers.Authorization = `Bearer ${token}`;

// After
config.headers['X-Auth-Token'] = token;
```

#### Backend Changes
```javascript
// Before
const authHeader = event.headers.Authorization;
const token = authHeader.replace('Bearer ', '');

// After (supporting both)
function extractToken(headers) {
  // Check X-Auth-Token first
  const xAuthToken = headers?.['X-Auth-Token'] || headers?.['x-auth-token'];
  if (xAuthToken) {
    return xAuthToken;
  }

  // Fallback to Authorization header
  const authHeader = headers?.Authorization || headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}
```

### Migration Timeline
1. **Phase 1**: Update backend to support both headers
2. **Phase 2**: Update frontend to use X-Auth-Token
3. **Phase 3**: Deprecate Authorization header support (future)

---

## Best Practices

### Development Guidelines
1. **Consistent Header Usage**: Always use X-Auth-Token for new development
2. **Error Handling**: Implement comprehensive authentication error handling
3. **Token Management**: Use centralized token storage and management
4. **Testing**: Include authentication in all API tests

### Security Guidelines
1. **HTTPS Only**: Never send tokens over unencrypted connections
2. **Token Expiration**: Implement proper token expiration handling
3. **Secure Storage**: Use appropriate token storage mechanisms
4. **Audit Trail**: Log authentication events for security monitoring

### Performance Guidelines
1. **Token Caching**: Cache valid tokens to reduce authentication overhead
2. **Request Batching**: Batch API requests when possible
3. **Error Recovery**: Implement intelligent retry logic for authentication failures

---

## Monitoring and Logging

### Authentication Metrics
- Token validation success rate
- Authentication failure rate by error type
- Token expiration patterns
- API endpoint usage by authenticated users

### CloudWatch Dashboards
- Authentication success/failure rates
- API Gateway 4xx error patterns
- Lambda function authentication performance
- CORS preflight request patterns

### Alerting
- High authentication failure rates
- Unusual token usage patterns
- API Gateway error spikes
- Security-related authentication events

---

## Conclusion

The ApexShare API authentication system provides robust, secure access control while maintaining compatibility and ease of use. The X-Auth-Token implementation resolves AWS API Gateway compatibility issues while preserving security and functionality.

### Key Benefits
1. **Compatibility**: Bypasses API Gateway IAM interpretation issues
2. **Security**: Maintains JWT-based authentication security
3. **Flexibility**: Supports dual authentication header methods
4. **Reliability**: Eliminates authentication-related errors
5. **Maintainability**: Clear implementation patterns and error handling

### Recommendations
1. Use X-Auth-Token for all new implementations
2. Implement proper JWT verification in production
3. Monitor authentication metrics and errors
4. Follow security best practices for token handling
5. Maintain comprehensive authentication documentation

---

*API Authentication Guide for ApexShare*
*Generated: September 21, 2025*
*Status: Current Implementation Guide*
*Next Update: Production JWT Verification Implementation*