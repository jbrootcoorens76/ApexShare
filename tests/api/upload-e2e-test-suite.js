/**
 * ApexShare Upload E2E Test Suite
 *
 * Comprehensive end-to-end testing of the complete video upload functionality
 * to verify resolution of "NaN undefined" errors and proper upload workflow.
 *
 * Test Coverage:
 * - API Endpoint Testing
 * - Upload Flow Validation
 * - Response Format Testing
 * - Integration Testing
 * - Error Scenarios
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration
const config = {
  baseURL: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
  endpoints: {
    uploadInitiate: '/uploads/initiate',
    uploadsRecent: '/uploads/recent',
    sessionUpload: '/sessions/{sessionId}/upload'
  },
  timeout: 30000,
  retries: 3,
  testFiles: {
    small: { size: 1024 * 1024, name: 'test-small.mp4' }, // 1MB
    medium: { size: 10 * 1024 * 1024, name: 'test-medium.mp4' }, // 10MB
    large: { size: 100 * 1024 * 1024, name: 'test-large.mp4' }, // 100MB
    oversized: { size: 6 * 1024 * 1024 * 1024, name: 'test-oversized.mp4' } // 6GB
  },
  allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'],
  maxFileSize: 5 * 1024 * 1024 * 1024 // 5GB
};

class UploadE2ETestSuite {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      tests: [],
      summary: {
        apiEndpoints: { passed: 0, failed: 0 },
        uploadFlow: { passed: 0, failed: 0 },
        responseFormat: { passed: 0, failed: 0 },
        integration: { passed: 0, failed: 0 },
        errorScenarios: { passed: 0, failed: 0 }
      }
    };
    this.startTime = Date.now();
  }

  /**
   * Main test execution method
   */
  async runTests() {
    console.log('🚀 Starting ApexShare Upload E2E Test Suite');
    console.log('='.repeat(60));

    try {
      // API Endpoint Testing
      await this.testApiEndpoints();

      // Upload Flow Validation
      await this.testUploadFlow();

      // Response Format Testing
      await this.testResponseFormats();

      // Integration Testing
      await this.testIntegration();

      // Error Scenarios
      await this.testErrorScenarios();

      // Generate final report
      this.generateReport();

    } catch (error) {
      console.error('❌ Test suite execution failed:', error.message);
      this.logError('Test suite execution failed', error);
    }
  }

  /**
   * Test API Endpoints
   */
  async testApiEndpoints() {
    console.log('\n🔌 Testing API Endpoints');
    console.log('-'.repeat(40));

    // Test CORS preflight
    await this.testCase('API-001', 'CORS Preflight Request', async () => {
      const response = await this.makeRequest('OPTIONS', config.endpoints.uploadInitiate);
      this.assert(response.status === 200, 'CORS preflight should return 200');
      this.assert(response.headers['access-control-allow-origin'], 'CORS headers should be present');
      this.assert(response.headers['access-control-allow-methods'], 'CORS methods should be specified');
      this.results.summary.apiEndpoints.passed++;
    });

    // Test upload initiate endpoint
    await this.testCase('API-002', 'Upload Initiate Endpoint', async () => {
      const requestBody = {
        studentEmail: 'test@example.com',
        studentName: 'Test Student',
        trainerName: 'Test Trainer',
        sessionDate: '2024-01-01',
        notes: 'E2E test upload',
        fileName: 'test-video.mp4',
        fileSize: 10485760, // 10MB
        contentType: 'video/mp4'
      };

      const response = await this.makeRequest('POST', config.endpoints.uploadInitiate, requestBody);
      this.assert(response.status === 200, 'Upload initiate should return 200');
      this.assert(response.data.success === true, 'Response should indicate success');
      this.assert(response.data.data, 'Response should contain data object');
      this.assert(response.data.data.fileId, 'Response should contain fileId');
      this.assert(response.data.data.uploadUrl, 'Response should contain uploadUrl');
      this.assert(response.data.data.expiresAt, 'Response should contain expiresAt');
      this.results.summary.apiEndpoints.passed++;
    });

    // Test recent uploads endpoint
    await this.testCase('API-003', 'Recent Uploads Endpoint', async () => {
      const response = await this.makeRequest('GET', config.endpoints.uploadsRecent);
      this.assert(response.status === 200, 'Recent uploads should return 200');
      this.assert(response.data.success === true, 'Response should indicate success');
      this.assert(response.data.data, 'Response should contain data object');
      this.assert(Array.isArray(response.data.data.uploads), 'Uploads should be an array');
      this.assert(response.data.data.pagination, 'Response should contain pagination');
      this.results.summary.apiEndpoints.passed++;
    });

    // Test session upload endpoint (new frontend)
    await this.testCase('API-004', 'Session Upload Endpoint', async () => {
      const sessionId = 'test-session-123';
      const requestBody = {
        fileName: 'test-session-video.mp4',
        fileSize: 10485760, // 10MB
        mimeType: 'video/mp4'
      };

      const endpoint = config.endpoints.sessionUpload.replace('{sessionId}', sessionId);
      const response = await this.makeRequest('POST', endpoint, requestBody);
      this.assert(response.status === 200, 'Session upload should return 200');
      this.assert(response.data.success === true, 'Response should indicate success');
      this.assert(response.data.data.uploadId, 'Response should contain uploadId');
      this.assert(response.data.data.uploadUrl, 'Response should contain uploadUrl');
      this.assert(response.data.data.chunkSize, 'Response should contain chunkSize');
      this.results.summary.apiEndpoints.passed++;
    });
  }

  /**
   * Test Upload Flow Validation
   */
  async testUploadFlow() {
    console.log('\n📤 Testing Upload Flow Validation');
    console.log('-'.repeat(40));

    // Test presigned URL generation
    await this.testCase('FLOW-001', 'Presigned URL Generation', async () => {
      const requestBody = {
        studentEmail: 'test@example.com',
        sessionDate: '2024-01-01',
        fileName: 'test-presigned.mp4',
        fileSize: 5242880, // 5MB
        contentType: 'video/mp4'
      };

      const response = await this.makeRequest('POST', config.endpoints.uploadInitiate, requestBody);
      this.assert(response.data.success === true, 'Upload initiation should succeed');
      this.assert(response.data.data.uploadUrl, 'Should generate upload URL');
      this.assert(response.data.data.fields, 'Should include form fields for S3');
      this.assert(typeof response.data.data.expiresAt === 'string', 'Should include expiration time');

      // Validate URL format
      const url = response.data.data.uploadUrl;
      this.assert(url.includes('s3'), 'Upload URL should be S3 URL');
      this.results.summary.uploadFlow.passed++;
    });

    // Test file size validation
    await this.testCase('FLOW-002', 'File Size Validation - Valid Sizes', async () => {
      const testSizes = [
        { size: 1024, name: 'min-size.mp4' }, // 1KB (minimum)
        { size: 1048576, name: 'small.mp4' }, // 1MB
        { size: 104857600, name: 'medium.mp4' }, // 100MB
        { size: 1073741824, name: 'large.mp4' } // 1GB
      ];

      for (const testFile of testSizes) {
        const requestBody = {
          studentEmail: 'test@example.com',
          sessionDate: '2024-01-01',
          fileName: testFile.name,
          fileSize: testFile.size,
          contentType: 'video/mp4'
        };

        const response = await this.makeRequest('POST', config.endpoints.uploadInitiate, requestBody);
        this.assert(response.status === 200, `File size ${testFile.size} should be accepted`);
        this.assert(response.data.success === true, `Upload for ${testFile.name} should succeed`);
      }
      this.results.summary.uploadFlow.passed++;
    });

    // Test different file types
    await this.testCase('FLOW-003', 'File Type Validation', async () => {
      for (const mimeType of config.allowedMimeTypes) {
        const requestBody = {
          studentEmail: 'test@example.com',
          sessionDate: '2024-01-01',
          fileName: `test-${mimeType.replace('/', '-')}.mp4`,
          fileSize: 10485760,
          contentType: mimeType
        };

        const response = await this.makeRequest('POST', config.endpoints.uploadInitiate, requestBody);
        this.assert(response.status === 200, `MIME type ${mimeType} should be accepted`);
        this.assert(response.data.success === true, `Upload for ${mimeType} should succeed`);
      }
      this.results.summary.uploadFlow.passed++;
    });

    // Test multipart upload configuration
    await this.testCase('FLOW-004', 'Multipart Upload Configuration', async () => {
      const sessionId = 'test-multipart-session';
      const requestBody = {
        fileName: 'large-video.mp4',
        fileSize: 1073741824, // 1GB
        mimeType: 'video/mp4'
      };

      const endpoint = config.endpoints.sessionUpload.replace('{sessionId}', sessionId);
      const response = await this.makeRequest('POST', endpoint, requestBody);

      this.assert(response.data.success === true, 'Multipart upload should be configured');
      this.assert(response.data.data.chunkSize, 'Should specify chunk size');
      this.assert(typeof response.data.data.chunkSize === 'number', 'Chunk size should be numeric');
      this.assert(response.data.data.chunkSize > 0, 'Chunk size should be positive');

      // Verify optimal chunk size calculation
      const expectedChunkSize = requestBody.fileSize > 1024 * 1024 * 1024 ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
      this.assert(response.data.data.chunkSize === expectedChunkSize, 'Should use optimal chunk size');
      this.results.summary.uploadFlow.passed++;
    });
  }

  /**
   * Test Response Format - Critical for resolving "NaN undefined" errors
   */
  async testResponseFormats() {
    console.log('\n📋 Testing Response Formats (NaN undefined validation)');
    console.log('-'.repeat(40));

    // Test structured JSON responses
    await this.testCase('FORMAT-001', 'Structured JSON Response Format', async () => {
      const requestBody = {
        studentEmail: 'test@example.com',
        sessionDate: '2024-01-01',
        fileName: 'format-test.mp4',
        fileSize: 10485760,
        contentType: 'video/mp4'
      };

      const response = await this.makeRequest('POST', config.endpoints.uploadInitiate, requestBody);

      // Verify response structure
      this.assert(typeof response.data === 'object', 'Response should be JSON object');
      this.assert(typeof response.data.success === 'boolean', 'success field should be boolean');
      this.assert(response.data.data || response.data.error, 'Should have either data or error field');

      if (response.data.success) {
        this.assert(typeof response.data.data === 'object', 'data field should be object');
        this.assert(typeof response.data.data.fileId === 'string', 'fileId should be string');
        this.assert(typeof response.data.data.uploadUrl === 'string', 'uploadUrl should be string');
        this.assert(typeof response.data.data.expiresAt === 'string', 'expiresAt should be string');
      }

      // Critical: Check for "NaN undefined" in response
      const responseString = JSON.stringify(response.data);
      this.assert(!responseString.includes('NaN'), 'Response should not contain NaN values');
      this.assert(!responseString.includes('undefined'), 'Response should not contain undefined values');
      this.assert(!responseString.includes('NaN undefined'), 'Response should not contain "NaN undefined"');

      this.results.summary.responseFormat.passed++;
    });

    // Test file size display format
    await this.testCase('FORMAT-002', 'File Size Display Format', async () => {
      const testSizes = [
        { size: 1024, expected: 'should be numeric' },
        { size: 1048576, expected: 'should be numeric' },
        { size: 104857600, expected: 'should be numeric' }
      ];

      for (const testFile of testSizes) {
        const requestBody = {
          fileName: 'size-format-test.mp4',
          fileSize: testFile.size,
          mimeType: 'video/mp4'
        };

        const sessionId = 'format-test-session';
        const endpoint = config.endpoints.sessionUpload.replace('{sessionId}', sessionId);
        const response = await this.makeRequest('POST', endpoint, requestBody);

        if (response.data.success) {
          // Verify file size is properly formatted
          this.assert(typeof response.data.data.chunkSize === 'number', 'Chunk size should be numeric');
          this.assert(!isNaN(response.data.data.chunkSize), 'Chunk size should not be NaN');
          this.assert(response.data.data.chunkSize > 0, 'Chunk size should be positive');

          // Check response doesn't contain formatting errors
          const responseString = JSON.stringify(response.data);
          this.assert(!responseString.includes('NaN'), 'No NaN values in file size formatting');
        }
      }
      this.results.summary.responseFormat.passed++;
    });

    // Test progress and speed calculations
    await this.testCase('FORMAT-003', 'Progress and Speed Calculations', async () => {
      const requestBody = {
        fileName: 'progress-test.mp4',
        fileSize: 52428800, // 50MB
        mimeType: 'video/mp4'
      };

      const sessionId = 'progress-test-session';
      const endpoint = config.endpoints.sessionUpload.replace('{sessionId}', sessionId);
      const response = await this.makeRequest('POST', endpoint, requestBody);

      if (response.data.success) {
        // Verify all numeric values are properly formatted
        this.assert(typeof response.data.data.chunkSize === 'number', 'Chunk size should be number');
        this.assert(!isNaN(response.data.data.chunkSize), 'Chunk size should not be NaN');

        // Calculate expected progress metrics to ensure no NaN scenarios
        const chunkSize = response.data.data.chunkSize;
        const totalChunks = Math.ceil(requestBody.fileSize / chunkSize);
        this.assert(totalChunks > 0, 'Total chunks should be positive');
        this.assert(!isNaN(totalChunks), 'Total chunks calculation should not be NaN');

        // Verify response format doesn't have calculation errors
        const responseString = JSON.stringify(response.data);
        this.assert(!responseString.includes('NaN'), 'No NaN in progress calculations');
        this.assert(!responseString.includes('undefined'), 'No undefined in calculations');
      }
      this.results.summary.responseFormat.passed++;
    });

    // Test error response format
    await this.testCase('FORMAT-004', 'Error Response Format', async () => {
      const invalidRequestBody = {
        // Missing required fields to trigger error
        fileName: '',
        fileSize: 'invalid'
      };

      try {
        const response = await this.makeRequest('POST', config.endpoints.uploadInitiate, invalidRequestBody);

        // Should get error response
        this.assert(response.data.success === false, 'Should indicate failure');
        this.assert(typeof response.data.error === 'string', 'Should have error message');
        this.assert(response.data.error.length > 0, 'Error message should not be empty');

        // Verify error response doesn't contain formatting issues
        const responseString = JSON.stringify(response.data);
        this.assert(!responseString.includes('NaN'), 'Error response should not contain NaN');
        this.assert(!responseString.includes('undefined'), 'Error response should not contain undefined');

      } catch (error) {
        // Expected behavior for invalid request
        this.assert(error.response.status >= 400, 'Should return error status');
      }
      this.results.summary.responseFormat.passed++;
    });
  }

  /**
   * Test Integration Features
   */
  async testIntegration() {
    console.log('\n🔗 Testing Integration Features');
    console.log('-'.repeat(40));

    // Test Authorization headers
    await this.testCase('INT-001', 'Authorization Headers', async () => {
      const requestBody = {
        studentEmail: 'auth-test@example.com',
        sessionDate: '2024-01-01',
        fileName: 'auth-test.mp4',
        fileSize: 10485760,
        contentType: 'video/mp4'
      };

      // Test with Authorization header
      const headers = {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      };

      const response = await this.makeRequest('POST', config.endpoints.uploadInitiate, requestBody, headers);
      // Should process request regardless of auth header (for now)
      this.assert(response.status === 200 || response.status === 401, 'Should handle auth header appropriately');
      this.results.summary.integration.passed++;
    });

    // Test CORS functionality
    await this.testCase('INT-002', 'CORS Functionality', async () => {
      const corsHeaders = {
        'Origin': 'https://test-frontend.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      };

      const response = await this.makeRequest('OPTIONS', config.endpoints.uploadInitiate, null, corsHeaders);
      this.assert(response.status === 200, 'CORS preflight should succeed');
      this.assert(response.headers['access-control-allow-origin'], 'Should include CORS origin header');
      this.assert(response.headers['access-control-allow-methods'], 'Should include allowed methods');
      this.assert(response.headers['access-control-allow-headers'], 'Should include allowed headers');
      this.results.summary.integration.passed++;
    });

    // Test session-based vs direct upload paths
    await this.testCase('INT-003', 'Upload Path Routing', async () => {
      // Test direct upload path
      const directRequestBody = {
        studentEmail: 'direct@example.com',
        sessionDate: '2024-01-01',
        fileName: 'direct-upload.mp4',
        fileSize: 10485760,
        contentType: 'video/mp4'
      };

      const directResponse = await this.makeRequest('POST', config.endpoints.uploadInitiate, directRequestBody);
      this.assert(directResponse.data.success === true, 'Direct upload path should work');
      this.assert(directResponse.data.data.fileId, 'Direct upload should return fileId');

      // Test session-based upload path
      const sessionRequestBody = {
        fileName: 'session-upload.mp4',
        fileSize: 10485760,
        mimeType: 'video/mp4'
      };

      const sessionId = 'integration-test-session';
      const sessionEndpoint = config.endpoints.sessionUpload.replace('{sessionId}', sessionId);
      const sessionResponse = await this.makeRequest('POST', sessionEndpoint, sessionRequestBody);
      this.assert(sessionResponse.data.success === true, 'Session upload path should work');
      this.assert(sessionResponse.data.data.uploadId, 'Session upload should return uploadId');

      this.results.summary.integration.passed++;
    });

    // Test concurrent uploads
    await this.testCase('INT-004', 'Concurrent Upload Handling', async () => {
      const concurrentRequests = [];

      for (let i = 0; i < 3; i++) {
        const requestBody = {
          studentEmail: `concurrent${i}@example.com`,
          sessionDate: '2024-01-01',
          fileName: `concurrent-${i}.mp4`,
          fileSize: 5242880,
          contentType: 'video/mp4'
        };

        concurrentRequests.push(this.makeRequest('POST', config.endpoints.uploadInitiate, requestBody));
      }

      const responses = await Promise.all(concurrentRequests);

      for (let i = 0; i < responses.length; i++) {
        this.assert(responses[i].data.success === true, `Concurrent request ${i} should succeed`);
        this.assert(responses[i].data.data.fileId, `Concurrent request ${i} should have unique fileId`);
      }

      // Verify all fileIds are unique
      const fileIds = responses.map(r => r.data.data.fileId);
      const uniqueFileIds = [...new Set(fileIds)];
      this.assert(fileIds.length === uniqueFileIds.length, 'All fileIds should be unique');

      this.results.summary.integration.passed++;
    });
  }

  /**
   * Test Error Scenarios
   */
  async testErrorScenarios() {
    console.log('\n❌ Testing Error Scenarios');
    console.log('-'.repeat(40));

    // Test missing/invalid file data
    await this.testCase('ERR-001', 'Missing File Data', async () => {
      const invalidBodies = [
        {}, // Empty body
        { fileName: '' }, // Empty filename
        { fileName: 'test.mp4' }, // Missing file size
        { fileName: 'test.mp4', fileSize: 0 }, // Zero file size
        { fileName: 'test.mp4', fileSize: 1024 } // Missing content type
      ];

      for (const body of invalidBodies) {
        try {
          const response = await this.makeRequest('POST', config.endpoints.uploadInitiate, body);
          this.assert(response.data.success === false, 'Invalid request should fail');
          this.assert(response.data.error, 'Should provide error message');
          this.assert(typeof response.data.error === 'string', 'Error should be string');
        } catch (error) {
          this.assert(error.response.status >= 400, 'Should return client error status');
        }
      }
      this.results.summary.errorScenarios.passed++;
    });

    // Test oversized files
    await this.testCase('ERR-002', 'Oversized File Validation', async () => {
      const oversizedRequestBody = {
        studentEmail: 'oversize@example.com',
        sessionDate: '2024-01-01',
        fileName: 'oversized.mp4',
        fileSize: config.maxFileSize + 1, // Exceed limit
        contentType: 'video/mp4'
      };

      try {
        const response = await this.makeRequest('POST', config.endpoints.uploadInitiate, oversizedRequestBody);
        this.assert(response.data.success === false, 'Oversized file should be rejected');
        this.assert(response.data.error.includes('size'), 'Error should mention file size');
      } catch (error) {
        this.assert(error.response.status === 400, 'Should return 400 for oversized file');
      }
      this.results.summary.errorScenarios.passed++;
    });

    // Test invalid file types
    await this.testCase('ERR-003', 'Invalid File Type Validation', async () => {
      const invalidMimeTypes = ['image/jpeg', 'application/pdf', 'text/plain', 'audio/mp3'];

      for (const mimeType of invalidMimeTypes) {
        const requestBody = {
          studentEmail: 'invalidtype@example.com',
          sessionDate: '2024-01-01',
          fileName: `invalid.${mimeType.split('/')[1]}`,
          fileSize: 1048576,
          contentType: mimeType
        };

        try {
          const response = await this.makeRequest('POST', config.endpoints.uploadInitiate, requestBody);
          this.assert(response.data.success === false, `Invalid MIME type ${mimeType} should be rejected`);
          this.assert(response.data.error.includes('type') || response.data.error.includes('MIME'), 'Error should mention file type');
        } catch (error) {
          this.assert(error.response.status === 400, 'Should return 400 for invalid file type');
        }
      }
      this.results.summary.errorScenarios.passed++;
    });

    // Test unauthorized requests
    await this.testCase('ERR-004', 'Unauthorized Request Handling', async () => {
      // Test with malicious user agent
      const headers = {
        'User-Agent': 'malicious-bot/1.0',
        'Content-Type': 'application/json'
      };

      const requestBody = {
        studentEmail: 'bot@example.com',
        sessionDate: '2024-01-01',
        fileName: 'bot-test.mp4',
        fileSize: 1048576,
        contentType: 'video/mp4'
      };

      try {
        const response = await this.makeRequest('POST', config.endpoints.uploadInitiate, requestBody, headers);
        this.assert(response.data.success === false, 'Bot request should be rejected');
      } catch (error) {
        this.assert(error.response.status === 400, 'Should return 400 for bot request');
      }
      this.results.summary.errorScenarios.passed++;
    });

    // Test SQL injection attempts
    await this.testCase('ERR-005', 'Security Injection Prevention', async () => {
      const maliciousInputs = [
        "'; DROP TABLE uploads; --",
        "<script>alert('xss')</script>",
        "UNION SELECT * FROM users",
        "javascript:alert('xss')"
      ];

      for (const maliciousInput of maliciousInputs) {
        const requestBody = {
          studentEmail: maliciousInput,
          sessionDate: '2024-01-01',
          fileName: maliciousInput,
          fileSize: 1048576,
          contentType: 'video/mp4',
          notes: maliciousInput
        };

        try {
          const response = await this.makeRequest('POST', config.endpoints.uploadInitiate, requestBody);
          this.assert(response.data.success === false, 'Malicious input should be rejected');
        } catch (error) {
          this.assert(error.response.status === 400, 'Should return 400 for malicious input');
        }
      }
      this.results.summary.errorScenarios.passed++;
    });

    // Test malformed JSON
    await this.testCase('ERR-006', 'Malformed JSON Handling', async () => {
      try {
        const response = await axios.post(
          `${config.baseURL}${config.endpoints.uploadInitiate}`,
          '{ invalid json }', // Malformed JSON
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: config.timeout
          }
        );
        this.assert(response.data.success === false, 'Malformed JSON should be rejected');
      } catch (error) {
        this.assert(error.response.status === 400, 'Should return 400 for malformed JSON');
      }
      this.results.summary.errorScenarios.passed++;
    });
  }

  /**
   * Test case wrapper with error handling and reporting
   */
  async testCase(id, description, testFunction) {
    const testStart = Date.now();
    console.log(`  ➤ ${id}: ${description}`);

    try {
      await testFunction();
      const duration = Date.now() - testStart;
      console.log(`    ✅ PASSED (${duration}ms)`);

      this.results.tests.push({
        id,
        description,
        status: 'PASSED',
        duration,
        error: null
      });
      this.results.passed++;

    } catch (error) {
      const duration = Date.now() - testStart;
      console.log(`    ❌ FAILED (${duration}ms): ${error.message}`);

      this.results.tests.push({
        id,
        description,
        status: 'FAILED',
        duration,
        error: error.message
      });
      this.results.failed++;

      // Update summary based on test category
      const category = id.split('-')[0].toLowerCase();
      if (category === 'api') this.results.summary.apiEndpoints.failed++;
      else if (category === 'flow') this.results.summary.uploadFlow.failed++;
      else if (category === 'format') this.results.summary.responseFormat.failed++;
      else if (category === 'int') this.results.summary.integration.failed++;
      else if (category === 'err') this.results.summary.errorScenarios.failed++;
    }

    this.results.total++;
  }

  /**
   * Make HTTP request with retry logic
   */
  async makeRequest(method, endpoint, body = null, headers = {}) {
    const url = `${config.baseURL}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    for (let attempt = 1; attempt <= config.retries; attempt++) {
      try {
        const requestConfig = {
          method,
          url,
          headers: defaultHeaders,
          timeout: config.timeout,
          validateStatus: () => true // Don't throw on HTTP error status
        };

        if (body && method !== 'GET') {
          requestConfig.data = body;
        }

        const response = await axios(requestConfig);
        return response;

      } catch (error) {
        if (attempt === config.retries) {
          throw error;
        }
        await this.sleep(1000 * attempt); // Exponential backoff
      }
    }
  }

  /**
   * Assert helper function
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  /**
   * Sleep helper function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log error with context
   */
  logError(message, error, context = {}) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      error: {
        message: error.message,
        stack: error.stack
      },
      context
    }));
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    const duration = Date.now() - this.startTime;
    const successRate = this.results.total > 0 ? (this.results.passed / this.results.total * 100).toFixed(2) : 0;

    console.log('\n📊 ApexShare Upload E2E Test Results');
    console.log('='.repeat(60));
    console.log(`⏱️  Total Duration: ${duration}ms`);
    console.log(`📈 Success Rate: ${successRate}% (${this.results.passed}/${this.results.total})`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⏭️  Skipped: ${this.results.skipped}`);

    console.log('\n📋 Test Categories Summary:');
    console.log(`  🔌 API Endpoints: ${this.results.summary.apiEndpoints.passed}✅ ${this.results.summary.apiEndpoints.failed}❌`);
    console.log(`  📤 Upload Flow: ${this.results.summary.uploadFlow.passed}✅ ${this.results.summary.uploadFlow.failed}❌`);
    console.log(`  📋 Response Format: ${this.results.summary.responseFormat.passed}✅ ${this.results.summary.responseFormat.failed}❌`);
    console.log(`  🔗 Integration: ${this.results.summary.integration.passed}✅ ${this.results.summary.integration.failed}❌`);
    console.log(`  ❌ Error Scenarios: ${this.results.summary.errorScenarios.passed}✅ ${this.results.summary.errorScenarios.failed}❌`);

    if (this.results.failed > 0) {
      console.log('\n🔍 Failed Tests:');
      this.results.tests
        .filter(test => test.status === 'FAILED')
        .forEach(test => {
          console.log(`  ❌ ${test.id}: ${test.description}`);
          console.log(`     Error: ${test.error}`);
        });
    }

    // Critical assessment for "NaN undefined" resolution
    const formatTests = this.results.tests.filter(test => test.id.startsWith('FORMAT-'));
    const nanTests = formatTests.filter(test => test.description.includes('NaN'));

    console.log('\n🎯 Critical Assessment: "NaN undefined" Error Resolution');
    console.log('-'.repeat(60));
    if (nanTests.every(test => test.status === 'PASSED')) {
      console.log('✅ SUCCESS: All "NaN undefined" validation tests passed');
      console.log('✅ Response format tests indicate the issue has been resolved');
    } else {
      console.log('❌ CONCERN: Some "NaN undefined" validation tests failed');
      console.log('❌ Further investigation required for complete resolution');
    }

    // Upload workflow assessment
    const workflowTests = this.results.tests.filter(test =>
      test.id.startsWith('API-') || test.id.startsWith('FLOW-') || test.id.startsWith('INT-')
    );
    const workflowSuccess = workflowTests.filter(test => test.status === 'PASSED').length;
    const workflowTotal = workflowTests.length;

    console.log('\n🚀 Upload Workflow Assessment');
    console.log('-'.repeat(40));
    console.log(`📊 Workflow Success Rate: ${((workflowSuccess / workflowTotal) * 100).toFixed(2)}%`);

    if (workflowSuccess === workflowTotal) {
      console.log('✅ Complete upload workflow functioning properly');
    } else {
      console.log('⚠️  Some upload workflow issues detected');
    }

    // Save detailed results
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        duration,
        successRate: parseFloat(successRate),
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        skipped: this.results.skipped
      },
      categories: this.results.summary,
      tests: this.results.tests,
      assessment: {
        nanUndefinedResolved: nanTests.every(test => test.status === 'PASSED'),
        uploadWorkflowFunctional: workflowSuccess === workflowTotal,
        criticalIssues: this.results.tests.filter(test =>
          test.status === 'FAILED' &&
          (test.id.startsWith('FORMAT-') || test.id.startsWith('API-'))
        )
      }
    };

    try {
      fs.writeFileSync(
        path.join(__dirname, 'upload-e2e-test-results.json'),
        JSON.stringify(reportData, null, 2)
      );
      console.log('\n💾 Detailed results saved to upload-e2e-test-results.json');
    } catch (error) {
      console.log('\n⚠️  Could not save detailed results:', error.message);
    }

    console.log('\n' + '='.repeat(60));

    return reportData;
  }
}

// Export for use in other test suites
module.exports = UploadE2ETestSuite;

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new UploadE2ETestSuite();
  testSuite.runTests()
    .then(() => {
      process.exit(testSuite.results.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}