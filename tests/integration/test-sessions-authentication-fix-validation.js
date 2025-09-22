#!/usr/bin/env node

/**
 * Session Authentication Fix Validation Test
 *
 * This test validates the specific fix needed for sessions handler to support
 * X-Public-Access authentication, ensuring compatibility with DirectUploadPage.
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

async function testAuthenticationMatrix() {
  log('\n🔐 Authentication Matrix Test for Sessions Endpoint', 'cyan');
  log('=' .repeat(80), 'cyan');

  const sessionData = {
    studentName: 'Test Student',
    studentEmail: 'test.student@example.com',
    sessionDate: '2025-01-22',
    notes: 'Authentication matrix test'
  };

  const testCases = [
    {
      name: 'No Authentication Headers',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'test-auth-matrix'
      },
      expectedStatus: 401,
      description: 'Should reject requests with no auth headers'
    },
    {
      name: 'X-Public-Access: true',
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Access': 'true',
        'X-Requested-With': 'test-auth-matrix'
      },
      expectedStatus: 201, // Should work after fix
      description: 'Frontend DirectUploadPage authentication'
    },
    {
      name: 'X-Public-Access: false',
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Access': 'false',
        'X-Requested-With': 'test-auth-matrix'
      },
      expectedStatus: 401,
      description: 'Should reject when public access is explicitly false'
    },
    {
      name: 'X-Auth-Token',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': 'mock-trainer-token',
        'X-Requested-With': 'test-auth-matrix'
      },
      expectedStatus: 201,
      description: 'Trainer authentication (already working)'
    },
    {
      name: 'Authorization Bearer',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-jwt-token',
        'X-Requested-With': 'test-auth-matrix'
      },
      expectedStatus: 201,
      description: 'Standard JWT authentication (already working)'
    },
    {
      name: 'Both X-Public-Access and X-Auth-Token',
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Access': 'true',
        'X-Auth-Token': 'mock-trainer-token',
        'X-Requested-With': 'test-auth-matrix'
      },
      expectedStatus: 201,
      description: 'Should work with either auth method present'
    }
  ];

  const results = [];

  for (const testCase of testCases) {
    log(`\n📋 Test: ${testCase.name}`, 'blue');
    log(`Description: ${testCase.description}`, 'white');

    const options = {
      hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
      port: 443,
      path: '/v1/sessions',
      method: 'POST',
      headers: testCase.headers
    };

    try {
      const response = await makeRequest(options, JSON.stringify(sessionData));

      const passed = response.statusCode === testCase.expectedStatus;
      results.push({ testCase: testCase.name, passed, actual: response.statusCode, expected: testCase.expectedStatus });

      log(`Expected: ${testCase.expectedStatus}, Actual: ${response.statusCode}`, passed ? 'green' : 'red');

      if (passed) {
        log(`✅ PASS: ${testCase.name}`, 'green');
      } else {
        log(`❌ FAIL: ${testCase.name}`, 'red');
        if (response.body && response.body.error) {
          log(`   Error: ${response.body.error.message}`, 'red');
        }
      }

    } catch (error) {
      log(`❌ ERROR: ${testCase.name} - ${error.message}`, 'red');
      results.push({ testCase: testCase.name, passed: false, actual: 'ERROR', expected: testCase.expectedStatus });
    }

    // Brief delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

async function testCompleteWorkflow() {
  log('\n🔄 Complete Workflow Test (DirectUploadPage Simulation)', 'cyan');
  log('=' .repeat(80), 'cyan');

  // Step 1: Create session with X-Public-Access (what frontend does)
  log('\n📋 Step 1: Create session with X-Public-Access header', 'blue');

  const sessionData = {
    studentName: 'Workflow Test Student',
    studentEmail: 'workflow.test@example.com',
    sessionDate: '2025-01-22',
    notes: 'Complete workflow validation test'
  };

  const sessionOptions = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: '/v1/sessions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Public-Access': 'true',
      'X-Requested-With': 'test-complete-workflow'
    }
  };

  let sessionId = null;

  try {
    const sessionResponse = await makeRequest(sessionOptions, JSON.stringify(sessionData));

    log(`Session Creation Status: ${sessionResponse.statusCode}`, sessionResponse.statusCode === 201 ? 'green' : 'red');

    if (sessionResponse.statusCode === 201 && sessionResponse.body && sessionResponse.body.data) {
      sessionId = sessionResponse.body.data.id;
      log(`✅ Session created successfully: ${sessionId}`, 'green');
    } else {
      log(`❌ Session creation failed`, 'red');
      log(`Response: ${JSON.stringify(sessionResponse.body, null, 2)}`, 'yellow');
      return false;
    }

  } catch (error) {
    log(`❌ Session creation error: ${error.message}`, 'red');
    return false;
  }

  // Step 2: Upload to the created session (should work)
  log('\n📋 Step 2: Upload file to created session', 'blue');

  const uploadData = {
    fileName: 'workflow-test-video.mp4',
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
      'X-Requested-With': 'test-complete-workflow'
    }
  };

  try {
    const uploadResponse = await makeRequest(uploadOptions, JSON.stringify(uploadData));

    log(`Upload Status: ${uploadResponse.statusCode}`, uploadResponse.statusCode === 200 ? 'green' : 'red');

    if (uploadResponse.statusCode === 200) {
      log(`✅ Upload initiated successfully`, 'green');
      log(`Upload ID: ${uploadResponse.body.data.uploadId}`, 'white');
      return true;
    } else {
      log(`❌ Upload failed`, 'red');
      log(`Response: ${JSON.stringify(uploadResponse.body, null, 2)}`, 'yellow');
      return false;
    }

  } catch (error) {
    log(`❌ Upload error: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('🧪 Sessions Handler Authentication Fix Validation', 'bold');
  log('Testing X-Public-Access header support for DirectUploadPage compatibility', 'white');

  // Run authentication matrix tests
  const results = await testAuthenticationMatrix();

  // Test complete workflow
  const workflowSuccess = await testCompleteWorkflow();

  // Summary
  log('\n📊 Test Results Summary', 'magenta');
  log('=' .repeat(80), 'magenta');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  log(`\nAuthentication Tests: ${passed}/${total} passed`, passed === total ? 'green' : 'red');

  for (const result of results) {
    const status = result.passed ? '✅' : '❌';
    const color = result.passed ? 'green' : 'red';
    log(`${status} ${result.testCase} (Expected: ${result.expected}, Actual: ${result.actual})`, color);
  }

  log(`\nWorkflow Test: ${workflowSuccess ? '✅ PASSED' : '❌ FAILED'}`, workflowSuccess ? 'green' : 'red');

  log('\n🛠️  Fix Required for sessions-handler/index.js:', 'yellow');
  log(`
Update the validateToken function (around line 17) to include:

// Check X-Public-Access header for frontend compatibility (add after line 23)
const publicAccess = event.headers?.['X-Public-Access'] || event.headers?.['x-public-access'];
if (publicAccess === 'true') {
  return { userId: 'public-user@apexshare.be', role: 'public' };
}
`, 'cyan');

  log('\n🎯 Expected Outcome After Fix:', 'green');
  log('• X-Public-Access: true authentication will work for sessions endpoint', 'white');
  log('• DirectUploadPage will successfully create sessions without auth errors', 'white');
  log('• Complete upload workflow will function end-to-end', 'white');
  log('• Consistent authentication behavior across sessions and upload handlers', 'white');

  if (!workflowSuccess) {
    log('\n⚠️  Current State: Public upload workflow is broken due to session creation failure', 'red');
    log('Users cannot upload files via apexshare.be/upload until this fix is applied', 'red');
  }
}

// Run the validation tests
main().catch(error => {
  log(`\n💥 Test suite failed: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});