/**
 * Focused Issue Analysis
 *
 * The comprehensive test revealed TWO distinct issues:
 * 1. 403 Unauthorized - CORS/Authentication issue with browser-like requests
 * 2. 400 Invalid request body - API Gateway model validation issue
 *
 * This test isolates and identifies the exact root causes.
 */

const axios = require('axios');

const TEST_CONFIG = {
  directApiUrl: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
  customDomainUrl: 'https://api.apexshare.be',
  sessionId: 'b1dcd4ef-c043-4f83-a73e-b9b8dfc62893',
  testFile: {
    fileName: 'test-video.mp4',
    fileSize: 10485760,
    mimeType: 'video/mp4'
  }
};

async function testCORSAndAuth() {
  console.log('\n🛡️  CORS AND AUTHENTICATION ANALYSIS');
  console.log('='.repeat(60));

  const endpoint = `/sessions/${TEST_CONFIG.sessionId}/upload`;
  const url = `${TEST_CONFIG.directApiUrl}${endpoint}`;
  const payload = {
    fileName: TEST_CONFIG.testFile.fileName,
    fileSize: TEST_CONFIG.testFile.fileSize,
    contentType: TEST_CONFIG.testFile.mimeType
  };

  // Test 1: Minimal headers (like curl)
  console.log('\n🧪 Test 1: Minimal Headers (curl-style)');
  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true
    });
    console.log(`📊 Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  // Test 2: Browser headers without auth
  console.log('\n🧪 Test 2: Browser Headers (no auth)');
  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://apexshare.be',
        'Referer': 'https://apexshare.be/'
      },
      validateStatus: () => true
    });
    console.log(`📊 Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  // Test 3: Browser headers with fake auth token
  console.log('\n🧪 Test 3: Browser Headers + Auth Token');
  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-token-123',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://apexshare.be',
        'Referer': 'https://apexshare.be/'
      },
      validateStatus: () => true
    });
    console.log(`📊 Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  // Test 4: Check if endpoint is public (no auth required)
  console.log('\n🧪 Test 4: Check API Gateway CORS configuration');
  try {
    const response = await axios.options(url, {
      headers: {
        'Origin': 'https://apexshare.be',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      },
      validateStatus: () => true
    });
    console.log(`📊 OPTIONS Status: ${response.status}`);
    console.log(`📋 CORS Headers:`);
    Object.keys(response.headers).forEach(key => {
      if (key.toLowerCase().includes('access-control')) {
        console.log(`   ${key}: ${response.headers[key]}`);
      }
    });
  } catch (error) {
    console.log(`❌ OPTIONS Error: ${error.message}`);
  }
}

async function testAPIGatewayModel() {
  console.log('\n🔧 API GATEWAY MODEL VALIDATION ANALYSIS');
  console.log('='.repeat(60));

  const endpoint = `/sessions/${TEST_CONFIG.sessionId}/upload`;
  const url = `${TEST_CONFIG.directApiUrl}${endpoint}`;

  const modelVariations = [
    {
      name: 'Current Model (simple)',
      payload: {
        fileName: 'test-video.mp4',
        fileSize: 10485760,
        contentType: 'video/mp4'
      }
    },
    {
      name: 'Minimal Required',
      payload: {
        fileName: 'test-video.mp4'
      }
    },
    {
      name: 'With All String Types',
      payload: {
        fileName: 'test-video.mp4',
        fileSize: '10485760', // String instead of number
        contentType: 'video/mp4'
      }
    },
    {
      name: 'Old Working Model',
      payload: {
        studentEmail: 'test@example.com',
        studentName: 'Test Student',
        sessionDate: '2024-01-01',
        fileName: 'test-video.mp4',
        fileSize: 10485760,
        contentType: 'video/mp4',
        notes: 'Test session upload'
      }
    },
    {
      name: 'Absolute Minimal',
      payload: {}
    }
  ];

  for (const variation of modelVariations) {
    console.log(`\n🧪 Testing Model: ${variation.name}`);
    console.log(`📦 Payload:`, JSON.stringify(variation.payload, null, 2));

    try {
      const response = await axios.post(url, variation.payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      });

      console.log(`📊 Status: ${response.status}`);
      if (response.status === 400) {
        console.log(`📄 Validation Error:`, JSON.stringify(response.data, null, 2));
      } else if (response.status === 200) {
        console.log(`✅ SUCCESS! Model accepts this format`);
      } else {
        console.log(`📄 Response:`, JSON.stringify(response.data, null, 2));
      }

    } catch (error) {
      console.log(`❌ Request Error: ${error.message}`);
    }
  }
}

async function testWithKnownWorkingCurl() {
  console.log('\n✅ VERIFY WITH KNOWN WORKING CURL COMMAND');
  console.log('='.repeat(60));

  // This matches the exact curl command that was shown to work
  const endpoint = `/sessions/${TEST_CONFIG.sessionId}/upload`;
  const url = `${TEST_CONFIG.directApiUrl}${endpoint}`;

  console.log('🔄 Testing exact curl equivalent...');
  console.log(`🎯 URL: ${url}`);

  const curlPayload = {
    fileName: 'test-video.mp4',
    fileSize: 10485760,
    contentType: 'video/mp4'
  };

  console.log(`📦 Payload: ${JSON.stringify(curlPayload, null, 2)}`);

  try {
    const response = await axios.post(url, curlPayload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'curl/7.68.0'
      },
      validateStatus: () => true
    });

    console.log(`📊 Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200) {
      console.log('✅ CURL request works - confirms API Gateway is functional');
    } else if (response.status === 400) {
      console.log('❌ Even curl fails - API Gateway model issue confirmed');
    } else {
      console.log('❓ Unexpected status - may be different issue');
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function analyzeSessionValidity() {
  console.log('\n🔍 SESSION VALIDITY CHECK');
  console.log('='.repeat(60));

  // Test if the session exists by trying to get session info
  const sessionUrl = `${TEST_CONFIG.directApiUrl}/sessions/${TEST_CONFIG.sessionId}`;

  console.log(`🔍 Checking session: ${TEST_CONFIG.sessionId}`);
  console.log(`🎯 URL: ${sessionUrl}`);

  try {
    const response = await axios.get(sessionUrl, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true
    });

    console.log(`📊 Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(response.data, null, 2));

    if (response.status === 404) {
      console.log('❌ SESSION NOT FOUND - This is the issue!');
      console.log('   The test session ID may be invalid or expired');
    } else if (response.status === 200) {
      console.log('✅ Session exists - issue is not with session validity');
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function runFocusedAnalysis() {
  console.log('🎯 FOCUSED ISSUE ANALYSIS');
  console.log('='.repeat(80));
  console.log('Isolating the exact root causes of the upload failures');
  console.log('');

  // Check session validity first
  await analyzeSessionValidity();

  // Test CORS and authentication
  await testCORSAndAuth();

  // Test API Gateway model validation
  await testAPIGatewayModel();

  // Verify with known working curl
  await testWithKnownWorkingCurl();

  console.log('\n📊 FINAL DIAGNOSIS');
  console.log('='.repeat(60));
  console.log('Based on the test results above:');
  console.log('');
  console.log('1. If curl equivalent fails → API Gateway model deployment issue');
  console.log('2. If minimal headers work but browser headers get 403 → CORS issue');
  console.log('3. If all requests fail → Session validity or endpoint access issue');
  console.log('4. If session GET fails → Invalid test session ID');
  console.log('');
  console.log('💡 Review the specific test results above to identify the exact issue.');
}

if (require.main === module) {
  runFocusedAnalysis().catch(console.error);
}

module.exports = { runFocusedAnalysis };