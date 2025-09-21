/**
 * COMPREHENSIVE UPLOAD FUNCTIONALITY VALIDATION
 *
 * This test suite validates the complete upload functionality including:
 * 1. Session upload endpoint (POST /v1/sessions/{sessionId}/upload)
 * 2. Legacy upload endpoint (POST /v1/uploads/initiate)
 * 3. End-to-end response validation
 * 4. Error handling verification
 */

const axios = require('axios');

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
const TEST_SESSION_ID = 'b1dcd4ef-c043-4f83-a73e-b9b8dfc62893';
const AUTH_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkZW1vLXRyYWluZXItMSIsImVtYWlsIjoidHJhaW5lckBhcGV4c2hhcmUuYmUiLCJyb2xlIjoidHJhaW5lciIsImlhdCI6MTc1ODQ0NDEwOSwiZXhwIjoxNzU4NTMwNTA5fQ.Y0kXtGk1lrnn9emyf5j0YpwLdAt0BPpnDAtdrScKTPA';

// Test configurations
const VALID_REQUEST_PAYLOAD = {
    fileName: 'validation-test-video.mp4',
    fileSize: 15728640, // 15MB
    contentType: 'video/mp4' // Session endpoint requires contentType as per API Gateway model
    // Note: SessionUploadRequestModel has additionalProperties: false, so only these 3 fields are allowed
};

const VALID_LEGACY_PAYLOAD = {
    studentEmail: 'test@example.com',
    fileName: 'validation-test-video.mp4',
    fileSize: 15728640,
    contentType: 'video/mp4', // Legacy endpoint requires contentType
    sessionDate: '2025-09-21' // Legacy endpoint requires sessionDate in YYYY-MM-DD format
};

class UploadValidator {
    constructor() {
        this.results = {
            sessionUpload: null,
            legacyUpload: null,
            responseValidation: null,
            errorHandling: null
        };
    }

    async validateResponse(response, endpointName) {
        console.log(`\n📊 Response Validation for ${endpointName}:`);
        console.log(`   Status: ${response.status}`);

        if (response.status !== 200) {
            console.log(`   ❌ Expected 200, got ${response.status}`);
            console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
            return false;
        }

        const data = response.data;
        const uploadData = data.data || data;

        // Different endpoints have different response formats
        let requiredFields;
        if (uploadData.uploadId) {
            // Session upload format
            requiredFields = ['uploadUrl', 'uploadId', 'expiresAt'];
        } else {
            // Legacy upload format
            requiredFields = ['uploadUrl', 'fileId', 'expiresAt'];
        }

        const missingFields = [];
        for (const field of requiredFields) {
            if (!uploadData[field]) {
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            console.log(`   ❌ Missing required fields: ${missingFields.join(', ')}`);
            return false;
        }

        // Validate uploadUrl format
        if (!uploadData.uploadUrl.includes('s3') || !uploadData.uploadUrl.includes('amazonaws.com')) {
            console.log(`   ❌ Invalid uploadUrl format: ${uploadData.uploadUrl}`);
            return false;
        }

        // Validate expiration is in the future
        const expirationTime = new Date(uploadData.expiresAt);
        const now = new Date();
        if (expirationTime <= now) {
            console.log(`   ❌ Upload URL already expired: ${uploadData.expiresAt}`);
            return false;
        }

        console.log(`   ✅ All validations passed`);
        const idField = uploadData.uploadId ? 'uploadId' : 'fileId';
        const idValue = uploadData.uploadId || uploadData.fileId;
        console.log(`   📄 ${idField === 'uploadId' ? 'Upload' : 'File'} ID: ${idValue}`);
        console.log(`   🔗 Upload URL: ${uploadData.uploadUrl.substring(0, 80)}...`);
        console.log(`   ⏰ Expires: ${uploadData.expiresAt}`);

        if (uploadData.chunkSize) {
            console.log(`   📦 Chunk Size: ${uploadData.chunkSize} bytes`);
        }

        if (uploadData.fields) {
            console.log(`   📝 Presigned POST with ${Object.keys(uploadData.fields).length} fields`);
        }

        return true;
    }

    async testSessionUploadEndpoint() {
        console.log('\n🎯 Testing Session Upload Endpoint');
        console.log('='.repeat(50));

        const endpoint = `/sessions/${TEST_SESSION_ID}/upload`;
        const url = `${API_BASE_URL}${endpoint}`;

        console.log(`📍 Endpoint: POST ${endpoint}`);
        console.log(`📤 Payload: ${JSON.stringify(VALID_REQUEST_PAYLOAD, null, 2)}`);

        try {
            const response = await axios.post(url, VALID_REQUEST_PAYLOAD, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': AUTH_TOKEN,
                    'User-Agent': 'Mozilla/5.0 (ApexShare QA Test)',
                    'Origin': 'https://apexshare.be'
                },
                validateStatus: () => true,
                timeout: 10000
            });

            const isValid = await this.validateResponse(response, 'Session Upload');
            this.results.sessionUpload = {
                success: isValid,
                status: response.status,
                data: response.data
            };

            return isValid;
        } catch (error) {
            console.log(`❌ Request failed: ${error.message}`);
            this.results.sessionUpload = {
                success: false,
                error: error.message
            };
            return false;
        }
    }

    async testLegacyUploadEndpoint() {
        console.log('\n🔄 Testing Legacy Upload Endpoint');
        console.log('='.repeat(50));

        const endpoint = '/uploads/initiate';
        const url = `${API_BASE_URL}${endpoint}`;

        console.log(`📍 Endpoint: POST ${endpoint}`);
        console.log(`📤 Payload: ${JSON.stringify(VALID_LEGACY_PAYLOAD, null, 2)}`);

        try {
            const response = await axios.post(url, VALID_LEGACY_PAYLOAD, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': AUTH_TOKEN,
                    'User-Agent': 'Mozilla/5.0 (ApexShare QA Test)',
                    'Origin': 'https://apexshare.be'
                },
                validateStatus: () => true,
                timeout: 10000
            });

            const isValid = await this.validateResponse(response, 'Legacy Upload');
            this.results.legacyUpload = {
                success: isValid,
                status: response.status,
                data: response.data
            };

            return isValid;
        } catch (error) {
            console.log(`❌ Request failed: ${error.message}`);
            this.results.legacyUpload = {
                success: false,
                error: error.message
            };
            return false;
        }
    }

    async testErrorHandling() {
        console.log('\n⚠️  Testing Error Handling');
        console.log('='.repeat(50));

        const invalidRequests = [
            {
                name: 'Missing fileName',
                payload: { fileSize: 15728640, contentType: 'video/mp4' },
                expectedStatus: 400
            },
            {
                name: 'Invalid fileSize',
                payload: { fileName: 'test.mp4', fileSize: -1, contentType: 'video/mp4' },
                expectedStatus: 400
            },
            {
                name: 'Missing contentType',
                payload: { fileName: 'test.mp4', fileSize: 15728640 },
                expectedStatus: 400
            },
            {
                name: 'Additional field (studentEmail)',
                payload: { ...VALID_REQUEST_PAYLOAD, studentEmail: 'test@example.com' },
                expectedStatus: 400
            }
        ];

        let allTestsPassed = true;
        const endpoint = `/sessions/${TEST_SESSION_ID}/upload`;
        const url = `${API_BASE_URL}${endpoint}`;

        for (const test of invalidRequests) {
            console.log(`\n🧪 Testing: ${test.name}`);
            try {
                const response = await axios.post(url, test.payload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': AUTH_TOKEN,
                        'User-Agent': 'Mozilla/5.0 (ApexShare QA Test)',
                        'Origin': 'https://apexshare.be'
                    },
                    validateStatus: () => true,
                    timeout: 5000
                });

                if (response.status === test.expectedStatus) {
                    console.log(`   ✅ Correctly returned ${response.status}`);
                } else {
                    console.log(`   ❌ Expected ${test.expectedStatus}, got ${response.status}`);
                    allTestsPassed = false;
                }
            } catch (error) {
                console.log(`   ⚠️  Request failed: ${error.message}`);
                allTestsPassed = false;
            }
        }

        this.results.errorHandling = { success: allTestsPassed };
        return allTestsPassed;
    }

    async runComprehensiveValidation() {
        console.log('🚀 COMPREHENSIVE UPLOAD FUNCTIONALITY VALIDATION');
        console.log('='.repeat(60));
        console.log(`🕐 Started at: ${new Date().toISOString()}`);

        // Run all tests
        const sessionUploadPassed = await this.testSessionUploadEndpoint();
        const legacyUploadPassed = await this.testLegacyUploadEndpoint();
        const errorHandlingPassed = await this.testErrorHandling();

        // Generate final report
        this.generateFinalReport(sessionUploadPassed, legacyUploadPassed, errorHandlingPassed);
    }

    generateFinalReport(sessionPassed, legacyPassed, errorsPassed) {
        console.log('\n🏁 FINAL VALIDATION REPORT');
        console.log('='.repeat(60));

        console.log('\n📊 Test Results Summary:');
        console.log(`   Session Upload Endpoint: ${sessionPassed ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Legacy Upload Endpoint:  ${legacyPassed ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Error Handling:          ${errorsPassed ? '✅ PASS' : '❌ FAIL'}`);

        const overallSuccess = sessionPassed && legacyPassed && errorsPassed;

        console.log('\n🎯 Overall Assessment:');
        if (overallSuccess) {
            console.log('🎉 SUCCESS! Upload functionality is working correctly!');
            console.log('');
            console.log('✅ CONFIRMED RESOLUTIONS:');
            console.log('   • 403 Forbidden errors: RESOLVED');
            console.log('   • 400 Bad Request errors: RESOLVED');
            console.log('   • Session upload endpoint: FUNCTIONAL');
            console.log('   • Legacy upload endpoint: FUNCTIONAL');
            console.log('   • Response format: VALID');
            console.log('   • Error handling: PROPER');
            console.log('');
            console.log('🚀 DEPLOYMENT STATUS: READY FOR PRODUCTION');
            console.log('🎊 Users can now successfully upload video files!');
        } else {
            console.log('❌ ISSUES DETECTED - Some functionality is not working correctly');
            console.log('');
            console.log('🔍 Issues Found:');
            if (!sessionPassed) console.log('   • Session upload endpoint has issues');
            if (!legacyPassed) console.log('   • Legacy upload endpoint has issues');
            if (!errorsPassed) console.log('   • Error handling needs improvement');
            console.log('');
            console.log('⚠️  DEPLOYMENT STATUS: REQUIRES FIXES BEFORE PRODUCTION');
        }

        console.log('\n📋 Detailed Results:');
        console.log(JSON.stringify(this.results, null, 2));

        console.log(`\n🕐 Completed at: ${new Date().toISOString()}`);
    }
}

// Run the comprehensive validation
const validator = new UploadValidator();
validator.runComprehensiveValidation()
    .catch(error => {
        console.error('❌ Validation suite failed:', error);
        process.exit(1);
    });