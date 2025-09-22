/**
 * API Authentication and Endpoint Testing
 * Comprehensive testing of API endpoints and authentication methods
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class APIAuthenticationTester {
  constructor() {
    this.config = {
      apiUrl: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
      frontendUrl: 'https://apexshare.be',
      testEmail: 'qa-test@apexshare.be',
      testTrainer: 'QA Test Trainer'
    };

    this.results = {
      timestamp: new Date().toISOString(),
      environment: 'production',
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        errors: []
      }
    };
  }

  async runTest(testName, testFn) {
    const test = {
      name: testName,
      status: 'running',
      startTime: Date.now(),
      details: {},
      errors: []
    };

    this.results.tests.push(test);
    this.results.summary.total++;

    console.log(`\n🧪 Testing: ${testName}`);

    try {
      await testFn(test);
      test.status = 'passed';
      this.results.summary.passed++;
      console.log(`✅ ${testName} - PASSED`);
    } catch (error) {
      test.status = 'failed';
      test.errors.push({
        message: error.message,
        stack: error.stack
      });
      this.results.summary.failed++;
      this.results.summary.errors.push(`${testName}: ${error.message}`);
      console.log(`❌ ${testName} - FAILED: ${error.message}`);
    }

    test.endTime = Date.now();
    test.duration = test.endTime - test.startTime;
  }

  async testHealthEndpoint(test) {
    console.log('  📊 Testing /health endpoint...');

    try {
      const response = await axios.get(`${this.config.apiUrl}/health`, {
        timeout: 10000,
        validateStatus: () => true,
        headers: {
          'Origin': this.config.frontendUrl,
          'User-Agent': 'API-Test-Script/1.0'
        }
      });

      test.details = {
        status: response.status,
        data: response.data,
        headers: response.headers,
        responseTime: test.duration
      };

      if (response.status !== 200) {
        throw new Error(`Health endpoint returned ${response.status}: ${JSON.stringify(response.data)}`);
      }

      console.log(`  ✅ Health endpoint responding (${response.status})`);
      console.log(`  📝 Response: ${JSON.stringify(response.data)}`);

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('API server is not accessible - connection refused');
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('Request timed out - API server may be slow or unresponsive');
      } else if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      } else {
        throw new Error(`Network error: ${error.message}`);
      }
    }
  }

  async testUploadEndpointXAuthToken(test) {
    console.log('  🔐 Testing /upload with X-Auth-Token...');

    const uploadData = {
      studentEmail: this.config.testEmail,
      studentName: 'API Test Student',
      trainerName: this.config.testTrainer,
      sessionDate: new Date().toISOString().split('T')[0],
      notes: 'API test upload with X-Auth-Token'
    };

    try {
      const response = await axios.post(`${this.config.apiUrl}/upload`, uploadData, {
        timeout: 15000,
        validateStatus: () => true,
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': 'test-auth-token-validation',
          'Origin': this.config.frontendUrl,
          'User-Agent': 'API-Test-Script/1.0'
        }
      });

      test.details = {
        requestData: uploadData,
        status: response.status,
        data: response.data,
        headers: response.headers,
        responseTime: test.duration
      };

      console.log(`  📝 Status: ${response.status}`);
      console.log(`  📝 Response: ${JSON.stringify(response.data)}`);
      console.log(`  📝 Headers: ${JSON.stringify(response.headers)}`);

      // Log the response regardless of status for analysis
      if (response.status >= 400) {
        console.log(`  ⚠️ X-Auth-Token authentication failed or not implemented correctly`);
      } else {
        console.log(`  ✅ X-Auth-Token authentication working`);
      }

    } catch (error) {
      test.details = {
        requestData: uploadData,
        error: error.message,
        errorCode: error.code
      };

      if (error.response) {
        test.details.responseStatus = error.response.status;
        test.details.responseData = error.response.data;
        test.details.responseHeaders = error.response.headers;
      }

      throw error;
    }
  }

  async testUploadEndpointAuthorizationBearer(test) {
    console.log('  🔐 Testing /upload with Authorization Bearer...');

    const uploadData = {
      studentEmail: this.config.testEmail,
      studentName: 'API Test Student',
      trainerName: this.config.testTrainer,
      sessionDate: new Date().toISOString().split('T')[0],
      notes: 'API test upload with Authorization Bearer'
    };

    try {
      const response = await axios.post(`${this.config.apiUrl}/upload`, uploadData, {
        timeout: 15000,
        validateStatus: () => true,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-bearer-token-validation',
          'Origin': this.config.frontendUrl,
          'User-Agent': 'API-Test-Script/1.0'
        }
      });

      test.details = {
        requestData: uploadData,
        status: response.status,
        data: response.data,
        headers: response.headers,
        responseTime: test.duration
      };

      console.log(`  📝 Status: ${response.status}`);
      console.log(`  📝 Response: ${JSON.stringify(response.data)}`);

      if (response.status >= 400) {
        console.log(`  ⚠️ Authorization Bearer authentication failed or not implemented correctly`);
      } else {
        console.log(`  ✅ Authorization Bearer authentication working`);
      }

    } catch (error) {
      test.details = {
        requestData: uploadData,
        error: error.message,
        errorCode: error.code
      };

      if (error.response) {
        test.details.responseStatus = error.response.status;
        test.details.responseData = error.response.data;
      }

      throw error;
    }
  }

  async testUploadEndpointNoAuth(test) {
    console.log('  🚫 Testing /upload without authentication...');

    const uploadData = {
      studentEmail: this.config.testEmail,
      studentName: 'API Test Student',
      trainerName: this.config.testTrainer,
      sessionDate: new Date().toISOString().split('T')[0],
      notes: 'API test upload without authentication'
    };

    try {
      const response = await axios.post(`${this.config.apiUrl}/upload`, uploadData, {
        timeout: 15000,
        validateStatus: () => true,
        headers: {
          'Content-Type': 'application/json',
          'Origin': this.config.frontendUrl,
          'User-Agent': 'API-Test-Script/1.0'
        }
      });

      test.details = {
        requestData: uploadData,
        status: response.status,
        data: response.data,
        headers: response.headers,
        responseTime: test.duration
      };

      console.log(`  📝 Status: ${response.status}`);
      console.log(`  📝 Response: ${JSON.stringify(response.data)}`);

      // Analyze the response
      if (response.status === 401 || response.status === 403) {
        console.log(`  ✅ Correctly rejecting unauthenticated requests`);
      } else if (response.status === 200) {
        console.log(`  ⚠️ API accepting requests without authentication (this might be the issue)`);
      } else {
        console.log(`  ❓ Unexpected response for unauthenticated request`);
      }

    } catch (error) {
      test.details = {
        requestData: uploadData,
        error: error.message,
        errorCode: error.code
      };

      if (error.response) {
        test.details.responseStatus = error.response.status;
        test.details.responseData = error.response.data;
      }

      throw error;
    }
  }

  async testCORSConfiguration(test) {
    console.log('  🌐 Testing CORS configuration...');

    try {
      // Test OPTIONS request (CORS preflight)
      const optionsResponse = await axios.options(this.config.apiUrl, {
        timeout: 10000,
        validateStatus: () => true,
        headers: {
          'Origin': this.config.frontendUrl,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,X-Auth-Token,Authorization'
        }
      });

      test.details.optionsRequest = {
        status: optionsResponse.status,
        headers: optionsResponse.headers,
        data: optionsResponse.data
      };

      // Test POST request with CORS headers
      const postResponse = await axios.post(`${this.config.apiUrl}/upload`, {
        test: 'cors'
      }, {
        timeout: 10000,
        validateStatus: () => true,
        headers: {
          'Content-Type': 'application/json',
          'Origin': this.config.frontendUrl
        }
      });

      test.details.postRequest = {
        status: postResponse.status,
        headers: postResponse.headers,
        corsHeaders: {
          'access-control-allow-origin': postResponse.headers['access-control-allow-origin'],
          'access-control-allow-methods': postResponse.headers['access-control-allow-methods'],
          'access-control-allow-headers': postResponse.headers['access-control-allow-headers'],
          'access-control-allow-credentials': postResponse.headers['access-control-allow-credentials']
        }
      };

      console.log(`  📝 OPTIONS Status: ${optionsResponse.status}`);
      console.log(`  📝 POST Status: ${postResponse.status}`);
      console.log(`  📝 CORS Headers:`, test.details.postRequest.corsHeaders);

      // Validate CORS configuration
      const corsIssues = [];

      if (!postResponse.headers['access-control-allow-origin']) {
        corsIssues.push('Missing Access-Control-Allow-Origin header');
      } else if (postResponse.headers['access-control-allow-origin'] !== this.config.frontendUrl &&
                 postResponse.headers['access-control-allow-origin'] !== '*') {
        corsIssues.push(`CORS origin mismatch: got ${postResponse.headers['access-control-allow-origin']}, expected ${this.config.frontendUrl}`);
      }

      if (corsIssues.length > 0) {
        console.log(`  ⚠️ CORS Issues: ${corsIssues.join(', ')}`);
      } else {
        console.log(`  ✅ CORS configuration appears correct`);
      }

    } catch (error) {
      test.details = {
        error: error.message,
        errorCode: error.code
      };

      if (error.response) {
        test.details.responseStatus = error.response.status;
        test.details.responseData = error.response.data;
      }

      throw error;
    }
  }

  async testNetworkConnectivity(test) {
    console.log('  🌍 Testing network connectivity...');

    const endpoints = [
      { name: 'API Base', url: this.config.apiUrl },
      { name: 'API Health', url: `${this.config.apiUrl}/health` },
      { name: 'Frontend', url: this.config.frontendUrl }
    ];

    test.details.connectivity = {};

    for (const endpoint of endpoints) {
      try {
        const start = Date.now();
        const response = await axios.head(endpoint.url, {
          timeout: 10000,
          validateStatus: () => true
        });
        const duration = Date.now() - start;

        test.details.connectivity[endpoint.name] = {
          status: response.status,
          responseTime: duration,
          accessible: response.status < 500
        };

        console.log(`  📡 ${endpoint.name}: ${response.status} (${duration}ms)`);

      } catch (error) {
        test.details.connectivity[endpoint.name] = {
          error: error.message,
          errorCode: error.code,
          accessible: false
        };

        console.log(`  ❌ ${endpoint.name}: ${error.message}`);
      }
    }
  }

  async testFileUploadEndpoint(test) {
    console.log('  📤 Testing file upload endpoint...');

    // Create a test file
    const testFileContent = Buffer.from('test video content for upload testing');
    const testFilePath = path.join(__dirname, 'test-upload.mp4');
    fs.writeFileSync(testFilePath, testFileContent);

    try {
      const formData = new FormData();
      formData.append('studentEmail', this.config.testEmail);
      formData.append('studentName', 'API Test Student');
      formData.append('trainerName', this.config.testTrainer);
      formData.append('sessionDate', new Date().toISOString().split('T')[0]);
      formData.append('notes', 'File upload test');
      formData.append('file', fs.createReadStream(testFilePath));

      const response = await axios.post(`${this.config.apiUrl}/upload`, formData, {
        timeout: 30000,
        validateStatus: () => true,
        headers: {
          ...formData.getHeaders(),
          'X-Auth-Token': 'test-file-upload-token',
          'Origin': this.config.frontendUrl
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      test.details = {
        status: response.status,
        data: response.data,
        headers: response.headers,
        responseTime: test.duration
      };

      console.log(`  📝 File Upload Status: ${response.status}`);
      console.log(`  📝 Response: ${JSON.stringify(response.data)}`);

      if (response.status >= 400) {
        console.log(`  ⚠️ File upload failed`);
      } else {
        console.log(`  ✅ File upload endpoint accessible`);
      }

    } catch (error) {
      test.details = {
        error: error.message,
        errorCode: error.code
      };

      if (error.response) {
        test.details.responseStatus = error.response.status;
        test.details.responseData = error.response.data;
      }

      throw error;
    } finally {
      // Clean up test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  }

  async runAllTests() {
    console.log('🚀 Starting API Authentication and Endpoint Testing...');
    console.log(`API URL: ${this.config.apiUrl}`);
    console.log(`Frontend URL: ${this.config.frontendUrl}`);

    await this.runTest('Network Connectivity', this.testNetworkConnectivity.bind(this));
    await this.runTest('Health Endpoint', this.testHealthEndpoint.bind(this));
    await this.runTest('CORS Configuration', this.testCORSConfiguration.bind(this));
    await this.runTest('Upload - X-Auth-Token', this.testUploadEndpointXAuthToken.bind(this));
    await this.runTest('Upload - Authorization Bearer', this.testUploadEndpointAuthorizationBearer.bind(this));
    await this.runTest('Upload - No Authentication', this.testUploadEndpointNoAuth.bind(this));
    await this.runTest('File Upload Endpoint', this.testFileUploadEndpoint.bind(this));

    this.generateReport();
  }

  generateReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 API AUTHENTICATION AND ENDPOINT TEST RESULTS');
    console.log('='.repeat(70));

    console.log(`\n🕐 Test executed: ${this.results.timestamp}`);
    console.log(`🔗 API URL: ${this.config.apiUrl}`);
    console.log(`🌐 Frontend URL: ${this.config.frontendUrl}`);

    console.log(`\n📈 Summary:`);
    console.log(`  Total tests: ${this.results.summary.total}`);
    console.log(`  Passed: ${this.results.summary.passed}`);
    console.log(`  Failed: ${this.results.summary.failed}`);
    console.log(`  Success rate: ${((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1)}%`);

    console.log('\n📋 Detailed Results:');
    this.results.tests.forEach(test => {
      const status = test.status === 'passed' ? '✅' : '❌';
      console.log(`\n  ${status} ${test.name} (${test.duration}ms)`);

      if (test.errors.length > 0) {
        test.errors.forEach(error => {
          console.log(`    ❌ Error: ${error.message}`);
        });
      }

      // Show key details
      if (test.details.status) {
        console.log(`    📝 HTTP Status: ${test.details.status}`);
      }

      if (test.details.data && typeof test.details.data === 'object') {
        console.log(`    📝 Response: ${JSON.stringify(test.details.data).substring(0, 200)}...`);
      }
    });

    if (this.results.summary.errors.length > 0) {
      console.log('\n🚨 Critical Issues:');
      this.results.summary.errors.forEach(error => {
        console.log(`  • ${error}`);
      });
    }

    console.log('\n🔍 Analysis and Recommendations:');
    this.analyzeResults();

    // Save detailed results
    const reportPath = path.join(__dirname, `api-test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);

    console.log('\n' + '='.repeat(70));
  }

  analyzeResults() {
    const recommendations = [];

    // Check authentication results
    const xAuthTest = this.results.tests.find(t => t.name === 'Upload - X-Auth-Token');
    const bearerTest = this.results.tests.find(t => t.name === 'Upload - Authorization Bearer');
    const noAuthTest = this.results.tests.find(t => t.name === 'Upload - No Authentication');

    if (xAuthTest && xAuthTest.details.status >= 400) {
      recommendations.push('X-Auth-Token authentication is not working correctly');
    }

    if (bearerTest && bearerTest.details.status >= 400) {
      recommendations.push('Authorization Bearer authentication is not working correctly');
    }

    if (noAuthTest && noAuthTest.details.status === 200) {
      recommendations.push('⚠️ API is accepting requests without authentication - this is a security issue');
    }

    // Check CORS
    const corsTest = this.results.tests.find(t => t.name === 'CORS Configuration');
    if (corsTest && corsTest.status === 'failed') {
      recommendations.push('CORS configuration issues detected - this will cause browser upload failures');
    }

    // Check health
    const healthTest = this.results.tests.find(t => t.name === 'Health Endpoint');
    if (healthTest && healthTest.status === 'failed') {
      recommendations.push('API health endpoint is not responding - API may be down');
    }

    if (recommendations.length === 0) {
      console.log('  ✅ No critical issues detected in API testing');
    } else {
      recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }

    console.log('\n💡 Next Steps:');
    console.log('  1. Review the detailed test results above');
    console.log('  2. Check authentication implementation in the API Gateway');
    console.log('  3. Verify CORS configuration allows frontend domain');
    console.log('  4. Test frontend integration with working authentication');
    console.log('  5. Monitor CloudWatch logs for API errors during testing');
  }
}

// Run the test suite
if (require.main === module) {
  const tester = new APIAuthenticationTester();
  tester.runAllTests().catch(console.error);
}

module.exports = APIAuthenticationTester;