/**
 * CRITICAL FINDING TEST: AUTHENTICATION VS PUBLIC ACCESS
 *
 * DISCOVERY: The API is returning 401 Unauthorized for requests that the
 * frontend expects to work with X-Public-Access: true
 *
 * This is likely the REAL root cause of the 400 error the user is experiencing.
 */

const axios = require('axios');

const config = {
  apiBaseUrl: 'https://api.apexshare.be',
  testTimeout: 10000
};

/**
 * Test various authentication scenarios
 */
async function testAuthenticationFlow() {
  console.log('\n🔍 TESTING AUTHENTICATION VS PUBLIC ACCESS');
  console.log('===========================================');

  const testCases = [
    {
      name: 'No auth headers (plain request)',
      headers: {
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'X-Public-Access header only',
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Access': 'true'
      }
    },
    {
      name: 'X-Requested-With header only',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'req_test_123'
      }
    },
    {
      name: 'Both X-Public-Access and X-Requested-With',
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Access': 'true',
        'X-Requested-With': 'req_test_123'
      }
    },
    {
      name: 'Fake auth token',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': 'fake-token-12345'
      }
    }
  ];

  console.log('\n📋 Testing /sessions endpoint (GET)...');
  for (const testCase of testCases) {
    try {
      const response = await axios.get(`${config.apiBaseUrl}/sessions`, {
        headers: testCase.headers,
        timeout: config.testTimeout
      });
      console.log(`✅ ${testCase.name}: SUCCESS (${response.status})`);
    } catch (error) {
      console.log(`❌ ${testCase.name}: ${error.response?.status} - ${error.response?.data?.error?.message || error.message}`);
    }
  }

  console.log('\n📋 Testing /sessions endpoint (POST)...');
  const sessionPayload = {
    title: 'Test Session',
    description: 'Test',
    studentEmails: [],
    isPublic: true,
    metadata: {}
  };

  for (const testCase of testCases) {
    try {
      const response = await axios.post(`${config.apiBaseUrl}/sessions`, sessionPayload, {
        headers: testCase.headers,
        timeout: config.testTimeout
      });
      console.log(`✅ ${testCase.name}: SUCCESS (${response.status})`);
      console.log('   Created session ID:', response.data.data?.id);
      return response.data.data?.id; // Return session ID for further testing
    } catch (error) {
      console.log(`❌ ${testCase.name}: ${error.response?.status} - ${error.response?.data?.error?.message || error.message}`);
    }
  }

  return null;
}

/**
 * Test health endpoint (should work without auth)
 */
async function testHealthEndpoint() {
  console.log('\n📋 Testing /health endpoint...');

  try {
    const response = await axios.get(`${config.apiBaseUrl}/health`);
    console.log('✅ Health endpoint accessible:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Health endpoint failed:', error.response?.status, error.response?.data);
    return false;
  }
}

/**
 * Test if this is related to CORS or OPTIONS requests
 */
async function testCorsAndOptions() {
  console.log('\n📋 Testing CORS and OPTIONS...');

  try {
    // Test OPTIONS request
    const optionsResponse = await axios.options(`${config.apiBaseUrl}/sessions`, {
      headers: {
        'Origin': 'https://apexshare.be',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,X-Public-Access'
      }
    });
    console.log('✅ OPTIONS request successful:', optionsResponse.status);
    console.log('📊 CORS headers:', optionsResponse.headers);
  } catch (error) {
    console.log('❌ OPTIONS request failed:', error.response?.status);
  }

  // Test request with proper Origin header
  try {
    const response = await axios.get(`${config.apiBaseUrl}/sessions`, {
      headers: {
        'Origin': 'https://apexshare.be',
        'X-Public-Access': 'true'
      }
    });
    console.log('✅ Request with Origin header successful');
  } catch (error) {
    console.log('❌ Request with Origin header failed:', error.response?.status, error.response?.data?.error?.message);
  }
}

/**
 * Check if the issue is specifically with the upload endpoint
 */
async function testUploadEndpointAuth() {
  console.log('\n📋 Testing upload endpoint authentication...');

  // Try to access upload endpoint with various auth methods
  const uploadPayload = {
    fileName: 'test.mp4',
    fileSize: 12345,
    contentType: 'video/mp4'
  };

  const authMethods = [
    { name: 'No auth', headers: {} },
    { name: 'X-Public-Access', headers: { 'X-Public-Access': 'true' } },
    { name: 'Fake token', headers: { 'X-Auth-Token': 'fake-token' } }
  ];

  for (const method of authMethods) {
    try {
      const response = await axios.post(
        `${config.apiBaseUrl}/sessions/test-session-id/upload`,
        uploadPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            ...method.headers
          },
          timeout: config.testTimeout
        }
      );
      console.log(`✅ Upload endpoint ${method.name}: SUCCESS`);
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.response?.data?.message;
      console.log(`❌ Upload endpoint ${method.name}: ${status} - ${message}`);

      // This is key - if we get 401 instead of 400, auth is the issue
      if (status === 401) {
        console.log('🚨 401 UNAUTHORIZED - This confirms auth is the issue!');
      } else if (status === 400) {
        console.log('🚨 400 BAD REQUEST - This might be the error the user sees');
      }
    }
  }
}

/**
 * Main execution
 */
async function runAuthTest() {
  console.log('🔬 AUTHENTICATION VS PUBLIC ACCESS TEST');
  console.log('=======================================');
  console.log('🎯 Investigating if auth requirements are the root cause');

  try {
    // Test health endpoint
    await testHealthEndpoint();

    // Test CORS
    await testCorsAndOptions();

    // Test authentication flow
    await testAuthenticationFlow();

    // Test upload endpoint specifically
    await testUploadEndpointAuth();

    console.log('\n🎯 ANALYSIS:');
    console.log('===========');
    console.log('If we see 401 errors, then the issue is:');
    console.log('- The API requires authentication for endpoints the frontend expects to be public');
    console.log('- The X-Public-Access header is not being recognized by the API');
    console.log('- This would manifest as 400/401 errors when users try to upload');
    console.log('');
    console.log('If we see 400 errors, then the issue is:');
    console.log('- Request payload format mismatch');
    console.log('- API Gateway model validation issues');
    console.log('- Different issue than authentication');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

if (require.main === module) {
  runAuthTest().catch(console.error);
}

module.exports = { runAuthTest };