/**
 * Session Creation Debug Tool
 *
 * Comprehensive debugging for Chrome network errors during session creation.
 * Focus on identifying why session creation fails in Chrome when curl works.
 */

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';

// Test configuration
const TEST_SESSION_DATA = {
    title: 'Session for jimmy@jbit.be - 2025-09-22',
    description: 'Direct upload session',
    studentEmails: ['jimmy@jbit.be'],
    isPublic: false,
    metadata: {
        studentName: 'Jimmy Broot',
        trainerName: 'Test Trainer',
        date: '2025-09-22',
        notes: 'Debug session creation test',
        uploadType: 'debug'
    }
};

/**
 * Test 1: Direct curl-equivalent test
 */
async function testSessionCreationDirect() {
    console.log('🔍 Test 1: Direct Session Creation (simulating curl)');

    try {
        const response = await fetch(`${API_BASE_URL}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Public-Access': 'true'
            },
            body: JSON.stringify(TEST_SESSION_DATA)
        });

        console.log('📊 Response Status:', response.status);
        console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()));

        const responseText = await response.text();
        console.log('📊 Response Body (raw):', responseText);

        try {
            const responseData = JSON.parse(responseText);
            console.log('📊 Response Body (parsed):', responseData);
        } catch (e) {
            console.log('⚠️ Could not parse response as JSON');
        }

        return { success: response.ok, status: response.status, data: responseText };
    } catch (error) {
        console.error('❌ Direct session creation failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Test 2: Test with different headers combinations
 */
async function testSessionCreationWithHeaders() {
    console.log('🔍 Test 2: Session Creation with Different Headers');

    const headerCombinations = [
        { name: 'Basic headers', headers: { 'Content-Type': 'application/json' } },
        { name: 'With X-Public-Access', headers: { 'Content-Type': 'application/json', 'X-Public-Access': 'true' } },
        { name: 'With X-Auth-Token', headers: { 'Content-Type': 'application/json', 'X-Auth-Token': 'test-token' } },
        { name: 'With CORS headers', headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true',
            'Origin': window.location.origin,
            'Accept': 'application/json'
        }},
        { name: 'With Requested-With', headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true',
            'X-Requested-With': 'XMLHttpRequest'
        }}
    ];

    const results = [];

    for (const combo of headerCombinations) {
        console.log(`\n🧪 Testing: ${combo.name}`);
        console.log('📤 Headers:', combo.headers);

        try {
            const response = await fetch(`${API_BASE_URL}/sessions`, {
                method: 'POST',
                headers: combo.headers,
                body: JSON.stringify(TEST_SESSION_DATA)
            });

            const result = {
                name: combo.name,
                status: response.status,
                ok: response.ok,
                headers: Object.fromEntries(response.headers.entries())
            };

            if (response.ok) {
                try {
                    result.data = await response.json();
                } catch (e) {
                    result.data = await response.text();
                }
            } else {
                result.error = await response.text();
            }

            results.push(result);
            console.log(`✅ ${combo.name}: ${response.status} ${response.ok ? 'OK' : 'ERROR'}`);
        } catch (error) {
            const result = {
                name: combo.name,
                networkError: true,
                error: error.message
            };
            results.push(result);
            console.error(`❌ ${combo.name}: Network Error - ${error.message}`);
        }
    }

    return results;
}

/**
 * Test 3: OPTIONS preflight request test
 */
async function testPreflightRequest() {
    console.log('🔍 Test 3: CORS Preflight Request');

    try {
        const response = await fetch(`${API_BASE_URL}/sessions`, {
            method: 'OPTIONS',
            headers: {
                'Origin': window.location.origin,
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type, X-Public-Access'
            }
        });

        console.log('📊 OPTIONS Response Status:', response.status);
        console.log('📊 OPTIONS Response Headers:', Object.fromEntries(response.headers.entries()));

        const corsHeaders = {
            'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
            'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
            'access-control-allow-headers': response.headers.get('access-control-allow-headers'),
            'access-control-max-age': response.headers.get('access-control-max-age')
        };

        console.log('🔍 CORS Headers:', corsHeaders);

        return {
            success: response.ok,
            status: response.status,
            corsHeaders
        };
    } catch (error) {
        console.error('❌ OPTIONS request failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Test 4: Test with XMLHttpRequest (like the frontend code)
 */
async function testWithXMLHttpRequest() {
    console.log('🔍 Test 4: XMLHttpRequest (matching frontend behavior)');

    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        const requestData = JSON.stringify(TEST_SESSION_DATA);

        // Track all events
        const events = [];

        ['loadstart', 'progress', 'abort', 'error', 'load', 'timeout', 'loadend'].forEach(eventType => {
            xhr.addEventListener(eventType, (event) => {
                events.push({
                    type: eventType,
                    timestamp: Date.now(),
                    loaded: event.loaded,
                    total: event.total,
                    readyState: xhr.readyState,
                    status: xhr.status,
                    statusText: xhr.statusText
                });
                console.log(`📡 XHR Event: ${eventType}`, {
                    readyState: xhr.readyState,
                    status: xhr.status,
                    statusText: xhr.statusText
                });
            });
        });

        xhr.onreadystatechange = function() {
            console.log(`🔄 ReadyState changed to: ${xhr.readyState}`, {
                status: xhr.status,
                statusText: xhr.statusText
            });
        };

        xhr.addEventListener('load', () => {
            const result = {
                success: xhr.status >= 200 && xhr.status < 300,
                status: xhr.status,
                statusText: xhr.statusText,
                responseHeaders: xhr.getAllResponseHeaders(),
                responseText: xhr.responseText,
                events
            };

            console.log('✅ XHR Load event:', result);
            resolve(result);
        });

        xhr.addEventListener('error', () => {
            const result = {
                success: false,
                networkError: true,
                status: xhr.status,
                statusText: xhr.statusText,
                events,
                error: 'XMLHttpRequest network error'
            };

            console.error('❌ XHR Error event:', result);
            resolve(result);
        });

        xhr.addEventListener('timeout', () => {
            const result = {
                success: false,
                timeout: true,
                events,
                error: 'XMLHttpRequest timeout'
            };

            console.error('⏰ XHR Timeout event:', result);
            resolve(result);
        });

        try {
            xhr.open('POST', `${API_BASE_URL}/sessions`, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('X-Public-Access', 'true');
            xhr.timeout = 30000; // 30 seconds

            console.log('📤 Sending XHR request with headers:', {
                'Content-Type': 'application/json',
                'X-Public-Access': 'true'
            });

            xhr.send(requestData);
        } catch (error) {
            console.error('❌ XHR setup error:', error);
            resolve({
                success: false,
                setupError: true,
                error: error.message,
                events
            });
        }
    });
}

/**
 * Test 5: Browser-specific diagnostics
 */
function runBrowserDiagnostics() {
    console.log('🔍 Test 5: Browser Diagnostics');

    const diagnostics = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        vendor: navigator.vendor,
        language: navigator.language,
        onLine: navigator.onLine,
        connection: navigator.connection ? {
            effectiveType: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink,
            rtt: navigator.connection.rtt,
            saveData: navigator.connection.saveData
        } : 'Not available',
        browserFeatures: {
            fetch: typeof fetch !== 'undefined',
            xhr: typeof XMLHttpRequest !== 'undefined',
            formData: typeof FormData !== 'undefined',
            blob: typeof Blob !== 'undefined',
            file: typeof File !== 'undefined',
            webWorkers: typeof Worker !== 'undefined'
        },
        location: {
            origin: window.location.origin,
            protocol: window.location.protocol,
            host: window.location.host
        },
        security: {
            isSecureContext: window.isSecureContext,
            crossOriginIsolated: window.crossOriginIsolated
        }
    };

    console.log('🔍 Browser Diagnostics:', diagnostics);
    return diagnostics;
}

/**
 * Test 6: Network connectivity test
 */
async function testNetworkConnectivity() {
    console.log('🔍 Test 6: Network Connectivity');

    const tests = [
        { name: 'API Health Check', url: `${API_BASE_URL}/health` },
        { name: 'Google (reference)', url: 'https://www.google.com/favicon.ico' },
        { name: 'AWS API Gateway (basic)', url: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com' }
    ];

    const results = [];

    for (const test of tests) {
        try {
            console.log(`🌐 Testing connectivity to: ${test.name}`);
            const start = performance.now();
            const response = await fetch(test.url, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache'
            });
            const end = performance.now();

            results.push({
                name: test.name,
                url: test.url,
                success: true,
                status: response.status,
                time: Math.round(end - start),
                headers: Object.fromEntries(response.headers.entries())
            });

            console.log(`✅ ${test.name}: ${response.status} (${Math.round(end - start)}ms)`);
        } catch (error) {
            results.push({
                name: test.name,
                url: test.url,
                success: false,
                error: error.message
            });
            console.error(`❌ ${test.name}: ${error.message}`);
        }
    }

    return results;
}

/**
 * Main test runner
 */
async function runAllTests() {
    console.log('🚀 Starting Session Creation Debug Tests');
    console.log('=====================================');

    const testResults = {};

    // Run browser diagnostics first
    testResults.browserDiagnostics = runBrowserDiagnostics();

    // Test network connectivity
    console.log('\n📡 Testing Network Connectivity...');
    testResults.networkConnectivity = await testNetworkConnectivity();

    // Test CORS preflight
    console.log('\n🔍 Testing CORS Preflight...');
    testResults.preflightTest = await testPreflightRequest();

    // Test direct session creation
    console.log('\n📤 Testing Direct Session Creation...');
    testResults.directSessionCreation = await testSessionCreationDirect();

    // Test with different headers
    console.log('\n🧪 Testing Different Header Combinations...');
    testResults.headerTests = await testSessionCreationWithHeaders();

    // Test with XMLHttpRequest
    console.log('\n📡 Testing with XMLHttpRequest...');
    testResults.xmlHttpRequestTest = await testWithXMLHttpRequest();

    console.log('\n📋 TEST RESULTS SUMMARY');
    console.log('========================');

    // Analyze results
    const analysis = analyzeResults(testResults);
    console.log('🔍 Analysis:', analysis);

    // Export results for further analysis
    console.log('\n📄 Full test results available in window.sessionDebugResults');
    window.sessionDebugResults = testResults;

    return testResults;
}

/**
 * Analyze test results to identify the root cause
 */
function analyzeResults(results) {
    const analysis = {
        networkIssues: [],
        corsIssues: [],
        authenticationIssues: [],
        browserIssues: [],
        recommendations: []
    };

    // Check network connectivity
    if (results.networkConnectivity) {
        const failedTests = results.networkConnectivity.filter(test => !test.success);
        if (failedTests.length > 0) {
            analysis.networkIssues.push('Basic network connectivity issues detected');
            analysis.recommendations.push('Check internet connection and firewall settings');
        }
    }

    // Check CORS
    if (results.preflightTest && !results.preflightTest.success) {
        analysis.corsIssues.push('CORS preflight request failed');
        analysis.recommendations.push('Check API Gateway CORS configuration');
    }

    // Check session creation results
    if (results.directSessionCreation && !results.directSessionCreation.success) {
        if (results.directSessionCreation.error && results.directSessionCreation.error.includes('Network')) {
            analysis.networkIssues.push('Direct session creation shows network error');
        } else {
            analysis.authenticationIssues.push('Session creation API issue');
        }
    }

    // Check XMLHttpRequest behavior
    if (results.xmlHttpRequestTest) {
        if (results.xmlHttpRequestTest.networkError) {
            analysis.networkIssues.push('XMLHttpRequest shows network error');
            analysis.recommendations.push('This matches the reported Chrome network error');
        }
        if (results.xmlHttpRequestTest.timeout) {
            analysis.networkIssues.push('XMLHttpRequest timeout detected');
        }
    }

    // Browser-specific analysis
    if (results.browserDiagnostics) {
        const isChrome = results.browserDiagnostics.userAgent.includes('Chrome');
        if (isChrome && results.xmlHttpRequestTest && results.xmlHttpRequestTest.networkError) {
            analysis.browserIssues.push('Chrome-specific network error detected');
            analysis.recommendations.push('Consider Chrome-specific CORS headers or fetch API instead of XHR');
        }
    }

    return analysis;
}

// Auto-run tests when script loads
runAllTests().catch(console.error);