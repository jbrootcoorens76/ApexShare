/**
 * Direct API Test to investigate the user issue
 *
 * This script tests the exact workflow the user is experiencing:
 * 1. Create session (works)
 * 2. Request upload URL (fails with "Failed to fetch")
 */

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';

async function testUserWorkflow() {
    console.log('🔍 INVESTIGATING USER ISSUE - DIRECT API TEST');
    console.log('=============================================');

    try {
        // Step 1: Test session creation (should work)
        console.log('\n📝 Step 1: Creating session...');

        const sessionData = {
            studentName: 'Investigation Test',
            studentEmail: 'investigation@test.com',
            sessionDate: '2025-01-22',
            notes: 'Testing exact user workflow'
        };

        const sessionResponse = await fetch(`${API_BASE_URL}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Public-Access': 'true',
                'Origin': 'https://apexshare.be'
            },
            body: JSON.stringify(sessionData)
        });

        console.log(`Session response status: ${sessionResponse.status}`);
        console.log(`Session response headers:`, Object.fromEntries(sessionResponse.headers.entries()));

        if (sessionResponse.ok) {
            const sessionResult = await sessionResponse.json();
            console.log(`✅ Session created successfully: ${sessionResult.sessionId}`);

            // Step 2: Test upload URL request (this should fail according to user)
            console.log('\n📤 Step 2: Requesting upload URL...');

            const uploadData = {
                fileName: 'test-video.mp4',
                fileSize: 1048576,
                contentType: 'video/mp4'
            };

            try {
                const uploadResponse = await fetch(`${API_BASE_URL}/sessions/${sessionResult.sessionId}/upload`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Public-Access': 'true',
                        'Origin': 'https://apexshare.be'
                    },
                    body: JSON.stringify(uploadData)
                });

                console.log(`Upload response status: ${uploadResponse.status}`);
                console.log(`Upload response headers:`, Object.fromEntries(uploadResponse.headers.entries()));

                if (uploadResponse.ok) {
                    const uploadResult = await uploadResponse.json();
                    console.log(`✅ Upload URL received successfully: ${uploadResult.uploadUrl}`);
                    console.log('🎉 SUCCESS: Both session creation and upload URL work!');
                } else {
                    const errorText = await uploadResponse.text();
                    console.log(`❌ Upload URL request failed with status ${uploadResponse.status}: ${errorText}`);
                }
            } catch (uploadError) {
                console.log(`❌ Upload URL fetch failed with error: ${uploadError.message}`);
                console.log('🔍 This matches the user\'s "Failed to fetch" error!');
            }
        } else {
            const errorText = await sessionResponse.text();
            console.log(`❌ Session creation failed: ${errorText}`);
        }

    } catch (error) {
        console.log(`❌ Script error: ${error.message}`);
    }
}

async function testCORSHeaders() {
    console.log('\n🌐 TESTING CORS HEADERS');
    console.log('======================');

    // Test CORS for sessions endpoint
    try {
        const sessionsOptions = await fetch(`${API_BASE_URL}/sessions`, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'https://apexshare.be',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type,x-public-access'
            }
        });

        console.log(`\nSessions CORS status: ${sessionsOptions.status}`);
        console.log('Sessions CORS headers:', Object.fromEntries(sessionsOptions.headers.entries()));

        const allowedHeaders = sessionsOptions.headers.get('access-control-allow-headers') || '';
        if (allowedHeaders.toLowerCase().includes('x-public-access')) {
            console.log('✅ X-Public-Access header is allowed for sessions endpoint');
        } else {
            console.log('❌ X-Public-Access header is NOT allowed for sessions endpoint');
        }
    } catch (error) {
        console.log(`❌ Sessions CORS test failed: ${error.message}`);
    }

    // Test CORS for upload endpoint
    try {
        const uploadOptions = await fetch(`${API_BASE_URL}/sessions/test-session/upload`, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'https://apexshare.be',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type,x-public-access'
            }
        });

        console.log(`\nUpload CORS status: ${uploadOptions.status}`);
        console.log('Upload CORS headers:', Object.fromEntries(uploadOptions.headers.entries()));

        const allowedHeaders = uploadOptions.headers.get('access-control-allow-headers') || '';
        if (allowedHeaders.toLowerCase().includes('x-public-access')) {
            console.log('✅ X-Public-Access header is allowed for upload endpoint');
        } else {
            console.log('❌ X-Public-Access header is NOT allowed for upload endpoint');
        }
    } catch (error) {
        console.log(`❌ Upload CORS test failed: ${error.message}`);
    }
}

async function testFrontendDeployment() {
    console.log('\n🌍 TESTING FRONTEND DEPLOYMENT');
    console.log('===============================');

    try {
        const frontendResponse = await fetch('https://apexshare.be/upload-debug');
        console.log(`Frontend response status: ${frontendResponse.status}`);

        const htmlContent = await frontendResponse.text();
        console.log(`Frontend content length: ${htmlContent.length}`);

        // Check for React app
        if (htmlContent.includes('<div id="root">')) {
            console.log('✅ Frontend HTML includes React root div');
        } else {
            console.log('❌ Frontend HTML does not include React root div');
        }

        // Check for JavaScript files
        const scriptMatches = htmlContent.match(/<script[^>]*src="([^"]*)"[^>]*>/g);
        if (scriptMatches) {
            console.log(`Found ${scriptMatches.length} script tags`);
            scriptMatches.forEach((script, index) => {
                console.log(`Script ${index + 1}: ${script}`);
            });
        } else {
            console.log('❌ No script tags found in HTML');
        }

        // Check CloudFront headers
        const cacheHeaders = {
            'x-cache': frontendResponse.headers.get('x-cache'),
            'cache-control': frontendResponse.headers.get('cache-control'),
            'cloudfront-viewer-country': frontendResponse.headers.get('cloudfront-viewer-country')
        };
        console.log('CloudFront headers:', cacheHeaders);

        if (cacheHeaders['x-cache'] && cacheHeaders['x-cache'].includes('Hit')) {
            console.log('⚠️  WARNING: Content is being served from CloudFront cache');
        }

    } catch (error) {
        console.log(`❌ Frontend test failed: ${error.message}`);
    }
}

// Run all tests
async function runAllTests() {
    await testUserWorkflow();
    await testCORSHeaders();
    await testFrontendDeployment();

    console.log('\n📊 INVESTIGATION COMPLETE');
    console.log('=========================');
}

runAllTests().catch(console.error);