#!/usr/bin/env node

const https = require('https');

// Test the exact payload that was causing the 400 error
const testPayload = {
  title: "Test Session",
  description: "Testing after cache invalidation",
  contentType: "text/plain"
};

const postData = JSON.stringify(testPayload);

const options = {
  hostname: 'l0hx9zgow8.execute-api.eu-west-1.amazonaws.com',
  path: '/v1/sessions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length,
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NzhlNzEwZS1lNmY5LTQ3ZWYtYTU0Zi1jYmNjMzE0YmMxNjUiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJpYXQiOjE3MjY5MDk4NjUsImV4cCI6OTk5OTk5OTk5OX0.cCq0EXxoW91wKz7xtopT7pUGW4eTlWmCrOqyNvyj2bg',
    'Cache-Control': 'no-cache'
  }
};

console.log('🚀 Testing session upload after cache invalidation...');
console.log('📤 Payload:', JSON.stringify(testPayload, null, 2));
console.log('🔗 Endpoint:', `https://${options.hostname}${options.path}`);
console.log('');

const req = https.request(options, (res) => {
  console.log(`📊 Status Code: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);
  console.log('');

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📥 Response Body:');
    try {
      const parsedData = JSON.parse(data);
      console.log(JSON.stringify(parsedData, null, 2));
    } catch (e) {
      console.log(data);
    }

    console.log('');
    if (res.statusCode === 201) {
      console.log('✅ SUCCESS: Session creation successful! Cache issue resolved.');
    } else if (res.statusCode === 400) {
      console.log('❌ FAILED: Still getting 400 error. Cache may not be fully cleared.');
    } else {
      console.log(`⚠️  UNEXPECTED: Got status ${res.statusCode}`);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Request failed: ${e.message}`);
});

req.write(postData);
req.end();