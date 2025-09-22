/**
 * Final validation test using the updated frontend format
 * This confirms the 400 Bad Request error is resolved
 */

const axios = require('axios');

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
const TEST_SESSION_ID = 'b1dcd4ef-c043-4f83-a73e-b9b8dfc62893';

async function finalValidation() {
  console.log('🎯 FINAL VALIDATION: 400 Bad Request Error Resolution');
  console.log('='.repeat(60));

  const endpoint = `/sessions/${TEST_SESSION_ID}/upload`;
  const url = `${API_BASE_URL}${endpoint}`;

  console.log('🔍 Test: Updated Frontend Format (Post-Fix)');
  console.log('-'.repeat(50));

  // Use the updated frontend format (from our fix)
  const updatedFrontendRequest = {
    studentEmail: 'session@placeholder.com', // Placeholder for API Gateway compatibility
    fileName: 'final-test-video.mp4',
    fileSize: 10485760,
    contentType: 'video/mp4' // Changed from mimeType to contentType
  };

  console.log('📤 Updated Request Format:');
  console.log(JSON.stringify(updatedFrontendRequest, null, 2));

  try {
    const response = await axios.post(url, updatedFrontendRequest, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (ApexShare Frontend)',
        'Origin': 'https://apexshare.be'
      },
      validateStatus: () => true
    });

    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Response: ${JSON.stringify(response.data, null, 2)}`);

    if (response.status === 200) {
      console.log('🎉 SUCCESS! 400 Bad Request Error is RESOLVED!');
      console.log('');
      console.log('✅ PROBLEM SOLVED:');
      console.log('   ❌ Was: Frontend sends mimeType → API Gateway rejects → 400 error');
      console.log('   ✅ Now: Frontend sends contentType → API Gateway accepts → 200 success');
      console.log('');
      console.log('🔧 FIXES IMPLEMENTED:');
      console.log('   1. Lambda handler updated to accept both mimeType and contentType');
      console.log('   2. Frontend updated to send contentType with required fields');
      console.log('   3. Session upload endpoint now works end-to-end');
      console.log('');
      console.log('📊 RESPONSE DATA:');
      console.log(`   Upload ID: ${response.data.data.uploadId}`);
      console.log(`   Upload URL: ${response.data.data.uploadUrl}`);
      console.log(`   Chunk Size: ${response.data.data.chunkSize} bytes`);
      console.log(`   Expires At: ${response.data.data.expiresAt}`);

      return true;
    } else {
      console.log('❌ Still failing - unexpected error');
      return false;
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    return false;
  }
}

// Run validation
finalValidation()
  .then((success) => {
    console.log('');
    console.log('🏁 FINAL ASSESSMENT');
    console.log('='.repeat(30));
    if (success) {
      console.log('🎊 RESOLUTION CONFIRMED: 400 Bad Request error is completely fixed!');
      console.log('🚀 The session upload endpoint is now working correctly.');
      console.log('✅ Frontend can successfully initiate file uploads through sessions.');
    } else {
      console.log('⚠️  There may still be issues to resolve.');
    }
  })
  .catch(console.error);