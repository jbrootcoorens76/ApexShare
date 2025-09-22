#!/usr/bin/env node

/**
 * Test script to verify the upload endpoint now accepts the correct payload format
 */

const https = require('https');

// Test the corrected payload format
const correctPayload = JSON.stringify({
  fileName: "test-video.mp4",
  fileSize: 12345678,
  mimeType: "video/mp4"
});

// Test the incorrect payload format (what the frontend was sending before)
const incorrectPayload = JSON.stringify({
  studentEmail: "session@placeholder.com",
  fileName: "test-video.mp4",
  fileSize: 12345678,
  contentType: "video/mp4"
});

console.log('🧪 Testing Upload Endpoint Payload Formats\n');

async function testPayload(description, payload) {
  return new Promise((resolve) => {
    const postData = payload;

    const options = {
      hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
      port: 443,
      path: '/v1/sessions/test-session/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`📤 ${description}`);
    console.log(`   Payload size: ${Buffer.byteLength(postData)} bytes`);
    console.log(`   Payload: ${postData}`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`   ✅ Status: ${res.statusCode}`);
        console.log(`   📄 Response: ${data}`);
        console.log();
        resolve();
      });
    });

    req.on('error', (e) => {
      console.log(`   ❌ Error: ${e.message}`);
      console.log();
      resolve();
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log(`Payload sizes:`);
  console.log(`- Correct format: ${Buffer.byteLength(correctPayload)} bytes`);
  console.log(`- Incorrect format: ${Buffer.byteLength(incorrectPayload)} bytes\n`);

  await testPayload('Testing CORRECT payload format (fileName, fileSize, mimeType)', correctPayload);
  await testPayload('Testing INCORRECT payload format (studentEmail, contentType)', incorrectPayload);

  console.log('🎯 Expected Results:');
  console.log('- Correct format: Should get 403 Unauthorized (passes validation, but no auth token)');
  console.log('- Incorrect format: Should get 400 Bad Request (fails validation)');
}

runTests().catch(console.error);