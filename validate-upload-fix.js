#!/usr/bin/env node

/**
 * Quick validation script to confirm the upload 400 error fix
 */

const https = require('https');

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';

function makeRequest(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(API_BASE_URL + path);

        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (body) {
            const bodyString = JSON.stringify(body);
            options.headers['Content-Length'] = Buffer.byteLength(bodyString);
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: parsedData
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: { raw: data }
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

async function validateUploadFix() {
    console.log('🔍 Validating ApexShare Upload Fix...\n');

    try {
        // Step 1: Create a test session
        console.log('1️⃣ Creating test session...');
        const sessionResponse = await makeRequest('POST', '/sessions', {
            'X-Public-Access': 'true'
        }, {
            title: 'Validation Test Session',
            description: 'Testing upload fix validation',
            studentEmails: ['test.validation@example.com'],
            isPublic: true
        });

        console.log(`   Session Response: ${sessionResponse.status}`);

        if (sessionResponse.status !== 200 && sessionResponse.status !== 201) {
            console.log(`   ❌ Session creation failed: ${sessionResponse.status}`);
            console.log(`   Response:`, sessionResponse.data);
            return;
        }

        const sessionId = sessionResponse.data.data?.id || sessionResponse.data.sessionId;
        console.log(`   ✅ Session created: ${sessionId}\n`);

        // Step 2: Test correct payload format
        console.log('2️⃣ Testing correct payload format (3 fields)...');
        const correctPayload = {
            fileName: 'test-validation.mp4',
            fileSize: 1024000,
            contentType: 'video/mp4'
        };

        const uploadResponse1 = await makeRequest('POST', `/sessions/${sessionId}/upload`, {
            'X-Public-Access': 'true'
        }, correctPayload);

        console.log(`   Upload Response: ${uploadResponse1.status}`);

        if (uploadResponse1.status === 400) {
            console.log('   ❌ 400 ERROR STILL OCCURRING - FIX NOT WORKING');
            console.log('   Response:', uploadResponse1.data);
        } else {
            console.log('   ✅ No 400 error - correct payload working');
        }

        // Step 3: Test payload with extra fields (previously caused 400)
        console.log('\n3️⃣ Testing payload with extra fields...');
        const payloadWithExtraFields = {
            fileName: 'test-validation-extra.mp4',
            fileSize: 1024000,
            contentType: 'video/mp4',
            studentEmail: 'test@example.com', // This used to cause 400 errors
            sessionDate: '2025-01-15',
            trainerName: 'Test Trainer',
            extraField: 'should be ignored'
        };

        const uploadResponse2 = await makeRequest('POST', `/sessions/${sessionId}/upload`, {
            'X-Public-Access': 'true'
        }, payloadWithExtraFields);

        console.log(`   Upload Response: ${uploadResponse2.status}`);

        if (uploadResponse2.status === 400) {
            console.log('   ❌ 400 ERROR WITH EXTRA FIELDS - FIX INCOMPLETE');
            console.log('   Response:', uploadResponse2.data);
        } else {
            console.log('   ✅ No 400 error with extra fields - fix working');
        }

        // Step 4: Test X-Auth-Token authentication
        console.log('\n4️⃣ Testing X-Auth-Token authentication...');
        const uploadResponse3 = await makeRequest('POST', `/sessions/${sessionId}/upload`, {
            'X-Auth-Token': 'test-validation-token'
        }, correctPayload);

        console.log(`   Upload Response: ${uploadResponse3.status}`);

        if (uploadResponse3.status === 400) {
            console.log('   ❌ 400 ERROR WITH X-AUTH-TOKEN - FIX NOT WORKING');
            console.log('   Response:', uploadResponse3.data);
        } else {
            console.log('   ✅ No 400 error with X-Auth-Token - working');
        }

        // Summary
        console.log('\n📊 VALIDATION SUMMARY:');
        const results = [
            { test: 'Correct payload format', status: uploadResponse1.status },
            { test: 'Payload with extra fields', status: uploadResponse2.status },
            { test: 'X-Auth-Token authentication', status: uploadResponse3.status }
        ];

        const has400Errors = results.some(r => r.status === 400);
        const allSuccessful = results.every(r => r.status === 200 || r.status === 201);

        if (has400Errors) {
            console.log('❌ VALIDATION FAILED: 400 errors still occurring');
            console.log('   The upload fix is not working properly');
        } else if (allSuccessful) {
            console.log('✅ VALIDATION PASSED: All upload requests successful');
            console.log('   The 400 error fix is working perfectly!');
        } else {
            console.log('⚠️  VALIDATION PARTIAL: No 400 errors, but some requests failed');
            console.log('   The 400 error fix is working, but there may be other issues');
        }

        results.forEach(r => {
            console.log(`   - ${r.test}: ${r.status}`);
        });

    } catch (error) {
        console.error('❌ Validation failed with error:', error.message);
    }
}

// Run the validation
validateUploadFix();