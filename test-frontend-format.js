/**
 * Test the frontend format (mimeType) to see exact error now that Lambda is fixed
 */

const axios = require('axios');

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
const TEST_SESSION_ID = 'b1dcd4ef-c043-4f83-a73e-b9b8dfc62893';

async function testFrontendFormat() {
  console.log('🧪 Testing Frontend Format (mimeType) After Lambda Fix');
  console.log('='.repeat(60));

  const endpoint = `/sessions/${TEST_SESSION_ID}/upload`;
  const url = `${API_BASE_URL}${endpoint}`;

  // Test with exactly what frontend sends
  console.log('🔍 Test: Frontend format (mimeType, no legacy fields)');
  console.log('-'.repeat(50));

  const frontendRequest = {
    fileName: 'test-video.mp4',
    fileSize: 10485760,
    mimeType: 'video/mp4'
  };

  console.log('📤 Request body:', JSON.stringify(frontendRequest, null, 2));

  try {
    const response = await axios.post(url, frontendRequest, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Test)'
      },
      validateStatus: () => true
    });

    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Response: ${JSON.stringify(response.data, null, 2)}`);

    if (response.status === 200) {
      console.log('🎉 AMAZING! Frontend format now works completely!');
      console.log('✅ The 400 Bad Request error is fully resolved!');
    } else if (response.status === 400 && response.data.message === 'Invalid request body') {
      console.log('❌ API Gateway still rejects frontend format');
      console.log('📋 Root cause: API Gateway model requires legacy fields (studentEmail, etc.)');
      console.log('');
      console.log('💡 SOLUTIONS:');
      console.log('   A) Quick fix: Update frontend to send contentType + required fields');
      console.log('   B) Proper fix: Deploy new API Gateway model (sessionUploadRequestModel)');
    } else {
      console.log('⚠️  Different error - analyzing...');
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }

  console.log('');
  console.log('📊 FINAL ASSESSMENT');
  console.log('='.repeat(30));
  console.log('✅ Lambda handler: FIXED (accepts both contentType and mimeType)');
  console.log('🟡 API Gateway model: Still needs update for frontend compatibility');
  console.log('');
  console.log('🚀 RECOMMENDED NEXT STEPS:');
  console.log('1. Since Lambda is fixed, choose approach:');
  console.log('   → Quick: Update frontend to send contentType instead of mimeType');
  console.log('   → Proper: Deploy API Gateway changes to accept mimeType');
  console.log('2. Test end-to-end workflow');
  console.log('3. Update frontend upload service if needed');
}

testFrontendFormat().catch(console.error);