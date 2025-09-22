const https = require('https');

// Test configuration
const BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';

// Test with an invalid token
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
    'Authorization': `Bearer invalid.token.here`,
    'Content-Length': Buffer.byteLength(uploadData)
  }
};

console.log('🚀 Testing session upload with INVALID Bearer token...');
console.log('📍 URL:', BASE_URL + '/sessions/test-session-123/upload');
console.log('🔑 Authorization header set with INVALID Bearer token');

const uploadReq = https.request(uploadOptions, (uploadRes) => {
  let responseData = '';

  uploadRes.on('data', (chunk) => {
    responseData += chunk;
  });

  uploadRes.on('end', () => {
    console.log('\n📊 Invalid Token Test Results:');
    console.log('Status Code:', uploadRes.statusCode);
    console.log('Response Headers:', uploadRes.headers);
    console.log('Response Body:', responseData);

    if (uploadRes.statusCode === 403) {
      console.log('✅ SUCCESS: Authorization correctly rejects invalid tokens!');
    } else {
      console.log('❌ FAILURE: Authorization should reject invalid tokens');
    }
  });
});

uploadReq.on('error', (error) => {
  console.error('❌ Upload request error:', error);
});

uploadReq.write(uploadData);
uploadReq.end();