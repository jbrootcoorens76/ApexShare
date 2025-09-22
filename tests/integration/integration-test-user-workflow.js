/**
 * Integration Test - Complete User Workflow
 *
 * This test simulates the complete user journey from visiting the upload page
 * to successfully uploading a video file. It reproduces the exact frontend
 * behavior that users experience.
 */

const axios = require('axios');

const TEST_CONFIG = {
  frontendOrigin: 'https://apexshare.be',
  apiUrl: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
  customDomainApi: 'https://api.apexshare.be',
  sessionId: 'b1dcd4ef-c043-4f83-a73e-b9b8dfc62893',
  testFile: {
    name: 'training-session-video.mp4',
    size: 52428800, // 50MB
    type: 'video/mp4'
  }
};

/**
 * Simulate frontend request exactly as it would be sent
 */
async function simulateUserUploadRequest(apiBaseUrl, useCorrectFieldName = false) {
  console.log(`\n🧪 Simulating User Upload Request`);
  console.log(`🎯 API: ${apiBaseUrl}`);
  console.log(`🔧 Field Name: ${useCorrectFieldName ? 'contentType' : 'mimeType'}`);
  console.log('-'.repeat(60));

  const endpoint = `/sessions/${TEST_CONFIG.sessionId}/upload`;
  const url = `${apiBaseUrl}${endpoint}`;

  // Exact payload structure from frontend (see api.ts line 247-252)
  const payload = {
    fileName: TEST_CONFIG.testFile.name,
    fileSize: TEST_CONFIG.testFile.size,
    ...(useCorrectFieldName
      ? { contentType: TEST_CONFIG.testFile.type }
      : { mimeType: TEST_CONFIG.testFile.type }
    )
  };

  console.log(`📦 Request Payload:`, JSON.stringify(payload, null, 2));

  try {
    // Simulate exact frontend axios request (from api.ts)
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': TEST_CONFIG.frontendOrigin,
        'Referer': `${TEST_CONFIG.frontendOrigin}/upload`,
        'X-Requested-With': `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site'
      },
      timeout: 30000,
      validateStatus: () => true
    });

    console.log(`📊 Response Status: ${response.status}`);
    console.log(`📄 Response Data:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200) {
      console.log('✅ SUCCESS: User would be able to upload');
      if (response.data && response.data.data && response.data.data.uploadUrl) {
        console.log('🔗 Upload URL received - proceeding to S3 upload simulation');
        return { success: true, uploadData: response.data.data };
      }
    } else if (response.status === 400) {
      console.log('❌ FAILURE: User gets "Bad Request" error');
      if (response.data.message === 'Invalid request body') {
        console.log('🔍 Root Cause: API Gateway model validation failure');
      }
    } else if (response.status === 403) {
      console.log('❌ FAILURE: User gets "Forbidden" error');
      console.log('🔍 Root Cause: CORS or authentication issue');
    }

    return { success: false, status: response.status, error: response.data };

  } catch (error) {
    console.log(`❌ Network Error: ${error.message}`);
    console.log('🔍 User would see: "Network error - please check your connection"');
    return { success: false, error: error.message };
  }
}

/**
 * Simulate the complete file upload process
 */
async function simulateCompleteUploadFlow(apiBaseUrl, useCorrectFieldName = false) {
  console.log(`\n🔄 COMPLETE UPLOAD FLOW SIMULATION`);
  console.log('='.repeat(60));

  // Step 1: Request upload URL
  const uploadResult = await simulateUserUploadRequest(apiBaseUrl, useCorrectFieldName);

  if (!uploadResult.success) {
    console.log('\n❌ Upload flow stopped at step 1: Cannot get upload URL');
    return uploadResult;
  }

  // Step 2: Simulate S3 upload (we won't actually upload, just validate the URL)
  console.log('\n🔗 Step 2: S3 Upload Simulation');
  console.log('-'.repeat(30));

  const uploadData = uploadResult.uploadData;

  if (uploadData.uploadUrl && uploadData.uploadId) {
    console.log('✅ Multipart upload URL received');
    console.log(`📋 Upload ID: ${uploadData.uploadId}`);
    console.log(`🔗 Upload URL: ${uploadData.uploadUrl.substring(0, 50)}...`);

    // For a real test, we would:
    // 1. Upload chunks to the presigned URLs
    // 2. Complete the multipart upload
    // But for this simulation, we'll just validate the response structure

    console.log('✅ Upload flow would complete successfully');
    return { success: true, message: 'Complete upload flow successful' };

  } else if (uploadData.uploadUrl) {
    console.log('✅ Direct upload URL received (legacy format)');
    console.log(`🔗 Upload URL: ${uploadData.uploadUrl.substring(0, 50)}...`);
    console.log('✅ Upload flow would complete successfully');
    return { success: true, message: 'Complete upload flow successful' };

  } else {
    console.log('❌ Invalid upload response structure');
    console.log('🔍 API returned 200 but missing upload URL');
    return { success: false, error: 'Invalid upload response' };
  }
}

/**
 * Test matrix covering all scenarios
 */
async function runCompleteIntegrationTest() {
  console.log('🚀 INTEGRATION TEST - COMPLETE USER WORKFLOW');
  console.log('='.repeat(80));
  console.log('Testing the exact user experience when uploading videos\n');

  const testScenarios = [
    {
      name: 'Current Frontend (Direct API)',
      apiUrl: TEST_CONFIG.apiUrl,
      useCorrectField: false,
      description: 'What users currently experience'
    },
    {
      name: 'Current Frontend (Custom Domain)',
      apiUrl: TEST_CONFIG.customDomainApi,
      useCorrectField: false,
      description: 'Alternative API endpoint test'
    },
    {
      name: 'Fixed Frontend (Direct API)',
      apiUrl: TEST_CONFIG.apiUrl,
      useCorrectField: true,
      description: 'After frontend field name fix'
    },
    {
      name: 'Fixed Frontend (Custom Domain)',
      apiUrl: TEST_CONFIG.customDomainApi,
      useCorrectField: true,
      description: 'Complete solution test'
    }
  ];

  const results = [];

  for (const scenario of testScenarios) {
    console.log(`\n📋 SCENARIO: ${scenario.name}`);
    console.log(`📝 Description: ${scenario.description}`);
    console.log('='.repeat(60));

    const result = await simulateCompleteUploadFlow(scenario.apiUrl, scenario.useCorrectField);

    results.push({
      name: scenario.name,
      description: scenario.description,
      success: result.success,
      details: result
    });
  }

  // Summary Report
  console.log('\n📊 INTEGRATION TEST SUMMARY');
  console.log('='.repeat(80));

  const workingScenarios = results.filter(r => r.success);
  const failingScenarios = results.filter(r => !r.success);

  console.log(`✅ Working Scenarios: ${workingScenarios.length}/${results.length}`);
  workingScenarios.forEach(scenario => {
    console.log(`   ✓ ${scenario.name}`);
  });

  console.log(`\n❌ Failing Scenarios: ${failingScenarios.length}/${results.length}`);
  failingScenarios.forEach(scenario => {
    console.log(`   ✗ ${scenario.name}`);
  });

  // User Impact Analysis
  console.log('\n🎯 USER IMPACT ANALYSIS');
  console.log('-'.repeat(40));

  if (failingScenarios.some(s => s.name.includes('Current Frontend'))) {
    console.log('❌ USERS CURRENTLY CANNOT UPLOAD');
    console.log('   - All upload attempts fail with 400 Bad Request');
    console.log('   - Users see error messages in the browser');
    console.log('   - No videos can be uploaded until fixes are deployed');
  }

  if (workingScenarios.some(s => s.name.includes('Fixed Frontend'))) {
    console.log('✅ SOLUTION CONFIRMED');
    console.log('   - Fixing the field name will resolve the issue');
    console.log('   - Users will be able to upload after deployment');
  } else {
    console.log('❌ SOLUTION NOT COMPLETE');
    console.log('   - API Gateway deployment still required');
    console.log('   - Frontend fix alone will not resolve the issue');
  }

  // Action Items
  console.log('\n📋 REQUIRED ACTION ITEMS');
  console.log('-'.repeat(40));

  if (failingScenarios.length === results.length) {
    console.log('1. 🚨 Deploy CDK changes to update API Gateway model');
    console.log('2. 🔧 Update frontend field name: mimeType → contentType');
    console.log('3. 🧪 Run this test again to verify both fixes');
  } else if (workingScenarios.some(s => s.useCorrectField)) {
    console.log('1. ✅ API Gateway is working');
    console.log('2. 🔧 Update frontend field name: mimeType → contentType');
    console.log('3. 🚀 Deploy frontend changes');
  } else {
    console.log('1. 🚨 API Gateway deployment required');
    console.log('2. 🧪 Run test again after API deployment');
  }

  return results;
}

if (require.main === module) {
  runCompleteIntegrationTest()
    .then(results => {
      console.log('\n🎉 Integration test completed!');
      console.log('📁 Test results available for analysis');
    })
    .catch(error => {
      console.error('💥 Integration test failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runCompleteIntegrationTest,
  simulateUserUploadRequest,
  simulateCompleteUploadFlow
};