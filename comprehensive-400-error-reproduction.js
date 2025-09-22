/**
 * COMPREHENSIVE 400 ERROR REPRODUCTION TEST
 *
 * This script will systematically reproduce the exact user experience
 * that's causing the 400 Bad Request error, even after all our fixes.
 *
 * The goal is to capture the EXACT request payload being sent from
 * the frontend and identify the real root cause.
 */

const axios = require('axios');

// Production environment configuration
const config = {
  apiBaseUrl: 'https://api.apexshare.be',
  frontendUrl: 'https://apexshare.be',
  testTimeout: 30000
};

/**
 * Test 1: Reproduce the session creation workflow
 */
async function testSessionCreation() {
  console.log('\n=== TEST 1: SESSION CREATION ===');

  try {
    // Simulate the exact request the frontend makes
    const sessionPayload = {
      title: 'Test Session for 400 Error Debugging',
      description: 'This session is created to reproduce the 400 error',
      studentEmails: ['test@example.com'],
      isPublic: false,
      metadata: {}
    };

    console.log('📝 Creating session with payload:', JSON.stringify(sessionPayload, null, 2));

    const response = await axios.post(`${config.apiBaseUrl}/sessions`, sessionPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        'X-Public-Access': 'true'
      },
      timeout: config.testTimeout
    });

    console.log('✅ Session created successfully');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));

    return response.data.data;
  } catch (error) {
    console.error('❌ Session creation failed');
    console.error('🔍 Error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers
    });
    throw error;
  }
}

/**
 * Test 2: Test the upload URL request - THIS IS WHERE THE 400 ERROR LIKELY OCCURS
 */
async function testUploadUrlRequest(sessionId) {
  console.log('\n=== TEST 2: UPLOAD URL REQUEST ===');
  console.log('🎯 This is where the 400 error is most likely occurring');

  try {
    // Test different payload variations to identify the issue
    const testCases = [
      {
        name: 'Current 3-field format (from our fixes)',
        payload: {
          fileName: 'test-video.mp4',
          fileSize: 10485760, // 10MB
          contentType: 'video/mp4'
        }
      },
      {
        name: 'Legacy 4-field format',
        payload: {
          fileName: 'test-video.mp4',
          fileSize: 10485760,
          contentType: 'video/mp4',
          mimeType: 'video/mp4'
        }
      },
      {
        name: 'Original mimeType format',
        payload: {
          fileName: 'test-video.mp4',
          fileSize: 10485760,
          mimeType: 'video/mp4'
        }
      },
      {
        name: 'Alternative field names',
        payload: {
          filename: 'test-video.mp4',
          size: 10485760,
          type: 'video/mp4'
        }
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n📋 Testing: ${testCase.name}`);
      console.log('📝 Payload:', JSON.stringify(testCase.payload, null, 2));

      try {
        const response = await axios.post(
          `${config.apiBaseUrl}/sessions/${sessionId}/upload`,
          testCase.payload,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              'X-Public-Access': 'true'
            },
            timeout: config.testTimeout
          }
        );

        console.log('✅ SUCCESS with format:', testCase.name);
        console.log('📊 Response:', JSON.stringify(response.data, null, 2));
        return { success: true, format: testCase.name, response: response.data };

      } catch (error) {
        console.error(`❌ FAILED with format: ${testCase.name}`);
        console.error('🔍 Error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          requestPayload: testCase.payload
        });

        // Capture the exact error for the 400 case
        if (error.response?.status === 400) {
          console.error('🚨 THIS IS THE 400 ERROR THE USER IS EXPERIENCING!');
          console.error('📋 Request that caused 400:', JSON.stringify(testCase.payload, null, 2));
          console.error('🔍 Response body:', JSON.stringify(error.response.data, null, 2));
          console.error('📨 Response headers:', JSON.stringify(error.response.headers, null, 2));
        }
      }
    }

    return { success: false, error: 'All payload formats failed' };

  } catch (error) {
    console.error('❌ Upload URL request test failed');
    console.error('🔍 Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 3: Verify current API Gateway model expectations
 */
async function testApiGatewayModel() {
  console.log('\n=== TEST 3: API GATEWAY MODEL VERIFICATION ===');

  // Check what the actual API Gateway model expects by examining error responses
  console.log('🔍 Testing various request formats to understand validation errors...');

  const sessionId = 'test-session-id'; // Using a test ID to trigger validation errors

  const testPayloads = [
    { /* empty payload */ },
    { fileName: 'test.mp4' },
    { fileSize: 123456 },
    { contentType: 'video/mp4' },
    { fileName: 'test.mp4', fileSize: 123456 },
    { fileName: 'test.mp4', contentType: 'video/mp4' },
    { fileSize: 123456, contentType: 'video/mp4' },
  ];

  for (const payload of testPayloads) {
    try {
      await axios.post(`${config.apiBaseUrl}/sessions/${sessionId}/upload`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Public-Access': 'true'
        },
        timeout: 5000
      });
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(`📋 Payload: ${JSON.stringify(payload)}`);
        console.log(`❌ Error: ${JSON.stringify(error.response.data)}`);
        console.log('---');
      }
    }
  }
}

/**
 * Test 4: Check if there are existing sessions to test with
 */
async function testExistingSessions() {
  console.log('\n=== TEST 4: EXISTING SESSIONS CHECK ===');

  try {
    const response = await axios.get(`${config.apiBaseUrl}/sessions`, {
      headers: {
        'X-Public-Access': 'true'
      },
      timeout: config.testTimeout
    });

    console.log('📊 Available sessions:', response.data);
    return response.data.data || [];

  } catch (error) {
    console.error('❌ Failed to fetch existing sessions');
    console.error('🔍 Error:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Test 5: Frontend cache verification
 */
async function testFrontendDeployment() {
  console.log('\n=== TEST 5: FRONTEND DEPLOYMENT VERIFICATION ===');

  try {
    const response = await axios.get(config.frontendUrl, {
      timeout: config.testTimeout,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    console.log('✅ Frontend is accessible');
    console.log('📊 Status:', response.status);
    console.log('📨 Headers:', JSON.stringify(response.headers, null, 2));

    // Check if the response contains our latest code
    if (response.data.includes('ApexShare')) {
      console.log('✅ Frontend appears to be deployed correctly');
    } else {
      console.log('⚠️ Frontend might not be deployed correctly');
    }

  } catch (error) {
    console.error('❌ Frontend verification failed');
    console.error('🔍 Error:', error.message);
  }
}

/**
 * Main test execution
 */
async function runComprehensiveTest() {
  console.log('🔬 COMPREHENSIVE 400 ERROR REPRODUCTION TEST');
  console.log('===========================================');
  console.log('🎯 Goal: Find the REAL root cause of the 400 error user is experiencing');
  console.log('📅 Test started at:', new Date().toISOString());

  try {
    // Test 1: Frontend deployment
    await testFrontendDeployment();

    // Test 2: Check existing sessions
    const existingSessions = await testExistingSessions();

    // Test 3: API Gateway model verification
    await testApiGatewayModel();

    // Test 4: Create a new session
    let sessionId;
    try {
      const session = await testSessionCreation();
      sessionId = session.id;
    } catch (error) {
      console.log('⚠️ Session creation failed, trying with existing session if available');
      if (existingSessions.length > 0) {
        sessionId = existingSessions[0].id;
        console.log(`📋 Using existing session: ${sessionId}`);
      } else {
        console.error('❌ No sessions available for testing');
        return;
      }
    }

    // Test 5: The critical upload URL request
    const uploadResult = await testUploadUrlRequest(sessionId);

    console.log('\n🎯 FINAL ANALYSIS:');
    console.log('==================');
    if (uploadResult.success) {
      console.log(`✅ Upload request succeeded with format: ${uploadResult.format}`);
      console.log('🤔 This suggests the issue might be elsewhere:');
      console.log('   - Frontend caching issue');
      console.log('   - Different session state');
      console.log('   - User-specific environment issue');
    } else {
      console.log('❌ Upload request failed - this is likely the root cause');
      console.log('🔍 The user is experiencing the same failure we just reproduced');
    }

  } catch (error) {
    console.error('❌ Test execution failed');
    console.error('🔍 Error:', error.message);
  }

  console.log('\n📅 Test completed at:', new Date().toISOString());
}

// Execute the test
if (require.main === module) {
  runComprehensiveTest().catch(console.error);
}

module.exports = {
  runComprehensiveTest,
  testSessionCreation,
  testUploadUrlRequest,
  testApiGatewayModel,
  testExistingSessions,
  testFrontendDeployment
};