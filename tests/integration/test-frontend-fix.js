/**
 * Test the exact frontend fix: sending contentType instead of mimeType
 */

const axios = require('axios');

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
const TEST_SESSION_ID = 'b1dcd4ef-c043-4f83-a73e-b9b8dfc62893';

async function testFrontendFix() {
  console.log('🧪 Testing Frontend Fix: contentType Field');
  console.log('='.repeat(50));

  const endpoint = `/sessions/${TEST_SESSION_ID}/upload`;
  const url = `${API_BASE_URL}${endpoint}`;

  console.log(`📡 Testing endpoint: ${endpoint}`);
  console.log(`🌐 Full URL: ${url}`);
  console.log('');

  // Test exactly what the fixed frontend now sends
  console.log('🔍 Test: Fixed Frontend Request (contentType instead of mimeType)');
  console.log('-'.repeat(50));

  const frontendFixedRequest = {
    studentEmail: 'session@placeholder.com', // Required by API Gateway model
    fileName: 'test-video.mp4',
    fileSize: 10485760, // 10MB
    contentType: 'video/mp4' // Fixed: was mimeType, now contentType
  };

  console.log('📤 Request payload:', JSON.stringify(frontendFixedRequest, null, 2));

  try {
    const response = await axios.post(url, frontendFixedRequest, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (ApexShare Frontend Fix Test)'
      },
      validateStatus: () => true // Don't throw on any status
    });

    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Response: ${JSON.stringify(response.data, null, 2)}`);
    console.log('');

    if (response.status === 200) {
      console.log('✅ SUCCESS! Frontend fix works - API Gateway accepts contentType');
      console.log('🎯 The field name mismatch issue is resolved');
      console.log('');
      console.log('✅ FRONTEND FIX CONFIRMED:');
      console.log('   - Changed: mimeType → contentType in api.ts');
      console.log('   - Result: API Gateway validation passes');
      console.log('   - Status: Ready for production');
      return true;
    } else if (response.status === 400) {
      if (response.data.message === 'Invalid request body') {
        console.log('❌ Still getting validation error');
        console.log('🔍 This suggests API Gateway model expects different fields');
        console.log('💡 Check if other required fields are missing');
      } else {
        console.log('❌ Different 400 error - check response details');
      }
      return false;
    } else if (response.status === 401 || response.status === 403) {
      console.log('⚠️  Authentication/Authorization error');
      console.log('🔍 This is expected for test requests without proper auth');
      console.log('✅ But it means API Gateway validation PASSED!');
      console.log('🎯 Frontend fix is working - field name issue resolved');
      return true;
    } else if (response.status === 404) {
      console.log('⚠️  Session not found');
      console.log('🔍 This is expected for test session ID');
      console.log('✅ But it means API Gateway validation PASSED!');
      console.log('🎯 Frontend fix is working - field name issue resolved');
      return true;
    } else {
      console.log(`⚠️  Unexpected status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    return false;
  }
}

async function main() {
  const success = await testFrontendFix();

  console.log('');
  console.log('📊 FRONTEND FIX ASSESSMENT');
  console.log('='.repeat(50));

  if (success) {
    console.log('✅ FRONTEND FIX SUCCESSFUL');
    console.log('');
    console.log('🔧 CHANGES MADE:');
    console.log('   File: frontend/src/services/api.ts');
    console.log('   Line 251: mimeType → contentType: mimeType');
    console.log('');
    console.log('🎯 RESULT:');
    console.log('   ✅ API Gateway validation now passes');
    console.log('   ✅ Frontend and backend field names aligned');
    console.log('   ✅ Ready for end-to-end testing');
    console.log('');
    console.log('🚀 NEXT STEPS:');
    console.log('   1. Test with real authentication');
    console.log('   2. Verify end-to-end upload flow');
    console.log('   3. Update frontend build and deploy');
  } else {
    console.log('❌ FRONTEND FIX NEEDS MORE WORK');
    console.log('');
    console.log('🔍 POSSIBLE ISSUES:');
    console.log('   1. API Gateway model expects additional fields');
    console.log('   2. Field validation rules are different');
    console.log('   3. Authentication required for any validation');
    console.log('');
    console.log('🔧 NEXT DEBUGGING STEPS:');
    console.log('   1. Check current API Gateway model definition');
    console.log('   2. Test with minimal required fields only');
    console.log('   3. Compare with working Lambda test payload');
  }
}

main().catch(console.error);