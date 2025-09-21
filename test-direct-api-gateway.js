#!/usr/bin/env node

/**
 * Test script to call API Gateway directly (bypassing custom domain/CloudFront)
 */

const https = require('https');

async function testDirectApiGateway() {
  console.log('🔍 Testing direct API Gateway endpoint...');
  console.log('Session ID: 8575929f-5a07-4926-92c5-4ed1298907ae');
  console.log('Timestamp:', new Date().toISOString());

  const requestData = JSON.stringify({
    fileName: 'video.mp4',
    fileSize: 1048576,
    contentType: 'video/mp4'
  });

  const authToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NTc1OTI5Zi01YTA3LTQ5MjYtOTJjNS00ZWQxMjk4OTA3YWUiLCJyb2xlIjoidHJhaW5lciIsImlhdCI6MTcyNjkyMzI1OSwiZXhwIjo0ODgwNTIzMjU5fQ.j8MwZ9Fam03KZV0iBXUuKMdhFa4U5lkP4kDgMEGDMmM';

  // Test direct API Gateway endpoint
  const options = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: '/v1/sessions/8575929f-5a07-4926-92c5-4ed1298907ae/upload',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestData),
      'Authorization': authToken,
      'User-Agent': 'ApexShare-Test/1.0'
    }
  };

  console.log('\n📡 Direct API Gateway Request:');
  console.log('URL:', `https://${options.hostname}${options.path}`);
  console.log('Method:', options.method);
  console.log('Headers:', JSON.stringify(options.headers, null, 2));
  console.log('Payload:', requestData);
  console.log('Payload size:', Buffer.byteLength(requestData), 'bytes');

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log('\n📥 Response:');
      console.log('Status:', res.statusCode);
      console.log('Headers:', JSON.stringify(res.headers, null, 2));

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('Body:', data);

        if (res.statusCode === 400) {
          console.log('\n❌ Still getting 400 error');
        } else if (res.statusCode === 403) {
          console.log('\n❌ Still getting 403 error (authentication issue)');
        } else if (res.statusCode === 200) {
          console.log('\n✅ Request succeeded!');
        } else {
          console.log(`\n⚠️  Unexpected status code: ${res.statusCode}`);
        }

        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error);
      reject(error);
    });

    req.write(requestData);
    req.end();
  });
}

// Run the test
testDirectApiGateway()
  .then((result) => {
    if (result.statusCode !== 200) {
      console.log('\n🔍 If this fails with the direct API Gateway URL, the issue is in the API Gateway configuration');
      console.log('🔍 If this succeeds but the custom domain fails, the issue is with CloudFront/custom domain setup');
    }
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });