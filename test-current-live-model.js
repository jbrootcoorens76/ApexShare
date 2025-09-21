/**
 * Test the current live API Gateway model to confirm the issue
 */

const axios = require('axios');

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
const TEST_SESSION_ID = 'b1dcd4ef-c043-4f83-a73e-b9b8dfc62893';

async function testCurrentLiveModel() {
  console.log('🧪 Testing Current Live API Gateway Model');
  console.log('='.repeat(50));

  const endpoint = `/sessions/${TEST_SESSION_ID}/upload`;
  const url = `${API_BASE_URL}${endpoint}`;

  // Test with full legacy model fields that the current API Gateway expects
  console.log('🔍 Test: Send request matching current live API Gateway model');
  console.log('-'.repeat(60));

  const legacyStyleRequest = {
    studentEmail: 'test@example.com',
    studentName: 'Test Student',
    sessionDate: '2024-01-01',
    fileName: 'test-video.mp4',
    fileSize: 10485760,
    contentType: 'video/mp4',
    notes: 'Test session upload'
  };

  console.log('📤 Request body:', JSON.stringify(legacyStyleRequest, null, 2));

  try {
    const response = await axios.post(url, legacyStyleRequest, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Test)'
      },
      validateStatus: () => true
    });

    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Response: ${JSON.stringify(response.data, null, 2)}`);

    if (response.status === 400) {
      if (response.data.message === 'Invalid request body') {
        console.log('❌ Still 400 with "Invalid request body" - API Gateway validation issue');
      } else {
        console.log('❌ 400 but different error - Lambda validation issue');
      }
    } else if (response.status === 200) {
      console.log('✅ Success! API Gateway accepts this format');
      console.log('🔍 This proves the issue is field mismatch, not Lambda logic');
    } else {
      console.log(`⚠️  Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }

  console.log('');
  console.log('📊 Next Steps:');
  console.log('1. If this test passes → Deploy the CDK changes to update the model');
  console.log('2. If this test fails → There are additional validation issues');
}

testCurrentLiveModel().catch(console.error);