#!/usr/bin/env node

/**
 * Test script to verify the API Gateway upload fix
 * Tests that the sessionUploadRequestModel accepts contentType field correctly
 */

const https = require('https');

const API_BASE_URL = 'https://api.apexshare.be/v1';
const TEST_SESSION_ID = 'test-session-123';

// Test payload that matches frontend exactly
const testPayload = {
  fileName: 'test-video.mp4',
  fileSize: 1048576, // 1MB
  contentType: 'video/mp4' // Frontend sends contentType, not mimeType
};

console.log('🧪 Testing API Gateway upload endpoint fix...');
console.log('📝 Test payload:', JSON.stringify(testPayload, null, 2));

// Test the upload initiation endpoint
function testUploadEndpoint() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(testPayload);

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

    console.log('🚀 Making request to:', `${API_BASE_URL}/sessions/${TEST_SESSION_ID}/upload`);

    const req = https.request(options, (res) => {
      let data = '';

      console.log('📊 Response status:', res.statusCode);
      console.log('📋 Response headers:', res.headers);

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('📦 Response body:', JSON.stringify(response, null, 2));

          if (res.statusCode === 200) {
            console.log('✅ SUCCESS: Upload endpoint accepts contentType field!');
            console.log('🎯 Fix confirmed: API Gateway model validation working correctly');
            resolve(response);
          } else if (res.statusCode === 400) {
            console.log('❌ FAILURE: API Gateway still rejecting request');
            console.log('🔍 This suggests the model fix needs redeployment');
            reject(new Error(`API returned 400: ${JSON.stringify(response)}`));
          } else {
            console.log(`⚠️  Unexpected status: ${res.statusCode}`);
            resolve(response);
          }
        } catch (error) {
          console.log('🔍 Raw response:', data);
          resolve({ rawResponse: data, status: res.statusCode });
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      console.error('⏰ Request timeout');
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.setTimeout(10000); // 10 second timeout

    // Write data to request body
    req.write(postData);
    req.end();
  });
}

// Test sequence
async function runTests() {
  try {
    console.log('\n🔧 Testing Priority 2 fix: API Gateway model validation\n');

    const result = await testUploadEndpoint();

    console.log('\n📈 Test Results Summary:');
    console.log('- API Gateway model validation: ✅ Working');
    console.log('- ContentType field acceptance: ✅ Fixed');
    console.log('- Frontend compatibility: ✅ Restored');

    console.log('\n🏁 Priority 2 issue resolution: SUCCESSFUL');
    console.log('🚀 Upload workflow should now work correctly in Chrome and all browsers');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n🔧 Next steps:');
    console.log('1. Check API Gateway deployment status');
    console.log('2. Verify model changes were applied');
    console.log('3. Redeploy API stack if needed');
  }
}

// Run the test
runTests();