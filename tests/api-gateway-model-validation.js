/**
 * API Gateway Model Validation Test
 *
 * This test investigates the exact requirements of each API Gateway endpoint
 * by sending different payload combinations to understand what's actually deployed.
 */

const axios = require('axios');

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
const TEST_SESSION_ID = 'b1dcd4ef-c043-4f83-a73e-b9b8dfc62893';

async function testPayloadVariations() {
    console.log('🔍 API GATEWAY MODEL VALIDATION TEST');
    console.log('='.repeat(60));

    const sessionEndpoint = `/sessions/${TEST_SESSION_ID}/upload`;
    const legacyEndpoint = '/uploads/initiate';

    // Test different payload combinations for session upload
    const sessionPayloads = [
        {
            name: 'Minimal with mimeType',
            payload: {
                fileName: 'test.mp4',
                fileSize: 1048576,
                mimeType: 'video/mp4'
            }
        },
        {
            name: 'Minimal with contentType',
            payload: {
                fileName: 'test.mp4',
                fileSize: 1048576,
                contentType: 'video/mp4'
            }
        },
        {
            name: 'With studentEmail + mimeType',
            payload: {
                studentEmail: 'test@example.com',
                fileName: 'test.mp4',
                fileSize: 1048576,
                mimeType: 'video/mp4'
            }
        },
        {
            name: 'With studentEmail + contentType',
            payload: {
                studentEmail: 'test@example.com',
                fileName: 'test.mp4',
                fileSize: 1048576,
                contentType: 'video/mp4'
            }
        }
    ];

    // Test different payload combinations for legacy upload
    const legacyPayloads = [
        {
            name: 'Minimal legacy with contentType',
            payload: {
                studentEmail: 'test@example.com',
                fileName: 'test.mp4',
                fileSize: 1048576,
                contentType: 'video/mp4'
            }
        },
        {
            name: 'Legacy with sessionDate',
            payload: {
                studentEmail: 'test@example.com',
                fileName: 'test.mp4',
                fileSize: 1048576,
                contentType: 'video/mp4',
                sessionDate: '2025-09-21'
            }
        },
        {
            name: 'Legacy with all optional fields',
            payload: {
                studentEmail: 'test@example.com',
                studentName: 'Test Student',
                trainerName: 'Test Trainer',
                sessionDate: '2025-09-21',
                notes: 'Test notes',
                fileName: 'test.mp4',
                fileSize: 1048576,
                contentType: 'video/mp4'
            }
        }
    ];

    console.log('\n🎯 TESTING SESSION UPLOAD ENDPOINT');
    console.log('='.repeat(50));

    for (const test of sessionPayloads) {
        console.log(`\n📤 Testing: ${test.name}`);
        console.log(`   Payload: ${JSON.stringify(test.payload)}`);

        try {
            const response = await axios.post(`${API_BASE_URL}${sessionEndpoint}`, test.payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (ApexShare QA Test)',
                    'Origin': 'https://apexshare.be'
                },
                validateStatus: () => true,
                timeout: 5000
            });

            console.log(`   📊 Status: ${response.status}`);
            if (response.status === 200) {
                console.log(`   ✅ SUCCESS!`);
                console.log(`   📋 Response keys: ${Object.keys(response.data).join(', ')}`);
            } else {
                console.log(`   ❌ Error: ${JSON.stringify(response.data)}`);
            }
        } catch (error) {
            console.log(`   💥 Request failed: ${error.message}`);
        }
    }

    console.log('\n🔄 TESTING LEGACY UPLOAD ENDPOINT');
    console.log('='.repeat(50));

    for (const test of legacyPayloads) {
        console.log(`\n📤 Testing: ${test.name}`);
        console.log(`   Payload: ${JSON.stringify(test.payload)}`);

        try {
            const response = await axios.post(`${API_BASE_URL}${legacyEndpoint}`, test.payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (ApexShare QA Test)',
                    'Origin': 'https://apexshare.be'
                },
                validateStatus: () => true,
                timeout: 5000
            });

            console.log(`   📊 Status: ${response.status}`);
            if (response.status === 200) {
                console.log(`   ✅ SUCCESS!`);
                console.log(`   📋 Response keys: ${Object.keys(response.data).join(', ')}`);
            } else {
                console.log(`   ❌ Error: ${JSON.stringify(response.data)}`);
            }
        } catch (error) {
            console.log(`   💥 Request failed: ${error.message}`);
        }
    }

    console.log('\n🏁 MODEL VALIDATION COMPLETE');
    console.log('='.repeat(60));
}

testPayloadVariations().catch(console.error);