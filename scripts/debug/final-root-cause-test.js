#!/usr/bin/env node

/**
 * Final Root Cause Test
 *
 * Testing with the proper X-Public-Access header that the frontend should be sending
 * This should resolve the 401/403 errors and test the actual upload validation
 */

const https = require('https');

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';

// User's exact payload that's failing
const USER_FAILING_PAYLOAD = {
  fileName: "GX010492.MP4",
  fileSize: 426210557,
  contentType: "video/mp4"
};

/**
 * Make HTTP request with X-Public-Access header
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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Origin': 'https://apexshare.be',
        'Referer': 'https://apexshare.be/',
        'X-Public-Access': 'true',  // THIS IS THE KEY HEADER MISSING FROM PREVIOUS TESTS
        ...headers
      }
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    console.log(`\n🔍 ${method} ${url}`);
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

          console.log(`\n📊 Status: ${res.statusCode}`);
          console.log('📄 Response Body:', responseData);

          resolve(result);
        } catch (parseError) {
          console.log(`\n⚠️  Status: ${res.statusCode} (JSON Parse Failed)`);
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
      console.error('\n❌ Network Error:', error.message);
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Test session creation with proper headers
 */
async function testSessionCreation() {
  console.log('\n🧪 TEST 1: Session Creation with X-Public-Access');
  console.log('=' .repeat(60));

  const sessionData = {
    studentName: 'Test Student',
    studentEmail: 'test@example.com',
    sessionDate: '2025-09-22',
    trainerName: 'Test Trainer',
    notes: 'Final root cause test'
  };

  try {
    const response = await makeRequest('POST', `${API_BASE_URL}/sessions`, sessionData);

    if (response.statusCode === 201) {
      console.log('✅ Session creation: SUCCESS');
      return response.parsedBody?.data?.id || null;
    } else {
      console.log('❌ Session creation: FAILED');
      console.log('Status:', response.statusCode);
      return null;
    }
  } catch (error) {
    console.log('❌ Session creation: ERROR -', error.message);
    return null;
  }
}

/**
 * Test upload URL request with proper headers and exact payload
 */
async function testUploadUrlRequest(sessionId) {
  console.log('\n🧪 TEST 2: Upload URL Request with X-Public-Access');
  console.log('=' .repeat(60));

  try {
    const response = await makeRequest(
      'POST',
      `${API_BASE_URL}/sessions/${sessionId}/upload`,
      USER_FAILING_PAYLOAD
    );

    console.log(`\n🔬 Analysis of Status ${response.statusCode}:`);

    if (response.statusCode === 200) {
      console.log('✅ SUCCESS! Upload URL request works!');
      console.log('🎉 The "Failed to fetch" issue is resolved!');
      return true;
    } else if (response.statusCode === 400) {
      console.log('❌ VALIDATION ERROR: API Gateway request validation issue');
      console.log('🔧 This confirms the validation model needs fixing');
      if (response.parsedBody?.message) {
        console.log('💡 Specific Error:', response.parsedBody.message);
      }
      return false;
    } else if (response.statusCode === 404) {
      console.log('❌ NOT FOUND: Session not found or endpoint missing');
      return false;
    } else if (response.statusCode === 401 || response.statusCode === 403) {
      console.log('❌ STILL UNAUTHORIZED: X-Public-Access header not working');
      console.log('🔧 Frontend needs to send X-Public-Access: true header');
      return false;
    } else {
      console.log(`❌ UNEXPECTED STATUS: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log('❌ NETWORK ERROR:', error.message);
    return false;
  }
}

/**
 * Main test execution
 */
async function runTest() {
  console.log('🔍 FINAL ROOT CAUSE VALIDATION');
  console.log('=' .repeat(80));
  console.log('🎯 Testing with X-Public-Access header');
  console.log('📅 Date:', new Date().toISOString());

  // Test session creation first
  const sessionId = await testSessionCreation();

  if (!sessionId) {
    console.log('\n❌ CRITICAL: Cannot create session even with X-Public-Access header');
    console.log('🔧 Frontend authentication mechanism is broken');
    return;
  }

  console.log(`\n✅ Session created: ${sessionId}`);

  // Test upload URL request
  const uploadWorks = await testUploadUrlRequest(sessionId);

  console.log('\n📊 FINAL DIAGNOSIS');
  console.log('=' .repeat(80));

  if (uploadWorks) {
    console.log('🎉 ISSUE RESOLVED!');
    console.log('✅ Upload URL requests work with proper headers');
    console.log('🔧 SOLUTION: Frontend must send "X-Public-Access: true" header');
    console.log('📝 The user\'s debug page is missing this header');
  } else {
    console.log('❌ ISSUE PERSISTS!');
    console.log('🔧 Even with authentication fixed, validation/other issues remain');
    console.log('📝 Additional fixes needed beyond authentication');
  }

  console.log('\n🔧 REQUIRED FIX FOR USER:');
  console.log('1. Frontend must include "X-Public-Access: true" in all API requests');
  console.log('2. Check debug page JavaScript to ensure header is sent');
  console.log('3. Update upload logic to include this header');
  console.log('4. Test in browser after header fix is deployed');
}

// Execute test
runTest().catch(error => {
  console.error('\n💥 Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});