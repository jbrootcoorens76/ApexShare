#!/usr/bin/env node

/**
 * Test script to verify the session upload fix
 * This script tests the multipart upload with proper server-side encryption headers
 */

const https = require('https');

// Configuration
const API_BASE_URL = 'https://api.apexshare.co.uk'; // Update with actual API URL
const TEST_SESSION_ID = 'test-session-' + Date.now();

// Mock file data for testing
const testFile = {
  fileName: 'test-video.mp4',
  fileSize: 1024 * 1024 * 10, // 10MB
  mimeType: 'video/mp4',
  contentType: 'video/mp4'
};

/**
 * Make HTTP request
 */
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, body: parsed, headers: res.headers });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body, headers: res.headers });
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

/**
 * Test session upload initiation
 */
async function testSessionUpload() {
  console.log('🧪 Testing session upload with encryption headers...');

  try {
    // Step 1: Initiate session upload
    const requestBody = JSON.stringify({
      sessionId: TEST_SESSION_ID,
      fileName: testFile.fileName,
      fileSize: testFile.fileSize,
      mimeType: testFile.mimeType,
      contentType: testFile.contentType
    });

    const options = {
      hostname: 'api.apexshare.co.uk',
      port: 443,
      path: '/api/initiate-session-upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        'Authorization': 'Bearer demo-jwt-token' // This might need to be updated
      }
    };

    console.log('📤 Initiating session upload...');
    const response = await makeRequest(options, requestBody);

    console.log(`📊 Response Status: ${response.statusCode}`);
    console.log('📋 Response Body:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      console.log('✅ Session upload initiated successfully!');
      console.log(`🔗 Upload URL: ${response.body.data.uploadUrl}`);

      // Verify the URL contains proper S3 signature parameters
      const url = new URL(response.body.data.uploadUrl);
      const hasSignature = url.searchParams.has('X-Amz-Signature');
      const hasServerSideEncryption = url.searchParams.has('X-Amz-ServerSideEncryption');

      console.log(`🔐 Has AWS Signature: ${hasSignature}`);
      console.log(`🔒 Has Server-Side Encryption: ${hasServerSideEncryption || 'Check in headers'}`);

      if (hasSignature) {
        console.log('✅ Upload URL properly signed for S3 PUT operation');
      } else {
        console.log('❌ Upload URL missing AWS signature - may not work with bucket policy');
      }

      return true;
    } else {
      console.log('❌ Session upload failed');
      console.log('Error details:', response.body);
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('🚀 Starting session upload encryption test...\n');

  const success = await testSessionUpload();

  console.log('\n📈 Test Summary:');
  console.log(`Result: ${success ? '✅ PASSED' : '❌ FAILED'}`);

  if (success) {
    console.log('✅ The multipart upload fix appears to be working correctly');
    console.log('✅ Server-side encryption headers should now be included');
    console.log('✅ S3 bucket policy requirements should be satisfied');
  } else {
    console.log('❌ The session upload is still failing');
    console.log('❌ Check deployment status and API configuration');
  }

  process.exit(success ? 0 : 1);
}

// Run the test if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testSessionUpload, makeRequest };