#!/usr/bin/env node

/**
 * Chrome-Specific Upload Issues Verification
 *
 * This test focuses specifically on the two fixes that were deployed:
 * 1. Debug page fix - moved debug headers from payload to HTTP headers
 * 2. CORS fix - added X-Public-Access to allowed headers in API Gateway
 *
 * Tests ONLY the critical Chrome issues that were reported.
 */

const https = require('https');

// Configuration
const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';

// ANSI Colors
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

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
    req.setTimeout(30000, () => {
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
 * CRITICAL TEST 1: Session Creation with X-Public-Access Header
 * This was failing in Chrome due to CORS - verify it's fixed
 */
async function testSessionCreationCORSFix() {
  log('\n🔥 CRITICAL TEST 1: Session Creation CORS Fix', 'cyan');
  log('='.repeat(60), 'cyan');

  // Test the exact scenario that was failing in Chrome
  const sessionData = {
    studentName: 'Chrome Test User',
    studentEmail: 'chrome.test@motorcycletraining.com',
    sessionDate: '2025-01-22',
    notes: 'Testing Chrome CORS fix'
  };

  const options = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: '/v1/sessions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Public-Access': 'true',  // This header was not allowed in CORS before
      'Origin': 'https://apexshare.be',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    }
  };

  try {
    const response = await makeRequest(options, JSON.stringify(sessionData));

    log(`Status Code: ${response.statusCode}`, response.statusCode === 201 ? 'green' : 'red');
    log(`CORS Origin: ${response.headers['access-control-allow-origin']}`, 'yellow');

    if (response.statusCode === 201) {
      log('✅ SUCCESS: Session creation with X-Public-Access works!', 'green');
      log('✅ CORS FIX CONFIRMED: X-Public-Access header is properly handled', 'green');
      return {
        success: true,
        sessionId: response.body.sessionId,
        message: 'Session creation CORS fix is working'
      };
    } else {
      log('❌ FAILED: Session creation still has issues', 'red');
      log(`Response: ${JSON.stringify(response.body, null, 2)}`, 'red');
      return { success: false, error: response.body };
    }
  } catch (error) {
    log(`❌ REQUEST FAILED: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * CRITICAL TEST 2: Session Upload with Debug Headers in HTTP Headers
 * This was causing 400 Bad Request errors - verify it's fixed
 */
async function testDebugHeadersFix(sessionId) {
  log('\n🔥 CRITICAL TEST 2: Debug Headers Fix', 'cyan');
  log('='.repeat(60), 'cyan');

  // Test the exact scenario that was causing 400 errors
  const uploadData = {
    fileName: 'chrome-debug-test.mp4',
    fileSize: 1048576, // 1MB
    contentType: 'video/mp4'
    // NOTE: Debug info is now in HTTP headers, NOT in payload
  };

  const options = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: `/v1/sessions/${sessionId}/upload`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Public-Access': 'true',
      'Origin': 'https://apexshare.be',
      // DEBUG INFO NOW IN HTTP HEADERS (this was the fix)
      'X-Debug-Student-Email': 'chrome.test@motorcycletraining.com',
      'X-Debug-Student-Name': 'Chrome Test User',
      'X-Debug-Notes': 'Testing debug headers fix',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    }
  };

  try {
    const response = await makeRequest(options, JSON.stringify(uploadData));

    log(`Status Code: ${response.statusCode}`, response.statusCode === 200 ? 'green' : 'red');
    log(`CORS Origin: ${response.headers['access-control-allow-origin']}`, 'yellow');

    if (response.statusCode === 200) {
      log('✅ SUCCESS: Session upload with debug headers works!', 'green');
      log('✅ DEBUG FIX CONFIRMED: Debug headers in HTTP headers are properly handled', 'green');
      return {
        success: true,
        uploadUrl: response.body.uploadUrl,
        message: 'Debug headers fix is working'
      };
    } else {
      log('❌ FAILED: Session upload still returns 400 errors', 'red');
      log(`Response: ${JSON.stringify(response.body, null, 2)}`, 'red');
      return { success: false, error: response.body };
    }
  } catch (error) {
    log(`❌ REQUEST FAILED: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * CRITICAL TEST 3: CORS Preflight for X-Public-Access
 * Verify that Chrome's preflight request succeeds for X-Public-Access
 */
async function testCORSPreflightForPublicAccess() {
  log('\n🔥 CRITICAL TEST 3: CORS Preflight for X-Public-Access', 'cyan');
  log('='.repeat(60), 'cyan');

  // Simulate the exact preflight request Chrome makes
  const options = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: '/v1/sessions',
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://apexshare.be',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-public-access', // Only the essential headers
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    }
  };

  try {
    const response = await makeRequest(options);

    log(`Status Code: ${response.statusCode}`, response.statusCode === 200 || response.statusCode === 204 ? 'green' : 'red');

    const allowedHeaders = response.headers['access-control-allow-headers'] || '';
    const allowedOrigin = response.headers['access-control-allow-origin'] || '';

    log(`Allowed Headers: ${allowedHeaders}`, 'yellow');
    log(`Allowed Origin: ${allowedOrigin}`, 'yellow');

    // Check if X-Public-Access is in the allowed headers list
    const hasPublicAccess = allowedHeaders.toLowerCase().includes('x-public-access');
    const hasCorrectOrigin = allowedOrigin === 'https://apexshare.be';

    if ((response.statusCode === 200 || response.statusCode === 204) && hasPublicAccess && hasCorrectOrigin) {
      log('✅ SUCCESS: CORS preflight allows X-Public-Access header!', 'green');
      log('✅ CORS FIX CONFIRMED: Chrome preflight requests will succeed', 'green');
      return {
        success: true,
        allowedHeaders,
        message: 'CORS preflight fix is working'
      };
    } else {
      log('❌ FAILED: CORS preflight issues detected', 'red');
      log(`Has X-Public-Access: ${hasPublicAccess}`, hasPublicAccess ? 'green' : 'red');
      log(`Has Correct Origin: ${hasCorrectOrigin}`, hasCorrectOrigin ? 'green' : 'red');
      return { success: false, error: 'CORS preflight validation failed' };
    }
  } catch (error) {
    log(`❌ PREFLIGHT FAILED: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * VERIFICATION TEST 4: Complete Upload Workflow
 * Test the entire workflow that was failing in Chrome
 */
async function testCompleteWorkflow() {
  log('\n🔥 VERIFICATION: Complete Chrome Upload Workflow', 'cyan');
  log('='.repeat(60), 'cyan');

  log('Step 1: Testing session creation...', 'blue');
  const sessionResult = await testSessionCreationCORSFix();

  if (!sessionResult.success) {
    log('❌ Workflow failed at session creation', 'red');
    return { success: false, failedAt: 'session_creation', error: sessionResult.error };
  }

  log('Step 2: Testing upload URL generation...', 'blue');
  const uploadResult = await testDebugHeadersFix(sessionResult.sessionId);

  if (!uploadResult.success) {
    log('❌ Workflow failed at upload URL generation', 'red');
    return { success: false, failedAt: 'upload_url_generation', error: uploadResult.error };
  }

  log('Step 3: Testing CORS preflight...', 'blue');
  const corsResult = await testCORSPreflightForPublicAccess();

  if (!corsResult.success) {
    log('❌ Workflow failed at CORS preflight', 'red');
    return { success: false, failedAt: 'cors_preflight', error: corsResult.error };
  }

  log('✅ COMPLETE WORKFLOW SUCCESS!', 'green');
  return {
    success: true,
    sessionId: sessionResult.sessionId,
    uploadUrl: uploadResult.uploadUrl,
    message: 'Complete Chrome upload workflow is working'
  };
}

/**
 * Generate focused test report
 */
function generateReport(results) {
  log('\n' + '='.repeat(80), 'cyan');
  log('🎯 CHROME UPLOAD FIXES VERIFICATION REPORT', 'cyan');
  log('='.repeat(80), 'cyan');

  log('\n📊 TEST RESULTS:', 'bold');

  const { sessionCreation, debugHeaders, corsPreflght, completeWorkflow } = results;

  // Test 1: Session Creation CORS Fix
  if (sessionCreation?.success) {
    log('✅ Session Creation CORS Fix: WORKING', 'green');
  } else {
    log('❌ Session Creation CORS Fix: FAILED', 'red');
  }

  // Test 2: Debug Headers Fix
  if (debugHeaders?.success) {
    log('✅ Debug Headers Fix: WORKING', 'green');
  } else {
    log('❌ Debug Headers Fix: FAILED', 'red');
  }

  // Test 3: CORS Preflight Fix
  if (corsPreflght?.success) {
    log('✅ CORS Preflight Fix: WORKING', 'green');
  } else {
    log('❌ CORS Preflight Fix: FAILED', 'red');
  }

  // Test 4: Complete Workflow
  if (completeWorkflow?.success) {
    log('✅ Complete Chrome Workflow: WORKING', 'green');
  } else {
    log('❌ Complete Chrome Workflow: FAILED', 'red');
  }

  // Overall Assessment
  const allWorking = sessionCreation?.success && debugHeaders?.success && corsPreflght?.success && completeWorkflow?.success;

  log('\n🎯 OVERALL ASSESSMENT:', 'bold');
  if (allWorking) {
    log('🎉 SUCCESS: Chrome upload issues are RESOLVED! 🎉', 'green');
    log('\n✅ CONFIRMED FIXES:', 'green');
    log('  • X-Public-Access header is now allowed in CORS', 'white');
    log('  • Debug headers are handled in HTTP headers (not payload)', 'white');
    log('  • Session creation works without authentication errors', 'white');
    log('  • Upload URL generation works without 400 errors', 'white');
    log('  • Complete workflow functions end-to-end', 'white');
    log('\n🚀 Chrome users can now use the debug upload page successfully!', 'green');
  } else {
    log('⚠️  ISSUES REMAIN: Some Chrome problems are not fully resolved', 'red');
    log('\n❌ REMAINING ISSUES:', 'red');

    if (!sessionCreation?.success) {
      log('  • Session creation with X-Public-Access still failing', 'white');
    }
    if (!debugHeaders?.success) {
      log('  • Debug headers in HTTP headers not working', 'white');
    }
    if (!corsPreflght?.success) {
      log('  • CORS preflight still blocking required headers', 'white');
    }
    if (!completeWorkflow?.success) {
      log('  • End-to-end workflow broken', 'white');
    }
  }

  return allWorking;
}

/**
 * Main execution
 */
async function main() {
  log('🔍 Chrome Upload Issues Verification Test', 'bold');
  log('Testing the two deployed fixes for Chrome upload problems\n', 'white');

  const startTime = Date.now();

  // Run all critical tests
  const results = {
    sessionCreation: await testSessionCreationCORSFix(),
    debugHeaders: null,
    corsPreflght: await testCORSPreflightForPublicAccess(),
    completeWorkflow: null
  };

  // Only test debug headers if session creation worked
  if (results.sessionCreation.success) {
    results.debugHeaders = await testDebugHeadersFix(results.sessionCreation.sessionId);
  } else {
    log('\n⚠️  Skipping debug headers test - session creation failed', 'yellow');
    results.debugHeaders = { success: false, error: 'Skipped due to session creation failure' };
  }

  // Test complete workflow
  results.completeWorkflow = await testCompleteWorkflow();

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  const allFixed = generateReport(results);

  log(`\n⏱️  Tests completed in ${duration} seconds`, 'white');
  log(`🏁 Result: ${allFixed ? 'ALL FIXES WORKING' : 'ISSUES REMAIN'}`, allFixed ? 'green' : 'red');

  return { success: allFixed, results, duration };
}

// Export for module use
module.exports = {
  main,
  testSessionCreationCORSFix,
  testDebugHeadersFix,
  testCORSPreflightForPublicAccess,
  testCompleteWorkflow
};

// Run if executed directly
if (require.main === module) {
  main()
    .then(({ success, duration }) => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log(`\n💥 Test execution failed: ${error.message}`, 'red');
      console.error(error.stack);
      process.exit(1);
    });
}