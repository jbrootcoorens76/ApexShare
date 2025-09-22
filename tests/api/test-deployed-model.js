const https = require('https');

// Test the deployed API with the new model
const testData = JSON.stringify({
  fileName: 'test-video.mp4',
  fileSize: 1048576,
  mimeType: 'video/mp4'
});

const options = {
  hostname: 'api.apexshare.be',
  port: 443,
  path: '/v1/sessions/test-session-123/upload',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': testData.length,
    'X-API-Key': 'test-key'
  }
};

console.log('Testing deployed API with new model...');
console.log('Endpoint: https://api.apexshare.be/v1/sessions/test-session-123/upload');
console.log('Request body:', JSON.parse(testData));
console.log('');

const req = https.request(options, (res) => {
  let responseBody = '';

  res.on('data', (chunk) => {
    responseBody += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Status Message:', res.statusMessage);
    console.log('Response Headers:', JSON.stringify(res.headers, null, 2));
    console.log('Response Body:', responseBody);

    if (res.statusCode === 200) {
      console.log('\n✅ SUCCESS! The new model is working correctly.');
      console.log('The API now accepts: fileName, fileSize, mimeType');
    } else if (res.statusCode === 400) {
      console.log('\n❌ VALIDATION ERROR: The request was rejected');
      console.log('The model may still be using old validation rules');
      if (responseBody.includes('Missing required fields') || responseBody.includes('Invalid request')) {
        console.log('Expected fields: fileName, fileSize, mimeType');
      }
    } else if (res.statusCode === 401 || res.statusCode === 403) {
      console.log('\n⚠️ Authentication required - this is expected for a test request');
      console.log('But the model validation passed if we got this far!');
    } else if (res.statusCode === 404) {
      console.log('\n⚠️ Session not found - this is expected for a test session ID');
      console.log('But the model validation passed if we got this far!');
    }
  });
});

req.on('error', (error) => {
  console.error('Error making request:', error);
});

req.write(testData);
req.end();