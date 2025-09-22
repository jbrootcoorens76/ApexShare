#!/usr/bin/env node

/**
 * Chrome Upload Fix Validation Script
 *
 * This script validates that the API Gateway request validation fix
 * resolves the Chrome upload issue by testing the exact payload
 * that was failing.
 */

const https = require('https');

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
const TEST_SESSION_ID = '56bd700d-1ef5-446a-bb91-7c256fef52d1'; // From debug data

/**
 * Make HTTP request with detailed logging
 */
function makeRequest(method, url, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Access': 'true',
        ...headers
      }
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    console.log(`\n🔍 Making ${method} request to: ${url}`);
    console.log('📝 Headers:', JSON.stringify(options.headers, null, 2));
    if (data) {
      console.log('📦 Payload:', JSON.stringify(data, null, 2));
    }

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const result = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseData,
            parsedBody: responseData ? JSON.parse(responseData) : null
          };

          console.log(`✅ Response Status: ${res.statusCode}`);
          console.log('📋 Response Headers:', JSON.stringify(res.headers, null, 2));
          console.log('📄 Response Body:', responseData);

          resolve(result);
        } catch (parseError) {
          console.log(`⚠️  Response Status: ${res.statusCode}`);
          console.log('📄 Raw Response:', responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseData,
            parsedBody: null,
            parseError: parseError.message
          });
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Test session creation (should work)
 */
async function testSessionCreation() {
  console.log('\n🧪 TEST 1: Session Creation (Control Test)');
  console.log('=' .repeat(50));

  const sessionData = {
    studentName: 'Test Student',
    studentEmail: 'test@example.com',
    sessionDate: '2025-09-22',
    trainerName: 'Test Trainer',
    notes: 'Validation test session'
  };

  try {
    const response = await makeRequest('POST', `${API_BASE_URL}/sessions`, sessionData);

    if (response.statusCode === 201) {
      console.log('✅ Session creation: SUCCESS');
      return response.parsedBody?.data?.id || null;
    } else {
      console.log('❌ Session creation: FAILED');
      console.log('Expected: 201, Got:', response.statusCode);
      return null;
    }
  } catch (error) {
    console.log('❌ Session creation: ERROR -', error.message);
    return null;
  }
}

/**
 * Test upload URL request with the exact failing payload
 */
async function testUploadUrlRequest(sessionId) {
  console.log('\n🧪 TEST 2: Upload URL Request (Fixed Payload)');
  console.log('=' .repeat(50));

  // This is the EXACT payload that was failing before the fix
  const uploadPayload = {
    fileName: 'GX010492.MP4',
    fileSize: 426210557,
    contentType: 'video/mp4'
  };

  try {
    const response = await makeRequest(
      'POST',
      `${API_BASE_URL}/sessions/${sessionId}/upload`,
      uploadPayload
    );

    if (response.statusCode === 200) {
      console.log('✅ Upload URL request: SUCCESS');
      console.log('🎉 Chrome upload issue has been RESOLVED!');

      if (response.parsedBody?.data) {
        console.log('📋 Upload details received:');
        console.log('  - Upload ID:', response.parsedBody.data.uploadId);
        console.log('  - Upload URL:', response.parsedBody.data.uploadUrl ? 'Provided' : 'Missing');
        console.log('  - Chunk Size:', response.parsedBody.data.chunkSize || 'Not specified');
        console.log('  - Expires At:', response.parsedBody.data.expiresAt || 'Not specified');
      }

      return true;
    } else if (response.statusCode === 400) {
      console.log('❌ Upload URL request: STILL FAILING');
      console.log('🔧 API Gateway validation fix needs to be deployed');
      console.log('Error:', response.parsedBody?.error || response.body);
      return false;
    } else {
      console.log(`❌ Upload URL request: UNEXPECTED STATUS (${response.statusCode})`);
      console.log('Response:', response.parsedBody || response.body);
      return false;
    }
  } catch (error) {
    console.log('❌ Upload URL request: ERROR -', error.message);
    return false;
  }
}

/**
 * Test upload URL request with mimeType field (alternative payload format)
 */
async function testUploadUrlRequestWithMimeType(sessionId) {
  console.log('\n🧪 TEST 3: Upload URL Request with mimeType field');
  console.log('=' .repeat(50));

  // Test with mimeType instead of contentType
  const uploadPayload = {
    fileName: 'test-video.mp4',
    fileSize: 1048576, // 1MB
    mimeType: 'video/mp4'
  };

  try {
    const response = await makeRequest(
      'POST',
      `${API_BASE_URL}/sessions/${sessionId}/upload`,
      uploadPayload
    );

    if (response.statusCode === 200) {
      console.log('✅ Upload URL request with mimeType: SUCCESS');
      return true;
    } else {
      console.log(`❌ Upload URL request with mimeType: FAILED (${response.statusCode})`);
      console.log('Error:', response.parsedBody?.error || response.body);
      return false;
    }
  } catch (error) {
    console.log('❌ Upload URL request with mimeType: ERROR -', error.message);
    return false;
  }
}

/**
 * Test with both contentType and mimeType (should be allowed after fix)
 */
async function testUploadUrlRequestWithBothFields(sessionId) {
  console.log('\n🧪 TEST 4: Upload URL Request with both contentType and mimeType');
  console.log('=' .repeat(50));

  const uploadPayload = {
    fileName: 'dual-field-test.mp4',
    fileSize: 2097152, // 2MB
    contentType: 'video/mp4',
    mimeType: 'video/mp4'
  };

  try {
    const response = await makeRequest(
      'POST',
      `${API_BASE_URL}/sessions/${sessionId}/upload`,
      uploadPayload
    );

    if (response.statusCode === 200) {
      console.log('✅ Upload URL request with both fields: SUCCESS');
      return true;
    } else {
      console.log(`❌ Upload URL request with both fields: FAILED (${response.statusCode})`);
      console.log('Error:', response.parsedBody?.error || response.body);
      return false;
    }
  } catch (error) {
    console.log('❌ Upload URL request with both fields: ERROR -', error.message);
    return false;
  }
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🚀 Chrome Upload Fix Validation');
  console.log('=' .repeat(50));
  console.log('Testing the fix for "Failed to fetch" error in Chrome uploads');
  console.log('Issue: API Gateway request validation was too restrictive');
  console.log('Fix: Allow mimeType field and additionalProperties in request model');
  console.log('Date:', new Date().toISOString());

  // Use existing session ID from debug data first
  let sessionId = TEST_SESSION_ID;
  console.log(`\n📋 Using session ID: ${sessionId}`);

  // Test upload URL request with existing session
  const originalTest = await testUploadUrlRequest(sessionId);

  // If the original test fails, try creating a new session
  if (!originalTest) {
    console.log('\n🔄 Attempting to create new session for additional tests...');
    sessionId = await testSessionCreation();

    if (sessionId) {
      console.log(`\n📋 New session created: ${sessionId}`);

      // Run all tests with new session
      const test2 = await testUploadUrlRequest(sessionId);
      const test3 = await testUploadUrlRequestWithMimeType(sessionId);
      const test4 = await testUploadUrlRequestWithBothFields(sessionId);

      // Results summary
      console.log('\n📊 TEST RESULTS SUMMARY');
      console.log('=' .repeat(50));
      console.log('Session Creation:', '✅ SUCCESS');
      console.log('Upload URL (contentType):', test2 ? '✅ SUCCESS' : '❌ FAILED');
      console.log('Upload URL (mimeType):', test3 ? '✅ SUCCESS' : '❌ FAILED');
      console.log('Upload URL (both fields):', test4 ? '✅ SUCCESS' : '❌ FAILED');

      if (test2 && test3 && test4) {
        console.log('\n🎉 ALL TESTS PASSED! Chrome upload issue is RESOLVED!');
        console.log('✅ API Gateway request validation has been fixed');
        console.log('✅ Frontend uploads should now work in Chrome');
      } else {
        console.log('\n⚠️  Some tests failed. The fix may not be fully deployed yet.');
        console.log('🔧 Check API Gateway deployment status');
      }
    } else {
      console.log('\n❌ Could not create test session. Check API authentication.');
    }
  } else {
    console.log('\n🎉 PRIMARY TEST PASSED! Chrome upload issue is RESOLVED!');
    console.log('✅ The exact failing payload now works');
    console.log('✅ Frontend uploads should work in Chrome');
  }

  console.log('\n📋 Next Steps:');
  console.log('1. Test in actual browser using debug page');
  console.log('2. Verify frontend upload workflow');
  console.log('3. Monitor for any remaining issues');
  console.log('4. Update documentation with fix details');
}

// Run the tests
runTests().catch(error => {
  console.error('\n💥 Test execution failed:', error.message);
  process.exit(1);
});