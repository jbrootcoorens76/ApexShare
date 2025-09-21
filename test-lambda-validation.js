/**
 * Test Lambda validation by sending the field it expects
 */

const axios = require('axios');

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
const TEST_SESSION_ID = 'b1dcd4ef-c043-4f83-a73e-b9b8dfc62893';

async function testLambdaValidation() {
  console.log('🧪 Testing Lambda Handler Validation');
  console.log('='.repeat(50));

  const endpoint = `/sessions/${TEST_SESSION_ID}/upload`;
  const url = `${API_BASE_URL}${endpoint}`;

  // Test 1: Send what Lambda expects (mimeType + required legacy fields for API Gateway)
  console.log('🔍 Test 1: Lambda format (mimeType) + API Gateway required fields');
  console.log('-'.repeat(70));

  const hybridRequest = {
    studentEmail: 'test@example.com',
    studentName: 'Test Student',
    sessionDate: '2024-01-01',
    fileName: 'test-video.mp4',
    fileSize: 10485760,
    contentType: 'video/mp4', // For API Gateway
    mimeType: 'video/mp4',    // For Lambda
    notes: 'Test session upload'
  };

  console.log('📤 Request body:', JSON.stringify(hybridRequest, null, 2));

  try {
    const response = await axios.post(url, hybridRequest, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Test)'
      },
      validateStatus: () => true
    });

    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Response: ${JSON.stringify(response.data, null, 2)}`);

    if (response.status === 200) {
      console.log('✅ SUCCESS! Both API Gateway and Lambda validation passed');
      console.log('🎯 Root cause confirmed: Field name mismatch between API Gateway and Lambda');
    } else if (response.status === 400) {
      console.log('❌ Still failing - analyzing error message...');
      if (response.data.error?.includes('MIME type')) {
        console.log('   → Lambda still can\'t find mimeType field');
      } else if (response.data.message === 'Invalid request body') {
        console.log('   → API Gateway still rejecting the request');
      } else {
        console.log('   → Different validation error');
      }
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }

  console.log('');
  console.log('📊 Root Cause Analysis:');
  console.log('='.repeat(50));
  console.log('Current situation:');
  console.log('  🟡 API Gateway model: expects contentType + legacy fields');
  console.log('  🟡 Lambda handler: expects mimeType (session uploads)');
  console.log('  🟡 Frontend: sends mimeType only');
  console.log('');
  console.log('Solution needed:');
  console.log('  1. Deploy updated API Gateway model (sessionUploadRequestModel)');
  console.log('  2. Ensure Lambda can handle both contentType and mimeType');
  console.log('  3. OR update frontend to match Lambda expectations');
}

testLambdaValidation().catch(console.error);