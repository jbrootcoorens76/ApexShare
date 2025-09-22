#!/usr/bin/env node

/**
 * Post-Fix Validation Test
 *
 * This test should be run AFTER applying the authentication fix to the sessions handler
 * to validate that the X-Public-Access header authentication is working correctly.
 */

const https = require('https');

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';

// ANSI color codes for console output
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
            body: parsedBody
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function validateFixApplied() {
  log('\n🔧 Post-Fix Validation Test', 'cyan');
  log('=' .repeat(80), 'cyan');
  log('This test validates that the X-Public-Access authentication fix has been applied correctly', 'white');

  // Test 1: X-Public-Access should now work
  log('\n📋 Test 1: Session creation with X-Public-Access (should now work)', 'blue');

  const sessionData = {
    studentName: 'Post-Fix Test Student',
    studentEmail: 'postfix.test@example.com',
    sessionDate: '2025-01-22',
    notes: 'Post-fix validation test'
  };

  const options = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: '/v1/sessions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Public-Access': 'true',
      'X-Requested-With': 'test-post-fix-validation'
    }
  };

  try {
    const response = await makeRequest(options, JSON.stringify(sessionData));

    log(`Status Code: ${response.statusCode}`, response.statusCode === 201 ? 'green' : 'red');

    if (response.statusCode === 201) {
      log('✅ SUCCESS: Sessions handler now accepts X-Public-Access authentication!', 'green');
      log('✅ FIXED: DirectUploadPage will now work correctly', 'green');

      const sessionId = response.body.data?.id;
      if (sessionId) {
        log(`   Created session ID: ${sessionId}`, 'white');
        return sessionId;
      }
    } else if (response.statusCode === 401) {
      log('❌ FAILED: Fix has not been applied yet', 'red');
      log('❌ Sessions handler still rejects X-Public-Access header', 'red');
      log(`   Error: ${response.body?.error?.message}`, 'red');
      return null;
    } else {
      log(`⚠️  UNEXPECTED: Got status ${response.statusCode}`, 'yellow');
      log(`   Response: ${JSON.stringify(response.body, null, 2)}`, 'yellow');
      return null;
    }

  } catch (error) {
    log(`❌ REQUEST FAILED: ${error.message}`, 'red');
    return null;
  }
}

async function validateCompleteWorkflow(sessionId) {
  if (!sessionId) {
    log('\n⏭️  Skipping workflow test - session creation failed', 'yellow');
    return false;
  }

  log('\n📋 Test 2: Complete workflow validation', 'blue');
  log('Testing end-to-end flow: session creation → file upload', 'white');

  // Test upload to the created session
  const uploadData = {
    fileName: 'post-fix-test-video.mp4',
    fileSize: 1048576, // 1MB
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
      'X-Requested-With': 'test-post-fix-validation'
    }
  };

  try {
    const uploadResponse = await makeRequest(uploadOptions, JSON.stringify(uploadData));

    log(`Upload Status: ${uploadResponse.statusCode}`, uploadResponse.statusCode === 200 ? 'green' : 'red');

    if (uploadResponse.statusCode === 200) {
      log('✅ SUCCESS: Complete workflow working end-to-end!', 'green');
      log('✅ Users can now upload files via apexshare.be/upload', 'green');

      if (uploadResponse.body.data?.uploadId) {
        log(`   Upload ID: ${uploadResponse.body.data.uploadId}`, 'white');
      }
      return true;
    } else {
      log('❌ FAILED: Upload still has issues', 'red');
      log(`   Upload error: ${uploadResponse.body?.error || uploadResponse.body}`, 'red');
      return false;
    }

  } catch (error) {
    log(`❌ UPLOAD FAILED: ${error.message}`, 'red');
    return false;
  }
}

async function testBothAuthMethods() {
  log('\n📋 Test 3: Verify both authentication methods still work', 'blue');

  const sessionData = {
    studentName: 'Auth Method Test',
    studentEmail: 'authmethod.test@example.com',
    sessionDate: '2025-01-22',
    notes: 'Testing both auth methods'
  };

  // Test X-Auth-Token (trainer authentication)
  const trainerOptions = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: '/v1/sessions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': 'mock-trainer-token',
      'X-Requested-With': 'test-post-fix-validation'
    }
  };

  try {
    const trainerResponse = await makeRequest(trainerOptions, JSON.stringify(sessionData));

    if (trainerResponse.statusCode === 201) {
      log('✅ X-Auth-Token authentication still working', 'green');
    } else {
      log('❌ X-Auth-Token authentication broken', 'red');
      return false;
    }

  } catch (error) {
    log(`❌ X-Auth-Token test failed: ${error.message}`, 'red');
    return false;
  }

  // Test Authorization Bearer
  const bearerOptions = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: '/v1/sessions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer mock-jwt-token',
      'X-Requested-With': 'test-post-fix-validation'
    }
  };

  try {
    const bearerResponse = await makeRequest(bearerOptions, JSON.stringify(sessionData));

    if (bearerResponse.statusCode === 201) {
      log('✅ Authorization Bearer authentication still working', 'green');
      return true;
    } else {
      log('❌ Authorization Bearer authentication broken', 'red');
      return false;
    }

  } catch (error) {
    log(`❌ Authorization Bearer test failed: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('🧪 Post-Fix Validation Test Suite', 'bold');
  log('Validating that X-Public-Access authentication fix has been applied correctly', 'white');

  // Test 1: Validate the fix
  const sessionId = await validateFixApplied();

  // Test 2: Complete workflow
  const workflowSuccess = await validateCompleteWorkflow(sessionId);

  // Test 3: Both auth methods
  const authMethodsWork = await testBothAuthMethods();

  // Summary
  log('\n📊 Post-Fix Validation Results', 'magenta');
  log('=' .repeat(80), 'magenta');

  const fixApplied = sessionId !== null;

  log(`\n🔧 Fix Applied: ${fixApplied ? '✅ YES' : '❌ NO'}`, fixApplied ? 'green' : 'red');
  log(`🔄 Workflow Working: ${workflowSuccess ? '✅ YES' : '❌ NO'}`, workflowSuccess ? 'green' : 'red');
  log(`🔐 All Auth Methods: ${authMethodsWork ? '✅ WORKING' : '❌ BROKEN'}`, authMethodsWork ? 'green' : 'red');

  if (fixApplied && workflowSuccess && authMethodsWork) {
    log('\n🎉 SUCCESS: All tests passed!', 'green');
    log('✅ X-Public-Access authentication is working', 'green');
    log('✅ DirectUploadPage will now function correctly', 'green');
    log('✅ Complete upload workflow is operational', 'green');
    log('✅ All authentication methods are preserved', 'green');

    log('\n🌟 The fix has been successfully applied!', 'bold');
    log('Users can now upload files via apexshare.be/upload without authentication errors', 'white');

  } else {
    log('\n❌ Some tests failed - fix may not be complete', 'red');

    if (!fixApplied) {
      log('• X-Public-Access authentication not working - fix needs to be applied', 'red');
    }
    if (!workflowSuccess) {
      log('• Complete workflow still broken', 'red');
    }
    if (!authMethodsWork) {
      log('• Existing authentication methods broken - fix may have introduced issues', 'red');
    }
  }
}

// Run the post-fix validation
main().catch(error => {
  log(`\n💥 Post-fix validation failed: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});