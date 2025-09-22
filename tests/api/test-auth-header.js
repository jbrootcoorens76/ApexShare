/**
 * Test script to verify X-Auth-Token header is being sent correctly
 * Run this from the browser console after logging in
 */

// This script can be pasted into the browser console to test the auth header
console.log('Testing authentication header configuration...');

// Check if token exists in localStorage
const token = localStorage.getItem('apexshare_auth_token');
if (token) {
  console.log('✅ Auth token found in localStorage');
  console.log('Token (first 20 chars):', token.substring(0, 20) + '...');
} else {
  console.log('❌ No auth token found in localStorage');
  console.log('Please login first');
}

// Test API call with the new header
if (token) {
  console.log('\nTesting API request with X-Auth-Token header...');

  fetch(`${window.location.origin}/api/auth/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': token  // Using X-Auth-Token instead of Authorization
    }
  })
  .then(response => {
    console.log('Response status:', response.status);
    return response.json();
  })
  .then(data => {
    if (data.success) {
      console.log('✅ Authentication successful with X-Auth-Token header!');
      console.log('User data:', data.data);
    } else {
      console.log('❌ Authentication failed:', data.error);
    }
  })
  .catch(error => {
    console.error('❌ Request failed:', error);
  });

  // Also test the upload endpoint
  console.log('\nTesting upload endpoint with X-Auth-Token header...');

  // You'll need to replace SESSION_ID with an actual session ID
  const testUploadRequest = {
    studentEmail: 'test@example.com',
    fileName: 'test-video.mp4',
    fileSize: 1024000,
    contentType: 'video/mp4'
  };

  console.log('To test upload, run:');
  console.log(`
fetch('${window.location.origin}/api/sessions/SESSION_ID/upload', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Auth-Token': '${token.substring(0, 20)}...'
  },
  body: JSON.stringify(${JSON.stringify(testUploadRequest, null, 2)})
})
  `);
}

console.log('\n=== Header Change Summary ===');
console.log('OLD: Authorization: Bearer <token>');
console.log('NEW: X-Auth-Token: <token>');
console.log('This change avoids API Gateway interpreting the Authorization header as AWS IAM authentication.');