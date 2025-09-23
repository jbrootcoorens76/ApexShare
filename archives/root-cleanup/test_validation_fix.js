#!/usr/bin/env node

/**
 * Test script to specifically verify API Gateway request validation fix
 * Compares behavior with valid vs invalid payloads
 */

const https = require('https');

const API_BASE_URL = 'https://api.apexshare.be/v1';
const TEST_SESSION_ID = 'test-session-123';

function makeRequest(payload, description) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);

    const options = {
      hostname: 'api.apexshare.be',
      port: 443,
      path: `/v1/sessions/${TEST_SESSION_ID}/upload`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'X-Public-Access': 'true',
        'User-Agent': 'ApexShare-Test-Client/1.0'
      }
    };

    console.log(`\n🧪 ${description}`);
    console.log('📝 Payload:', JSON.stringify(payload, null, 2));

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`📊 Status: ${res.statusCode}`);
          console.log('📦 Response:', JSON.stringify(response, null, 2));

          // Analyze the response
          if (res.statusCode === 400) {
            console.log('❌ VALIDATION ERROR - Request rejected by API Gateway model');
          } else if (res.statusCode === 403) {
            console.log('✅ VALIDATION PASSED - Request reached Lambda (auth error expected)');
          } else {
            console.log(`ℹ️  Other status: ${res.statusCode}`);
          }

          resolve({ status: res.statusCode, body: response });
        } catch (error) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      resolve({ error: error.message });
    });

    req.setTimeout(5000);
    req.write(postData);
    req.end();
  });
}

async function runValidationTests() {
  console.log('🔧 Testing API Gateway Request Validation Fix');
  console.log('📋 Comparing different payload formats to verify model behavior\n');

  // Test 1: Valid payload with contentType (what frontend sends)
  const validPayload = {
    fileName: 'test-video.mp4',
    fileSize: 1048576,
    contentType: 'video/mp4'
  };

  // Test 2: Invalid payload missing required fields
  const invalidPayload = {
    contentType: 'video/mp4'
    // Missing fileName and fileSize
  };

  // Test 3: Old format with mimeType (should still work due to additionalProperties: true)
  const oldFormatPayload = {
    fileName: 'test-video.mp4',
    fileSize: 1048576,
    mimeType: 'video/mp4'
  };

  // Test 4: Empty payload
  const emptyPayload = {};

  try {
    const test1 = await makeRequest(validPayload, 'Test 1: Valid frontend payload (contentType)');
    const test2 = await makeRequest(invalidPayload, 'Test 2: Invalid payload (missing required fields)');
    const test3 = await makeRequest(oldFormatPayload, 'Test 3: Legacy format (mimeType)');
    const test4 = await makeRequest(emptyPayload, 'Test 4: Empty payload');

    console.log('\n📊 TEST RESULTS SUMMARY:');
    console.log('═══════════════════════════════════════');

    // Analyze results
    if (test1.status === 403) {
      console.log('✅ Test 1 PASSED: Frontend payload with contentType accepted');
    } else if (test1.status === 400) {
      console.log('❌ Test 1 FAILED: Frontend payload rejected - model still requires mimeType');
    }

    if (test2.status === 400) {
      console.log('✅ Test 2 PASSED: Invalid payload correctly rejected');
    } else {
      console.log('⚠️  Test 2 UNEXPECTED: Invalid payload not rejected');
    }

    if (test3.status === 403) {
      console.log('✅ Test 3 PASSED: Legacy mimeType format still accepted');
    } else if (test3.status === 400) {
      console.log('⚠️  Test 3: Legacy format rejected (may be expected)');
    }

    if (test4.status === 400) {
      console.log('✅ Test 4 PASSED: Empty payload correctly rejected');
    } else {
      console.log('⚠️  Test 4 UNEXPECTED: Empty payload not rejected');
    }

    console.log('\n🎯 CONCLUSION:');
    if (test1.status === 403 && test2.status === 400) {
      console.log('🎉 SUCCESS: API Gateway model fix is working correctly!');
      console.log('📱 Frontend uploads should now work in Chrome and all browsers');
      console.log('🔧 Priority 2 issue has been RESOLVED');
    } else {
      console.log('🔄 PARTIAL: Model fix may need redeployment or further investigation');
    }

  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
  }
}

runValidationTests();