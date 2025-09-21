/**
 * Comprehensive Upload Workflow Test
 * Tests the complete upload workflow against live environment
 * Reproduces user issues and identifies failure points
 */

const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration
const CONFIG = {
  frontendUrl: 'https://apexshare.be',
  apiUrl: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
  testEmail: 'test@apexshare.be',
  testTrainer: 'QA Test Trainer',
  headless: false, // Set to false to see browser interaction
  slowMo: 100,
  timeout: 30000
};

class UploadWorkflowTester {
  constructor() {
    this.browser = null;
    this.testResults = {
      timestamp: new Date().toISOString(),
      testSuite: 'Upload Workflow E2E Test',
      environment: 'production',
      frontend: CONFIG.frontendUrl,
      api: CONFIG.apiUrl,
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        errors: []
      }
    };
  }

  async initialize() {
    console.log('🚀 Initializing comprehensive upload workflow test...');
    console.log(`Frontend: ${CONFIG.frontendUrl}`);
    console.log(`API: ${CONFIG.apiUrl}`);

    this.browser = await puppeteer.launch({
      headless: CONFIG.headless,
      slowMo: CONFIG.slowMo,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async runTest(testName, testFn) {
    const test = {
      name: testName,
      status: 'running',
      startTime: Date.now(),
      errors: [],
      details: {}
    };

    this.testResults.tests.push(test);
    this.testResults.summary.total++;

    console.log(`\n🧪 Running: ${testName}`);

    try {
      await testFn(test);
      test.status = 'passed';
      this.testResults.summary.passed++;
      console.log(`✅ ${testName} - PASSED`);
    } catch (error) {
      test.status = 'failed';
      test.errors.push({
        message: error.message,
        stack: error.stack
      });
      this.testResults.summary.failed++;
      this.testResults.summary.errors.push(`${testName}: ${error.message}`);
      console.log(`❌ ${testName} - FAILED: ${error.message}`);
    }

    test.endTime = Date.now();
    test.duration = test.endTime - test.startTime;
  }

  async testAPIHealth(test) {
    console.log('  📊 Testing API health...');

    try {
      const response = await axios.get(`${CONFIG.apiUrl}/health`, {
        timeout: 10000,
        validateStatus: () => true
      });

      test.details.apiHealth = {
        status: response.status,
        data: response.data,
        headers: response.headers
      };

      if (response.status !== 200) {
        throw new Error(`API health check failed: ${response.status} - ${JSON.stringify(response.data)}`);
      }

      console.log('  ✅ API is healthy');
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('API is not accessible - connection refused');
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('API health check timed out');
      } else {
        throw new Error(`API health check failed: ${error.message}`);
      }
    }
  }

  async testFrontendAccessibility(test) {
    console.log('  🌐 Testing frontend accessibility...');

    const page = await this.browser.newPage();

    try {
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Navigate to frontend
      const response = await page.goto(CONFIG.frontendUrl, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.timeout
      });

      test.details.frontendAccess = {
        status: response.status(),
        url: response.url(),
        headers: response.headers()
      };

      if (!response.ok()) {
        throw new Error(`Frontend not accessible: ${response.status()} - ${response.statusText()}`);
      }

      // Check if page loads properly
      await page.waitForSelector('body', { timeout: 10000 });

      const title = await page.title();
      test.details.pageTitle = title;

      console.log(`  ✅ Frontend accessible (${response.status()}) - Title: ${title}`);

    } finally {
      await page.close();
    }
  }

  async testUploadPageLoad(test) {
    console.log('  📄 Testing upload page load...');

    const page = await this.browser.newPage();

    try {
      // Enable request/response logging
      const requests = [];
      const responses = [];

      page.on('request', req => {
        requests.push({
          url: req.url(),
          method: req.method(),
          headers: req.headers()
        });
      });

      page.on('response', res => {
        responses.push({
          url: res.url(),
          status: res.status(),
          headers: res.headers()
        });
      });

      await page.goto(`${CONFIG.frontendUrl}/upload`, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.timeout
      });

      // Check for form elements
      const formElements = await page.evaluate(() => {
        return {
          studentEmail: !!document.querySelector('[data-cy="student-email"], input[type="email"], #studentEmail, [name="studentEmail"]'),
          sessionDate: !!document.querySelector('[data-cy="session-date"], input[type="date"], #sessionDate, [name="sessionDate"]'),
          fileUpload: !!document.querySelector('[data-cy="file-upload-zone"], input[type="file"], #fileUpload, [name="file"]'),
          uploadButton: !!document.querySelector('[data-cy="upload-button"], button[type="submit"], #uploadButton')
        };
      });

      test.details.uploadPage = {
        formElements,
        requests: requests.length,
        responses: responses.length,
        networkLogs: {
          requests: requests.slice(-5), // Last 5 requests
          responses: responses.slice(-5) // Last 5 responses
        }
      };

      const missingElements = Object.entries(formElements)
        .filter(([key, exists]) => !exists)
        .map(([key]) => key);

      if (missingElements.length > 0) {
        throw new Error(`Missing form elements: ${missingElements.join(', ')}`);
      }

      console.log('  ✅ Upload page loaded with all required elements');

    } finally {
      await page.close();
    }
  }

  async testAuthenticationMethods(test) {
    console.log('  🔐 Testing authentication methods...');

    const testData = {
      studentEmail: CONFIG.testEmail,
      studentName: 'Test Student',
      trainerName: CONFIG.testTrainer,
      sessionDate: new Date().toISOString().split('T')[0],
      notes: 'Authentication test'
    };

    // Test X-Auth-Token method
    try {
      const xAuthResponse = await axios.post(`${CONFIG.apiUrl}/upload`, testData, {
        headers: {
          'X-Auth-Token': 'test-token-validation',
          'Content-Type': 'application/json'
        },
        timeout: 10000,
        validateStatus: () => true
      });

      test.details.xAuthToken = {
        status: xAuthResponse.status,
        data: xAuthResponse.data,
        headers: xAuthResponse.headers
      };

      console.log(`  📝 X-Auth-Token test: ${xAuthResponse.status}`);
    } catch (error) {
      test.details.xAuthToken = { error: error.message };
      console.log(`  ⚠️ X-Auth-Token test failed: ${error.message}`);
    }

    // Test Authorization header method
    try {
      const authResponse = await axios.post(`${CONFIG.apiUrl}/upload`, testData, {
        headers: {
          'Authorization': 'Bearer test-bearer-token',
          'Content-Type': 'application/json'
        },
        timeout: 10000,
        validateStatus: () => true
      });

      test.details.authorization = {
        status: authResponse.status,
        data: authResponse.data,
        headers: authResponse.headers
      };

      console.log(`  📝 Authorization header test: ${authResponse.status}`);
    } catch (error) {
      test.details.authorization = { error: error.message };
      console.log(`  ⚠️ Authorization header test failed: ${error.message}`);
    }

    // Test without authentication
    try {
      const noAuthResponse = await axios.post(`${CONFIG.apiUrl}/upload`, testData, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000,
        validateStatus: () => true
      });

      test.details.noAuth = {
        status: noAuthResponse.status,
        data: noAuthResponse.data,
        headers: noAuthResponse.headers
      };

      console.log(`  📝 No auth test: ${noAuthResponse.status}`);
    } catch (error) {
      test.details.noAuth = { error: error.message };
      console.log(`  ⚠️ No auth test failed: ${error.message}`);
    }
  }

  async testBrowserUploadFlow(test) {
    console.log('  🖥️ Testing browser upload flow...');

    const page = await this.browser.newPage();

    try {
      // Enable request interception to monitor API calls
      await page.setRequestInterception(true);
      const apiCalls = [];

      page.on('request', req => {
        if (req.url().includes(CONFIG.apiUrl)) {
          apiCalls.push({
            url: req.url(),
            method: req.method(),
            headers: req.headers(),
            postData: req.postData()
          });
        }
        req.continue();
      });

      // Navigate to upload page
      await page.goto(`${CONFIG.frontendUrl}/upload`, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.timeout
      });

      // Create a test file
      const testFileContent = Buffer.from('test video content');
      const testFilePath = path.join(__dirname, 'test-video.mp4');
      fs.writeFileSync(testFilePath, testFileContent);

      // Fill out the form
      await page.waitForSelector('input[type="email"], [data-cy="student-email"]');

      const emailSelector = await page.$('input[type="email"], [data-cy="student-email"]');
      if (emailSelector) {
        await emailSelector.type(CONFIG.testEmail);
      }

      const dateSelector = await page.$('input[type="date"], [data-cy="session-date"]');
      if (dateSelector) {
        await dateSelector.type('2025-01-20');
      }

      // Try to upload file
      const fileSelector = await page.$('input[type="file"], [data-cy="file-upload-zone"]');
      if (fileSelector) {
        await fileSelector.uploadFile(testFilePath);
        console.log('  📎 File selected for upload');
      }

      // Try to submit
      const submitButton = await page.$('button[type="submit"], [data-cy="upload-button"]');
      if (submitButton) {
        await submitButton.click();
        console.log('  🔄 Submit button clicked');

        // Wait for any API calls
        await page.waitForTimeout(5000);
      }

      test.details.browserFlow = {
        formFilled: true,
        fileSelected: !!fileSelector,
        submitted: !!submitButton,
        apiCalls: apiCalls
      };

      // Clean up test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }

      console.log(`  ✅ Browser flow completed (${apiCalls.length} API calls made)`);

    } finally {
      await page.close();
    }
  }

  async testIncognitoMode(test) {
    console.log('  🕵️ Testing incognito mode...');

    const incognitoContext = await this.browser.createIncognitoBrowserContext();
    const page = await incognitoContext.newPage();

    try {
      const apiCalls = [];

      page.on('request', req => {
        if (req.url().includes(CONFIG.apiUrl)) {
          apiCalls.push({
            url: req.url(),
            method: req.method(),
            headers: req.headers()
          });
        }
      });

      await page.goto(`${CONFIG.frontendUrl}/upload`, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.timeout
      });

      // Check if page loads in incognito
      const title = await page.title();

      test.details.incognitoMode = {
        pageLoaded: true,
        title: title,
        apiCalls: apiCalls.length
      };

      console.log('  ✅ Incognito mode works');

    } finally {
      await page.close();
      await incognitoContext.close();
    }
  }

  async testCORSHeaders(test) {
    console.log('  🌐 Testing CORS headers...');

    try {
      const corsTest = await axios.options(CONFIG.apiUrl, {
        headers: {
          'Origin': CONFIG.frontendUrl,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,X-Auth-Token,Authorization'
        },
        timeout: 10000,
        validateStatus: () => true
      });

      test.details.cors = {
        status: corsTest.status,
        headers: corsTest.headers,
        allowedOrigins: corsTest.headers['access-control-allow-origin'],
        allowedMethods: corsTest.headers['access-control-allow-methods'],
        allowedHeaders: corsTest.headers['access-control-allow-headers']
      };

      console.log(`  ✅ CORS test completed (${corsTest.status})`);

    } catch (error) {
      test.details.cors = { error: error.message };
      console.log(`  ⚠️ CORS test failed: ${error.message}`);
    }
  }

  async runAllTests() {
    await this.initialize();

    try {
      // Test API health
      await this.runTest('API Health Check', this.testAPIHealth.bind(this));

      // Test frontend accessibility
      await this.runTest('Frontend Accessibility', this.testFrontendAccessibility.bind(this));

      // Test upload page load
      await this.runTest('Upload Page Load', this.testUploadPageLoad.bind(this));

      // Test authentication methods
      await this.runTest('Authentication Methods', this.testAuthenticationMethods.bind(this));

      // Test CORS headers
      await this.runTest('CORS Configuration', this.testCORSHeaders.bind(this));

      // Test browser upload flow
      await this.runTest('Browser Upload Flow', this.testBrowserUploadFlow.bind(this));

      // Test incognito mode
      await this.runTest('Incognito Mode', this.testIncognitoMode.bind(this));

    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }

    // Generate report
    this.generateReport();
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE UPLOAD WORKFLOW TEST RESULTS');
    console.log('='.repeat(60));

    console.log(`\n🕐 Test executed: ${this.testResults.timestamp}`);
    console.log(`🌐 Frontend: ${this.testResults.frontend}`);
    console.log(`🔗 API: ${this.testResults.api}`);

    console.log(`\n📈 Summary:`);
    console.log(`  Total tests: ${this.testResults.summary.total}`);
    console.log(`  Passed: ${this.testResults.summary.passed}`);
    console.log(`  Failed: ${this.testResults.summary.failed}`);
    console.log(`  Success rate: ${((this.testResults.summary.passed / this.testResults.summary.total) * 100).toFixed(1)}%`);

    console.log('\n📋 Test Details:');
    this.testResults.tests.forEach(test => {
      const status = test.status === 'passed' ? '✅' : '❌';
      console.log(`  ${status} ${test.name} (${test.duration}ms)`);

      if (test.errors.length > 0) {
        test.errors.forEach(error => {
          console.log(`    ❌ ${error.message}`);
        });
      }
    });

    if (this.testResults.summary.errors.length > 0) {
      console.log('\n🚨 Critical Issues Found:');
      this.testResults.summary.errors.forEach(error => {
        console.log(`  • ${error}`);
      });
    }

    // Save detailed results to file
    const reportPath = path.join(__dirname, `upload-test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);

    console.log('\n' + '='.repeat(60));
  }
}

// Run the test suite
if (require.main === module) {
  const tester = new UploadWorkflowTester();
  tester.runAllTests().catch(console.error);
}

module.exports = UploadWorkflowTester;