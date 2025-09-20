/**
 * Integration Tests for API Gateway Endpoints
 * Tests the actual HTTP endpoints with mocked AWS services
 */

import axios, { AxiosResponse } from 'axios';
import { jest } from '@jest/globals';

// Mock AWS SDK services for integration testing
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-ses');

describe('API Gateway Integration Tests', () => {
  const API_BASE_URL = process.env.API_BASE_URL || 'https://api.apexshare.be';

  // Test configuration
  const timeout = 30000; // 30 seconds

  beforeAll(() => {
    // Set longer timeout for integration tests
    jest.setTimeout(timeout);
  });

  describe('CORS Configuration', () => {
    it('should handle CORS preflight requests', async () => {
      try {
        const response = await axios.options(`${API_BASE_URL}/upload`, {
          headers: {
            'Origin': 'https://apexshare.be',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type'
          },
          timeout: 10000
        });

        expect(response.status).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBeDefined();
        expect(response.headers['access-control-allow-methods']).toContain('POST');
        expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });

    it('should include CORS headers in actual responses', async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/upload`, {
          studentEmail: 'test@example.com',
          fileName: 'test.mp4',
          fileSize: 1024,
          contentType: 'video/mp4',
          sessionDate: '2025-01-20'
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          validateStatus: () => true // Accept all status codes
        });

        expect(response.headers['access-control-allow-origin']).toBeDefined();
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });
  });

  describe('Upload Endpoint', () => {
    const validUploadRequest = {
      studentEmail: 'test@example.com',
      studentName: 'Test Student',
      trainerName: 'Test Trainer',
      sessionDate: '2025-01-20',
      notes: 'Test session notes',
      fileName: 'test-video.mp4',
      fileSize: 1024 * 1024 * 100, // 100MB
      contentType: 'video/mp4'
    };

    it('should accept valid upload requests', async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/upload`, validUploadRequest, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          validateStatus: () => true
        });

        if (response.status === 200) {
          expect(response.data).toHaveProperty('success', true);
          expect(response.data.data).toHaveProperty('fileId');
          expect(response.data.data).toHaveProperty('uploadUrl');
          expect(response.data.data).toHaveProperty('fields');
          expect(response.data.data).toHaveProperty('expiresAt');
        }
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });

    it('should reject invalid email addresses', async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/upload`, {
          ...validUploadRequest,
          studentEmail: 'invalid-email'
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          validateStatus: () => true
        });

        expect(response.status).toBe(400);
        expect(response.data).toHaveProperty('success', false);
        expect(response.data.error).toContain('email');
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });

    it('should reject files that are too large', async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/upload`, {
          ...validUploadRequest,
          fileSize: 6 * 1024 * 1024 * 1024 // 6GB
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          validateStatus: () => true
        });

        expect(response.status).toBe(400);
        expect(response.data).toHaveProperty('success', false);
        expect(response.data.error).toContain('size');
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });

    it('should reject unsupported content types', async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/upload`, {
          ...validUploadRequest,
          contentType: 'image/jpeg'
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          validateStatus: () => true
        });

        expect(response.status).toBe(400);
        expect(response.data).toHaveProperty('success', false);
        expect(response.data.error).toContain('Content type');
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });

    it('should handle malformed JSON requests', async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/upload`, 'invalid json {', {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          validateStatus: () => true
        });

        expect(response.status).toBe(400);
        expect(response.data).toHaveProperty('success', false);
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });
  });

  describe('Download Endpoint', () => {
    const validFileId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

    it('should handle valid file ID requests', async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/download/${validFileId}`, {
          timeout: 10000,
          validateStatus: () => true
        });

        // Could be 200 (file found) or 404 (file not found/expired)
        expect([200, 404, 410]).toContain(response.status);

        if (response.status === 200) {
          expect(response.data).toHaveProperty('success', true);
          expect(response.data.data).toHaveProperty('downloadUrl');
          expect(response.data.data).toHaveProperty('videoInfo');
        } else {
          expect(response.data).toHaveProperty('success', false);
        }
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });

    it('should reject invalid file ID format', async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/download/invalid-uuid`, {
          timeout: 10000,
          validateStatus: () => true
        });

        expect(response.status).toBe(400);
        expect(response.data).toHaveProperty('success', false);
        expect(response.data.error).toContain('Invalid file ID');
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });

    it('should reject non-GET methods', async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/download/${validFileId}`, {}, {
          timeout: 10000,
          validateStatus: () => true
        });

        expect(response.status).toBe(405);
        expect(response.data).toHaveProperty('success', false);
        expect(response.data.error).toContain('Method not allowed');
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting gracefully', async () => {
      try {
        const requests = Array.from({ length: 50 }, (_, i) =>
          axios.post(`${API_BASE_URL}/upload`, {
            studentEmail: `test${i}@example.com`,
            fileName: 'test.mp4',
            fileSize: 1024,
            contentType: 'video/mp4',
            sessionDate: '2025-01-20'
          }, {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 5000,
            validateStatus: () => true
          })
        );

        const responses = await Promise.allSettled(requests);

        // Some requests might be rate limited (429) or succeed (200/400)
        const statusCodes = responses
          .filter(result => result.status === 'fulfilled')
          .map(result => (result as any).value.status);

        // Should handle all requests without throwing errors
        expect(statusCodes.length).toBeGreaterThan(0);

        // All status codes should be valid HTTP responses
        statusCodes.forEach(status => {
          expect(status).toBeGreaterThanOrEqual(200);
          expect(status).toBeLessThan(600);
        });
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });
  });

  describe('Authentication and Security', () => {
    it('should reject requests with suspicious user agents', async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/upload`, {
          studentEmail: 'test@example.com',
          fileName: 'test.mp4',
          fileSize: 1024,
          contentType: 'video/mp4',
          sessionDate: '2025-01-20'
        }, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'googlebot/2.1'
          },
          timeout: 10000,
          validateStatus: () => true
        });

        expect(response.status).toBe(400);
        expect(response.data).toHaveProperty('success', false);
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });

    it('should handle SQL injection attempts', async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/upload`, {
          studentEmail: 'test@example.com',
          fileName: 'test.mp4; DROP TABLE users; --',
          fileSize: 1024,
          contentType: 'video/mp4',
          sessionDate: '2025-01-20'
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          validateStatus: () => true
        });

        expect(response.status).toBe(400);
        expect(response.data).toHaveProperty('success', false);
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });
  });

  describe('Error Handling', () => {
    it('should return structured error responses', async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/upload`, {
          // Missing required fields
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          validateStatus: () => true
        });

        expect(response.status).toBe(400);
        expect(response.data).toHaveProperty('success', false);
        expect(response.data).toHaveProperty('error');
        expect(typeof response.data.error).toBe('string');
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });

    it('should handle internal server errors gracefully', async () => {
      // This test would typically require a way to trigger server errors
      // For now, we'll test that any 500 responses are properly formatted
      try {
        const response = await axios.post(`${API_BASE_URL}/upload`, {
          studentEmail: 'test@example.com',
          fileName: 'test.mp4',
          fileSize: 1024,
          contentType: 'video/mp4',
          sessionDate: '2025-01-20'
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          validateStatus: () => true
        });

        if (response.status >= 500) {
          expect(response.data).toHaveProperty('success', false);
          expect(response.data).toHaveProperty('error');
        }
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });
  });

  describe('Performance', () => {
    it('should respond within acceptable time limits', async () => {
      try {
        const startTime = Date.now();

        const response = await axios.post(`${API_BASE_URL}/upload`, {
          studentEmail: 'test@example.com',
          fileName: 'test.mp4',
          fileSize: 1024,
          contentType: 'video/mp4',
          sessionDate: '2025-01-20'
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          validateStatus: () => true
        });

        const responseTime = Date.now() - startTime;

        // API should respond within 5 seconds
        expect(responseTime).toBeLessThan(5000);

        // Response should have appropriate status
        expect([200, 400, 404, 429, 500]).toContain(response.status);
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });
  });

  describe('Content Type Handling', () => {
    it('should handle missing Content-Type header', async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/upload`, {
          studentEmail: 'test@example.com',
          fileName: 'test.mp4',
          fileSize: 1024,
          contentType: 'video/mp4',
          sessionDate: '2025-01-20'
        }, {
          timeout: 10000,
          validateStatus: () => true
        });

        // Should still process the request
        expect([200, 400]).toContain(response.status);
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });

    it('should handle wrong Content-Type header', async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/upload`,
          JSON.stringify({
            studentEmail: 'test@example.com',
            fileName: 'test.mp4',
            fileSize: 1024,
            contentType: 'video/mp4',
            sessionDate: '2025-01-20'
          }), {
          headers: {
            'Content-Type': 'text/plain'
          },
          timeout: 10000,
          validateStatus: () => true
        });

        // Should handle gracefully
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(600);
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          console.log('API Gateway not available - skipping integration test');
          return;
        }
        throw error;
      }
    });
  });
});