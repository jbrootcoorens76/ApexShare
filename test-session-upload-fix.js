/**
 * Test script to verify session upload endpoint 400 error fix
 *
 * This tests the specific issue where API Gateway expects 'contentType'
 * but frontend sends 'mimeType', causing 400 Bad Request errors.
 */

const axios = require('axios');

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
const TEST_SESSION_ID = 'b1dcd4ef-c043-4f83-a73e-b9b8dfc62893';

async function testSessionUploadFix() {
  console.log('🧪 Testing Session Upload 400 Error Fix');
  console.log('='.repeat(50));

  const endpoint = `/sessions/${TEST_SESSION_ID}/upload`;
  const url = `${API_BASE_URL}${endpoint}`;

  console.log(`📡 Testing endpoint: ${endpoint}`);
  console.log(`🌐 Full URL: ${url}`);
  console.log('');

  // Test 1: Current frontend request (with mimeType) - should fail
  console.log('🔍 Test 1: Current Frontend Request Format (with mimeType)');
  console.log('-'.repeat(40));

  const frontendRequest = {
    fileName: 'test-video.mp4',
    fileSize: 10485760, // 10MB
    mimeType: 'video/mp4'
  };

  try {
    const response1 = await axios.post(url, frontendRequest, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Test)'
      },
      validateStatus: () => true // Don't throw on any status
    });

    console.log(`📊 Status: ${response1.status}`);
    console.log(`📋 Response: ${JSON.stringify(response1.data, null, 2)}`);

    if (response1.status === 400) {
      console.log('❌ Still returns 400 - API Gateway validation is rejecting mimeType');
    } else if (response1.status === 200) {
      console.log('✅ Success! API Gateway now accepts mimeType');
    } else {
      console.log(`⚠️  Unexpected status: ${response1.status}`);
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }

  console.log('');

  // Test 2: Legacy format (with contentType) - should work
  console.log('🔍 Test 2: Legacy API Gateway Format (with contentType)');
  console.log('-'.repeat(40));

  const legacyRequest = {
    fileName: 'test-video.mp4',
    fileSize: 10485760, // 10MB
    contentType: 'video/mp4'
  };

  try {
    const response2 = await axios.post(url, legacyRequest, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Test)'
      },
      validateStatus: () => true // Don't throw on any status
    });

    console.log(`📊 Status: ${response2.status}`);
    console.log(`📋 Response: ${JSON.stringify(response2.data, null, 2)}`);

    if (response2.status === 400) {
      console.log('❌ Still returns 400 - there may be other validation issues');
    } else if (response2.status === 200) {
      console.log('✅ Success! API Gateway accepts contentType');
    } else {
      console.log(`⚠️  Unexpected status: ${response2.status}`);
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }

  console.log('');

  // Test 3: Include both fields to see what happens
  console.log('🔍 Test 3: Include Both Fields (mimeType + contentType)');
  console.log('-'.repeat(40));

  const bothFieldsRequest = {
    fileName: 'test-video.mp4',
    fileSize: 10485760, // 10MB
    mimeType: 'video/mp4',
    contentType: 'video/mp4'
  };

  try {
    const response3 = await axios.post(url, bothFieldsRequest, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Test)'
      },
      validateStatus: () => true // Don't throw on any status
    });

    console.log(`📊 Status: ${response3.status}`);
    console.log(`📋 Response: ${JSON.stringify(response3.data, null, 2)}`);

    if (response3.status === 400) {
      console.log('❌ Still returns 400 - API Gateway may require only specific fields');
    } else if (response3.status === 200) {
      console.log('✅ Success! API Gateway accepts both fields');
    } else {
      console.log(`⚠️  Unexpected status: ${response3.status}`);
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }

  console.log('');
  console.log('📊 Analysis Summary');
  console.log('='.repeat(50));
  console.log('1. If Test 1 fails and Test 2 succeeds:');
  console.log('   → Problem is mimeType vs contentType field name mismatch');
  console.log('   → Solution: Update API Gateway model or frontend field name');
  console.log('');
  console.log('2. If both Test 1 and Test 2 fail:');
  console.log('   → Problem is deeper validation issue (required fields, etc.)');
  console.log('   → Solution: Check Lambda handler expectations vs API Gateway model');
  console.log('');
  console.log('3. If both succeed:');
  console.log('   → Problem is resolved!');
  console.log('   → The API Gateway now accepts the frontend format');
}

// Run the test
testSessionUploadFix().catch(console.error);