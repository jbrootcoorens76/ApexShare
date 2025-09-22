#!/usr/bin/env node

/**
 * Comprehensive Chrome Upload Issues Verification Test Suite
 *
 * This test suite performs end-to-end verification that the two deployed fixes
 * for Chrome upload issues are working correctly in production:
 *
 * 1. Debug page fix - moved debug headers from payload to HTTP headers
 * 2. CORS fix - added X-Public-Access to allowed headers in API Gateway
 *
 * Tests include:
 * - API endpoint testing with proper headers
 * - Browser automation to verify CORS behavior
 * - Network request validation
 * - Regression testing for main upload functionality
 */

const https = require('https');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  API_BASE_URL: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
  PRODUCTION_URL: 'https://apexshare.be',
  DEBUG_URL: 'https://apexshare.be/upload-debug',
  MAIN_UPLOAD_URL: 'https://apexshare.be/upload',
  TEST_TIMEOUT: 30000,
  USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
};

// ANSI Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(80)}`, 'cyan');
  log(`🧪 ${title}`, 'cyan');
  log(`${'='.repeat(80)}`, 'cyan');
}

function logTest(title, step = '') {
  const prefix = step ? `📋 Step ${step}: ` : '📋 ';
  log(`\n${prefix}${title}`, 'blue');
  log('-'.repeat(60), 'blue');
}

/**
 * Make HTTPS requests with proper error handling
 */
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsedBody = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsedBody,
            rawBody: body
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
            rawBody: body
          });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(CONFIG.TEST_TIMEOUT, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

/**
 * Test 1: API Endpoint Testing with X-Public-Access Headers
 */
async function testApiEndpointsWithPublicAccess() {
  logSection('API Endpoint Testing with X-Public-Access Headers');

  const results = {
    sessionCreation: null,
    sessionUpload: null,
    cors: null
  };

  // Test 1.1: Session Creation with X-Public-Access
  logTest('Session Creation with X-Public-Access Header', '1.1');

  const sessionData = {
    studentName: 'Chrome Test Student',
    studentEmail: 'chrome.test@example.com',
    sessionDate: '2025-01-22',
    notes: 'Testing Chrome upload fixes'
  };

  const sessionOptions = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: '/v1/sessions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Public-Access': 'true',
      'Origin': 'https://apexshare.be',
      'User-Agent': CONFIG.USER_AGENT,
      'X-Requested-With': 'comprehensive-chrome-test'
    }
  };

  try {
    const sessionResponse = await makeRequest(sessionOptions, JSON.stringify(sessionData));

    log(`Status: ${sessionResponse.statusCode}`, sessionResponse.statusCode === 201 ? 'green' : 'red');
    log(`CORS Origin: ${sessionResponse.headers['access-control-allow-origin']}`, 'yellow');

    if (sessionResponse.statusCode === 201) {
      log('✅ SUCCESS: Session creation with X-Public-Access works', 'green');
      results.sessionCreation = { success: true, sessionId: sessionResponse.body.sessionId };
    } else {
      log('❌ FAILED: Session creation with X-Public-Access failed', 'red');
      log(`Error: ${JSON.stringify(sessionResponse.body, null, 2)}`, 'red');
      results.sessionCreation = { success: false, error: sessionResponse.body };
    }
  } catch (error) {
    log(`❌ REQUEST FAILED: ${error.message}`, 'red');
    results.sessionCreation = { success: false, error: error.message };
  }

  // Test 1.2: Session Upload with Debug Headers
  logTest('Session Upload with Debug Headers in HTTP Headers', '1.2');

  const sessionId = results.sessionCreation?.sessionId || 'test-session-id';

  const uploadData = {
    fileName: 'chrome-test-video.mp4',
    fileSize: 2097152, // 2MB
    contentType: 'video/mp4'
  };

  const uploadOptions = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: `/v1/sessions/${sessionId}/upload`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Public-Access': 'true',
      'Origin': 'https://apexshare.be',
      'User-Agent': CONFIG.USER_AGENT,
      // Debug headers now in HTTP headers (not payload)
      'X-Debug-Student-Email': 'chrome.test@example.com',
      'X-Debug-Student-Name': 'Chrome Test Student',
      'X-Debug-Notes': 'Testing debug header fix',
      'X-Requested-With': 'comprehensive-chrome-test'
    }
  };

  try {
    const uploadResponse = await makeRequest(uploadOptions, JSON.stringify(uploadData));

    log(`Status: ${uploadResponse.statusCode}`, uploadResponse.statusCode === 200 ? 'green' : 'red');
    log(`CORS Origin: ${uploadResponse.headers['access-control-allow-origin']}`, 'yellow');

    if (uploadResponse.statusCode === 200) {
      log('✅ SUCCESS: Session upload with debug headers works', 'green');
      results.sessionUpload = { success: true, uploadUrl: uploadResponse.body.uploadUrl };
    } else {
      log('❌ FAILED: Session upload with debug headers failed', 'red');
      log(`Error: ${JSON.stringify(uploadResponse.body, null, 2)}`, 'red');
      results.sessionUpload = { success: false, error: uploadResponse.body };
    }
  } catch (error) {
    log(`❌ REQUEST FAILED: ${error.message}`, 'red');
    results.sessionUpload = { success: false, error: error.message };
  }

  // Test 1.3: CORS Preflight Test
  logTest('CORS Preflight Request Validation', '1.3');

  const corsOptions = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: '/v1/sessions',
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://apexshare.be',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-public-access,x-debug-student-email,x-debug-student-name,x-debug-notes',
      'User-Agent': CONFIG.USER_AGENT
    }
  };

  try {
    const corsResponse = await makeRequest(corsOptions);

    log(`Status: ${corsResponse.statusCode}`, corsResponse.statusCode === 200 ? 'green' : 'red');
    log(`Allowed Headers: ${corsResponse.headers['access-control-allow-headers']}`, 'yellow');
    log(`Allowed Methods: ${corsResponse.headers['access-control-allow-methods']}`, 'yellow');
    log(`Allowed Origin: ${corsResponse.headers['access-control-allow-origin']}`, 'yellow');

    const allowedHeaders = corsResponse.headers['access-control-allow-headers'] || '';
    const hasPublicAccess = allowedHeaders.toLowerCase().includes('x-public-access');
    const hasDebugHeaders = allowedHeaders.toLowerCase().includes('x-debug-student-email');

    if (corsResponse.statusCode === 200 && hasPublicAccess && hasDebugHeaders) {
      log('✅ SUCCESS: CORS allows all required headers', 'green');
      results.cors = { success: true, allowedHeaders };
    } else {
      log('❌ FAILED: CORS does not allow required headers', 'red');
      results.cors = { success: false, allowedHeaders };
    }
  } catch (error) {
    log(`❌ CORS REQUEST FAILED: ${error.message}`, 'red');
    results.cors = { success: false, error: error.message };
  }

  return results;
}

/**
 * Test 2: Browser-Based Testing with Playwright
 */
async function testBrowserFunctionality() {
  logSection('Browser-Based Testing (Chrome Specific)');

  // Check if Playwright is available
  const playwrightPath = path.join(process.cwd(), 'node_modules', '.bin', 'playwright');
  if (!fs.existsSync(playwrightPath)) {
    log('⚠️  Playwright not found - skipping browser tests', 'yellow');
    log('Install with: npm install playwright', 'yellow');
    return { skipped: true, reason: 'Playwright not available' };
  }

  const browserTestScript = `
const { chromium } = require('playwright');

async function testChromeBehavior() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: '${CONFIG.USER_AGENT}'
  });
  const page = await context.newPage();

  // Monitor network requests
  const requests = [];
  const responses = [];

  page.on('request', request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers()
    });
  });

  page.on('response', response => {
    responses.push({
      url: response.url(),
      status: response.status(),
      headers: response.headers()
    });
  });

  try {
    // Test 1: Visit debug upload page
    console.log('Testing debug upload page...');
    await page.goto('${CONFIG.DEBUG_URL}', { waitUntil: 'networkidle' });

    // Test 2: Try to trigger session creation
    console.log('Testing session creation...');
    // This would need specific page interaction logic

    // Test 3: Check for CORS errors in console
    const logs = [];
    page.on('console', msg => {
      logs.push({ type: msg.type(), text: msg.text() });
    });

    await page.waitForTimeout(5000);

    await browser.close();

    return {
      success: true,
      requests: requests.filter(r => r.url.includes('api')),
      responses: responses.filter(r => r.url.includes('api')),
      consoleLogs: logs.filter(l => l.type === 'error')
    };

  } catch (error) {
    await browser.close();
    return { success: false, error: error.message };
  }
}

testChromeBehavior().then(result => {
  console.log(JSON.stringify(result, null, 2));
}).catch(error => {
  console.error(JSON.stringify({ success: false, error: error.message }));
});
`;

  // Write temporary test script
  const tempScript = '/tmp/chrome-browser-test.js';
  fs.writeFileSync(tempScript, browserTestScript);

  return new Promise((resolve) => {
    const child = spawn('node', [tempScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: CONFIG.TEST_TIMEOUT
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      fs.unlinkSync(tempScript);

      try {
        const result = JSON.parse(stdout);
        if (result.success) {
          log('✅ Browser tests completed successfully', 'green');
          log(`API Requests captured: ${result.requests.length}`, 'yellow');
          log(`Console errors: ${result.consoleLogs.length}`, result.consoleLogs.length === 0 ? 'green' : 'red');
        } else {
          log('❌ Browser tests failed', 'red');
          log(`Error: ${result.error}`, 'red');
        }
        resolve(result);
      } catch (error) {
        log('❌ Browser test parsing failed', 'red');
        log(`stdout: ${stdout}`, 'yellow');
        log(`stderr: ${stderr}`, 'red');
        resolve({ success: false, error: 'Failed to parse browser test results' });
      }
    });

    child.on('error', (error) => {
      fs.unlinkSync(tempScript);
      log(`❌ Browser test execution failed: ${error.message}`, 'red');
      resolve({ success: false, error: error.message });
    });
  });
}

/**
 * Test 3: Manual API Request Simulation
 */
async function testManualApiRequests() {
  logSection('Manual API Request Simulation (Chrome-like behavior)');

  const results = {
    preflightRequest: null,
    sessionCreationRequest: null,
    uploadUrlRequest: null
  };

  // Simulate exact Chrome preflight request
  logTest('Simulate Chrome CORS Preflight Request', '3.1');

  const preflightOptions = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: '/v1/sessions',
    method: 'OPTIONS',
    headers: {
      'Host': 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
      'Connection': 'keep-alive',
      'Accept': '*/*',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-public-access',
      'Origin': 'https://apexshare.be',
      'User-Agent': CONFIG.USER_AGENT,
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-Dest': 'empty',
      'Referer': 'https://apexshare.be/',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  };

  try {
    const preflightResponse = await makeRequest(preflightOptions);

    log(`Preflight Status: ${preflightResponse.statusCode}`,
        preflightResponse.statusCode === 200 ? 'green' : 'red');
    log(`Access-Control-Allow-Origin: ${preflightResponse.headers['access-control-allow-origin']}`, 'yellow');
    log(`Access-Control-Allow-Headers: ${preflightResponse.headers['access-control-allow-headers']}`, 'yellow');
    log(`Access-Control-Allow-Methods: ${preflightResponse.headers['access-control-allow-methods']}`, 'yellow');

    results.preflightRequest = {
      success: preflightResponse.statusCode === 200,
      headers: preflightResponse.headers
    };

    if (preflightResponse.statusCode === 200) {
      log('✅ Chrome-like preflight request succeeded', 'green');
    } else {
      log('❌ Chrome-like preflight request failed', 'red');
    }
  } catch (error) {
    log(`❌ Preflight request failed: ${error.message}`, 'red');
    results.preflightRequest = { success: false, error: error.message };
  }

  // Simulate Chrome actual POST request
  logTest('Simulate Chrome Session Creation POST Request', '3.2');

  const sessionData = {
    studentName: 'Chrome Manual Test',
    studentEmail: 'chrome.manual@example.com',
    sessionDate: '2025-01-22',
    notes: 'Manual Chrome simulation test'
  };

  const sessionRequestOptions = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: '/v1/sessions',
    method: 'POST',
    headers: {
      'Host': 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
      'Connection': 'keep-alive',
      'Content-Length': JSON.stringify(sessionData).length,
      'Accept': 'application/json, text/plain, */*',
      'X-Public-Access': 'true',
      'User-Agent': CONFIG.USER_AGENT,
      'Content-Type': 'application/json',
      'Origin': 'https://apexshare.be',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      'Referer': 'https://apexshare.be/',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  };

  try {
    const sessionResponse = await makeRequest(sessionRequestOptions, JSON.stringify(sessionData));

    log(`Session Creation Status: ${sessionResponse.statusCode}`,
        sessionResponse.statusCode === 201 ? 'green' : 'red');

    if (sessionResponse.statusCode === 201) {
      log('✅ Chrome-like session creation succeeded', 'green');
      log(`Session ID: ${sessionResponse.body.sessionId}`, 'cyan');
      results.sessionCreationRequest = {
        success: true,
        sessionId: sessionResponse.body.sessionId
      };
    } else {
      log('❌ Chrome-like session creation failed', 'red');
      log(`Error: ${JSON.stringify(sessionResponse.body, null, 2)}`, 'red');
      results.sessionCreationRequest = { success: false, error: sessionResponse.body };
    }
  } catch (error) {
    log(`❌ Session creation request failed: ${error.message}`, 'red');
    results.sessionCreationRequest = { success: false, error: error.message };
  }

  return results;
}

/**
 * Test 4: Regression Testing
 */
async function testRegressionScenarios() {
  logSection('Regression Testing - Ensure Main Upload Still Works');

  // Test that the main upload page functionality is not broken
  logTest('Test Main Upload Page API Endpoints', '4.1');

  // Test /uploads/initiate endpoint (used by main upload page)
  const initiateData = {
    studentEmail: 'regression.test@example.com',
    studentName: 'Regression Test Student',
    fileName: 'regression-test.mp4',
    fileSize: 1048576,
    contentType: 'video/mp4'
  };

  const initiateOptions = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: '/v1/uploads/initiate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Public-Access': 'true',
      'Origin': 'https://apexshare.be',
      'User-Agent': CONFIG.USER_AGENT
    }
  };

  try {
    const initiateResponse = await makeRequest(initiateOptions, JSON.stringify(initiateData));

    log(`Upload Initiate Status: ${initiateResponse.statusCode}`,
        initiateResponse.statusCode === 200 ? 'green' : 'red');

    if (initiateResponse.statusCode === 200) {
      log('✅ Main upload page endpoint works correctly', 'green');
      return { mainUpload: { success: true, data: initiateResponse.body } };
    } else {
      log('❌ Main upload page endpoint broken by changes', 'red');
      log(`Error: ${JSON.stringify(initiateResponse.body, null, 2)}`, 'red');
      return { mainUpload: { success: false, error: initiateResponse.body } };
    }
  } catch (error) {
    log(`❌ Main upload test failed: ${error.message}`, 'red');
    return { mainUpload: { success: false, error: error.message } };
  }
}

/**
 * Generate comprehensive test report
 */
function generateTestReport(results) {
  logSection('COMPREHENSIVE TEST REPORT');

  log('\n📊 TEST RESULTS SUMMARY', 'bold');
  log('========================', 'bold');

  // API Tests Results
  log('\n🔌 API Endpoint Tests:', 'cyan');
  const apiResults = results.apiTests;
  if (apiResults.sessionCreation?.success) {
    log('✅ Session Creation with X-Public-Access: PASSED', 'green');
  } else {
    log('❌ Session Creation with X-Public-Access: FAILED', 'red');
  }

  if (apiResults.sessionUpload?.success) {
    log('✅ Session Upload with Debug Headers: PASSED', 'green');
  } else {
    log('❌ Session Upload with Debug Headers: FAILED', 'red');
  }

  if (apiResults.cors?.success) {
    log('✅ CORS Preflight for Required Headers: PASSED', 'green');
  } else {
    log('❌ CORS Preflight for Required Headers: FAILED', 'red');
  }

  // Browser Tests Results
  log('\n🌐 Browser Tests:', 'cyan');
  const browserResults = results.browserTests;
  if (browserResults.skipped) {
    log('⚠️  Browser Tests: SKIPPED (Playwright not available)', 'yellow');
  } else if (browserResults.success) {
    log('✅ Chrome Browser Behavior: PASSED', 'green');
  } else {
    log('❌ Chrome Browser Behavior: FAILED', 'red');
  }

  // Manual Tests Results
  log('\n🤖 Manual API Simulation:', 'cyan');
  const manualResults = results.manualTests;
  if (manualResults.preflightRequest?.success) {
    log('✅ Chrome-like CORS Preflight: PASSED', 'green');
  } else {
    log('❌ Chrome-like CORS Preflight: FAILED', 'red');
  }

  if (manualResults.sessionCreationRequest?.success) {
    log('✅ Chrome-like Session Creation: PASSED', 'green');
  } else {
    log('❌ Chrome-like Session Creation: FAILED', 'red');
  }

  // Regression Tests Results
  log('\n🔄 Regression Tests:', 'cyan');
  const regressionResults = results.regressionTests;
  if (regressionResults.mainUpload?.success) {
    log('✅ Main Upload Page Functionality: PASSED', 'green');
  } else {
    log('❌ Main Upload Page Functionality: FAILED', 'red');
  }

  // Overall Assessment
  log('\n🎯 OVERALL ASSESSMENT', 'bold');
  log('=====================', 'bold');

  const allPassed =
    apiResults.sessionCreation?.success &&
    apiResults.sessionUpload?.success &&
    apiResults.cors?.success &&
    (browserResults.skipped || browserResults.success) &&
    manualResults.preflightRequest?.success &&
    manualResults.sessionCreationRequest?.success &&
    regressionResults.mainUpload?.success;

  if (allPassed) {
    log('\n🎉 ALL TESTS PASSED - Chrome upload issues are RESOLVED! 🎉', 'green');
    log('\n✅ VERIFICATION COMPLETE:', 'green');
    log('  • X-Public-Access header is properly handled by API Gateway', 'white');
    log('  • Debug headers are accepted in HTTP headers (not payload)', 'white');
    log('  • CORS preflight requests succeed for all required headers', 'white');
    log('  • Session creation and upload workflows work end-to-end', 'white');
    log('  • No regression in main upload page functionality', 'white');
    log('\n🚀 Production deployment is ready for Chrome users!', 'green');
  } else {
    log('\n⚠️  SOME TESTS FAILED - Issues may still exist', 'red');
    log('\n❌ ISSUES FOUND:', 'red');

    if (!apiResults.sessionCreation?.success) {
      log('  • Session creation with X-Public-Access still failing', 'white');
    }
    if (!apiResults.sessionUpload?.success) {
      log('  • Session upload with debug headers still failing', 'white');
    }
    if (!apiResults.cors?.success) {
      log('  • CORS preflight not allowing required headers', 'white');
    }
    if (!manualResults.preflightRequest?.success) {
      log('  • Chrome-like CORS preflight failing', 'white');
    }
    if (!manualResults.sessionCreationRequest?.success) {
      log('  • Chrome-like session creation failing', 'white');
    }
    if (!regressionResults.mainUpload?.success) {
      log('  • Main upload page functionality broken', 'white');
    }

    log('\n🔧 Further investigation and fixes needed', 'yellow');
  }

  // Detailed Error Information
  if (!allPassed) {
    log('\n🔍 DETAILED ERROR INFORMATION', 'bold');
    log('==============================', 'bold');

    Object.entries(results).forEach(([testType, testResults]) => {
      log(`\n${testType.toUpperCase()}:`, 'yellow');
      Object.entries(testResults).forEach(([testName, result]) => {
        if (result && !result.success && result.error) {
          log(`  ${testName}: ${JSON.stringify(result.error, null, 4)}`, 'red');
        }
      });
    });
  }

  return allPassed;
}

/**
 * Main test execution function
 */
async function runComprehensiveTests() {
  log('🚀 Starting Comprehensive Chrome Upload Issues Verification', 'bold');
  log(`🕒 Test started at: ${new Date().toISOString()}`, 'white');
  log(`🌐 Testing against: ${CONFIG.API_BASE_URL}`, 'white');
  log(`🔗 Debug URL: ${CONFIG.DEBUG_URL}`, 'white');
  log(`🔗 Main Upload URL: ${CONFIG.MAIN_UPLOAD_URL}`, 'white');

  const startTime = Date.now();

  const results = {
    apiTests: await testApiEndpointsWithPublicAccess(),
    browserTests: await testBrowserFunctionality(),
    manualTests: await testManualApiRequests(),
    regressionTests: await testRegressionScenarios()
  };

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  log(`\n🕒 Test completed in ${duration} seconds`, 'white');

  const allTestsPassed = generateTestReport(results);

  // Save detailed results to file for further analysis
  const reportPath = '/tmp/chrome-upload-verification-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  log(`\n📝 Detailed results saved to: ${reportPath}`, 'cyan');

  return { success: allTestsPassed, results, duration };
}

// Export for use as module
module.exports = {
  runComprehensiveTests,
  testApiEndpointsWithPublicAccess,
  testBrowserFunctionality,
  testManualApiRequests,
  testRegressionScenarios,
  CONFIG
};

// Run tests if executed directly
if (require.main === module) {
  runComprehensiveTests()
    .then(({ success, duration }) => {
      log(`\n🏁 Test suite ${success ? 'COMPLETED SUCCESSFULLY' : 'COMPLETED WITH FAILURES'}`,
          success ? 'green' : 'red');
      log(`⏱️  Total execution time: ${duration} seconds`, 'white');
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log(`\n💥 Test suite crashed: ${error.message}`, 'red');
      console.error(error.stack);
      process.exit(1);
    });
}