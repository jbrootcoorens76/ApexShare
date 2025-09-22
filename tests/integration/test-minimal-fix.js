/**
 * Test minimal fix: send only required fields that make sense for session uploads
 */

const axios = require('axios');

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
const TEST_SESSION_ID = 'b1dcd4ef-c043-4f83-a73e-b9b8dfc62893';

async function testMinimalFix() {
  console.log('🧪 Testing Minimal Fix for Session Upload');
  console.log('='.repeat(50));

  const endpoint = `/sessions/${TEST_SESSION_ID}/upload`;
  const url = `${API_BASE_URL}${endpoint}`;

  console.log('🔍 Test: Minimal required fields for session upload');
  console.log('-'.repeat(50));

  // According to the API Gateway model, required fields are:
  // ['studentEmail', 'fileName', 'fileSize', 'contentType']
  // But for session uploads, we can use dummy/session-derived values

  const minimalRequest = {
    studentEmail: 'session@placeholder.com', // Placeholder - session has the real data
    fileName: 'test-video.mp4',
    fileSize: 10485760,
    contentType: 'video/mp4'
  };

  console.log('📤 Request body:', JSON.stringify(minimalRequest, null, 2));
  console.log('💡 Note: studentEmail is placeholder - session upload should derive from session');

  try {
    const response = await axios.post(url, minimalRequest, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Test)'
      },
      validateStatus: () => true
    });

    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Response: ${JSON.stringify(response.data, null, 2)}`);

    if (response.status === 200) {
      console.log('✅ SUCCESS! Minimal session upload works');
      console.log('');
      console.log('🔧 FRONTEND FIX APPROACH:');
      console.log('1. Update frontend to send these minimal required fields');
      console.log('2. Use placeholder values for legacy fields not relevant to sessions');
      console.log('3. Lambda handler will process as session upload (not legacy)');
      console.log('');
      console.log('📋 Frontend should send:');
      console.log('   {');
      console.log('     studentEmail: "session@placeholder.com",  // Placeholder');
      console.log('     fileName: actualFileName,');
      console.log('     fileSize: actualFileSize,');
      console.log('     contentType: actualMimeType');
      console.log('   }');
    } else {
      console.log('❌ Still failing with minimal fields');
      console.log('📋 May need to add more required fields or fix API Gateway');
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }
}

testMinimalFix().catch(console.error);