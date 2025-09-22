#!/usr/bin/env node

/**
 * Test script to login first and then use the token for upload
 */

const https = require('https');

async function makeRequest(hostname, path, method, headers, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: 443,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function testLoginAndUpload() {
  console.log('🔐 Step 1: Login to get a fresh JWT token...');

  // Test login first
  const loginData = JSON.stringify({
    email: 'trainer@apexshare.be',
    password: 'trainer123'
  });

  const loginResult = await makeRequest(
    'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    '/v1/auth/login',
    'POST',
    {},
    loginData
  );

  console.log('Login response:', loginResult.statusCode);
  console.log('Login body:', loginResult.body);

  if (loginResult.statusCode !== 200) {
    console.error('❌ Login failed, cannot proceed with upload test');
    return;
  }

  const loginResponse = JSON.parse(loginResult.body);
  const authToken = loginResponse.data?.token;

  if (!authToken) {
    console.error('❌ No token received from login response');
    return;
  }

  console.log('✅ Login successful, received token:', authToken.substring(0, 50) + '...');

  console.log('\n📤 Step 2: Test upload with fresh token...');

  const uploadData = JSON.stringify({
    fileName: 'video.mp4',
    fileSize: 1048576,
    contentType: 'video/mp4'
  });

  const uploadResult = await makeRequest(
    'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    '/v1/sessions/8575929f-5a07-4926-92c5-4ed1298907ae/upload',
    'POST',
    {
      'Authorization': `Bearer ${authToken}`,
      'User-Agent': 'ApexShare-Test/1.0'
    },
    uploadData
  );

  console.log('Upload response:', uploadResult.statusCode);
  console.log('Upload body:', uploadResult.body);

  if (uploadResult.statusCode === 200) {
    console.log('\n✅ Upload successful! The issue was the JWT token.');
  } else if (uploadResult.statusCode === 403) {
    console.log('\n❌ Still getting 403 with fresh token - there may be another auth issue');
  } else if (uploadResult.statusCode === 400) {
    console.log('\n🎯 Getting 400 - this means auth works, now we have the original validation issue!');
  } else {
    console.log(`\n⚠️  Unexpected status: ${uploadResult.statusCode}`);
  }
}

// Run the test
testLoginAndUpload()
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });