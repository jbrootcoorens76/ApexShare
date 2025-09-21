const https = require('https');

// Test configuration
const BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';

// First, get a valid JWT token by logging in
const loginData = JSON.stringify({
  email: 'trainer@apexshare.be',
  password: 'demo123'
});

const loginOptions = {
  hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
  port: 443,
  path: '/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
};

console.log('🔐 Step 1: Logging in to get JWT token...');

const loginReq = https.request(loginOptions, (loginRes) => {
  let loginData = '';

  loginRes.on('data', (chunk) => {
    loginData += chunk;
  });

  loginRes.on('end', () => {
    console.log('📊 Login Response Status:', loginRes.statusCode);
    console.log('📊 Login Response Headers:', loginRes.headers);
    console.log('📊 Login Response Body:', loginData);

    if (loginRes.statusCode === 200) {
      const loginResponse = JSON.parse(loginData);
      const token = loginResponse.data.token;

      console.log('✅ Login successful, got token:', token.substring(0, 50) + '...');

      // Now test the session upload with the token
      testSessionUpload(token);
    } else {
      console.log('❌ Login failed');
    }
  });
});

loginReq.on('error', (error) => {
  console.error('❌ Login request error:', error);
});

loginReq.write(loginData);
loginReq.end();

function testSessionUpload(token) {
  const uploadData = JSON.stringify({
    fileName: 'test-session-video.mp4',
    fileSize: 1048576, // 1MB
    mimeType: 'video/mp4'
  });

  const uploadOptions = {
    hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
    port: 443,
    path: '/v1/sessions/test-session-123/upload',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Length': Buffer.byteLength(uploadData)
    }
  };

  console.log('\n🚀 Step 2: Testing session upload with Bearer token...');
  console.log('📍 URL:', BASE_URL + '/sessions/test-session-123/upload');
  console.log('🔑 Authorization header set with Bearer token');

  const uploadReq = https.request(uploadOptions, (uploadRes) => {
    let responseData = '';

    uploadRes.on('data', (chunk) => {
      responseData += chunk;
    });

    uploadRes.on('end', () => {
      console.log('\n📊 Session Upload Test Results:');
      console.log('Status Code:', uploadRes.statusCode);
      console.log('Response Headers:', uploadRes.headers);
      console.log('Response Body:', responseData);

      if (uploadRes.statusCode === 200) {
        console.log('✅ SUCCESS: Session upload endpoint now accepts authorized requests!');
      } else if (uploadRes.statusCode === 403) {
        console.log('❌ STILL GETTING 403: Authorization validation may not be working correctly');
      } else {
        console.log('⚠️  UNEXPECTED STATUS:', uploadRes.statusCode);
      }
    });
  });

  uploadReq.on('error', (error) => {
    console.error('❌ Upload request error:', error);
  });

  uploadReq.write(uploadData);
  uploadReq.end();
}