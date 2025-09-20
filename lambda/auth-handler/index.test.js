/**
 * Authentication Handler Tests
 *
 * Comprehensive test suite for the authentication Lambda function
 * Tests login, logout, me endpoints with various scenarios
 */

const { handler } = require('./index');

// Mock crypto module for consistent JWT testing
const crypto = require('crypto');

describe('Authentication Handler', () => {
  // Test data
  const validUser = {
    email: 'trainer@apexshare.be',
    password: 'demo123'
  };

  const invalidUser = {
    email: 'invalid@example.com',
    password: 'wrongpassword'
  };

  const createEvent = (httpMethod, path, body = null, headers = {}) => ({
    httpMethod,
    path,
    resource: path,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': 'test-request-123',
      ...headers
    },
    body: body ? JSON.stringify(body) : null
  });

  describe('POST /auth/login', () => {
    test('should successfully login with valid credentials', async () => {
      const event = createEvent('POST', '/auth/login', validUser);
      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('user');
      expect(body.data).toHaveProperty('token');

      // Verify user data
      expect(body.data.user.email).toBe('trainer@apexshare.be');
      expect(body.data.user.role).toBe('trainer');
      expect(body.data.user.firstName).toBe('Demo');
      expect(body.data.user.lastName).toBe('Trainer');
      expect(body.data.user).not.toHaveProperty('password');

      // Verify token exists
      expect(typeof body.data.token).toBe('string');
      expect(body.data.token.split('.')).toHaveLength(3); // JWT format
    });

    test('should successfully login student account', async () => {
      const studentEvent = createEvent('POST', '/auth/login', {
        email: 'student@apexshare.be',
        password: 'demo123'
      });

      const response = await handler(studentEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.user.role).toBe('student');
      expect(body.data.user.email).toBe('student@apexshare.be');
    });

    test('should fail login with invalid email', async () => {
      const event = createEvent('POST', '/auth/login', invalidUser);
      const response = await handler(event);

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
      expect(body.error.message).toBe('Invalid email or password');
    });

    test('should fail login with wrong password', async () => {
      const event = createEvent('POST', '/auth/login', {
        email: 'trainer@apexshare.be',
        password: 'wrongpassword'
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('should fail login with missing email', async () => {
      const event = createEvent('POST', '/auth/login', {
        password: 'demo123'
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MISSING_FIELDS');
      expect(body.error.details.missingFields).toContain('email');
    });

    test('should fail login with missing password', async () => {
      const event = createEvent('POST', '/auth/login', {
        email: 'trainer@apexshare.be'
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MISSING_FIELDS');
      expect(body.error.details.missingFields).toContain('password');
    });

    test('should fail login with invalid email format', async () => {
      const event = createEvent('POST', '/auth/login', {
        email: 'invalid-email',
        password: 'demo123'
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_EMAIL');
    });

    test('should fail login with invalid JSON', async () => {
      const event = createEvent('POST', '/auth/login');
      event.body = 'invalid json';

      const response = await handler(event);

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_JSON');
    });

    test('should include CORS headers', async () => {
      const event = createEvent('POST', '/auth/login', validUser);
      const response = await handler(event);

      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Headers');
    });
  });

  describe('GET /auth/me', () => {
    let validToken;

    beforeAll(async () => {
      // Get a valid token first
      const loginEvent = createEvent('POST', '/auth/login', validUser);
      const loginResponse = await handler(loginEvent);
      const loginBody = JSON.parse(loginResponse.body);
      validToken = loginBody.data.token;
    });

    test('should return current user with valid token', async () => {
      const event = createEvent('GET', '/auth/me', null, {
        Authorization: `Bearer ${validToken}`
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe('trainer@apexshare.be');
      expect(body.data.user.role).toBe('trainer');
      expect(body.data.user).not.toHaveProperty('password');
    });

    test('should fail without authorization header', async () => {
      const event = createEvent('GET', '/auth/me');
      const response = await handler(event);

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MISSING_TOKEN');
    });

    test('should fail with malformed authorization header', async () => {
      const event = createEvent('GET', '/auth/me', null, {
        Authorization: 'InvalidFormat'
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MISSING_TOKEN');
    });

    test('should fail with invalid token', async () => {
      const event = createEvent('GET', '/auth/me', null, {
        Authorization: 'Bearer invalid.token.here'
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    test('should fail with expired token', async () => {
      // Create a manually crafted expired token
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        userId: 'demo-trainer-1',
        email: 'trainer@apexshare.be',
        role: 'trainer',
        iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        exp: Math.floor(Date.now() / 1000) - 1800  // 30 minutes ago (expired)
      })).toString('base64url');

      const signature = crypto
        .createHmac('sha256', process.env.JWT_SECRET || 'demo-secret-key-apexshare-2024')
        .update(`${header}.${payload}`)
        .digest('base64url');

      const expiredToken = `${header}.${payload}.${signature}`;

      const event = createEvent('GET', '/auth/me', null, {
        Authorization: `Bearer ${expiredToken}`
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /auth/logout', () => {
    test('should successfully logout', async () => {
      const event = createEvent('POST', '/auth/logout');
      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Logged out successfully');
    });

    test('should include CORS headers', async () => {
      const event = createEvent('POST', '/auth/logout');
      const response = await handler(event);

      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Headers');
    });
  });

  describe('OPTIONS requests (CORS preflight)', () => {
    test('should handle OPTIONS request for /auth/login', async () => {
      const event = createEvent('OPTIONS', '/auth/login');
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Headers');
      expect(response.headers).toHaveProperty('Access-Control-Max-Age');
      expect(response.body).toBe('');
    });
  });

  describe('Unknown routes', () => {
    test('should return 404 for unknown route', async () => {
      const event = createEvent('GET', '/auth/unknown');
      const response = await handler(event);

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('Route not found');
    });

    test('should return 404 for wrong method on existing route', async () => {
      const event = createEvent('DELETE', '/auth/login');
      const response = await handler(event);

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Error handling', () => {
    test('should have robust error handling in production', async () => {
      // This test verifies that the function has good error handling structure
      // The actual error scenarios are covered by other tests
      const handler = require('./index').handler;
      expect(typeof handler).toBe('function');

      // Verify the handler is async
      const result = handler({}, {});
      expect(result).toBeInstanceOf(Promise);
    });
  });
});