/**
 * Session Upload Endpoint Debugging Test Suite
 *
 * This test suite specifically targets the 400 Bad Request error
 * on the /sessions/{id}/upload endpoint to identify the exact
 * payload format requirements.
 */

const axios = require('axios');

// Test configuration
const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
const TEST_SESSION_ID = '5c527b32-d811-45c6-b9a2-6b8606081b97';
const TEST_AUTH_TOKEN = 'your-auth-token-here'; // Replace with valid token

const API_CONFIG = {
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'x-auth-token': TEST_AUTH_TOKEN
  }
};

/**
 * Test 1: Minimal Valid Payload (Based on API Gateway Model)
 * According to sessionUploadRequestModel, only these fields are required:
 * - fileName (required)
 * - fileSize (required)
 * - contentType (required)
 */
async function testMinimalValidPayload() {
  console.log('\n🧪 Test 1: Minimal Valid Payload');
  console.log('=====================================');

  const payload = {
    fileName: 'test-video.mp4',
    fileSize: 1048576, // 1MB
    contentType: 'video/mp4'
  };

  try {
    const response = await axios.post(
      `${API_BASE_URL}/sessions/${TEST_SESSION_ID}/upload`,
      payload,
      API_CONFIG
    );

    console.log('✅ SUCCESS - Status:', response.status);
    console.log('📄 Response:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    console.log('❌ FAILED - Status:', error.response?.status);
    console.log('📄 Error Response:', JSON.stringify(error.response?.data, null, 2));
    console.log('🔍 Request was:', JSON.stringify(payload, null, 2));
    return { success: false, error: error.response?.data };
  }
}

/**
 * Test 2: Test with Additional Fields (Should Fail)
 * API Gateway model has additionalProperties: false
 */
async function testWithAdditionalFields() {
  console.log('\n🧪 Test 2: Payload with Additional Fields (Should Fail)');
  console.log('========================================================');

  const payload = {
    fileName: 'test-video.mp4',
    fileSize: 1048576,
    contentType: 'video/mp4',
    // These extra fields should cause validation failure
    studentEmail: 'test@example.com',
    studentName: 'Test Student',
    notes: 'Test notes'
  };

  try {
    const response = await axios.post(
      `${API_BASE_URL}/sessions/${TEST_SESSION_ID}/upload`,
      payload,
      API_CONFIG
    );

    console.log('⚠️  UNEXPECTED SUCCESS - Status:', response.status);
    console.log('📄 Response:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    console.log('✅ EXPECTED FAILURE - Status:', error.response?.status);
    console.log('📄 Error Response:', JSON.stringify(error.response?.data, null, 2));
    console.log('🔍 This should fail due to additionalProperties: false');
    return { success: false, error: error.response?.data };
  }
}

/**
 * Test 3: Missing Required Fields
 */
async function testMissingRequiredFields() {
  console.log('\n🧪 Test 3: Missing Required Fields');
  console.log('=====================================');

  const payload = {
    fileName: 'test-video.mp4'
    // Missing fileSize and contentType
  };

  try {
    const response = await axios.post(
      `${API_BASE_URL}/sessions/${TEST_SESSION_ID}/upload`,
      payload,
      API_CONFIG
    );

    console.log('⚠️  UNEXPECTED SUCCESS - Status:', response.status);
    console.log('📄 Response:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    console.log('✅ EXPECTED FAILURE - Status:', error.response?.status);
    console.log('📄 Error Response:', JSON.stringify(error.response?.data, null, 2));
    console.log('🔍 This should fail due to missing required fields');
    return { success: false, error: error.response?.data };
  }
}

/**
 * Test 4: Invalid File Extension
 */
async function testInvalidFileExtension() {
  console.log('\n🧪 Test 4: Invalid File Extension');
  console.log('=====================================');

  const payload = {
    fileName: 'test-video.txt', // Invalid extension
    fileSize: 1048576,
    contentType: 'video/mp4'
  };

  try {
    const response = await axios.post(
      `${API_BASE_URL}/sessions/${TEST_SESSION_ID}/upload`,
      payload,
      API_CONFIG
    );

    console.log('⚠️  UNEXPECTED SUCCESS - Status:', response.status);
    console.log('📄 Response:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    console.log('✅ EXPECTED FAILURE - Status:', error.response?.status);
    console.log('📄 Error Response:', JSON.stringify(error.response?.data, null, 2));
    console.log('🔍 This should fail due to invalid file extension pattern');
    return { success: false, error: error.response?.data };
  }
}

/**
 * Test 5: Invalid Content Type
 */
async function testInvalidContentType() {
  console.log('\n🧪 Test 5: Invalid Content Type');
  console.log('=====================================');

  const payload = {
    fileName: 'test-video.mp4',
    fileSize: 1048576,
    contentType: 'application/pdf' // Invalid content type
  };

  try {
    const response = await axios.post(
      `${API_BASE_URL}/sessions/${TEST_SESSION_ID}/upload`,
      payload,
      API_CONFIG
    );

    console.log('⚠️  UNEXPECTED SUCCESS - Status:', response.status);
    console.log('📄 Response:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    console.log('✅ EXPECTED FAILURE - Status:', error.response?.status);
    console.log('📄 Error Response:', JSON.stringify(error.response?.data, null, 2));
    console.log('🔍 This should fail due to invalid content type enum');
    return { success: false, error: error.response?.data };
  }
}

/**
 * Test 6: Compare with Working /uploads/initiate Endpoint
 */
async function testWorkingUploadsInitiate() {
  console.log('\n🧪 Test 6: Working /uploads/initiate Endpoint (for comparison)');
  console.log('==============================================================');

  const payload = {
    studentEmail: 'test@example.com',
    studentName: 'Test Student',
    fileName: 'test-video.mp4',
    fileSize: 1048576,
    contentType: 'video/mp4'
  };

  try {
    const response = await axios.post(
      `${API_BASE_URL}/uploads/initiate`,
      payload,
      API_CONFIG
    );

    console.log('✅ SUCCESS - Status:', response.status);
    console.log('📄 Response:', JSON.stringify(response.data, null, 2));
    console.log('🔍 This endpoint works with different payload structure');
    return { success: true, data: response.data };
  } catch (error) {
    console.log('❌ FAILED - Status:', error.response?.status);
    console.log('📄 Error Response:', JSON.stringify(error.response?.data, null, 2));
    return { success: false, error: error.response?.data };
  }
}

/**
 * Test 7: Verify Authorization Header Handling
 */
async function testWithoutAuthToken() {
  console.log('\n🧪 Test 7: Without Authorization Token');
  console.log('=====================================');

  const payload = {
    fileName: 'test-video.mp4',
    fileSize: 1048576,
    contentType: 'video/mp4'
  };

  const configWithoutAuth = {
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json'
      // No x-auth-token header
    }
  };

  try {
    const response = await axios.post(
      `${API_BASE_URL}/sessions/${TEST_SESSION_ID}/upload`,
      payload,
      configWithoutAuth
    );

    console.log('⚠️  SUCCESS WITHOUT AUTH - Status:', response.status);
    console.log('📄 Response:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    console.log('❌ FAILED - Status:', error.response?.status);
    console.log('📄 Error Response:', JSON.stringify(error.response?.data, null, 2));
    console.log('🔍 This could fail due to missing auth or other reasons');
    return { success: false, error: error.response?.data };
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🎯 Session Upload Endpoint Debugging Test Suite');
  console.log('================================================');
  console.log(`🌐 API Base URL: ${API_BASE_URL}`);
  console.log(`🆔 Test Session ID: ${TEST_SESSION_ID}`);
  console.log(`🔑 Auth Token: ${TEST_AUTH_TOKEN ? 'Present' : 'Missing'}`);

  const results = {
    minimalValid: await testMinimalValidPayload(),
    withAdditionalFields: await testWithAdditionalFields(),
    missingRequired: await testMissingRequiredFields(),
    invalidFileExtension: await testInvalidFileExtension(),
    invalidContentType: await testInvalidContentType(),
    workingInitiate: await testWorkingUploadsInitiate(),
    withoutAuth: await testWithoutAuthToken()
  };

  console.log('\n📊 Test Results Summary');
  console.log('========================');
  Object.entries(results).forEach(([test, result]) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test}`);
  });

  console.log('\n🎯 Key Findings:');
  console.log('================');
  console.log('1. Session upload endpoint requires EXACTLY: fileName, fileSize, contentType');
  console.log('2. No additional fields allowed (additionalProperties: false)');
  console.log('3. File name must match pattern: ^[a-zA-Z0-9\\s\\-\\._]{1,255}\\.(mp4|mov|avi|mkv)$');
  console.log('4. Content type must be one of the allowed MIME types');
  console.log('5. File size must be between 1 and MAX_FILE_SIZE');

  console.log('\n🔧 Expected Solution:');
  console.log('=====================');
  console.log('The frontend should send ONLY these three fields for session upload:');
  console.log(JSON.stringify({
    fileName: 'video-filename.mp4',
    fileSize: 1048576,
    contentType: 'video/mp4'
  }, null, 2));

  return results;
}

// Export for use in other test files
module.exports = {
  runAllTests,
  testMinimalValidPayload,
  API_BASE_URL,
  TEST_SESSION_ID
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}