#!/usr/bin/env node

/**
 * Final Chrome Upload Issues Validation
 *
 * This test performs the complete end-to-end validation that the two
 * Chrome upload fixes are working correctly in production:
 *
 * 1. CORS Fix: X-Public-Access header is allowed
 * 2. Debug Fix: Debug headers moved from payload to HTTP headers
 *
 * Real-world testing approach simulating actual Chrome behavior.
 */

const https = require('https');
const fs = require('fs');

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
 * Final Validation: Complete Chrome Upload Workflow
 */
async function performFinalValidation() {
  log('🎯 FINAL CHROME UPLOAD VALIDATION', 'bold');
  log('=' .repeat(60), 'cyan');

  const results = {
    step1_corsCheck: null,
    step2_sessionCreation: null,
    step3_uploadUrl: null,
    step4_regression: null,
    overall: null
  };

  // STEP 1: CORS Validation
  log('\n📋 STEP 1: CORS Preflight Validation', 'blue');
  log('-'.repeat(40), 'blue');

  try {
    const corsResponse = await makeRequest({
      hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
      port: 443,
      path: '/v1/sessions',
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://apexshare.be',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-public-access'
      }
    });

    const allowedHeaders = corsResponse.headers['access-control-allow-headers'] || '';
    const hasPublicAccess = allowedHeaders.toLowerCase().includes('x-public-access');

    log(`CORS Status: ${corsResponse.statusCode}`, corsResponse.statusCode === 204 ? 'green' : 'red');
    log(`Allowed Headers: ${allowedHeaders}`, 'yellow');
    log(`X-Public-Access Allowed: ${hasPublicAccess}`, hasPublicAccess ? 'green' : 'red');

    results.step1_corsCheck = {
      success: (corsResponse.statusCode === 200 || corsResponse.statusCode === 204) && hasPublicAccess,
      allowedHeaders
    };

    if (results.step1_corsCheck.success) {
      log('✅ CORS FIX CONFIRMED: Chrome preflight will succeed', 'green');
    } else {
      log('❌ CORS ISSUE: Chrome preflight may fail', 'red');
    }
  } catch (error) {
    log(`❌ CORS test failed: ${error.message}`, 'red');
    results.step1_corsCheck = { success: false, error: error.message };
  }

  // STEP 2: Session Creation with X-Public-Access
  log('\n📋 STEP 2: Session Creation with X-Public-Access', 'blue');
  log('-'.repeat(40), 'blue');

  try {
    const sessionResponse = await makeRequest({
      hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
      port: 443,
      path: '/v1/sessions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Access': 'true',
        'Origin': 'https://apexshare.be',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      }
    }, JSON.stringify({
      studentName: 'Final Validation Test',
      studentEmail: 'final.validation@example.com',
      sessionDate: '2025-01-22',
      notes: 'Testing complete Chrome upload workflow'
    }));

    log(`Session Status: ${sessionResponse.statusCode}`, sessionResponse.statusCode === 201 ? 'green' : 'red');

    if (sessionResponse.statusCode === 201) {
      log(`Session ID: ${sessionResponse.body.sessionId}`, 'cyan');
      log('✅ SESSION CREATION FIX CONFIRMED: X-Public-Access works', 'green');
      results.step2_sessionCreation = {
        success: true,
        sessionId: sessionResponse.body.sessionId
      };
    } else {
      log(`Error: ${JSON.stringify(sessionResponse.body, null, 2)}`, 'red');
      log('❌ SESSION CREATION ISSUE: X-Public-Access not working', 'red');
      results.step2_sessionCreation = { success: false, error: sessionResponse.body };
    }
  } catch (error) {
    log(`❌ Session creation failed: ${error.message}`, 'red');
    results.step2_sessionCreation = { success: false, error: error.message };
  }

  // STEP 3: Upload URL with Debug Headers (if session creation succeeded)
  if (results.step2_sessionCreation?.success) {
    log('\n📋 STEP 3: Upload URL with Debug Headers', 'blue');
    log('-'.repeat(40), 'blue');

    try {
      const uploadResponse = await makeRequest({
        hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
        port: 443,
        path: `/v1/sessions/${results.step2_sessionCreation.sessionId}/upload`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Public-Access': 'true',
          'Origin': 'https://apexshare.be',
          // Debug headers in HTTP headers (not in payload) - this was the key fix
          'X-Debug-Student-Email': 'final.validation@example.com',
          'X-Debug-Student-Name': 'Final Validation Test',
          'X-Debug-Notes': 'Testing debug headers in HTTP headers',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        }
      }, JSON.stringify({
        fileName: 'final-validation-test.mp4',
        fileSize: 2097152, // 2MB
        contentType: 'video/mp4'
      }));

      log(`Upload Status: ${uploadResponse.statusCode}`, uploadResponse.statusCode === 200 ? 'green' : 'red');

      if (uploadResponse.statusCode === 200) {
        log(`Upload URL: ${uploadResponse.body.uploadUrl ? 'Generated successfully' : 'Missing'}`,
            uploadResponse.body.uploadUrl ? 'green' : 'red');
        log('✅ DEBUG HEADERS FIX CONFIRMED: No more 400 errors', 'green');
        results.step3_uploadUrl = {
          success: true,
          uploadUrl: uploadResponse.body.uploadUrl
        };
      } else {
        log(`Error: ${JSON.stringify(uploadResponse.body, null, 2)}`, 'red');
        log('❌ DEBUG HEADERS ISSUE: Still getting 400 errors', 'red');
        results.step3_uploadUrl = { success: false, error: uploadResponse.body };
      }
    } catch (error) {
      log(`❌ Upload URL generation failed: ${error.message}`, 'red');
      results.step3_uploadUrl = { success: false, error: error.message };
    }
  } else {
    log('\n⚠️  STEP 3 SKIPPED: Session creation failed', 'yellow');
    results.step3_uploadUrl = { success: false, error: 'Session creation failed' };
  }

  // STEP 4: Regression Test (Main Upload Endpoint)
  log('\n📋 STEP 4: Regression Test - Main Upload Endpoint', 'blue');
  log('-'.repeat(40), 'blue');

  try {
    const regressionResponse = await makeRequest({
      hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
      port: 443,
      path: '/v1/uploads/initiate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Access': 'true',
        'Origin': 'https://apexshare.be'
      }
    }, JSON.stringify({
      studentEmail: 'regression.test@example.com',
      studentName: 'Regression Test',
      fileName: 'regression-test.mp4',
      fileSize: 1048576,
      contentType: 'video/mp4',
      sessionDate: '2025-01-22'
    }));

    log(`Regression Status: ${regressionResponse.statusCode}`, regressionResponse.statusCode === 200 ? 'green' : 'red');

    if (regressionResponse.statusCode === 200) {
      log('✅ REGRESSION TEST PASSED: Main upload still works', 'green');
      results.step4_regression = { success: true };
    } else {
      log(`Error: ${JSON.stringify(regressionResponse.body, null, 2)}`, 'red');
      log('❌ REGRESSION ISSUE: Main upload broken', 'red');
      results.step4_regression = { success: false, error: regressionResponse.body };
    }
  } catch (error) {
    log(`❌ Regression test failed: ${error.message}`, 'red');
    results.step4_regression = { success: false, error: error.message };
  }

  // OVERALL ASSESSMENT
  log('\n' + '='.repeat(60), 'cyan');
  log('🎯 FINAL VALIDATION RESULTS', 'bold');
  log('='.repeat(60), 'cyan');

  const allSuccessful =
    results.step1_corsCheck?.success &&
    results.step2_sessionCreation?.success &&
    results.step3_uploadUrl?.success &&
    results.step4_regression?.success;

  results.overall = { success: allSuccessful };

  // Step-by-step results
  log('\n📊 Step-by-Step Results:', 'white');
  log(`Step 1 - CORS Preflight: ${results.step1_corsCheck?.success ? '✅ PASS' : '❌ FAIL'}`,
      results.step1_corsCheck?.success ? 'green' : 'red');
  log(`Step 2 - Session Creation: ${results.step2_sessionCreation?.success ? '✅ PASS' : '❌ FAIL'}`,
      results.step2_sessionCreation?.success ? 'green' : 'red');
  log(`Step 3 - Upload URL (Debug): ${results.step3_uploadUrl?.success ? '✅ PASS' : '❌ FAIL'}`,
      results.step3_uploadUrl?.success ? 'green' : 'red');
  log(`Step 4 - Regression Test: ${results.step4_regression?.success ? '✅ PASS' : '❌ FAIL'}`,
      results.step4_regression?.success ? 'green' : 'red');

  // Final verdict
  log('\n🏆 FINAL VERDICT:', 'bold');
  if (allSuccessful) {
    log('🎉 SUCCESS: All Chrome upload issues are RESOLVED! 🎉', 'green');
    log('\n✅ VERIFIED FIXES:', 'green');
    log('  • CORS allows X-Public-Access header for Chrome', 'white');
    log('  • Debug headers work in HTTP headers (not payload)', 'white');
    log('  • Session creation succeeds without authentication errors', 'white');
    log('  • Upload URL generation succeeds without 400 errors', 'white');
    log('  • No regression in existing functionality', 'white');
    log('\n🚀 Production is ready for Chrome users!', 'green');
    log('🌐 Users can now use https://apexshare.be/upload-debug successfully in Chrome', 'green');
  } else {
    log('⚠️  ISSUES REMAIN: Some Chrome problems are not fully resolved', 'red');
    log('\n❌ FAILED TESTS:', 'red');
    if (!results.step1_corsCheck?.success) log('  • CORS preflight validation failed', 'white');
    if (!results.step2_sessionCreation?.success) log('  • Session creation with X-Public-Access failed', 'white');
    if (!results.step3_uploadUrl?.success) log('  • Upload URL with debug headers failed', 'white');
    if (!results.step4_regression?.success) log('  • Regression test failed', 'white');
    log('\n🔧 Further fixes required before Chrome users can upload successfully', 'yellow');
  }

  return { success: allSuccessful, results };
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();

  log('🔍 Final Chrome Upload Issues Validation', 'bold');
  log('Comprehensive end-to-end testing of deployed fixes\n', 'white');

  const { success, results } = await performFinalValidation();

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Save detailed results
  const reportPath = '/tmp/final-chrome-validation-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  log(`\n📝 Detailed results saved to: ${reportPath}`, 'cyan');
  log(`⏱️  Validation completed in ${duration} seconds`, 'white');

  return { success, results, duration };
}

// Export for module use
module.exports = {
  main,
  performFinalValidation
};

// Run if executed directly
if (require.main === module) {
  main()
    .then(({ success }) => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log(`\n💥 Validation failed: ${error.message}`, 'red');
      console.error(error.stack);
      process.exit(1);
    });
}