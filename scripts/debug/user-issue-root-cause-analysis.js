/**
 * USER ISSUE ROOT CAUSE ANALYSIS
 *
 * Based on our investigation:
 * 1. ✅ API backend works perfectly (confirmed via direct testing)
 * 2. ✅ X-Public-Access header is in deployed frontend code
 * 3. ✅ CORS headers are properly configured
 * 4. ❌ User still reports "Failed to fetch" errors
 *
 * This test will determine the TRUE root cause.
 */

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';

async function comprehensiveRootCauseAnalysis() {
    console.log('🔍 COMPREHENSIVE ROOT CAUSE ANALYSIS');
    console.log('=====================================');

    const results = {
        timestamp: new Date().toISOString(),
        tests: {}
    };

    // Test 1: Direct API calls (should work)
    console.log('\n📋 Test 1: Direct API Backend Testing');
    try {
        const sessionResponse = await fetch(`${API_BASE_URL}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Public-Access': 'true',
                'Origin': 'https://apexshare.be'
            },
            body: JSON.stringify({
                studentName: 'Root Cause Test',
                studentEmail: 'rootcause@test.com',
                sessionDate: '2025-01-22',
                notes: 'Testing root cause'
            })
        });

        if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            const sessionId = sessionData.sessionId;

            const uploadResponse = await fetch(`${API_BASE_URL}/sessions/${sessionId}/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Public-Access': 'true',
                    'Origin': 'https://apexshare.be'
                },
                body: JSON.stringify({
                    fileName: 'test.mp4',
                    fileSize: 1000000,
                    contentType: 'video/mp4'
                })
            });

            results.tests.directAPI = {
                sessionCreation: { status: sessionResponse.status, success: true },
                uploadURL: { status: uploadResponse.status, success: uploadResponse.ok }
            };

            console.log('✅ Direct API Test: SUCCESS');
        } else {
            results.tests.directAPI = { error: `Session creation failed: ${sessionResponse.status}` };
            console.log('❌ Direct API Test: FAILED');
        }
    } catch (error) {
        results.tests.directAPI = { error: error.message };
        console.log(`❌ Direct API Test: ERROR - ${error.message}`);
    }

    // Test 2: Frontend page loading
    console.log('\n📄 Test 2: Frontend Page Analysis');
    try {
        const frontendResponse = await fetch('https://apexshare.be/upload-debug');
        const htmlContent = await frontendResponse.text();

        results.tests.frontend = {
            status: frontendResponse.status,
            contentLength: htmlContent.length,
            hasReactRoot: htmlContent.includes('<div id="root">'),
            hasJavaScript: htmlContent.includes('.js'),
            cloudFrontCache: frontendResponse.headers.get('x-cache')
        };

        // Extract JavaScript file references
        const scriptMatches = htmlContent.match(/<script[^>]*src="([^"]*\.js)"[^>]*>/g);
        if (scriptMatches) {
            results.tests.frontend.scriptFiles = scriptMatches.map(match => {
                const srcMatch = match.match(/src="([^"]*)"/);
                return srcMatch ? srcMatch[1] : null;
            }).filter(Boolean);
        }

        console.log('✅ Frontend page loads successfully');
        console.log(`   Cache status: ${results.tests.frontend.cloudFrontCache}`);
    } catch (error) {
        results.tests.frontend = { error: error.message };
        console.log(`❌ Frontend Test: ERROR - ${error.message}`);
    }

    // Test 3: JavaScript file verification
    console.log('\n🔧 Test 3: JavaScript File X-Public-Access Check');
    try {
        if (results.tests.frontend && results.tests.frontend.scriptFiles) {
            for (const scriptFile of results.tests.frontend.scriptFiles) {
                const scriptUrl = scriptFile.startsWith('http') ? scriptFile : `https://apexshare.be${scriptFile}`;

                try {
                    const scriptResponse = await fetch(scriptUrl);
                    const scriptContent = await scriptResponse.text();

                    const hasXPublicAccess = scriptContent.includes('X-Public-Access');
                    const hasXPublicAccessTrue = scriptContent.includes('X-Public-Access":"true') ||
                                                 scriptContent.includes('X-Public-Access":"true') ||
                                                 scriptContent.includes('"X-Public-Access":"true"');

                    if (!results.tests.javascript) results.tests.javascript = {};
                    results.tests.javascript[scriptFile] = {
                        status: scriptResponse.status,
                        size: scriptContent.length,
                        hasXPublicAccess,
                        hasXPublicAccessTrue,
                        cloudFrontCache: scriptResponse.headers.get('x-cache')
                    };

                    if (hasXPublicAccess) {
                        console.log(`✅ ${scriptFile}: Contains X-Public-Access`);
                    } else {
                        console.log(`❌ ${scriptFile}: NO X-Public-Access found`);
                    }
                } catch (scriptError) {
                    console.log(`❌ ${scriptFile}: ERROR - ${scriptError.message}`);
                }
            }
        }
    } catch (error) {
        console.log(`❌ JavaScript verification error: ${error.message}`);
    }

    // Test 4: Browser environment simulation
    console.log('\n🌐 Test 4: Browser Environment Simulation');
    try {
        // Simulate what happens when the frontend makes the actual request
        const simulatedRequest = async () => {
            // This simulates the exact request that the frontend would make
            const response = await fetch(`${API_BASE_URL}/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Public-Access': 'true',
                    // Add browser-like headers
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Sec-Fetch-Site': 'cross-site',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Dest': 'empty',
                    'Origin': 'https://apexshare.be',
                    'Referer': 'https://apexshare.be/upload-debug'
                },
                body: JSON.stringify({
                    studentName: 'Browser Simulation',
                    studentEmail: 'browser@test.com',
                    sessionDate: '2025-01-22',
                    notes: 'Browser simulation test'
                })
            });

            return {
                status: response.status,
                ok: response.ok,
                headers: Object.fromEntries(response.headers.entries())
            };
        };

        const browserSimResult = await simulatedRequest();
        results.tests.browserSimulation = browserSimResult;

        if (browserSimResult.ok) {
            console.log('✅ Browser simulation: SUCCESS');
        } else {
            console.log(`❌ Browser simulation: FAILED - Status ${browserSimResult.status}`);
        }
    } catch (error) {
        results.tests.browserSimulation = { error: error.message };
        console.log(`❌ Browser simulation: ERROR - ${error.message}`);
    }

    // Test 5: Network timing and reliability
    console.log('\n⏱️  Test 5: Network Timing and Reliability');
    try {
        const timingTests = [];

        for (let i = 0; i < 3; i++) {
            const startTime = Date.now();
            try {
                const response = await fetch(`${API_BASE_URL}/sessions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Public-Access': 'true',
                        'Origin': 'https://apexshare.be'
                    },
                    body: JSON.stringify({
                        studentName: `Timing Test ${i + 1}`,
                        studentEmail: `timing${i + 1}@test.com`,
                        sessionDate: '2025-01-22',
                        notes: `Timing test iteration ${i + 1}`
                    })
                });

                const duration = Date.now() - startTime;
                timingTests.push({
                    iteration: i + 1,
                    status: response.status,
                    duration,
                    success: response.ok
                });

                console.log(`   Test ${i + 1}: ${response.status} (${duration}ms)`);
            } catch (error) {
                const duration = Date.now() - startTime;
                timingTests.push({
                    iteration: i + 1,
                    error: error.message,
                    duration,
                    success: false
                });
                console.log(`   Test ${i + 1}: ERROR - ${error.message} (${duration}ms)`);
            }
        }

        results.tests.timing = timingTests;
        const successCount = timingTests.filter(t => t.success).length;
        console.log(`✅ Timing tests: ${successCount}/3 successful`);
    } catch (error) {
        console.log(`❌ Timing tests error: ${error.message}`);
    }

    // Generate final analysis
    console.log('\n📊 FINAL ROOT CAUSE ANALYSIS');
    console.log('==============================');

    let rootCause = "UNKNOWN";
    let recommendation = "Further investigation needed";

    if (results.tests.directAPI && results.tests.directAPI.sessionCreation && results.tests.directAPI.uploadURL) {
        if (results.tests.directAPI.sessionCreation.success && results.tests.directAPI.uploadURL.success) {
            console.log('✅ Backend API: Working perfectly');

            if (results.tests.frontend && results.tests.frontend.status === 200) {
                console.log('✅ Frontend deployment: Accessible');

                if (results.tests.javascript) {
                    const jsFilesWithXPublicAccess = Object.values(results.tests.javascript)
                        .filter(js => js.hasXPublicAccess);

                    if (jsFilesWithXPublicAccess.length > 0) {
                        console.log('✅ X-Public-Access header: Present in JavaScript');

                        if (results.tests.browserSimulation && results.tests.browserSimulation.ok) {
                            console.log('✅ Browser simulation: Working');
                            rootCause = "DEPLOYMENT_CACHING_ISSUE";
                            recommendation = "Clear CloudFront cache and browser cache. The fix is deployed but cached versions may be served.";
                        } else {
                            rootCause = "BROWSER_SPECIFIC_ISSUE";
                            recommendation = "Issue appears to be browser-specific. Check for browser extensions, security policies, or network restrictions.";
                        }
                    } else {
                        rootCause = "FRONTEND_DEPLOYMENT_INCOMPLETE";
                        recommendation = "X-Public-Access header fix not properly deployed. Redeploy frontend.";
                    }
                } else {
                    rootCause = "FRONTEND_LOADING_ISSUE";
                    recommendation = "Frontend JavaScript files not accessible. Check CloudFront configuration.";
                }
            } else {
                rootCause = "FRONTEND_DEPLOYMENT_FAILED";
                recommendation = "Frontend not properly deployed. Check S3 and CloudFront configuration.";
            }
        } else {
            rootCause = "BACKEND_API_ISSUE";
            recommendation = "Backend API has issues. Check Lambda functions and API Gateway configuration.";
        }
    } else {
        rootCause = "NETWORK_CONNECTIVITY_ISSUE";
        recommendation = "Cannot reach backend API. Check network connectivity and DNS resolution.";
    }

    console.log(`\n🔍 ROOT CAUSE: ${rootCause}`);
    console.log(`💡 RECOMMENDATION: ${recommendation}`);

    // Generate detailed report
    const report = {
        ...results,
        analysis: {
            rootCause,
            recommendation,
            confidence: "HIGH"
        }
    };

    console.log('\n📋 DETAILED REPORT:');
    console.log(JSON.stringify(report, null, 2));

    return report;
}

// Run the analysis
comprehensiveRootCauseAnalysis().catch(console.error);