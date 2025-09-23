#!/usr/bin/env node

/**
 * ApexShare Phase 3 Technical Validation Test Suite (Simplified)
 * Validates production readiness following Phase 2 Chrome upload fixes
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Test Configuration
const CONFIG = {
    API_BASE_URL: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
    FRONTEND_URL: 'https://apexshare.be',
    TEST_EMAIL: 'phase3-test@example.com',
    TEST_TIMEOUT: 30000
};

// Test Results
let testResults = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    detailedResults: [],
    phase2IssuesValidation: {
        chromeUploadFixed: false,
        nanUndefinedFixed: false,
        corsIssuesResolved: false,
        uploadWorkflowFunctional: false
    }
};

// Utility Functions
function logTest(testId, description, status, details = {}) {
    const result = {
        testId,
        description,
        status,
        details,
        timestamp: new Date(),
        executionTime: details.executionTime || 0
    };

    testResults.detailedResults.push(result);
    testResults.totalTests++;

    if (status === 'PASS') {
        testResults.passedTests++;
        console.log(`✅ ${testId}: ${description} - PASSED (${details.executionTime || 0}ms)`);
    } else {
        testResults.failedTests++;
        console.log(`❌ ${testId}: ${description} - FAILED`);
        if (details.error) {
            console.log(`   Error: ${details.error}`);
        }
    }
}

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const urlObj = new URL(url);
        const requestModule = urlObj.protocol === 'https:' ? https : http;

        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Origin': CONFIG.FRONTEND_URL,
                'User-Agent': 'ApexShare-Phase3-Test-Suite/1.0',
                ...options.headers
            },
            timeout: CONFIG.TEST_TIMEOUT
        };

        const req = requestModule.request(requestOptions, (res) => {
            const executionTime = Date.now() - startTime;
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const result = {
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    headers: res.headers,
                    executionTime
                };

                try {
                    if (res.headers['content-type']?.includes('application/json')) {
                        result.data = JSON.parse(data);
                    } else {
                        result.text = data;
                    }
                } catch (e) {
                    result.text = data;
                }

                resolve(result);
            });
        });

        req.on('error', (error) => {
            const executionTime = Date.now() - startTime;
            resolve({
                error: error.message,
                executionTime
            });
        });

        req.on('timeout', () => {
            req.destroy();
            const executionTime = Date.now() - startTime;
            resolve({
                error: 'Request timeout',
                executionTime
            });
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

// Test Functions
async function testInfrastructureIntegration() {
    console.log('\n🏗️  Phase 3.1a: Infrastructure Integration Testing');
    console.log('=' .repeat(60));

    // Test API Gateway → Lambda Integration
    try {
        const response = await makeRequest(`${CONFIG.API_BASE_URL}/uploads/recent`);

        if (response.status === 200 && !response.error) {
            logTest('INFRA-001a', 'API Gateway → Lambda Integration', 'PASS', {
                executionTime: response.executionTime,
                apiResponse: response.status
            });

            // Check for Phase 2 "NaN undefined" fix
            const responseText = JSON.stringify(response.data || response.text || '');
            if (!responseText.includes('NaN') && !responseText.includes('undefined')) {
                testResults.phase2IssuesValidation.nanUndefinedFixed = true;
                logTest('INFRA-001b', 'Phase 2 "NaN undefined" Error Resolution', 'PASS', {
                    executionTime: response.executionTime,
                    validation: 'No NaN or undefined values in API responses'
                });
            } else {
                logTest('INFRA-001b', 'Phase 2 "NaN undefined" Error Resolution', 'FAIL', {
                    error: 'NaN or undefined values still present in responses'
                });
            }
        } else {
            logTest('INFRA-001a', 'API Gateway → Lambda Integration', 'FAIL', {
                error: response.error || `HTTP ${response.status}`,
                executionTime: response.executionTime
            });
        }
    } catch (error) {
        logTest('INFRA-001a', 'API Gateway → Lambda Integration', 'FAIL', {
            error: error.message
        });
    }

    // Test CORS Configuration (Critical Phase 2 Fix)
    try {
        const corsResponse = await makeRequest(`${CONFIG.API_BASE_URL}/uploads/initiate`, {
            method: 'OPTIONS',
            headers: {
                'Origin': CONFIG.FRONTEND_URL,
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });

        if (corsResponse.status === 204 || corsResponse.status === 200) {
            const hasCorrectCorsHeaders =
                corsResponse.headers['access-control-allow-origin'] === CONFIG.FRONTEND_URL ||
                corsResponse.headers['access-control-allow-origin'] === '*';

            if (hasCorrectCorsHeaders) {
                testResults.phase2IssuesValidation.corsIssuesResolved = true;
                logTest('INFRA-001c', 'Phase 2 CORS 403 Error Resolution', 'PASS', {
                    executionTime: corsResponse.executionTime,
                    corsOrigin: corsResponse.headers['access-control-allow-origin']
                });
            } else {
                logTest('INFRA-001c', 'Phase 2 CORS 403 Error Resolution', 'FAIL', {
                    error: 'CORS headers missing or incorrect'
                });
            }
        } else {
            logTest('INFRA-001c', 'Phase 2 CORS 403 Error Resolution', 'FAIL', {
                error: `CORS preflight failed: HTTP ${corsResponse.status}`,
                executionTime: corsResponse.executionTime
            });
        }
    } catch (error) {
        logTest('INFRA-001c', 'Phase 2 CORS 403 Error Resolution', 'FAIL', {
            error: error.message
        });
    }

    // Test Frontend Accessibility
    try {
        const frontendResponse = await makeRequest(CONFIG.FRONTEND_URL);

        if (frontendResponse.status === 200 && !frontendResponse.error) {
            const isValidHtml = frontendResponse.text?.includes('<!doctype html') &&
                              frontendResponse.text?.includes('ApexShare');

            if (isValidHtml) {
                logTest('INFRA-002a', 'Frontend Application Deployment', 'PASS', {
                    executionTime: frontendResponse.executionTime,
                    contentLength: frontendResponse.text?.length || 0
                });
            } else {
                logTest('INFRA-002a', 'Frontend Application Deployment', 'FAIL', {
                    error: 'Invalid HTML content or missing ApexShare branding'
                });
            }
        } else {
            logTest('INFRA-002a', 'Frontend Application Deployment', 'FAIL', {
                error: frontendResponse.error || `HTTP ${frontendResponse.status}`,
                executionTime: frontendResponse.executionTime
            });
        }
    } catch (error) {
        logTest('INFRA-002a', 'Frontend Application Deployment', 'FAIL', {
            error: error.message
        });
    }
}

async function testAPIEndpoints() {
    console.log('\n🔌 Phase 3.1b: API Endpoint Validation');
    console.log('=' .repeat(60));

    // Test Upload Initiation
    const validUploadPayload = {
        fileName: 'phase3-test-video.mp4',
        fileSize: 104857600, // 100MB
        mimeType: 'video/mp4',
        trainerName: 'Phase 3 Test Trainer',
        trainerEmail: 'trainer@phase3test.com',
        studentName: 'Phase 3 Test Student',
        studentEmail: CONFIG.TEST_EMAIL,
        description: 'Phase 3 technical validation test'
    };

    try {
        const response = await makeRequest(`${CONFIG.API_BASE_URL}/uploads/initiate`, {
            method: 'POST',
            body: JSON.stringify(validUploadPayload)
        });

        if (response.status === 200 && response.data?.success) {
            const hasRequiredFields =
                response.data.data?.fileId &&
                response.data.data?.uploadUrl &&
                response.data.data?.fields;

            if (hasRequiredFields) {
                testResults.phase2IssuesValidation.uploadWorkflowFunctional = true;
                logTest('API-001a', 'Valid Upload Request Processing', 'PASS', {
                    executionTime: response.executionTime,
                    fileId: response.data.data.fileId
                });

                // Check for "NaN undefined" in response
                const responseStr = JSON.stringify(response.data);
                if (!responseStr.includes('NaN') && !responseStr.includes('undefined')) {
                    logTest('API-001b', 'Upload Response Format Validation', 'PASS', {
                        executionTime: response.executionTime,
                        validation: 'Clean response format without NaN/undefined'
                    });
                } else {
                    logTest('API-001b', 'Upload Response Format Validation', 'FAIL', {
                        error: 'Response contains NaN or undefined values'
                    });
                }
            } else {
                logTest('API-001a', 'Valid Upload Request Processing', 'FAIL', {
                    error: 'Missing required response fields',
                    executionTime: response.executionTime
                });
            }
        } else {
            logTest('API-001a', 'Valid Upload Request Processing', 'FAIL', {
                error: response.error || `HTTP ${response.status}`,
                executionTime: response.executionTime
            });
        }
    } catch (error) {
        logTest('API-001a', 'Valid Upload Request Processing', 'FAIL', {
            error: error.message
        });
    }

    // Test Session-Based Upload (Phase 2 Focus)
    const testSessionId = 'phase3-test-session-' + Date.now();

    try {
        const corsResponse = await makeRequest(`${CONFIG.API_BASE_URL}/sessions/${testSessionId}/upload`, {
            method: 'OPTIONS',
            headers: {
                'Origin': CONFIG.FRONTEND_URL,
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });

        if (corsResponse.status === 204 || corsResponse.status === 200) {
            logTest('API-002a', 'Session Upload CORS Preflight (Phase 2 Fix)', 'PASS', {
                executionTime: corsResponse.executionTime,
                sessionId: testSessionId
            });

            if (corsResponse.headers['access-control-allow-origin']) {
                testResults.phase2IssuesValidation.chromeUploadFixed = true;
            }
        } else {
            logTest('API-002a', 'Session Upload CORS Preflight (Phase 2 Fix)', 'FAIL', {
                error: `CORS preflight failed: HTTP ${corsResponse.status}`,
                executionTime: corsResponse.executionTime
            });
        }
    } catch (error) {
        logTest('API-002a', 'Session Upload CORS Preflight (Phase 2 Fix)', 'FAIL', {
            error: error.message
        });
    }

    // Test session POST (should not return 403)
    const sessionUploadPayload = {
        fileName: 'session-test-video.mp4',
        fileSize: 52428800,
        mimeType: 'video/mp4'
    };

    try {
        const response = await makeRequest(`${CONFIG.API_BASE_URL}/sessions/${testSessionId}/upload`, {
            method: 'POST',
            body: JSON.stringify(sessionUploadPayload)
        });

        if (response.status !== 403) {
            logTest('API-002b', 'Session Upload No 403 Forbidden (Phase 2 Validation)', 'PASS', {
                executionTime: response.executionTime,
                actualStatus: response.status,
                validation: 'No 403 errors (Phase 2 issue resolved)'
            });
        } else {
            logTest('API-002b', 'Session Upload No 403 Forbidden (Phase 2 Validation)', 'FAIL', {
                error: '403 Forbidden error still present',
                executionTime: response.executionTime
            });
        }
    } catch (error) {
        logTest('API-002b', 'Session Upload No 403 Forbidden (Phase 2 Validation)', 'FAIL', {
            error: error.message
        });
    }
}

async function testPerformanceBaseline() {
    console.log('\n⚡ Phase 3.1c: Performance Baseline Testing');
    console.log('=' .repeat(60));

    const performanceTests = [
        {
            name: 'API Response Time - Recent Uploads',
            url: `${CONFIG.API_BASE_URL}/uploads/recent`,
            method: 'GET',
            threshold: 2000
        },
        {
            name: 'CORS Preflight Response Time',
            url: `${CONFIG.API_BASE_URL}/uploads/initiate`,
            method: 'OPTIONS',
            threshold: 1000
        },
        {
            name: 'Frontend Load Time',
            url: CONFIG.FRONTEND_URL,
            method: 'GET',
            threshold: 3000
        }
    ];

    for (const test of performanceTests) {
        try {
            const response = await makeRequest(test.url, { method: test.method });

            if (response.executionTime <= test.threshold && !response.error) {
                logTest('PERF-001', test.name, 'PASS', {
                    executionTime: response.executionTime,
                    threshold: test.threshold,
                    performanceRatio: Math.round((response.executionTime / test.threshold) * 100) + '%'
                });
            } else {
                logTest('PERF-001', test.name, 'FAIL', {
                    executionTime: response.executionTime,
                    threshold: test.threshold,
                    error: response.error || `Response time ${response.executionTime}ms exceeds threshold ${test.threshold}ms`
                });
            }
        } catch (error) {
            logTest('PERF-001', test.name, 'FAIL', {
                error: error.message
            });
        }
    }
}

function generateTestReport() {
    console.log('\n📊 Phase 3.1 Technical Validation Test Report');
    console.log('=' .repeat(60));

    const successRate = ((testResults.passedTests / testResults.totalTests) * 100).toFixed(1);

    console.log(`\n📋 Test Execution Summary:`);
    console.log(`   Total Tests: ${testResults.totalTests}`);
    console.log(`   Passed: ${testResults.passedTests}`);
    console.log(`   Failed: ${testResults.failedTests}`);
    console.log(`   Success Rate: ${successRate}%`);

    console.log(`\n🔍 Phase 2 Issue Resolution Validation:`);
    const phase2Issues = testResults.phase2IssuesValidation;
    console.log(`   Chrome Upload Fixed: ${phase2Issues.chromeUploadFixed ? '✅' : '❌'}`);
    console.log(`   NaN Undefined Fixed: ${phase2Issues.nanUndefinedFixed ? '✅' : '❌'}`);
    console.log(`   CORS Issues Resolved: ${phase2Issues.corsIssuesResolved ? '✅' : '❌'}`);
    console.log(`   Upload Workflow Functional: ${phase2Issues.uploadWorkflowFunctional ? '✅' : '❌'}`);

    const phase2ValidationsPassed = Object.values(phase2Issues).filter(Boolean).length;
    const phase2ValidationRate = ((phase2ValidationsPassed / 4) * 100).toFixed(1);
    console.log(`   Phase 2 Validation Rate: ${phase2ValidationRate}%`);

    // Quality Gate Assessment
    console.log(`\n🚪 Quality Gate Assessment:`);
    const overallSuccess = parseFloat(successRate) >= 80;
    const phase2Success = parseFloat(phase2ValidationRate) >= 75;

    console.log(`   Overall Test Success: ${overallSuccess ? '✅ PASS' : '❌ FAIL'} (${successRate}%)`);
    console.log(`   Phase 2 Validations: ${phase2Success ? '✅ PASS' : '❌ FAIL'} (${phase2ValidationRate}%)`);

    const readyForPhase32 = overallSuccess && phase2Success;
    console.log(`   Ready for Phase 3.2: ${readyForPhase32 ? '✅ YES' : '❌ NO'}`);

    // Save results
    const reportData = {
        ...testResults,
        successRate: parseFloat(successRate),
        phase2ValidationRate: parseFloat(phase2ValidationRate),
        readyForPhase32
    };

    try {
        const reportPath = path.join(__dirname, 'technical-validation-results.json');
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        console.log(`\n💾 Detailed report saved to: ${reportPath}`);
    } catch (error) {
        console.log(`\n⚠️  Could not save report: ${error.message}`);
    }

    return readyForPhase32;
}

// Main execution
async function runPhase3TechnicalValidation() {
    console.log('🚀 ApexShare Phase 3: Production Validation Testing');
    console.log('🔧 Phase 3.1: Technical Validation Suite');
    console.log('=' .repeat(60));
    console.log(`Test Environment: ${CONFIG.API_BASE_URL}`);
    console.log(`Frontend URL: ${CONFIG.FRONTEND_URL}`);
    console.log(`Test Start Time: ${new Date().toISOString()}`);

    try {
        await testInfrastructureIntegration();
        await testAPIEndpoints();
        await testPerformanceBaseline();

        const success = generateTestReport();

        console.log(`\n🎯 Phase 3.1 Technical Validation: ${success ? 'COMPLETE ✅' : 'REQUIRES ATTENTION ❌'}`);

        if (success) {
            console.log('\n✅ System is ready for Phase 3.2 User End-to-End Testing');
            process.exit(0);
        } else {
            console.log('\n❌ Address failing tests before proceeding to Phase 3.2');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n💥 Fatal error during test execution:', error.message);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    runPhase3TechnicalValidation();
}

module.exports = { runPhase3TechnicalValidation, testResults, CONFIG };