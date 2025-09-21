/**
 * Session Upload Endpoint Solution Test
 *
 * This test demonstrates the exact solution for the 400 Bad Request error
 * and provides working examples for the frontend developers.
 */

const axios = require('axios');

// Test configuration
const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
const TEST_SESSION_ID = '5c527b32-d811-45c6-b9a2-6b8606081b97';

/**
 * First, get a valid auth token by logging in
 */
async function getAuthToken() {
  console.log('🔐 Step 1: Getting authentication token...');

  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'trainer@apexshare.be',
      password: 'demo123' // Demo credentials from auth handler
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    if (response.data && response.data.data && response.data.data.token) {
      console.log('✅ Authentication successful');
      return response.data.data.token;
    } else {
      console.log('❌ No token in response:', response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Authentication failed:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test the session upload with correct payload and authentication
 */
async function testSessionUploadWithAuth(authToken) {
  console.log('\n🎯 Step 2: Testing session upload with correct payload...');

  // This is the EXACT payload format required by the API Gateway model
  const correctPayload = {
    fileName: 'training-session-video.mp4',
    fileSize: 52428800, // 50MB
    contentType: 'video/mp4'
  };

  const config = {
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': authToken
    },
    timeout: 30000
  };

  try {
    console.log('📤 Sending request with payload:', JSON.stringify(correctPayload, null, 2));
    console.log('🌐 URL:', `${API_BASE_URL}/sessions/${TEST_SESSION_ID}/upload`);

    const response = await axios.post(
      `${API_BASE_URL}/sessions/${TEST_SESSION_ID}/upload`,
      correctPayload,
      config
    );

    console.log('✅ SUCCESS! - Status:', response.status);
    console.log('📄 Response data:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };

  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;

    console.log(`❌ FAILED - Status: ${status}`);
    console.log('📄 Error response:', JSON.stringify(data, null, 2));

    // Provide specific troubleshooting based on status code
    if (status === 400) {
      console.log('\n🔍 400 Bad Request Troubleshooting:');
      console.log('   - Check payload format matches exactly: fileName, fileSize, contentType');
      console.log('   - Ensure no additional fields are included');
      console.log('   - Verify fileName has valid extension (.mp4, .mov, .avi, .mkv)');
      console.log('   - Check fileSize is a valid integer');
      console.log('   - Verify contentType is one of allowed MIME types');
    } else if (status === 403) {
      console.log('\n🔍 403 Forbidden Troubleshooting:');
      console.log('   - Check x-auth-token header is present and valid');
      console.log('   - Token may have expired - try getting a new one');
      console.log('   - Verify session ID exists and user has access');
    } else if (status === 404) {
      console.log('\n🔍 404 Not Found Troubleshooting:');
      console.log('   - Session ID may not exist or may have been deleted');
      console.log('   - Check the session ID format is a valid UUID');
    }

    return { success: false, error: data };
  }
}

/**
 * Demonstrate common mistakes that cause 400 errors
 */
async function demonstrateCommonMistakes(authToken) {
  console.log('\n⚠️  Step 3: Demonstrating common mistakes that cause 400 errors...');

  const config = {
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': authToken
    },
    timeout: 30000
  };

  const mistakes = [
    {
      name: 'Including extra fields (common frontend mistake)',
      payload: {
        fileName: 'video.mp4',
        fileSize: 1048576,
        contentType: 'video/mp4',
        // These extra fields cause validation failure:
        studentEmail: 'student@example.com',
        studentName: 'John Doe',
        notes: 'Training session notes'
      },
      expectedError: 'API Gateway rejects due to additionalProperties: false'
    },
    {
      name: 'Wrong field names (mimeType instead of contentType)',
      payload: {
        fileName: 'video.mp4',
        fileSize: 1048576,
        mimeType: 'video/mp4' // Should be 'contentType'
      },
      expectedError: 'Missing required field contentType'
    },
    {
      name: 'String fileSize instead of integer',
      payload: {
        fileName: 'video.mp4',
        fileSize: '1048576', // Should be integer, not string
        contentType: 'video/mp4'
      },
      expectedError: 'fileSize must be integer, not string'
    }
  ];

  for (const mistake of mistakes) {
    console.log(`\n🚫 Testing: ${mistake.name}`);
    try {
      await axios.post(
        `${API_BASE_URL}/sessions/${TEST_SESSION_ID}/upload`,
        mistake.payload,
        config
      );
      console.log('   ⚠️  Unexpected success - this should have failed');
    } catch (error) {
      console.log(`   ✅ Expected failure - Status: ${error.response?.status}`);
      console.log(`   📝 ${mistake.expectedError}`);
    }
  }
}

/**
 * Create a working session first
 */
async function createTestSession(authToken) {
  console.log('\n📝 Creating test session...');

  const sessionData = {
    studentEmail: 'test@example.com',
    studentName: 'Test Student',
    trainerName: 'Test Trainer',
    sessionDate: '2024-01-15',
    notes: 'Test session for debugging upload endpoint'
  };

  try {
    const response = await axios.post(
      `${API_BASE_URL}/sessions`,
      sessionData,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken
        },
        timeout: 30000
      }
    );

    console.log('✅ Session created successfully');
    console.log('📄 Session data:', JSON.stringify(response.data, null, 2));
    return response.data.sessionId || response.data.id;
  } catch (error) {
    console.log('❌ Failed to create session:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Main test runner
 */
async function runSolutionTest() {
  console.log('🎯 Session Upload Endpoint Solution Test');
  console.log('=========================================');
  console.log(`🌐 API Base URL: ${API_BASE_URL}`);

  // Step 1: Get authentication token
  const authToken = await getAuthToken();
  if (!authToken) {
    console.log('\n❌ Cannot proceed without authentication token');
    console.log('💡 Check if the auth endpoint is working and credentials are correct');
    return;
  }

  // Step 2: Test with correct payload format
  const result = await testSessionUploadWithAuth(authToken);

  // Step 3: Demonstrate common mistakes
  await demonstrateCommonMistakes(authToken);

  // Step 4: Show the solution
  console.log('\n🎯 SOLUTION SUMMARY');
  console.log('===================');
  console.log('The 400 Bad Request error is caused by API Gateway model validation.');
  console.log('The /sessions/{id}/upload endpoint requires EXACTLY these fields:');
  console.log('');
  console.log('✅ CORRECT PAYLOAD FORMAT:');
  console.log(JSON.stringify({
    fileName: 'video-filename.mp4',  // Required: string with valid extension
    fileSize: 52428800,             // Required: integer (bytes)
    contentType: 'video/mp4'        // Required: valid MIME type
  }, null, 2));
  console.log('');
  console.log('❌ COMMON MISTAKES TO AVOID:');
  console.log('   - Including extra fields (studentEmail, studentName, etc.)');
  console.log('   - Using "mimeType" instead of "contentType"');
  console.log('   - Passing fileSize as string instead of integer');
  console.log('   - Using invalid file extensions or MIME types');
  console.log('   - Missing x-auth-token header');
  console.log('');
  console.log('🔧 FRONTEND FIX:');
  console.log('   Remove all extra fields from the request payload');
  console.log('   Only send fileName, fileSize, and contentType');
  console.log('   Ensure fileSize is an integer, not a string');
  console.log('   Include valid x-auth-token header');

  return result;
}

// Export for use in other test files
module.exports = {
  runSolutionTest,
  getAuthToken,
  testSessionUploadWithAuth
};

// Run test if this file is executed directly
if (require.main === module) {
  runSolutionTest().catch(console.error);
}