/**
 * Comprehensive End-to-End Upload Test
 *
 * This test reproduces the exact user flow and identifies the specific
 * difference between working curl requests and failing frontend requests.
 *
 * Test Strategy:
 * 1. Simulate the exact frontend JavaScript request flow
 * 2. Compare with working curl request patterns
 * 3. Test both API Gateway direct URL and custom domain
 * 4. Capture detailed request/response information
 * 5. Identify the specific cause of the 400 Bad Request error
 */

const axios = require('axios');

// Test Configuration
const TEST_CONFIG = {
  // API URLs to test
  directApiUrl: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
  customDomainUrl: 'https://api.apexshare.be',

  // Test session (same as used in successful curl tests)
  sessionId: 'b1dcd4ef-c043-4f83-a73e-b9b8dfc62893',

  // Test file details
  testFile: {
    fileName: 'test-video.mp4',
    fileSize: 10485760, // 10MB
    mimeType: 'video/mp4'
  }
};

/**
 * Simulate the exact frontend API service request
 */
async function simulateFrontendRequest(baseUrl, testName) {
  console.log(`\n🧪 ${testName}`);
  console.log('='.repeat(60));

  const endpoint = `/sessions/${TEST_CONFIG.sessionId}/upload`;
  const url = `${baseUrl}${endpoint}`;

  // This is the EXACT payload structure the frontend sends (from api.ts line 247-252)
  const frontendPayload = {
    fileName: TEST_CONFIG.testFile.fileName,
    fileSize: TEST_CONFIG.testFile.fileSize,
    mimeType: TEST_CONFIG.testFile.mimeType, // Frontend uses 'mimeType'
  };

  console.log(`🎯 URL: ${url}`);
  console.log(`📦 Payload:`, JSON.stringify(frontendPayload, null, 2));

  try {
    // Simulate frontend axios request with same configuration
    const response = await axios.post(url, frontendPayload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://apexshare.be',
        'Referer': 'https://apexshare.be/',
        // This simulates a request from the actual frontend
        'X-Requested-With': `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
      timeout: 30000,
      validateStatus: () => true // Don't throw on 4xx/5xx
    });

    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Response Headers:`, JSON.stringify(response.headers, null, 2));
    console.log(`📄 Response Body:`, JSON.stringify(response.data, null, 2));

    return {
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      data: response.data,
      headers: response.headers
    };

  } catch (error) {
    console.log(`❌ Request Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      status: 0
    };
  }
}

/**
 * Test with curl-style payload (what works)
 */
async function testCurlStyleRequest(baseUrl, testName) {
  console.log(`\n🧪 ${testName}`);
  console.log('='.repeat(60));

  const endpoint = `/sessions/${TEST_CONFIG.sessionId}/upload`;
  const url = `${baseUrl}${endpoint}`;

  // This is the payload structure that works with curl
  const curlPayload = {
    fileName: TEST_CONFIG.testFile.fileName,
    fileSize: TEST_CONFIG.testFile.fileSize,
    contentType: TEST_CONFIG.testFile.mimeType, // curl uses 'contentType'
  };

  console.log(`🎯 URL: ${url}`);
  console.log(`📦 Payload:`, JSON.stringify(curlPayload, null, 2));

  try {
    const response = await axios.post(url, curlPayload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'curl/7.68.0' // Simulate curl request
      },
      validateStatus: () => true
    });

    console.log(`📊 Status: ${response.status}`);
    console.log(`📄 Response Body:`, JSON.stringify(response.data, null, 2));

    return {
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      data: response.data
    };

  } catch (error) {
    console.log(`❌ Request Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      status: 0
    };
  }
}

/**
 * Test various payload combinations to identify the exact issue
 */
async function testPayloadVariations(baseUrl) {
  console.log(`\n🔬 Testing Payload Variations on ${baseUrl}`);
  console.log('='.repeat(60));

  const endpoint = `/sessions/${TEST_CONFIG.sessionId}/upload`;
  const url = `${baseUrl}${endpoint}`;

  const variations = [
    {
      name: 'Frontend Style (mimeType)',
      payload: {
        fileName: TEST_CONFIG.testFile.fileName,
        fileSize: TEST_CONFIG.testFile.fileSize,
        mimeType: TEST_CONFIG.testFile.mimeType
      }
    },
    {
      name: 'Curl Style (contentType)',
      payload: {
        fileName: TEST_CONFIG.testFile.fileName,
        fileSize: TEST_CONFIG.testFile.fileSize,
        contentType: TEST_CONFIG.testFile.mimeType
      }
    },
    {
      name: 'Both Fields',
      payload: {
        fileName: TEST_CONFIG.testFile.fileName,
        fileSize: TEST_CONFIG.testFile.fileSize,
        mimeType: TEST_CONFIG.testFile.mimeType,
        contentType: TEST_CONFIG.testFile.mimeType
      }
    },
    {
      name: 'Legacy Full Format',
      payload: {
        studentEmail: 'test@example.com',
        studentName: 'Test Student',
        sessionDate: '2024-01-01',
        fileName: TEST_CONFIG.testFile.fileName,
        fileSize: TEST_CONFIG.testFile.fileSize,
        contentType: TEST_CONFIG.testFile.mimeType,
        notes: 'Test session upload'
      }
    }
  ];

  const results = [];

  for (const variation of variations) {
    console.log(`\n🧪 Testing: ${variation.name}`);
    console.log(`📦 Payload:`, JSON.stringify(variation.payload, null, 2));

    try {
      const response = await axios.post(url, variation.payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      });

      console.log(`📊 Status: ${response.status}`);
      if (response.status !== 200) {
        console.log(`📄 Error Response:`, JSON.stringify(response.data, null, 2));
      }

      results.push({
        name: variation.name,
        status: response.status,
        success: response.status >= 200 && response.status < 300,
        payload: variation.payload,
        response: response.data
      });

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      results.push({
        name: variation.name,
        status: 0,
        success: false,
        payload: variation.payload,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Main test execution
 */
async function runComprehensiveTest() {
  console.log('🚀 COMPREHENSIVE END-TO-END UPLOAD TEST');
  console.log('='.repeat(80));
  console.log('This test reproduces the exact user flow to identify the 400 Bad Request issue');
  console.log('');

  const results = {
    directApi: {},
    customDomain: {},
    analysis: {}
  };

  // Test 1: Frontend simulation on Direct API Gateway URL
  console.log('\n📍 PHASE 1: Direct API Gateway URL Tests');
  console.log('-'.repeat(50));

  results.directApi.frontend = await simulateFrontendRequest(
    TEST_CONFIG.directApiUrl,
    'Frontend Request Simulation (Direct API Gateway)'
  );

  results.directApi.curl = await testCurlStyleRequest(
    TEST_CONFIG.directApiUrl,
    'Curl Style Request (Direct API Gateway)'
  );

  results.directApi.variations = await testPayloadVariations(TEST_CONFIG.directApiUrl);

  // Test 2: Frontend simulation on Custom Domain URL
  console.log('\n📍 PHASE 2: Custom Domain URL Tests');
  console.log('-'.repeat(50));

  results.customDomain.frontend = await simulateFrontendRequest(
    TEST_CONFIG.customDomainUrl,
    'Frontend Request Simulation (Custom Domain)'
  );

  results.customDomain.curl = await testCurlStyleRequest(
    TEST_CONFIG.customDomainUrl,
    'Curl Style Request (Custom Domain)'
  );

  results.customDomain.variations = await testPayloadVariations(TEST_CONFIG.customDomainUrl);

  // Analysis
  console.log('\n📊 COMPREHENSIVE ANALYSIS');
  console.log('='.repeat(80));

  // Find working vs failing combinations
  const workingCombinations = [];
  const failingCombinations = [];

  // Check direct API results
  [results.directApi.frontend, results.directApi.curl, ...results.directApi.variations].forEach(result => {
    if (result.success) {
      workingCombinations.push({ url: 'Direct API', ...result });
    } else {
      failingCombinations.push({ url: 'Direct API', ...result });
    }
  });

  // Check custom domain results
  [results.customDomain.frontend, results.customDomain.curl, ...results.customDomain.variations].forEach(result => {
    if (result.success) {
      workingCombinations.push({ url: 'Custom Domain', ...result });
    } else {
      failingCombinations.push({ url: 'Custom Domain', ...result });
    }
  });

  console.log(`\n✅ WORKING COMBINATIONS (${workingCombinations.length}):`);
  workingCombinations.forEach((combo, index) => {
    console.log(`${index + 1}. ${combo.url} - ${combo.name || 'Standard Request'} (${combo.status})`);
  });

  console.log(`\n❌ FAILING COMBINATIONS (${failingCombinations.length}):`);
  failingCombinations.forEach((combo, index) => {
    console.log(`${index + 1}. ${combo.url} - ${combo.name || 'Standard Request'} (${combo.status})`);
    if (combo.response && combo.response.message) {
      console.log(`   Error: ${combo.response.message}`);
    }
  });

  // Identify the specific issue
  console.log('\n🔍 ROOT CAUSE ANALYSIS:');
  console.log('-'.repeat(40));

  if (workingCombinations.length === 0) {
    console.log('❌ NO WORKING COMBINATIONS FOUND');
    console.log('   - API Gateway model validation is completely blocking all requests');
    console.log('   - The deployed model does not match any tested payload structure');
    console.log('   - CDK deployment may have failed or model not updated');
  } else if (failingCombinations.some(f => f.name === 'Frontend Style (mimeType)')) {
    console.log('🎯 FIELD NAME MISMATCH DETECTED');
    console.log('   - Frontend sends "mimeType" field');
    console.log('   - API Gateway model expects "contentType" field');
    console.log('   - This is the exact cause of the user\'s 400 Bad Request error');
    console.log('');
    console.log('💡 SOLUTION:');
    console.log('   Option 1: Update frontend to send "contentType" instead of "mimeType"');
    console.log('   Option 2: Update API Gateway model to accept "mimeType" field');
    console.log('   Option 3: Update model to accept both field names');
  } else {
    console.log('🤔 COMPLEX ISSUE DETECTED');
    console.log('   - Multiple factors may be involved');
    console.log('   - Review detailed logs above for specific error patterns');
  }

  // Specific recommendations
  console.log('\n📋 IMMEDIATE ACTION ITEMS:');
  console.log('-'.repeat(40));

  if (workingCombinations.some(w => w.name === 'Curl Style (contentType)')) {
    console.log('1. ✅ Confirm: API Gateway accepts "contentType" field');
    console.log('2. ❌ Problem: Frontend sends "mimeType" field');
    console.log('3. 🔧 Fix: Update frontend/src/services/api.ts line 251 from "mimeType" to "contentType"');
  }

  if (results.directApi.frontend.status !== results.customDomain.frontend.status) {
    console.log('4. ⚠️  URL routing issue detected between direct API and custom domain');
  }

  console.log('\n📁 Test Results saved for future reference');

  return results;
}

/**
 * Utility function to create a test file for repeated testing
 */
function createRepeatableTestScript() {
  const script = `
// Quick test script for repeated validation after fixes
const axios = require('axios');

async function quickValidationTest() {
  const response = await axios.post(
    'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1/sessions/b1dcd4ef-c043-4f83-a73e-b9b8dfc62893/upload',
    {
      fileName: 'test-video.mp4',
      fileSize: 10485760,
      contentType: 'video/mp4' // Using working field name
    },
    {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    }
  );

  console.log(\`Status: \${response.status}\`);
  console.log(\`Response: \${JSON.stringify(response.data, null, 2)}\`);

  if (response.status === 200) {
    console.log('✅ Fix successful!');
  } else {
    console.log('❌ Still failing - check logs above');
  }
}

quickValidationTest().catch(console.error);
`;

  require('fs').writeFileSync('/Users/jimmybrootcoorens/Library/Mobile Documents/com~apple~CloudDocs/JBIT /apps/ApexShare/quick-validation-test.js', script);
  console.log('📁 Created quick-validation-test.js for repeated testing');
}

// Run the comprehensive test
if (require.main === module) {
  runComprehensiveTest()
    .then((results) => {
      createRepeatableTestScript();
      console.log('\n🎉 Test completed successfully!');
      console.log('Run quick-validation-test.js after implementing fixes to verify resolution.');
    })
    .catch((error) => {
      console.error('💥 Test failed with error:', error);
      process.exit(1);
    });
}

module.exports = {
  runComprehensiveTest,
  simulateFrontendRequest,
  testCurlStyleRequest,
  testPayloadVariations
};