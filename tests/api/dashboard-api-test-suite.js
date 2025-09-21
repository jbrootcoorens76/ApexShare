/**
 * Comprehensive Dashboard API Test Suite
 * Tests all analytics and sessions endpoints for the ApexShare dashboard
 */

const axios = require('axios');

// Test configuration
const config = {
    baseURL: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token-12345'
    }
};

// Test data
const testData = {
    validToken: 'Bearer test-token-12345',
    invalidToken: 'Bearer invalid-token',
    testSession: {
        name: 'Test Session',
        description: 'Test session for API validation',
        status: 'active'
    },
    testEvent: {
        eventType: 'page_view',
        page: '/dashboard',
        userId: 'test-user-123',
        timestamp: new Date().toISOString()
    }
};

// Test results storage
let testResults = {
    analytics: {},
    sessions: {},
    authentication: {},
    cors: {},
    errorHandling: {},
    summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        issues: []
    }
};

// Utility functions
function logTest(category, testName, status, details = {}) {
    testResults.summary.totalTests++;
    if (status === 'PASS') {
        testResults.summary.passedTests++;
    } else {
        testResults.summary.failedTests++;
        testResults.summary.issues.push(`${category}: ${testName} - ${details.error || 'Failed'}`);
    }

    if (!testResults[category]) {
        testResults[category] = {};
    }

    testResults[category][testName] = {
        status,
        details,
        timestamp: new Date().toISOString()
    };

    console.log(`[${status}] ${category} - ${testName}`);
    if (details.responseTime) {
        console.log(`  Response time: ${details.responseTime}ms`);
    }
    if (status === 'FAIL' && details.error) {
        console.log(`  Error: ${details.error}`);
    }
}

async function makeRequest(method, endpoint, data = null, customHeaders = {}) {
    const startTime = Date.now();
    try {
        const requestConfig = {
            method,
            url: `${config.baseURL}${endpoint}`,
            timeout: config.timeout,
            headers: { ...config.headers, ...customHeaders }
        };

        if (data) {
            requestConfig.data = data;
        }

        const response = await axios(requestConfig);
        const responseTime = Date.now() - startTime;

        return {
            success: true,
            status: response.status,
            data: response.data,
            headers: response.headers,
            responseTime
        };
    } catch (error) {
        const responseTime = Date.now() - startTime;
        return {
            success: false,
            status: error.response?.status,
            data: error.response?.data,
            headers: error.response?.headers,
            error: error.message,
            responseTime
        };
    }
}

// Test suites
async function testAnalyticsEndpoints() {
    console.log('\n=== Testing Analytics Endpoints ===');

    // Test GET /v1/analytics/usage with different periods
    const periods = ['30d', '7d', '1d'];

    for (const period of periods) {
        const result = await makeRequest('GET', `/analytics/usage?period=${period}`);

        if (result.success && result.status === 200) {
            const data = result.data;
            const hasRequiredFields = data.period && data.totalUploads !== undefined &&
                                    data.totalDownloads !== undefined && data.storageUsed !== undefined;

            if (hasRequiredFields) {
                logTest('analytics', `GET /analytics/usage?period=${period}`, 'PASS', {
                    responseTime: result.responseTime,
                    dataStructure: 'Valid',
                    period: data.period,
                    totalUploads: data.totalUploads,
                    totalDownloads: data.totalDownloads
                });
            } else {
                logTest('analytics', `GET /analytics/usage?period=${period}`, 'FAIL', {
                    responseTime: result.responseTime,
                    error: 'Missing required fields in response',
                    receivedFields: Object.keys(data)
                });
            }
        } else {
            logTest('analytics', `GET /analytics/usage?period=${period}`, 'FAIL', {
                responseTime: result.responseTime,
                error: result.error || `HTTP ${result.status}`,
                status: result.status
            });
        }
    }

    // Test POST /v1/analytics/events
    const eventResult = await makeRequest('POST', '/analytics/events', testData.testEvent);

    if (eventResult.success && eventResult.status === 200) {
        logTest('analytics', 'POST /analytics/events', 'PASS', {
            responseTime: eventResult.responseTime,
            response: eventResult.data
        });
    } else {
        logTest('analytics', 'POST /analytics/events', 'FAIL', {
            responseTime: eventResult.responseTime,
            error: eventResult.error || `HTTP ${eventResult.status}`,
            status: eventResult.status
        });
    }
}

async function testSessionsEndpoints() {
    console.log('\n=== Testing Sessions Endpoints ===');

    let sessionId = null;

    // Test GET /v1/sessions (list)
    const listResult = await makeRequest('GET', '/sessions');

    if (listResult.success && listResult.status === 200) {
        const data = listResult.data;
        const hasRequiredFields = Array.isArray(data.sessions) &&
                                 data.pagination !== undefined;

        if (hasRequiredFields) {
            logTest('sessions', 'GET /sessions', 'PASS', {
                responseTime: listResult.responseTime,
                sessionsCount: data.sessions.length,
                hasPagination: !!data.pagination
            });

            // Extract a session ID for further tests
            if (data.sessions.length > 0) {
                sessionId = data.sessions[0].id;
            }
        } else {
            logTest('sessions', 'GET /sessions', 'FAIL', {
                responseTime: listResult.responseTime,
                error: 'Invalid response structure',
                receivedFields: Object.keys(data)
            });
        }
    } else {
        logTest('sessions', 'GET /sessions', 'FAIL', {
            responseTime: listResult.responseTime,
            error: listResult.error || `HTTP ${listResult.status}`,
            status: listResult.status
        });
    }

    // Test POST /v1/sessions (create)
    const createResult = await makeRequest('POST', '/sessions', testData.testSession);

    if (createResult.success && createResult.status === 201) {
        const data = createResult.data;
        if (data.id) {
            sessionId = data.id; // Use the created session for further tests
            logTest('sessions', 'POST /sessions', 'PASS', {
                responseTime: createResult.responseTime,
                createdSessionId: data.id,
                sessionData: data
            });
        } else {
            logTest('sessions', 'POST /sessions', 'FAIL', {
                responseTime: createResult.responseTime,
                error: 'No session ID in response',
                response: data
            });
        }
    } else {
        logTest('sessions', 'POST /sessions', 'FAIL', {
            responseTime: createResult.responseTime,
            error: createResult.error || `HTTP ${createResult.status}`,
            status: createResult.status
        });
    }

    // Test GET /v1/sessions/{sessionId} (individual session)
    if (sessionId) {
        const getResult = await makeRequest('GET', `/sessions/${sessionId}`);

        if (getResult.success && getResult.status === 200) {
            const data = getResult.data;
            const hasRequiredFields = data.id && data.name !== undefined;

            if (hasRequiredFields) {
                logTest('sessions', `GET /sessions/${sessionId}`, 'PASS', {
                    responseTime: getResult.responseTime,
                    sessionData: data
                });
            } else {
                logTest('sessions', `GET /sessions/${sessionId}`, 'FAIL', {
                    responseTime: getResult.responseTime,
                    error: 'Missing required fields in session data',
                    receivedFields: Object.keys(data)
                });
            }
        } else {
            logTest('sessions', `GET /sessions/${sessionId}`, 'FAIL', {
                responseTime: getResult.responseTime,
                error: getResult.error || `HTTP ${getResult.status}`,
                status: getResult.status
            });
        }

        // Test PUT /v1/sessions/{sessionId} (update)
        const updateData = { ...testData.testSession, name: 'Updated Test Session' };
        const updateResult = await makeRequest('PUT', `/sessions/${sessionId}`, updateData);

        if (updateResult.success && updateResult.status === 200) {
            logTest('sessions', `PUT /sessions/${sessionId}`, 'PASS', {
                responseTime: updateResult.responseTime,
                updatedData: updateResult.data
            });
        } else {
            logTest('sessions', `PUT /sessions/${sessionId}`, 'FAIL', {
                responseTime: updateResult.responseTime,
                error: updateResult.error || `HTTP ${updateResult.status}`,
                status: updateResult.status
            });
        }

        // Test DELETE /v1/sessions/{sessionId}
        const deleteResult = await makeRequest('DELETE', `/sessions/${sessionId}`);

        if (deleteResult.success && (deleteResult.status === 200 || deleteResult.status === 204)) {
            logTest('sessions', `DELETE /sessions/${sessionId}`, 'PASS', {
                responseTime: deleteResult.responseTime,
                status: deleteResult.status
            });
        } else {
            logTest('sessions', `DELETE /sessions/${sessionId}`, 'FAIL', {
                responseTime: deleteResult.responseTime,
                error: deleteResult.error || `HTTP ${deleteResult.status}`,
                status: deleteResult.status
            });
        }
    } else {
        logTest('sessions', 'Individual session tests', 'SKIP', {
            error: 'No session ID available for testing'
        });
    }
}

async function testAuthentication() {
    console.log('\n=== Testing Authentication ===');

    // Test with valid token (already tested above, but explicitly test auth)
    const validAuthResult = await makeRequest('GET', '/analytics/usage');

    if (validAuthResult.success) {
        logTest('authentication', 'Valid Bearer token', 'PASS', {
            responseTime: validAuthResult.responseTime,
            status: validAuthResult.status
        });
    } else {
        logTest('authentication', 'Valid Bearer token', 'FAIL', {
            responseTime: validAuthResult.responseTime,
            error: validAuthResult.error,
            status: validAuthResult.status
        });
    }

    // Test with invalid token
    const invalidAuthResult = await makeRequest('GET', '/analytics/usage', null, {
        'Authorization': testData.invalidToken
    });

    if (!invalidAuthResult.success && invalidAuthResult.status === 401) {
        logTest('authentication', 'Invalid Bearer token returns 401', 'PASS', {
            responseTime: invalidAuthResult.responseTime,
            status: invalidAuthResult.status
        });
    } else {
        logTest('authentication', 'Invalid Bearer token returns 401', 'FAIL', {
            responseTime: invalidAuthResult.responseTime,
            error: 'Should return 401 for invalid token',
            actualStatus: invalidAuthResult.status
        });
    }

    // Test with missing token
    const noAuthResult = await makeRequest('GET', '/analytics/usage', null, {
        'Authorization': ''
    });

    if (!noAuthResult.success && noAuthResult.status === 401) {
        logTest('authentication', 'Missing Bearer token returns 401', 'PASS', {
            responseTime: noAuthResult.responseTime,
            status: noAuthResult.status
        });
    } else {
        logTest('authentication', 'Missing Bearer token returns 401', 'FAIL', {
            responseTime: noAuthResult.responseTime,
            error: 'Should return 401 for missing token',
            actualStatus: noAuthResult.status
        });
    }
}

async function testCORSAndIntegration() {
    console.log('\n=== Testing CORS and Integration ===');

    // Test OPTIONS request for CORS
    const corsResult = await makeRequest('OPTIONS', '/analytics/usage');

    if (corsResult.success || corsResult.status === 200 || corsResult.status === 204) {
        const corsHeaders = corsResult.headers || {};
        const hasCorsHeaders = corsHeaders['access-control-allow-origin'] ||
                             corsHeaders['Access-Control-Allow-Origin'];

        if (hasCorsHeaders) {
            logTest('cors', 'OPTIONS request with CORS headers', 'PASS', {
                responseTime: corsResult.responseTime,
                corsHeaders: {
                    'access-control-allow-origin': corsHeaders['access-control-allow-origin'] || corsHeaders['Access-Control-Allow-Origin'],
                    'access-control-allow-methods': corsHeaders['access-control-allow-methods'] || corsHeaders['Access-Control-Allow-Methods'],
                    'access-control-allow-headers': corsHeaders['access-control-allow-headers'] || corsHeaders['Access-Control-Allow-Headers']
                }
            });
        } else {
            logTest('cors', 'OPTIONS request with CORS headers', 'FAIL', {
                responseTime: corsResult.responseTime,
                error: 'Missing CORS headers',
                headers: corsHeaders
            });
        }
    } else {
        logTest('cors', 'OPTIONS request', 'FAIL', {
            responseTime: corsResult.responseTime,
            error: corsResult.error || `HTTP ${corsResult.status}`,
            status: corsResult.status
        });
    }

    // Test integration with existing endpoints (if any)
    // This would test if the new endpoints work alongside existing ones
    const integrationEndpoints = ['/health', '/status', '/version'];

    for (const endpoint of integrationEndpoints) {
        const result = await makeRequest('GET', endpoint);
        logTest('integration', `Integration test ${endpoint}`,
            result.success ? 'PASS' : 'INFO', {
            responseTime: result.responseTime,
            status: result.status,
            note: result.success ? 'Endpoint exists and responds' : 'Endpoint not found (expected for new API)'
        });
    }
}

async function testErrorHandling() {
    console.log('\n=== Testing Error Handling ===');

    // Test malformed JSON
    const malformedResult = await makeRequest('POST', '/analytics/events', 'invalid-json');

    if (!malformedResult.success && malformedResult.status >= 400) {
        logTest('errorHandling', 'Malformed JSON request', 'PASS', {
            responseTime: malformedResult.responseTime,
            status: malformedResult.status,
            error: malformedResult.error
        });
    } else {
        logTest('errorHandling', 'Malformed JSON request', 'FAIL', {
            responseTime: malformedResult.responseTime,
            error: 'Should return error for malformed JSON',
            actualStatus: malformedResult.status
        });
    }

    // Test invalid session ID
    const invalidSessionResult = await makeRequest('GET', '/sessions/invalid-session-id-123');

    if (!invalidSessionResult.success && invalidSessionResult.status === 404) {
        logTest('errorHandling', 'Invalid session ID returns 404', 'PASS', {
            responseTime: invalidSessionResult.responseTime,
            status: invalidSessionResult.status
        });
    } else {
        logTest('errorHandling', 'Invalid session ID returns 404', 'FAIL', {
            responseTime: invalidSessionResult.responseTime,
            error: 'Should return 404 for invalid session ID',
            actualStatus: invalidSessionResult.status
        });
    }

    // Test invalid period parameter
    const invalidPeriodResult = await makeRequest('GET', '/analytics/usage?period=invalid');

    if (!invalidPeriodResult.success && invalidPeriodResult.status >= 400) {
        logTest('errorHandling', 'Invalid period parameter', 'PASS', {
            responseTime: invalidPeriodResult.responseTime,
            status: invalidPeriodResult.status
        });
    } else {
        logTest('errorHandling', 'Invalid period parameter', 'INFO', {
            responseTime: invalidPeriodResult.responseTime,
            note: 'API accepts invalid period (may use default)',
            actualStatus: invalidPeriodResult.status
        });
    }
}

async function generateReport() {
    console.log('\n=== Dashboard API Test Report ===');
    console.log('Generated:', new Date().toISOString());
    console.log('Base URL:', config.baseURL);
    console.log('\nSUMMARY:');
    console.log(`Total Tests: ${testResults.summary.totalTests}`);
    console.log(`Passed: ${testResults.summary.passedTests}`);
    console.log(`Failed: ${testResults.summary.failedTests}`);
    console.log(`Success Rate: ${((testResults.summary.passedTests / testResults.summary.totalTests) * 100).toFixed(1)}%`);

    if (testResults.summary.issues.length > 0) {
        console.log('\nISSUES FOUND:');
        testResults.summary.issues.forEach(issue => {
            console.log(`- ${issue}`);
        });
    }

    console.log('\nDETAILED RESULTS:');

    Object.keys(testResults).forEach(category => {
        if (category === 'summary') return;

        console.log(`\n${category.toUpperCase()}:`);
        Object.keys(testResults[category]).forEach(testName => {
            const test = testResults[category][testName];
            console.log(`  [${test.status}] ${testName}`);
            if (test.details.responseTime) {
                console.log(`    Response time: ${test.details.responseTime}ms`);
            }
            if (test.status === 'FAIL' && test.details.error) {
                console.log(`    Error: ${test.details.error}`);
            }
        });
    });

    // Dashboard readiness assessment
    console.log('\n=== DASHBOARD READINESS ASSESSMENT ===');

    const criticalEndpoints = [
        'analytics GET /analytics/usage?period=30d',
        'sessions GET /sessions',
        'sessions POST /sessions',
        'authentication Valid Bearer token'
    ];

    const criticalPassed = criticalEndpoints.every(endpoint => {
        const [category, testName] = endpoint.split(' ', 2);
        const fullTestName = endpoint.substring(category.length + 1);
        return testResults[category] && testResults[category][fullTestName] &&
               testResults[category][fullTestName].status === 'PASS';
    });

    const overallReadiness = testResults.summary.failedTests === 0 ? 'READY' :
                           criticalPassed ? 'MOSTLY_READY' : 'NOT_READY';

    console.log(`Overall Status: ${overallReadiness}`);

    if (overallReadiness === 'READY') {
        console.log('✅ All tests passed. Dashboard is fully functional.');
    } else if (overallReadiness === 'MOSTLY_READY') {
        console.log('⚠️  Critical endpoints working. Minor issues detected.');
    } else {
        console.log('❌ Critical issues found. Dashboard may not function properly.');
    }

    return {
        testResults,
        overallReadiness,
        criticalPassed
    };
}

// Main test runner
async function runAllTests() {
    console.log('Starting comprehensive dashboard API tests...');
    console.log('Base URL:', config.baseURL);
    console.log('Test Token:', testData.validToken);

    try {
        await testAnalyticsEndpoints();
        await testSessionsEndpoints();
        await testAuthentication();
        await testCORSAndIntegration();
        await testErrorHandling();

        const report = await generateReport();

        // Save results to file
        const fs = require('fs');
        const reportPath = '/Users/jimmybrootcoorens/Library/Mobile Documents/com~apple~CloudDocs/JBIT /apps/ApexShare/tests/api/dashboard-test-results.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\nDetailed results saved to: ${reportPath}`);

        return report;

    } catch (error) {
        console.error('Test suite failed:', error);
        return { error: error.message };
    }
}

// Export for use in other test files
module.exports = {
    runAllTests,
    testAnalyticsEndpoints,
    testSessionsEndpoints,
    testAuthentication,
    testCORSAndIntegration,
    testErrorHandling,
    config,
    testData
};

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().then(result => {
        if (result.error) {
            process.exit(1);
        } else {
            process.exit(result.overallReadiness === 'NOT_READY' ? 1 : 0);
        }
    });
}