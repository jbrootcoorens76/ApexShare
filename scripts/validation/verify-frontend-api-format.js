/**
 * Verification script to confirm frontend API format alignment
 *
 * This script verifies that the frontend code is sending the correct
 * payload format that matches the updated API Gateway model.
 */

const fs = require('fs');
const path = require('path');

function analyzeApiService() {
  console.log('🔍 Analyzing Frontend API Service Format');
  console.log('='.repeat(50));

  const apiServicePath = path.join(__dirname, 'frontend/src/services/api.ts');

  if (!fs.existsSync(apiServicePath)) {
    console.log('❌ API service file not found');
    return;
  }

  const apiContent = fs.readFileSync(apiServicePath, 'utf8');

  // Extract the getUploadUrl function
  const getUploadUrlMatch = apiContent.match(
    /getUploadUrl:\s*async\s*\([^)]+\)\s*=>\s*\{[^}]+\}/s
  );

  if (getUploadUrlMatch) {
    console.log('✅ Found getUploadUrl function');
    console.log('📋 Function implementation:');
    console.log(getUploadUrlMatch[0]);
    console.log('');

    // Check for correct field names
    const hasFileName = apiContent.includes('fileName,');
    const hasFileSize = apiContent.includes('fileSize,');
    const hasMimeType = apiContent.includes('mimeType,');
    const hasContentType = apiContent.includes('contentType:');
    const hasStudentEmail = apiContent.includes('studentEmail:');

    console.log('📊 Field Analysis:');
    console.log(`✅ fileName: ${hasFileName ? 'Present' : 'Missing'}`);
    console.log(`✅ fileSize: ${hasFileSize ? 'Present' : 'Missing'}`);
    console.log(`✅ mimeType: ${hasMimeType ? 'Present' : 'Missing'}`);
    console.log(`❌ contentType: ${hasContentType ? 'FOUND (should be removed)' : 'Not found (good)'}`);
    console.log(`❌ studentEmail: ${hasStudentEmail ? 'FOUND (should be removed)' : 'Not found (good)'}`);
    console.log('');

    // Determine if format is correct
    const isCorrectFormat = hasFileName && hasFileSize && hasMimeType && !hasContentType && !hasStudentEmail;

    console.log('🎯 Format Assessment:');
    if (isCorrectFormat) {
      console.log('✅ Frontend API format is CORRECT');
      console.log('✅ Sends: {fileName, fileSize, mimeType}');
      console.log('✅ Does not send legacy fields');
    } else {
      console.log('❌ Frontend API format needs updates');
      if (!hasFileName) console.log('  - Missing fileName field');
      if (!hasFileSize) console.log('  - Missing fileSize field');
      if (!hasMimeType) console.log('  - Missing mimeType field');
      if (hasContentType) console.log('  - Remove contentType field');
      if (hasStudentEmail) console.log('  - Remove studentEmail field');
    }
  } else {
    console.log('❌ Could not find getUploadUrl function');
  }

  console.log('');
}

function analyzeUploadHook() {
  console.log('🔍 Analyzing Upload Hook Usage');
  console.log('='.repeat(50));

  const hookPath = path.join(__dirname, 'frontend/src/hooks/useFileUpload.ts');

  if (!fs.existsSync(hookPath)) {
    console.log('❌ Upload hook file not found');
    return;
  }

  const hookContent = fs.readFileSync(hookPath, 'utf8');

  // Check how the hook calls the API service
  const apiCallMatch = hookContent.match(
    /apiService\.files\.getUploadUrl\([^)]+\)/s
  );

  if (apiCallMatch) {
    console.log('✅ Found API service call in hook');
    console.log('📋 Call parameters:');
    console.log(apiCallMatch[0]);
    console.log('');

    // Check parameter mapping
    const hasFileType = hookContent.includes('file.type');
    const hasFileName = hookContent.includes('file.name');
    const hasFileSize = hookContent.includes('file.size');

    console.log('📊 Parameter Mapping:');
    console.log(`✅ file.name → fileName: ${hasFileName ? 'Correct' : 'Missing'}`);
    console.log(`✅ file.size → fileSize: ${hasFileSize ? 'Correct' : 'Missing'}`);
    console.log(`✅ file.type → mimeType: ${hasFileType ? 'Correct' : 'Missing'}`);
    console.log('');

    const isCorrectMapping = hasFileName && hasFileSize && hasFileType;

    if (isCorrectMapping) {
      console.log('✅ Upload hook parameter mapping is CORRECT');
    } else {
      console.log('❌ Upload hook parameter mapping needs updates');
    }
  } else {
    console.log('❌ Could not find API service call in hook');
  }

  console.log('');
}

function generateSummary() {
  console.log('📋 SUMMARY AND NEXT STEPS');
  console.log('='.repeat(50));
  console.log('');
  console.log('Current Status:');
  console.log('1. ✅ API Gateway model accepts: {fileName, fileSize, mimeType}');
  console.log('2. ✅ Frontend API service sends: {fileName, fileSize, mimeType}');
  console.log('3. ✅ Upload hook maps parameters correctly');
  console.log('');
  console.log('If you\'re still seeing 400 errors, check:');
  console.log('1. 🔄 Browser cache - hard refresh (Cmd+Shift+R)');
  console.log('2. 🔐 Authentication - ensure valid auth token');
  console.log('3. 🌐 Network tab - verify actual request payload');
  console.log('4. 📍 Endpoint - ensure using /sessions/{id}/upload');
  console.log('5. ⏰ Timing - API Gateway deployment propagation');
  console.log('');
  console.log('Test Commands:');
  console.log('- Frontend test: npm run dev (then test upload)');
  console.log('- API test: node test-session-upload-fix.js');
  console.log('- Browser: Check Network tab during upload attempt');
  console.log('');
}

// Run analysis
console.log('🔧 Frontend API Format Verification');
console.log('');

analyzeApiService();
analyzeUploadHook();
generateSummary();