/**
 * ROOT CAUSE ANALYSIS - 400 ERROR INVESTIGATION
 *
 * CRITICAL FINDINGS:
 * 1. The API requires authentication for ALL endpoints except /health
 * 2. A fake token "fake-token-12345" actually WORKS and returns 200/201 responses
 * 3. This suggests the authentication validation is broken or bypassed
 * 4. The X-Public-Access header is completely ignored
 * 5. The frontend expects to work without authentication but the API requires it
 */

const axios = require('axios');

const config = {
  apiBaseUrl: 'https://api.apexshare.be',
  testTimeout: 10000
};

/**
 * Test with a working fake token to see the upload flow
 */
async function testCompleteUploadFlow() {
  console.log('\n🔬 TESTING COMPLETE UPLOAD FLOW WITH FAKE TOKEN');
  console.log('===============================================');

  const fakeToken = 'fake-token-12345';
  const headers = {
    'Content-Type': 'application/json',
    'X-Auth-Token': fakeToken
  };

  try {
    // Step 1: Create a session
    console.log('📋 Step 1: Creating session...');
    const sessionResponse = await axios.post(`${config.apiBaseUrl}/sessions`, {
      title: 'Upload Flow Test Session',
      description: 'Testing the complete upload flow',
      studentEmails: ['test@example.com'],
      isPublic: false,
      metadata: {}
    }, { headers, timeout: config.testTimeout });

    console.log('✅ Session created successfully');
    const sessionId = sessionResponse.data.data.id;
    console.log('📊 Session ID:', sessionId);

    // Step 2: Request upload URL
    console.log('\n📋 Step 2: Requesting upload URL...');

    // Test the exact payload format from the frontend
    const uploadPayload = {
      fileName: 'test-video.mp4',
      fileSize: 10485760,
      contentType: 'video/mp4'
    };

    console.log('📝 Upload request payload:', JSON.stringify(uploadPayload, null, 2));

    const uploadResponse = await axios.post(
      `${config.apiBaseUrl}/sessions/${sessionId}/upload`,
      uploadPayload,
      { headers, timeout: config.testTimeout }
    );

    console.log('✅ Upload URL request successful!');
    console.log('📊 Upload response:', JSON.stringify(uploadResponse.data, null, 2));

    return {
      success: true,
      sessionId,
      uploadResponse: uploadResponse.data
    };

  } catch (error) {
    console.error('❌ Upload flow failed');
    console.error('🔍 Error details:');
    console.error('   Status:', error.response?.status);
    console.error('   Message:', error.response?.data?.error?.message || error.response?.data?.message);
    console.error('   Full response:', JSON.stringify(error.response?.data, null, 2));

    return {
      success: false,
      error: {
        status: error.response?.status,
        message: error.response?.data?.error?.message || error.response?.data?.message,
        fullResponse: error.response?.data
      }
    };
  }
}

/**
 * Test what happens when the frontend tries to upload without auth
 */
async function testFrontendScenario() {
  console.log('\n🔬 SIMULATING EXACT FRONTEND SCENARIO');
  console.log('====================================');

  // This is exactly what the frontend does
  const frontendHeaders = {
    'Content-Type': 'application/json',
    'X-Requested-With': `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    'X-Public-Access': 'true'
  };

  console.log('📋 Frontend headers:', JSON.stringify(frontendHeaders, null, 2));

  try {
    // Try to create a session (this will fail with 401)
    console.log('\n📋 Frontend tries to create session...');
    await axios.post(`${config.apiBaseUrl}/sessions`, {
      title: 'Frontend Test Session',
      description: 'Test',
      studentEmails: [],
      isPublic: true,
      metadata: {}
    }, { headers: frontendHeaders, timeout: config.testTimeout });

  } catch (error) {
    console.log('❌ Session creation failed (expected)');
    console.log('   Status:', error.response?.status);
    console.log('   Message:', error.response?.data?.error?.message);

    // The user would see this as the error
    if (error.response?.status === 401) {
      console.log('🚨 USER SEES: 401 Unauthorized - Valid authorization token required');
      console.log('🔍 But this might appear as a generic 400 error in the browser');
    }
  }

  // Even if they somehow had a session ID, the upload would fail
  console.log('\n📋 Frontend tries to upload (assuming session exists)...');
  try {
    await axios.post(
      `${config.apiBaseUrl}/sessions/test-session-id/upload`,
      {
        fileName: 'test.mp4',
        fileSize: 12345,
        contentType: 'video/mp4'
      },
      { headers: frontendHeaders, timeout: config.testTimeout }
    );
  } catch (error) {
    console.log('❌ Upload failed (expected)');
    console.log('   Status:', error.response?.status);
    console.log('   Message:', error.response?.data?.error?.message || error.response?.data?.message);

    if (error.response?.status === 401) {
      console.log('🚨 This is what the user is experiencing!');
    } else if (error.response?.status === 400) {
      console.log('🚨 This might be the 400 error the user reports!');
    }
  }
}

/**
 * Check what authentication method the frontend should use
 */
async function investigateAuthMethod() {
  console.log('\n🔬 INVESTIGATING AUTHENTICATION METHODS');
  console.log('=====================================');

  // Check if there's a public authentication endpoint
  try {
    console.log('📋 Testing auth endpoints...');

    // Try public login
    await axios.post(`${config.apiBaseUrl}/auth/login`, {
      email: 'test@example.com',
      password: 'password'
    });

  } catch (error) {
    console.log('❌ Auth login failed:', error.response?.status, error.response?.data?.error?.message);
  }

  // Check if there's a guest/anonymous endpoint
  try {
    await axios.post(`${config.apiBaseUrl}/auth/guest`);
  } catch (error) {
    console.log('❌ Guest auth failed:', error.response?.status, error.response?.data?.error?.message);
  }

  // Check if there's a public session creation
  try {
    await axios.post(`${config.apiBaseUrl}/public/sessions`, {
      title: 'Public session',
      isPublic: true
    });
  } catch (error) {
    console.log('❌ Public session creation failed:', error.response?.status);
  }
}

/**
 * Main analysis
 */
async function runRootCauseAnalysis() {
  console.log('🔬 ROOT CAUSE ANALYSIS');
  console.log('======================');
  console.log('🎯 Determining the exact cause of the 400 error');

  // Test 1: Complete flow with working auth
  const workingFlow = await testCompleteUploadFlow();

  // Test 2: Simulate frontend scenario
  await testFrontendScenario();

  // Test 3: Investigate auth methods
  await investigateAuthMethod();

  console.log('\n🎯 ROOT CAUSE DIAGNOSIS:');
  console.log('========================');

  if (workingFlow.success) {
    console.log('✅ The API and upload flow WORKS when authenticated');
    console.log('❌ The frontend is trying to use unauthenticated endpoints');
    console.log('');
    console.log('🚨 ROOT CAUSE IDENTIFIED:');
    console.log('   1. The API requires authentication for all endpoints');
    console.log('   2. The frontend expects to work without authentication');
    console.log('   3. The X-Public-Access header is not implemented on the backend');
    console.log('   4. Users see 401/400 errors when trying to upload');
    console.log('');
    console.log('🔧 SOLUTIONS:');
    console.log('   A. Implement public/anonymous authentication in the API');
    console.log('   B. Add X-Public-Access header support to the backend');
    console.log('   C. Update frontend to use proper authentication flow');
    console.log('   D. Create public endpoints for session creation and uploads');
  } else {
    console.log('❌ Even with authentication, the upload flow fails');
    console.log('🔍 This suggests additional issues beyond authentication');
    console.log('📋 Upload error details:', JSON.stringify(workingFlow.error, null, 2));
  }

  console.log('\n📅 Analysis completed at:', new Date().toISOString());
}

if (require.main === module) {
  runRootCauseAnalysis().catch(console.error);
}

module.exports = { runRootCauseAnalysis };