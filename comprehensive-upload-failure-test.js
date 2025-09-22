#!/usr/bin/env node

/**
 * Comprehensive Upload Failure Root Cause Analysis
 *
 * Testing the EXACT failing scenario reported by the user:
 * - Session ID: fe41f1ff-635b-4405-a6b4-c34412ca3134
 * - Payload: fileName: "GX010492.MP4", fileSize: 426210557, contentType: "video/mp4"
 * - Error: "Failed to fetch"
 *
 * This test will identify the TRUE root cause.
 */

const https = require('https');

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
const USER_SESSION_ID = 'fe41f1ff-635b-4405-a6b4-c34412ca3134';

// User's exact payload that's failing
const USER_FAILING_PAYLOAD = {
  fileName: "GX010492.MP4",
  fileSize: 426210557,
  contentType: "video/mp4"
};

/**
 * Make HTTP request with detailed error analysis
 */
function makeRequest(method, url, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Origin': 'https://apexshare.be',
        'Referer': 'https://apexshare.be/',
        ...headers
      }
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    console.log(`\n🔍 ${method} ${url}`);
    console.log('📝 Headers:', JSON.stringify(options.headers, null, 2));
    if (data) {
      console.log('📦 Payload:', JSON.stringify(data, null, 2));
    }

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const result = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseData,
            parsedBody: responseData ? JSON.parse(responseData) : null
          };

          console.log(`\n📊 Status: ${res.statusCode}`);
          console.log('📋 Response Headers:');
          Object.entries(res.headers).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
          });
          console.log('📄 Response Body:', responseData);

          resolve(result);
        } catch (parseError) {
          console.log(`\n⚠️  Status: ${res.statusCode} (JSON Parse Failed)`);
          console.log('📄 Raw Response:', responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseData,
            parsedBody: null,
            parseError: parseError.message
          });
        }
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ Network Error:', error.message);
      console.error('Error Code:', error.code);
      console.error('Error Details:', error);
      reject(error);
    });

    req.setTimeout(30000, () => {
      console.error('\n⏰ Request Timeout (30s)');
      req.destroy();
      reject(new Error('Request timeout after 30 seconds'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Test 1: Verify the user's session still exists
 */
async function testSessionExists() {
  console.log('\n🧪 TEST 1: Verify User Session Exists');
  console.log('=' .repeat(60));

  try {
    const response = await makeRequest('GET', `${API_BASE_URL}/sessions/${USER_SESSION_ID}`);

    if (response.statusCode === 200) {
      console.log('✅ Session exists and is accessible');
      return true;
    } else if (response.statusCode === 404) {
      console.log('❌ Session not found - expired or invalid');
      return false;
    } else {
      console.log(`⚠️  Unexpected status: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to check session:', error.message);
    return false;
  }
}

/**
 * Test 2: Test the EXACT failing endpoint with EXACT payload
 */
async function testExactFailingScenario() {
  console.log('\n🧪 TEST 2: Exact Failing Scenario');
  console.log('=' .repeat(60));
  console.log('🎯 This is the EXACT request that fails with "Failed to fetch"');

  try {
    const response = await makeRequest(
      'POST',
      `${API_BASE_URL}/sessions/${USER_SESSION_ID}/upload`,
      USER_FAILING_PAYLOAD
    );

    console.log(`\n🔬 Analysis of Status ${response.statusCode}:`);

    if (response.statusCode === 200) {
      console.log('✅ SUCCESS! The issue has been resolved!');
      console.log('🎉 User should no longer see "Failed to fetch"');
      return true;
    } else if (response.statusCode === 400) {
      console.log('❌ VALIDATION ERROR: API Gateway is rejecting the request');
      console.log('🔧 Root Cause: Request validation model is too restrictive');

      if (response.parsedBody?.message?.includes('validation')) {
        console.log('💡 Specific Issue: API Gateway validation model needs updating');
      }
      return false;
    } else if (response.statusCode === 404) {
      console.log('❌ NOT FOUND: Session expired or endpoint not available');
      console.log('🔧 Root Cause: Session lifecycle or routing issue');
      return false;
    } else if (response.statusCode === 500) {
      console.log('❌ SERVER ERROR: Lambda function error');
      console.log('🔧 Root Cause: Backend processing issue');
      return false;
    } else if (response.statusCode === 403) {
      console.log('❌ FORBIDDEN: Authentication or authorization issue');
      console.log('🔧 Root Cause: API Gateway security configuration');
      return false;
    } else {
      console.log(`❌ UNEXPECTED STATUS: ${response.statusCode}`);
      console.log('🔧 Root Cause: Unknown - needs investigation');
      return false;
    }
  } catch (error) {
    console.log('❌ NETWORK ERROR:', error.message);

    if (error.code === 'ENOTFOUND') {
      console.log('🔧 Root Cause: DNS resolution failure or wrong API URL');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('🔧 Root Cause: API Gateway not responding');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('🔧 Root Cause: Request timeout - possibly CORS or processing issue');
    } else {
      console.log('🔧 Root Cause: Network connectivity issue');
    }
    return false;
  }
}

/**
 * Test 3: Test with new session to isolate session-specific issues
 */
async function testWithNewSession() {
  console.log('\n🧪 TEST 3: Test with New Session');
  console.log('=' .repeat(60));

  // Create new session
  const sessionData = {
    studentName: 'Test Student',
    studentEmail: 'test@example.com',
    sessionDate: '2025-09-22',
    trainerName: 'Test Trainer',
    notes: 'Root cause analysis test'
  };

  try {
    const sessionResponse = await makeRequest('POST', `${API_BASE_URL}/sessions`, sessionData);

    if (sessionResponse.statusCode !== 201) {
      console.log('❌ Cannot create new session for testing');
      return false;
    }

    const newSessionId = sessionResponse.parsedBody?.data?.id;
    if (!newSessionId) {
      console.log('❌ No session ID returned');
      return false;
    }

    console.log(`✅ New session created: ${newSessionId}`);

    // Test upload with new session using same payload
    const uploadResponse = await makeRequest(
      'POST',
      `${API_BASE_URL}/sessions/${newSessionId}/upload`,
      USER_FAILING_PAYLOAD
    );

    if (uploadResponse.statusCode === 200) {
      console.log('✅ Upload works with new session - user session may be expired');
      return true;
    } else {
      console.log(`❌ Upload fails with new session too (${uploadResponse.statusCode})`);
      console.log('🔧 This confirms a systematic issue, not session-specific');
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to test with new session:', error.message);
    return false;
  }
}

/**
 * Test 4: Test CORS preflight for the exact endpoint
 */
async function testCORSPreflight() {
  console.log('\n🧪 TEST 4: CORS Preflight Test');
  console.log('=' .repeat(60));

  try {
    const response = await makeRequest(
      'OPTIONS',
      `${API_BASE_URL}/sessions/${USER_SESSION_ID}/upload`,
      null,
      {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    );

    console.log('\n🔬 CORS Analysis:');

    if (response.statusCode === 204 || response.statusCode === 200) {
      console.log('✅ CORS preflight successful');

      const corsHeaders = [
        'access-control-allow-origin',
        'access-control-allow-methods',
        'access-control-allow-headers',
        'access-control-max-age'
      ];

      corsHeaders.forEach(header => {
        const value = response.headers[header];
        if (value) {
          console.log(`   ${header}: ${value}`);
        } else {
          console.log(`   ${header}: ❌ MISSING`);
        }
      });

      return true;
    } else {
      console.log(`❌ CORS preflight failed: ${response.statusCode}`);
      console.log('🔧 This could cause "Failed to fetch" in browsers');
      return false;
    }
  } catch (error) {
    console.log('❌ CORS preflight error:', error.message);
    return false;
  }
}

/**
 * Test 5: Validate the request payload against API Gateway model
 */
async function testPayloadValidation() {
  console.log('\n🧪 TEST 5: Payload Validation Analysis');
  console.log('=' .repeat(60));

  // Test variations of the payload to identify validation issues
  const payloadVariations = [
    {
      name: 'Original (failing)',
      payload: USER_FAILING_PAYLOAD
    },
    {
      name: 'With mimeType instead',
      payload: {
        fileName: "GX010492.MP4",
        fileSize: 426210557,
        mimeType: "video/mp4"
      }
    },
    {
      name: 'With both contentType and mimeType',
      payload: {
        fileName: "GX010492.MP4",
        fileSize: 426210557,
        contentType: "video/mp4",
        mimeType: "video/mp4"
      }
    },
    {
      name: 'Minimal payload',
      payload: {
        fileName: "test.mp4",
        fileSize: 1000000
      }
    }
  ];

  for (const variation of payloadVariations) {
    console.log(`\n🔍 Testing: ${variation.name}`);
    console.log('Payload:', JSON.stringify(variation.payload, null, 2));

    try {
      const response = await makeRequest(
        'POST',
        `${API_BASE_URL}/sessions/${USER_SESSION_ID}/upload`,
        variation.payload
      );

      if (response.statusCode === 200) {
        console.log('✅ ACCEPTED');
      } else if (response.statusCode === 400) {
        console.log('❌ VALIDATION ERROR');
        if (response.parsedBody?.message) {
          console.log('   Error:', response.parsedBody.message);
        }
      } else {
        console.log(`⚠️  Status: ${response.statusCode}`);
      }
    } catch (error) {
      console.log('❌ Network error:', error.message);
    }
  }
}

/**
 * Main analysis execution
 */
async function runAnalysis() {
  console.log('🔍 COMPREHENSIVE UPLOAD FAILURE ROOT CAUSE ANALYSIS');
  console.log('=' .repeat(80));
  console.log('🎯 Investigating "Failed to fetch" error for Chrome uploads');
  console.log('📅 Date:', new Date().toISOString());
  console.log(`🔑 User Session ID: ${USER_SESSION_ID}`);
  console.log('📦 Failing Payload:', JSON.stringify(USER_FAILING_PAYLOAD, null, 2));

  const results = {
    sessionExists: false,
    exactScenario: false,
    newSession: false,
    corsWorking: false,
    payloadValid: false
  };

  // Run comprehensive tests
  results.sessionExists = await testSessionExists();
  results.exactScenario = await testExactFailingScenario();

  if (!results.exactScenario) {
    results.newSession = await testWithNewSession();
  }

  results.corsWorking = await testCORSPreflight();
  await testPayloadValidation();

  // Final analysis
  console.log('\n📊 ROOT CAUSE ANALYSIS SUMMARY');
  console.log('=' .repeat(80));

  console.log('\n🔬 Test Results:');
  console.log(`Session Exists: ${results.sessionExists ? '✅' : '❌'}`);
  console.log(`Exact Scenario Works: ${results.exactScenario ? '✅' : '❌'}`);
  console.log(`New Session Works: ${results.newSession ? '✅' : '❌'}`);
  console.log(`CORS Working: ${results.corsWorking ? '✅' : '❌'}`);

  console.log('\n🎯 ROOT CAUSE DETERMINATION:');

  if (results.exactScenario) {
    console.log('✅ ISSUE RESOLVED: The exact failing scenario now works');
    console.log('🎉 User should no longer experience "Failed to fetch" errors');
  } else if (!results.sessionExists) {
    console.log('❌ SESSION EXPIRED: User session is no longer valid');
    console.log('🔧 Solution: User needs to create a new session');
  } else if (!results.corsWorking) {
    console.log('❌ CORS ISSUE: Cross-origin requests are failing');
    console.log('🔧 Solution: Fix API Gateway CORS configuration');
  } else if (results.newSession && !results.exactScenario) {
    console.log('❌ SESSION-SPECIFIC ISSUE: Problem with the specific session');
    console.log('🔧 Solution: Session cleanup or expiry logic needs fixing');
  } else {
    console.log('❌ SYSTEMATIC ISSUE: API Gateway or Lambda problem');
    console.log('🔧 Solution: Check API Gateway deployment and Lambda function');
  }

  console.log('\n📋 NEXT STEPS:');
  if (results.exactScenario) {
    console.log('1. ✅ Issue is resolved - verify in browser');
    console.log('2. 📝 Update user that the fix is deployed');
    console.log('3. 🔍 Monitor for any edge cases');
  } else {
    console.log('1. ❌ Issue NOT resolved - needs immediate attention');
    console.log('2. 🔧 Apply specific fixes based on root cause above');
    console.log('3. 🧪 Re-run this test after fixes');
    console.log('4. 🌐 Test in actual browser to confirm fix');
  }
}

// Execute analysis
runAnalysis().catch(error => {
  console.error('\n💥 Analysis failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});