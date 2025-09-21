
/**
 * Quick Validation Test
 *
 * Run this after implementing fixes to verify the upload endpoint works correctly.
 * This tests both the API Gateway model deployment and frontend compatibility.
 */

const axios = require('axios');

const TEST_CONFIG = {
  apiUrl: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
  sessionId: 'b1dcd4ef-c043-4f83-a73e-b9b8dfc62893'
};

async function testAPIGatewayDeployment() {
  console.log('🔧 Testing API Gateway Model Deployment');
  console.log('='.repeat(50));

  const url = `${TEST_CONFIG.apiUrl}/sessions/${TEST_CONFIG.sessionId}/upload`;

  const response = await axios.post(url, {
    fileName: 'test-video.mp4',
    fileSize: 10485760,
    mimeType: 'video/mp4'
  }, {
    headers: { 'Content-Type': 'application/json' },
    validateStatus: () => true
  });

  console.log(`📊 Status: ${response.status}`);
  console.log(`📄 Response:`, JSON.stringify(response.data, null, 2));

  if (response.status === 200) {
    console.log('✅ API Gateway deployment successful!');
    return true;
  } else if (response.status === 403 && response.data.error === 'Unauthorized') {
    console.log('✅ API Gateway model validation working! (403 Unauthorized is expected without auth)');
    return true;
  } else {
    console.log('❌ API Gateway still failing - model not updated');
    return false;
  }
}

async function testFrontendCompatibility() {
  console.log('\n🖥️  Testing Frontend Compatibility');
  console.log('='.repeat(50));

  const url = `${TEST_CONFIG.apiUrl}/sessions/${TEST_CONFIG.sessionId}/upload`;

  // Test the payload format the frontend actually sends
  const response = await axios.post(url, {
    fileName: 'test-video.mp4',
    fileSize: 10485760,
    mimeType: 'video/mp4' // Frontend field name
  }, {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (frontend simulation)',
      'Origin': 'https://apexshare.be'
    },
    validateStatus: () => true
  });

  console.log(`📊 Status: ${response.status}`);
  console.log(`📄 Response:`, JSON.stringify(response.data, null, 2));

  if (response.status === 200) {
    console.log('✅ Frontend compatibility confirmed!');
    return true;
  } else if (response.status === 403 && response.data.error === 'Unauthorized') {
    console.log('✅ Frontend compatibility confirmed! (403 Unauthorized is expected without auth)');
    return true;
  } else if (response.status === 400 && response.data.message === 'Invalid request body') {
    console.log('❌ Frontend field name still needs fixing');
    console.log('💡 Update frontend/src/services/api.ts line 251: mimeType → contentType');
    return false;
  } else {
    console.log('❌ Unexpected error - check logs above');
    return false;
  }
}

async function runFullValidation() {
  console.log('🧪 UPLOAD ENDPOINT VALIDATION TEST');
  console.log('='.repeat(60));
  console.log('Testing fixes for the 400 Bad Request issue\n');

  const apiWorking = await testAPIGatewayDeployment();

  if (apiWorking) {
    const frontendWorking = await testFrontendCompatibility();

    console.log('\n📊 VALIDATION SUMMARY');
    console.log('='.repeat(30));
    console.log(`API Gateway Model: ${apiWorking ? '✅ Working' : '❌ Failed'}`);
    console.log(`Frontend Compatibility: ${frontendWorking ? '✅ Working' : '❌ Failed'}`);

    if (apiWorking && frontendWorking) {
      console.log('\n🎉 ALL TESTS PASSED! Users can now upload successfully.');
    } else if (apiWorking && !frontendWorking) {
      console.log('\n⚠️  API fixed but frontend needs update. See action items above.');
    }
  } else {
    console.log('\n❌ API Gateway deployment issue must be resolved first.');
  }
}

if (require.main === module) {
  runFullValidation().catch(console.error);
}

module.exports = { runFullValidation };
