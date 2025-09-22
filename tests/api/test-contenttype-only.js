/**
 * Test Lambda fix by sending only the contentType field (no mimeType)
 * to match the current API Gateway model exactly
 */

const axios = require('axios');

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
const TEST_SESSION_ID = 'b1dcd4ef-c043-4f83-a73e-b9b8dfc62893';

async function testContentTypeOnly() {
  console.log('🧪 Testing Lambda Fix with contentType Only');
  console.log('='.repeat(50));

  const endpoint = `/sessions/${TEST_SESSION_ID}/upload`;
  const url = `${API_BASE_URL}${endpoint}`;

  // Test with exactly what current API Gateway expects (contentType, not mimeType)
  console.log('🔍 Test: Current API Gateway format (contentType only)');
  console.log('-'.repeat(50));

  const exactApiGatewayRequest = {
    studentEmail: 'test@example.com',
    studentName: 'Test Student',
    sessionDate: '2024-01-01',
    fileName: 'test-video.mp4',
    fileSize: 10485760,
    contentType: 'video/mp4', // Only this field, not mimeType
    notes: 'Test session upload'
  };

  console.log('📤 Request body:', JSON.stringify(exactApiGatewayRequest, null, 2));

  try {
    const response = await axios.post(url, exactApiGatewayRequest, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Test)'
      },
      validateStatus: () => true
    });

    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Response: ${JSON.stringify(response.data, null, 2)}`);

    if (response.status === 200) {
      console.log('✅ SUCCESS! Lambda handler now accepts contentType field');
      console.log('🎯 The Lambda fix works! Now we need to update the API Gateway model');
      console.log('   to accept the frontend format (mimeType) OR update frontend to send contentType');
    } else if (response.status === 400) {
      if (response.data.message === 'Invalid request body') {
        console.log('❌ API Gateway still rejecting - model issue persists');
      } else {
        console.log('❌ Lambda validation failed - checking error...');
        if (response.data.error?.includes('MIME type')) {
          console.log('   → Lambda looking for mimeType field (contentType fallback not working)');
        } else {
          console.log(`   → Different error: ${response.data.error}`);
        }
      }
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }

  console.log('');
  console.log('📊 Next Steps:');
  console.log('='.repeat(30));
  if (response.status === 200) {
    console.log('1. ✅ Lambda handler fix confirmed working');
    console.log('2. 🔄 Need to deploy API Gateway changes for frontend compatibility');
    console.log('3. 🧪 Then test with frontend format (mimeType field)');
  } else {
    console.log('1. 🔍 Debug API Gateway model constraints');
    console.log('2. 🔄 May need to remove additionalProperties: false');
    console.log('3. 🧪 Test with minimal required fields only');
  }
}

testContentTypeOnly().catch(console.error);