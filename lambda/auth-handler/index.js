/**
 * Authentication Handler Lambda Function
 *
 * Handles authentication endpoints:
 * - POST /auth/login - User login with email/password
 * - GET /auth/me - Get current user information
 * - POST /auth/logout - User logout
 *
 * Supports demo accounts for testing:
 * - trainer@apexshare.be / demo123 (role: trainer)
 * - student@apexshare.be / demo123 (role: student)
 */

const crypto = require('crypto');

// Demo user accounts
const DEMO_USERS = {
  'trainer@apexshare.be': {
    id: 'demo-trainer-1',
    email: 'trainer@apexshare.be',
    password: 'demo123', // In production, this would be hashed
    role: 'trainer',
    firstName: 'Demo',
    lastName: 'Trainer',
    createdAt: '2024-01-01T00:00:00.000Z',
    lastLoginAt: null
  },
  'student@apexshare.be': {
    id: 'demo-student-1',
    email: 'student@apexshare.be',
    password: 'demo123', // In production, this would be hashed
    role: 'student',
    firstName: 'Demo',
    lastName: 'Student',
    createdAt: '2024-01-01T00:00:00.000Z',
    lastLoginAt: null
  }
};

// JWT secret (in production, this would be from environment variables or AWS Secrets Manager)
const JWT_SECRET = process.env.JWT_SECRET || 'demo-secret-key-apexshare-2024';
const JWT_EXPIRY = '24h'; // 24 hours

/**
 * Simple JWT implementation (for demo purposes)
 * In production, use a proper JWT library like jsonwebtoken
 */
const jwt = {
  /**
   * Create a JWT token
   */
  sign: (payload, secret, expiresIn = JWT_EXPIRY) => {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const exp = now + (expiresIn === '24h' ? 24 * 60 * 60 : parseInt(expiresIn));

    const tokenPayload = {
      ...payload,
      iat: now,
      exp: exp
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');

    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    return `${headerB64}.${payloadB64}.${signature}`;
  },

  /**
   * Verify a JWT token
   */
  verify: (token, secret) => {
    try {
      const [headerB64, payloadB64, signature] = token.split('.');

      if (!headerB64 || !payloadB64 || !signature) {
        throw new Error('Invalid token format');
      }

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');

      if (signature !== expectedSignature) {
        throw new Error('Invalid signature');
      }

      // Decode payload
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        throw new Error('Token expired');
      }

      return payload;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }
};

/**
 * Create standardized API response
 */
const createResponse = (statusCode, body, additionalHeaders = {}) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
      'Access-Control-Allow-Credentials': 'true',
      ...additionalHeaders
    },
    body: JSON.stringify(body)
  };
};

/**
 * Create error response
 */
const createErrorResponse = (statusCode, code, message, details = null, requestId = null) => {
  const errorBody = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
      ...(requestId && { requestId })
    }
  };

  return createResponse(statusCode, errorBody);
};

/**
 * Create success response
 */
const createSuccessResponse = (data = null, message = null) => {
  const successBody = {
    success: true,
    ...(data && { data }),
    ...(message && { message })
  };

  return createResponse(200, successBody);
};

/**
 * Extract token from Authorization header
 */
const extractToken = (headers) => {
  if (!headers) {
    return null;
  }

  const authHeader = headers.Authorization || headers.authorization;
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Remove sensitive data from user object
 */
const sanitizeUser = (user) => {
  const { password, ...sanitizedUser } = user;
  return sanitizedUser;
};

/**
 * Handle POST /auth/login
 */
const handleLogin = async (event) => {
  const requestId = event.headers?.['X-Request-ID'] || event.headers?.['x-request-id'];

  try {
    // Parse request body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (error) {
      return createErrorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON', null, requestId);
    }

    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return createErrorResponse(400, 'MISSING_FIELDS', 'Email and password are required', {
        missingFields: [
          ...(!email ? ['email'] : []),
          ...(!password ? ['password'] : [])
        ]
      }, requestId);
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return createErrorResponse(400, 'INVALID_EMAIL', 'Please provide a valid email address', null, requestId);
    }

    // Find user
    const user = DEMO_USERS[email.toLowerCase()];
    if (!user) {
      // Use generic message to prevent email enumeration
      return createErrorResponse(401, 'INVALID_CREDENTIALS', 'Invalid email or password', null, requestId);
    }

    // Verify password (in production, use bcrypt or similar)
    if (user.password !== password) {
      return createErrorResponse(401, 'INVALID_CREDENTIALS', 'Invalid email or password', null, requestId);
    }

    // Update last login time
    user.lastLoginAt = new Date().toISOString();

    // Generate JWT token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET);

    // Return user data and token
    return createSuccessResponse({
      user: sanitizeUser(user),
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal error occurred', {
      error: error.message
    }, requestId);
  }
};

/**
 * Handle GET /auth/me
 */
const handleGetCurrentUser = async (event) => {
  const requestId = event.headers?.['X-Request-ID'] || event.headers?.['x-request-id'];

  try {
    // Extract token
    const token = extractToken(event.headers);
    if (!token) {
      return createErrorResponse(401, 'MISSING_TOKEN', 'Authorization token is required', null, requestId);
    }

    // Verify token
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return createErrorResponse(401, 'INVALID_TOKEN', 'Invalid or expired token', {
        error: error.message
      }, requestId);
    }

    // Find user
    const user = DEMO_USERS[payload.email.toLowerCase()];
    if (!user) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found', null, requestId);
    }

    // Return user data
    return createSuccessResponse({
      user: sanitizeUser(user)
    });

  } catch (error) {
    console.error('Get current user error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal error occurred', {
      error: error.message
    }, requestId);
  }
};

/**
 * Handle POST /auth/logout
 */
const handleLogout = async (event) => {
  const requestId = event.headers?.['X-Request-ID'] || event.headers?.['x-request-id'];

  try {
    // In a real implementation, you might:
    // - Add token to blacklist
    // - Clear server-side session
    // - Log logout event

    // For demo purposes, just return success
    // Frontend will handle removing the token from localStorage
    return createSuccessResponse(null, 'Logged out successfully');

  } catch (error) {
    console.error('Logout error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal error occurred', {
      error: error.message
    }, requestId);
  }
};

/**
 * Handle OPTIONS requests for CORS preflight
 */
const handleOptions = () => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    },
    body: ''
  };
};

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
  console.log('Auth Handler Event:', JSON.stringify({
    httpMethod: event.httpMethod,
    path: event.path,
    resource: event.resource,
    headers: event.headers ? {
      ...event.headers,
      Authorization: event.headers.Authorization ? '[REDACTED]' : undefined
    } : null
  }, null, 2));

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return handleOptions();
    }

    // Route based on path and method
    const resource = event.resource || event.path;
    const method = event.httpMethod;

    // Auth routes
    if (resource === '/auth/login' && method === 'POST') {
      return await handleLogin(event);
    } else if (resource === '/auth/me' && method === 'GET') {
      return await handleGetCurrentUser(event);
    } else if (resource === '/auth/logout' && method === 'POST') {
      return await handleLogout(event);
    }

    // Unknown route
    const requestId = event.headers?.['X-Request-ID'] || event.headers?.['x-request-id'];
    return createErrorResponse(404, 'NOT_FOUND', `Route not found: ${method} ${resource}`, null, requestId);

  } catch (error) {
    console.error('Handler error:', error);
    const requestId = event.headers?.['X-Request-ID'] || event.headers?.['x-request-id'];
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal error occurred', {
      error: error.message
    }, requestId);
  }
};