#!/usr/bin/env node

/**
 * Test Suite: Session Creation Public Access Authentication Fix
 *
 * This test validates that the sessions handler properly accepts X-Public-Access headers
 * for the direct upload flow from apexshare.be/upload, matching the upload handler behavior.
 *
 * Issue: DirectUploadPage sends X-Public-Access: true but sessions handler only accepts
 * X-Auth-Token or Authorization headers, causing 401 Unauthorized errors.
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

async function testSessionCreationWithPublicAccess() {
  log('\n🔐 Testing Session Creation with X-Public-Access Authentication', 'cyan');
  log('=' .repeat(80), 'cyan');

  // Test 1: Session creation with X-Public-Access header (current frontend behavior)
  log('\n📋 Test 1: Session creation with X-Public-Access: true (current frontend)', 'blue');

  const sessionData = {
    studentName: 'Test Student',
    studentEmail: 'test.student@example.com',
    sessionDate: '2025-01-22',
    notes: 'Test session for public access validation'
  };

  const options = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: '/v1/sessions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Public-Access': 'true',  // This is what the frontend sends
      'X-Requested-With': 'test-sessions-public-access-fix',
      'User-Agent': 'ApexShare-SessionTest/1.0'
    }
  };

  try {
    const response = await makeRequest(options, JSON.stringify(sessionData));

    log(`Status Code: ${response.statusCode}`, response.statusCode === 201 ? 'green' : 'red');
    log(`Response Headers:`, 'yellow');
    console.log('  CORS Origin:', response.headers['access-control-allow-origin']);
    console.log('  Content-Type:', response.headers['content-type']);

    log(`Response Body:`, 'yellow');
    console.log(JSON.stringify(response.body, null, 2));

    if (response.statusCode === 201) {
      log('✅ SUCCESS: Session created successfully with X-Public-Access header', 'green');
      log('✅ FIXED: Sessions handler now accepts public access authentication', 'green');
    } else if (response.statusCode === 401) {
      log('❌ ISSUE CONFIRMED: Sessions handler rejects X-Public-Access header', 'red');
      log('❌ Sessions handler needs to be updated to match upload handler behavior', 'red');
    } else {
      log(`⚠️  UNEXPECTED: Got status ${response.statusCode} instead of 201 or 401`, 'yellow');
    }

  } catch (error) {
    log(`❌ REQUEST FAILED: ${error.message}`, 'red');
  }

  // Test 2: Compare with upload handler behavior (should work)
  log('\n📋 Test 2: Upload endpoint with X-Public-Access: true (for comparison)', 'blue');

  const uploadData = {
    fileName: 'test-video.mp4',
    fileSize: 1048576, // 1MB
    contentType: 'video/mp4'
  };

  const uploadOptions = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: '/v1/sessions/test-session-id/upload',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Public-Access': 'true',  // Same header as sessions test
      'X-Requested-With': 'test-sessions-public-access-fix',
      'User-Agent': 'ApexShare-SessionTest/1.0'
    }
  };

  try {
    const uploadResponse = await makeRequest(uploadOptions, JSON.stringify(uploadData));

    log(`Upload Status Code: ${uploadResponse.statusCode}`, uploadResponse.statusCode === 200 ? 'green' : 'red');
    log(`Upload Response Body:`, 'yellow');
    console.log(JSON.stringify(uploadResponse.body, null, 2));

    if (uploadResponse.statusCode === 200) {
      log('✅ CONFIRMED: Upload handler correctly accepts X-Public-Access header', 'green');
    } else {
      log(`⚠️  Upload endpoint also has issues: ${uploadResponse.statusCode}`, 'yellow');
    }

  } catch (error) {
    log(`❌ UPLOAD TEST FAILED: ${error.message}`, 'red');
  }

  // Test 3: Session creation with X-Auth-Token (trainer authentication)
  log('\n📋 Test 3: Session creation with X-Auth-Token (trainer authentication)', 'blue');

  const trainerOptions = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: '/v1/sessions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': 'mock-trainer-token',  // Sessions handler accepts this
      'X-Requested-With': 'test-sessions-public-access-fix',
      'User-Agent': 'ApexShare-SessionTest/1.0'
    }
  };

  try {
    const trainerResponse = await makeRequest(trainerOptions, JSON.stringify(sessionData));

    log(`Trainer Status Code: ${trainerResponse.statusCode}`, trainerResponse.statusCode === 201 ? 'green' : 'red');
    log(`Trainer Response Body:`, 'yellow');
    console.log(JSON.stringify(trainerResponse.body, null, 2));

    if (trainerResponse.statusCode === 201) {
      log('✅ CONFIRMED: Sessions handler accepts X-Auth-Token authentication', 'green');
    } else {
      log(`⚠️  Trainer authentication also has issues: ${trainerResponse.statusCode}`, 'yellow');
    }

  } catch (error) {
    log(`❌ TRAINER TEST FAILED: ${error.message}`, 'red');
  }

  // Summary and recommendations
  log('\n📊 Test Summary and Recommendations', 'magenta');
  log('=' .repeat(80), 'magenta');

  log('\n🔍 Issue Analysis:', 'yellow');
  log('• DirectUploadPage (/upload) sends X-Public-Access: true for session creation', 'white');
  log('• Sessions handler only validates X-Auth-Token and Authorization headers', 'white');
  log('• Upload handler correctly handles X-Public-Access headers', 'white');
  log('• This causes 401 errors when creating sessions from public upload page', 'white');

  log('\n🛠️  Required Fix:', 'yellow');
  log('• Update sessions handler validateToken() function to handle X-Public-Access', 'white');
  log('• Add the same logic that upload handler uses (lines 144-148)', 'white');
  log('• Ensure consistent authentication across all endpoints', 'white');

  log('\n📝 Code Fix Needed in sessions-handler/index.js:', 'yellow');
  log(`
// In validateToken function, add after line 23:

// Check X-Public-Access header for frontend compatibility
const publicAccess = event.headers?.['X-Public-Access'] || event.headers?.['x-public-access'];
if (publicAccess === 'true') {
  return { userId: 'public-user@apexshare.be', role: 'public' };
}
`, 'cyan');

  log('\n🚀 After the fix, the public upload flow should work:', 'green');
  log('1. User visits apexshare.be/upload', 'white');
  log('2. DirectUploadPage sends X-Public-Access: true to create session', 'white');
  log('3. Sessions handler accepts public access and creates session', 'white');
  log('4. Upload handler accepts public access for file upload', 'white');
  log('5. Complete workflow succeeds without authentication errors', 'white');
}

async function main() {
  log('🧪 ApexShare Session Creation Authentication Test Suite', 'bold');
  log('Testing X-Public-Access header compatibility between sessions and upload handlers', 'white');

  await testSessionCreationWithPublicAccess();

  log('\n✨ Test Suite Complete', 'bold');
  log('Check the results above to confirm the authentication fix is needed', 'white');
}

// Run the tests
main().catch(error => {
  log(`\n💥 Test suite failed: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});