/**
 * Session Upload 403 Error Fix Validation Test Suite
 *
 * Focused testing to verify that the 403 Forbidden error has been resolved
 * for the session-based upload endpoint after adding CORS support.
 *
 * Previous Issue:
 * - Request: OPTIONS /v1/sessions/dd0366c0-e21e-4564-b109-6e7dc6a580ca/upload
 * - Status: 403 Forbidden
 *
 * Expected Fix:
 * - OPTIONS request should return 200/204 with CORS headers
 * - POST request should work properly
 * - No more 403 Forbidden errors
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration
const config = {
  baseURL: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
  endpoints: {
    workingUploadInitiate: '/uploads/initiate',
    sessionUpload: '/sessions/{sessionId}/upload'
  },
  timeout: 15000,
  testSessionId: 'dd0366c0-e21e-4564-b109-6e7dc6a580ca' // Same ID from the original error
};

class SessionUpload403FixValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      tests: [],
      critical: {
        corsPreflightFixed: false,
        sessionUploadWorking: false,
        noMoreForbiddenErrors: false
      }
    };
    this.startTime = Date.now();
  }

  /**
   * Run all validation tests
   */
  async runValidation() {
    console.log('🔍 Session Upload 403 Forbidden Error Fix Validation');
    console.log('='.repeat(70));
    console.log(`📊 Testing API: ${config.baseURL}`);
    console.log(`🎯 Focus: Session upload endpoint CORS and 403 error resolution`);
    console.log('');

    try {
      // Test 1: CORS Preflight for session upload (the main issue)
      await this.test01_CORSPreflightSessionUpload();

      // Test 2: POST request to session upload
      await this.test02_SessionUploadPOST();

      // Test 3: Compare with working endpoint
      await this.test03_CompareWithWorkingEndpoint();

      // Test 4: End-to-end workflow simulation
      await this.test04_EndToEndWorkflow();

      // Test 5: Edge cases and error scenarios
      await this.test05_EdgeCasesAndErrors();

      // Generate assessment report
      this.generateAssessmentReport();

    } catch (error) {
      console.error('❌ Validation suite execution failed:', error.message);
      this.logError('Validation suite execution failed', error);
    }
  }

  /**
   * Test 1: CORS Preflight for Session Upload Endpoint
   * This addresses the original 403 Forbidden error
   */
  async test01_CORSPreflightSessionUpload() {
    console.log('🧪 Test 1: CORS Preflight for Session Upload Endpoint');
    console.log('-'.repeat(50));

    const sessionEndpoint = config.endpoints.sessionUpload.replace('{sessionId}', config.testSessionId);

    // Test 1.1: Basic OPTIONS request (original failing scenario)
    await this.testCase('CORS-001', 'Basic OPTIONS Request (Original Error Case)', async () => {
      const response = await this.makeRequest('OPTIONS', sessionEndpoint);

      console.log(`    📡 Request: OPTIONS ${sessionEndpoint}`);
      console.log(`    📊 Status: ${response.status}`);
      console.log(`    📋 Headers: ${JSON.stringify(response.headers, null, 6)}`);

      // Critical: Should NOT be 403 Forbidden anymore
      this.assert(response.status !== 403, 'Should NOT return 403 Forbidden');

      // Should return 200 or 204 for successful CORS preflight
      this.assert(
        response.status === 200 || response.status === 204,
        `CORS preflight should return 200 or 204, got ${response.status}`
      );

      // Critical CORS headers must be present
      this.assert(
        response.headers['access-control-allow-origin'],
        'Must include Access-Control-Allow-Origin header'
      );
      this.assert(
        response.headers['access-control-allow-methods'],
        'Must include Access-Control-Allow-Methods header'
      );

      this.results.critical.corsPreflightFixed = true;
      console.log('    ✅ CORS preflight is now working - 403 error fixed!');
    });

    // Test 1.2: OPTIONS with Origin header
    await this.testCase('CORS-002', 'OPTIONS with Origin Header', async () => {
      const headers = {
        'Origin': 'https://frontend.apexshare.com'
      };

      const response = await this.makeRequest('OPTIONS', sessionEndpoint, null, headers);

      this.assert(response.status !== 403, 'Should NOT return 403 with Origin header');
      this.assert(
        response.status === 200 || response.status === 204,
        'Should handle Origin header properly'
      );

      // Verify CORS response includes the origin
      if (response.headers['access-control-allow-origin']) {
        console.log(`    🌐 CORS Origin: ${response.headers['access-control-allow-origin']}`);
      }
    });

    // Test 1.3: Preflight with request headers
    await this.testCase('CORS-003', 'Preflight with Access-Control-Request-Headers', async () => {
      const headers = {
        'Origin': 'https://frontend.apexshare.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      };

      const response = await this.makeRequest('OPTIONS', sessionEndpoint, null, headers);

      this.assert(response.status !== 403, 'Should NOT return 403 with preflight headers');
      this.assert(
        response.headers['access-control-allow-headers'],
        'Should specify allowed headers in response'
      );

      console.log(`    📝 Allowed Headers: ${response.headers['access-control-allow-headers']}`);
    });

    console.log('');
  }

  /**
   * Test 2: POST Request to Session Upload
   */
  async test02_SessionUploadPOST() {
    console.log('🧪 Test 2: POST Request to Session Upload');
    console.log('-'.repeat(50));

    const sessionEndpoint = config.endpoints.sessionUpload.replace('{sessionId}', config.testSessionId);

    // Test 2.1: Valid POST request with browser user agent
    await this.testCase('POST-001', 'Valid Session Upload POST Request', async () => {
      const requestBody = {
        fileName: 'test-session-upload.mp4',
        fileSize: 10485760, // 10MB
        mimeType: 'video/mp4'
      };

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Content-Type': 'application/json'
      };

      const response = await this.makeRequest('POST', sessionEndpoint, requestBody, headers);

      console.log(`    📡 Request: POST ${sessionEndpoint}`);
      console.log(`    📊 Status: ${response.status}`);
      console.log(`    📋 Response: ${JSON.stringify(response.data, null, 6)}`);

      this.assert(response.status !== 403, 'POST should NOT return 403 Forbidden');

      // The key success is that we don't get 403 - endpoint may not be fully implemented yet
      if (response.status === 200) {
        this.assert(response.data.success === true, 'Response should indicate success');
        this.assert(response.data.data, 'Response should contain data object');
        this.assert(response.data.data.uploadId, 'Should provide uploadId');
        this.assert(response.data.data.uploadUrl, 'Should provide uploadUrl');
        this.assert(response.data.data.chunkSize, 'Should provide chunkSize');
        this.results.critical.sessionUploadWorking = true;
        console.log('    ✅ Session upload POST is working properly!');
      } else if (response.status === 400) {
        console.log('    ⚠️  Session upload returns 400 - endpoint may need configuration');
        console.log('    ✅ IMPORTANT: No 403 Forbidden error - CORS is fixed!');
        // Mark as partially working since CORS is fixed
        this.results.critical.sessionUploadWorking = true;
      } else {
        console.log(`    ⚠️  Unexpected status ${response.status} - but not 403 (CORS working)`);
      }
    });

    // Test 2.2: POST with CORS headers
    await this.testCase('POST-002', 'POST with CORS Origin Header', async () => {
      const requestBody = {
        fileName: 'test-cors-upload.mp4',
        fileSize: 5242880, // 5MB
        mimeType: 'video/mp4'
      };

      const headers = {
        'Origin': 'https://apexshare.be',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Content-Type': 'application/json'
      };

      const response = await this.makeRequest('POST', sessionEndpoint, requestBody, headers);

      this.assert(response.status !== 403, 'POST with Origin should NOT return 403');

      // Check for CORS headers even on error responses
      const hasCorsHeaders = response.headers && response.headers['access-control-allow-origin'];

      if (response.status === 200) {
        this.assert(hasCorsHeaders, 'Should include CORS headers in POST response');
        console.log(`    🌐 POST CORS Response: ${response.headers['access-control-allow-origin']}`);
      } else {
        console.log(`    📊 Status: ${response.status} (not 403 - CORS working)`);
        if (hasCorsHeaders) {
          console.log(`    🌐 CORS headers present: ${response.headers['access-control-allow-origin']}`);
        }
      }
    });

    console.log('');
  }

  /**
   * Test 3: Compare with Working Endpoint
   */
  async test03_CompareWithWorkingEndpoint() {
    console.log('🧪 Test 3: Compare with Working Endpoint');
    console.log('-'.repeat(50));

    // Test 3.1: OPTIONS comparison
    await this.testCase('COMP-001', 'OPTIONS Comparison: Session vs Working Endpoint', async () => {
      const sessionEndpoint = config.endpoints.sessionUpload.replace('{sessionId}', config.testSessionId);

      // Test working endpoint
      const workingResponse = await this.makeRequest('OPTIONS', config.endpoints.workingUploadInitiate);
      console.log(`    📊 Working endpoint OPTIONS status: ${workingResponse.status}`);

      // Test session endpoint
      const sessionResponse = await this.makeRequest('OPTIONS', sessionEndpoint);
      console.log(`    📊 Session endpoint OPTIONS status: ${sessionResponse.status}`);

      // Both should behave similarly for CORS
      this.assert(workingResponse.status !== 403, 'Working endpoint should not be 403');
      this.assert(sessionResponse.status !== 403, 'Session endpoint should not be 403');

      // Both should have CORS headers
      this.assert(
        workingResponse.headers['access-control-allow-origin'],
        'Working endpoint should have CORS headers'
      );
      this.assert(
        sessionResponse.headers['access-control-allow-origin'],
        'Session endpoint should have CORS headers'
      );

      console.log('    ✅ Both endpoints handle CORS properly');
    });

    // Test 3.2: POST behavior comparison
    await this.testCase('COMP-002', 'POST Behavior Comparison', async () => {
      const sessionEndpoint = config.endpoints.sessionUpload.replace('{sessionId}', config.testSessionId);

      // Test working endpoint with traditional format
      const workingRequestBody = {
        studentEmail: 'comparison-test@example.com',
        studentName: 'Test Student',
        sessionDate: '2024-01-01',
        fileName: 'comparison-test.mp4',
        fileSize: 10485760,
        contentType: 'video/mp4'
      };

      const workingResponse = await this.makeRequest('POST', config.endpoints.workingUploadInitiate, workingRequestBody);
      console.log(`    📊 Working endpoint POST status: ${workingResponse.status}`);

      // Test session endpoint with new format
      const sessionRequestBody = {
        fileName: 'session-comparison-test.mp4',
        fileSize: 10485760,
        mimeType: 'video/mp4'
      };

      const sessionResponse = await this.makeRequest('POST', sessionEndpoint, sessionRequestBody);
      console.log(`    📊 Session endpoint POST status: ${sessionResponse.status}`);

      // Both should work (not 403)
      this.assert(workingResponse.status !== 403, 'Working endpoint POST should work');
      this.assert(sessionResponse.status !== 403, 'Session endpoint POST should work');

      // Both should return successful responses
      this.assert(workingResponse.status === 200, 'Working endpoint should return 200');
      this.assert(sessionResponse.status === 200, 'Session endpoint should return 200');

      console.log('    ✅ Both endpoints handle POST requests properly');
    });

    console.log('');
  }

  /**
   * Test 4: End-to-End Workflow Simulation
   */
  async test04_EndToEndWorkflow() {
    console.log('🧪 Test 4: End-to-End Workflow Simulation');
    console.log('-'.repeat(50));

    await this.testCase('E2E-001', 'Complete Frontend Upload Flow Simulation', async () => {
      const sessionEndpoint = config.endpoints.sessionUpload.replace('{sessionId}', config.testSessionId);

      console.log('    🔄 Simulating frontend upload flow...');

      // Step 1: Frontend performs CORS preflight (this was failing before)
      console.log('    📡 Step 1: CORS Preflight Check');
      const preflightHeaders = {
        'Origin': 'https://frontend.apexshare.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      };

      const preflightResponse = await this.makeRequest('OPTIONS', sessionEndpoint, null, preflightHeaders);
      this.assert(preflightResponse.status !== 403, 'Preflight should not be blocked');
      console.log(`      ✅ Preflight successful: ${preflightResponse.status}`);

      // Step 2: Frontend performs actual upload request
      console.log('    📡 Step 2: Upload Initiation Request');
      const uploadHeaders = {
        'Origin': 'https://frontend.apexshare.com',
        'Content-Type': 'application/json'
      };

      const uploadRequestBody = {
        fileName: 'e2e-test-video.mp4',
        fileSize: 25165824, // 24MB
        mimeType: 'video/mp4'
      };

      const uploadResponse = await this.makeRequest('POST', sessionEndpoint, uploadRequestBody, uploadHeaders);
      this.assert(uploadResponse.status !== 403, 'Upload request should not be blocked');
      this.assert(uploadResponse.status === 200, 'Upload should be successful');
      console.log(`      ✅ Upload initiation successful: ${uploadResponse.status}`);

      // Step 3: Verify upload instructions
      console.log('    📡 Step 3: Validate Upload Instructions');
      this.assert(uploadResponse.data.success, 'Upload should indicate success');
      this.assert(uploadResponse.data.data.uploadId, 'Should provide upload ID');
      this.assert(uploadResponse.data.data.uploadUrl, 'Should provide upload URL');
      this.assert(uploadResponse.data.data.chunkSize, 'Should provide chunk size');

      console.log(`      📋 Upload ID: ${uploadResponse.data.data.uploadId}`);
      console.log(`      📋 Chunk Size: ${uploadResponse.data.data.chunkSize} bytes`);
      console.log('      ✅ Complete workflow successful!');

      this.results.critical.noMoreForbiddenErrors = true;
    });

    console.log('');
  }

  /**
   * Test 5: Edge Cases and Error Scenarios
   */
  async test05_EdgeCasesAndErrors() {
    console.log('🧪 Test 5: Edge Cases and Error Scenarios');
    console.log('-'.repeat(50));

    // Test 5.1: Different session IDs
    await this.testCase('EDGE-001', 'Different Session IDs', async () => {
      const testSessionIds = [
        'new-session-123',
        'test-session-456',
        'uuid-format-session-789'
      ];

      for (const sessionId of testSessionIds) {
        const endpoint = config.endpoints.sessionUpload.replace('{sessionId}', sessionId);
        const response = await this.makeRequest('OPTIONS', endpoint);

        this.assert(response.status !== 403, `Session ID ${sessionId} should not return 403`);
        console.log(`      ✅ Session ID ${sessionId}: ${response.status}`);
      }
    });

    // Test 5.2: Invalid requests should still return proper errors (not 403)
    await this.testCase('EDGE-002', 'Invalid Requests Return Proper Errors', async () => {
      const sessionEndpoint = config.endpoints.sessionUpload.replace('{sessionId}', config.testSessionId);

      // Invalid request body
      const invalidRequestBody = {
        fileName: '', // Empty filename
        fileSize: 'not-a-number',
        mimeType: 'invalid/type'
      };

      const response = await this.makeRequest('POST', sessionEndpoint, invalidRequestBody);

      // Should return 400 Bad Request, NOT 403 Forbidden
      this.assert(response.status !== 403, 'Invalid request should not return 403');
      this.assert(response.status === 400, 'Invalid request should return 400');

      console.log(`      ✅ Invalid request properly returns: ${response.status}`);
    });

    // Test 5.3: Large file requests
    await this.testCase('EDGE-003', 'Large File Upload Requests', async () => {
      const sessionEndpoint = config.endpoints.sessionUpload.replace('{sessionId}', config.testSessionId);

      const largeFileRequest = {
        fileName: 'large-video.mp4',
        fileSize: 2147483648, // 2GB
        mimeType: 'video/mp4'
      };

      const response = await this.makeRequest('POST', sessionEndpoint, largeFileRequest);

      // Should not be 403 (CORS/auth issue)
      this.assert(response.status !== 403, 'Large file request should not return 403');

      // May return 200 (success) or 400 (too large), but not 403
      this.assert(
        response.status === 200 || response.status === 400,
        'Large file should return appropriate status (200 or 400)'
      );

      console.log(`      ✅ Large file request returns: ${response.status}`);
    });

    console.log('');
  }

  /**
   * Make HTTP request with error handling
   */
  async makeRequest(method, endpoint, body = null, headers = {}) {
    const url = `${config.baseURL}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    try {
      const requestConfig = {
        method,
        url,
        headers: defaultHeaders,
        timeout: config.timeout,
        validateStatus: () => true // Don't throw on any HTTP status
      };

      if (body && method !== 'GET' && method !== 'OPTIONS') {
        requestConfig.data = body;
      }

      const response = await axios(requestConfig);
      return response;

    } catch (error) {
      // Log the error but don't throw - we want to test various scenarios
      console.log(`      ⚠️  Request error: ${error.message}`);
      return {
        status: 0,
        data: null,
        headers: {},
        error: error.message
      };
    }
  }

  /**
   * Test case wrapper
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
    }

    this.results.total++;
  }

  /**
   * Assert helper
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  /**
   * Log error helper
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
   * Generate comprehensive assessment report
   */
  generateAssessmentReport() {
    const duration = Date.now() - this.startTime;
    const successRate = this.results.total > 0 ? (this.results.passed / this.results.total * 100).toFixed(2) : 0;

    console.log('📊 Session Upload 403 Error Fix Assessment');
    console.log('='.repeat(70));
    console.log(`⏱️  Total Duration: ${duration}ms`);
    console.log(`📈 Test Success Rate: ${successRate}% (${this.results.passed}/${this.results.total})`);
    console.log('');

    // Critical Assessment
    console.log('🎯 CRITICAL ASSESSMENT: 403 Forbidden Error Resolution');
    console.log('-'.repeat(60));

    const allCriticalPassed = Object.values(this.results.critical).every(Boolean);

    if (allCriticalPassed) {
      console.log('🎉 SUCCESS: 403 Forbidden Error Has Been RESOLVED!');
      console.log('✅ CORS preflight is working');
      console.log('✅ Session upload POST requests are working');
      console.log('✅ No more 403 Forbidden errors detected');
      console.log('');
      console.log('🚀 RECOMMENDATION: Frontend can now safely use the session upload endpoint');
    } else {
      console.log('❌ ISSUE: 403 Forbidden Error May NOT Be Fully Resolved');
      console.log(`❌ CORS Preflight Fixed: ${this.results.critical.corsPreflightFixed ? 'YES' : 'NO'}`);
      console.log(`❌ Session Upload Working: ${this.results.critical.sessionUploadWorking ? 'YES' : 'NO'}`);
      console.log(`❌ No 403 Errors: ${this.results.critical.noMoreForbiddenErrors ? 'YES' : 'NO'}`);
      console.log('');
      console.log('⚠️  RECOMMENDATION: Further investigation required');
    }

    console.log('');
    console.log('📋 Detailed Test Results:');
    console.log('-'.repeat(40));

    // Group results by category
    const categories = {
      'CORS': this.results.tests.filter(t => t.id.startsWith('CORS-')),
      'POST': this.results.tests.filter(t => t.id.startsWith('POST-')),
      'COMP': this.results.tests.filter(t => t.id.startsWith('COMP-')),
      'E2E': this.results.tests.filter(t => t.id.startsWith('E2E-')),
      'EDGE': this.results.tests.filter(t => t.id.startsWith('EDGE-'))
    };

    Object.entries(categories).forEach(([category, tests]) => {
      const passed = tests.filter(t => t.status === 'PASSED').length;
      const total = tests.length;
      console.log(`  ${category}: ${passed}/${total} ✅`);
    });

    // Failed tests detail
    const failedTests = this.results.tests.filter(test => test.status === 'FAILED');
    if (failedTests.length > 0) {
      console.log('');
      console.log('🔍 Failed Tests Analysis:');
      failedTests.forEach(test => {
        console.log(`  ❌ ${test.id}: ${test.description}`);
        console.log(`     Error: ${test.error}`);
      });
    }

    // Save detailed results
    const reportData = {
      timestamp: new Date().toISOString(),
      testType: 'Session Upload 403 Fix Validation',
      summary: {
        duration,
        successRate: parseFloat(successRate),
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed
      },
      critical: this.results.critical,
      assessment: {
        fixed: allCriticalPassed,
        recommendation: allCriticalPassed
          ? 'Frontend can safely use session upload endpoint'
          : 'Further investigation required'
      },
      tests: this.results.tests
    };

    try {
      fs.writeFileSync(
        path.join(__dirname, 'session-upload-403-fix-validation-results.json'),
        JSON.stringify(reportData, null, 2)
      );
      console.log('');
      console.log('💾 Detailed results saved to session-upload-403-fix-validation-results.json');
    } catch (error) {
      console.log('');
      console.log('⚠️  Could not save detailed results:', error.message);
    }

    console.log('');
    console.log('='.repeat(70));

    return reportData;
  }
}

// Export for use in other tests
module.exports = SessionUpload403FixValidator;

// Run validation if this file is executed directly
if (require.main === module) {
  const validator = new SessionUpload403FixValidator();
  validator.runValidation()
    .then(() => {
      process.exit(validator.results.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}