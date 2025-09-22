#!/usr/bin/env node

/**
 * Test script to verify the API payload fix
 * Tests the corrected payload format for /sessions/{sessionId}/upload endpoint
 */

const https = require('https');

const API_BASE_URL = 'https://api-dev.apexshare.be';
const TEST_SESSION_ID = 'test-session-123'; // Replace with actual session ID for testing
const TEST_PAYLOAD = {
  fileName: 'test-video.mp4',
  fileSize: 52428800, // 50MB as integer
  contentType: 'video/mp4' // Using contentType instead of mimeType
};

console.log('🧪 Testing API payload fix for /sessions/{sessionId}/upload endpoint');
console.log('📝 Correct payload format (only 3 fields):');
console.log(JSON.stringify(TEST_PAYLOAD, null, 2));
console.log('');

const testApiEndpoint = (sessionId, payload) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);

    const options = {
      hostname: 'api-dev.apexshare.be',
      port: 443,
      path: `/sessions/${sessionId}/upload`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'X-Public-Access': 'true',
        'X-Requested-With': generateRequestId()
      }
    };

    console.log(`🚀 Making API call: POST ${API_BASE_URL}${options.path}`);
    console.log(`📦 Payload: ${postData}`);
    console.log('');

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log(`📊 Response Status: ${res.statusCode}`);
        console.log(`📋 Response Headers:`);
        Object.entries(res.headers).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
        console.log(`📄 Response Body: ${responseData}`);
        console.log('');

        if (res.statusCode === 400) {
          console.log('❌ Still getting 400 Bad Request - API Gateway model validation failed');
          console.log('🔍 This suggests the payload format is still incorrect');
          reject(new Error(`API returned 400: ${responseData}`));
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ Success! API accepted the payload format');
          resolve({ statusCode: res.statusCode, data: responseData });
        } else {
          console.log(`⚠️  Unexpected status code: ${res.statusCode}`);
          resolve({ statusCode: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Request error: ${error.message}`);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
};

const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Test with corrected payload
console.log('🔧 Testing the corrected payload format...');
testApiEndpoint(TEST_SESSION_ID, TEST_PAYLOAD)
  .then((result) => {
    console.log('🎉 Test completed successfully!');
    console.log('✨ The API payload fix appears to be working.');
    console.log('');
    console.log('📈 Next steps:');
    console.log('1. Test with a real session ID');
    console.log('2. Test the complete upload workflow');
    console.log('3. Verify file uploads work end-to-end');
  })
  .catch((error) => {
    console.log('💥 Test failed with error:');
    console.log(error.message);
    console.log('');
    console.log('🔍 Debugging suggestions:');
    console.log('1. Check if the session ID exists');
    console.log('2. Verify API Gateway model validation');
    console.log('3. Check CloudWatch logs for detailed error messages');
  });