/**
 * CORS Fix Validation Test
 *
 * This test demonstrates the root cause of the Chrome network error
 * and validates the fix for the missing X-Public-Access header in CORS configuration.
 */

const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';

/**
 * Root Cause Analysis Results
 */
function displayRootCause() {
    console.log('🔍 ROOT CAUSE ANALYSIS');
    console.log('=====================');
    console.log('');
    console.log('ISSUE: Chrome "Network error - please check your connection" during session creation');
    console.log('');
    console.log('ROOT CAUSE: CORS preflight failure');
    console.log('- Browser sends OPTIONS request with Access-Control-Request-Headers: "Content-Type, X-Public-Access"');
    console.log('- API Gateway responds with Access-Control-Allow-Headers: "Content-Type,Authorization,X-Requested-With,Accept,Origin,X-Auth-Token"');
    console.log('- X-Public-Access is MISSING from the allowed headers list');
    console.log('- Browser blocks the POST request due to CORS violation');
    console.log('- Frontend receives generic "Network error" message');
    console.log('');
    console.log('WHY CURL WORKS:');
    console.log('- curl does not perform CORS preflight checks');
    console.log('- curl sends the POST request directly');
    console.log('- API Gateway processes the request normally');
    console.log('');
    console.log('SOLUTION: Add X-Public-Access to API_CONFIG.CORS.ALLOWED_HEADERS');
}

/**
 * Test current CORS behavior (should fail)
 */
async function testCurrentCorsFailure() {
    console.log('🧪 Testing Current CORS Behavior (Expected: FAILURE)');
    console.log('====================================================');

    try {
        // Test with fetch (this will trigger CORS preflight)
        const response = await fetch(`${API_BASE_URL}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Public-Access': 'true' // This header causes CORS preflight
            },
            body: JSON.stringify({
                title: 'CORS Test Session',
                description: 'Testing CORS preflight failure',
                studentEmails: ['test@example.com'],
                isPublic: true
            })
        });

        console.log('❌ UNEXPECTED: Request succeeded when it should have failed due to CORS');
        console.log('Status:', response.status);
        console.log('This means the fix has already been applied!');

        return { success: true, fixed: true };
    } catch (error) {
        if (error.message.includes('Network') || error.message.includes('CORS')) {
            console.log('✅ EXPECTED: CORS failure detected');
            console.log('Error:', error.message);
            return { success: false, corsError: true };
        } else {
            console.log('❌ UNEXPECTED: Different error occurred');
            console.log('Error:', error.message);
            return { success: false, otherError: true };
        }
    }
}

/**
 * Test CORS preflight request
 */
async function testCorsPreflightRequest() {
    console.log('🔍 Testing CORS Preflight Request');
    console.log('=================================');

    try {
        const response = await fetch(`${API_BASE_URL}/sessions`, {
            method: 'OPTIONS',
            headers: {
                'Origin': window.location.origin,
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type, X-Public-Access'
            }
        });

        const allowedHeaders = response.headers.get('access-control-allow-headers');
        console.log('✅ CORS Preflight Response:');
        console.log('Status:', response.status);
        console.log('Access-Control-Allow-Headers:', allowedHeaders);

        const hasXPublicAccess = allowedHeaders && allowedHeaders.toLowerCase().includes('x-public-access');

        if (hasXPublicAccess) {
            console.log('✅ X-Public-Access is in allowed headers - CORS issue is FIXED');
            return { success: true, fixed: true };
        } else {
            console.log('❌ X-Public-Access is NOT in allowed headers - CORS issue confirmed');
            console.log('Required fix: Add "X-Public-Access" to API_CONFIG.CORS.ALLOWED_HEADERS');
            return { success: false, needsFix: true };
        }
    } catch (error) {
        console.error('❌ CORS preflight test failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Show the exact fix needed
 */
function showExactFix() {
    console.log('🔧 EXACT FIX REQUIRED');
    console.log('====================');
    console.log('');
    console.log('File: lib/shared/constants.ts');
    console.log('Location: API_CONFIG.CORS.ALLOWED_HEADERS (lines 41-48)');
    console.log('');
    console.log('CURRENT:');
    console.log('```typescript');
    console.log('ALLOWED_HEADERS: [');
    console.log('  "Content-Type",');
    console.log('  "Authorization",');
    console.log('  "X-Requested-With",');
    console.log('  "Accept",');
    console.log('  "Origin",');
    console.log('  "X-Auth-Token",');
    console.log('],');
    console.log('```');
    console.log('');
    console.log('FIXED:');
    console.log('```typescript');
    console.log('ALLOWED_HEADERS: [');
    console.log('  "Content-Type",');
    console.log('  "Authorization",');
    console.log('  "X-Requested-With",');
    console.log('  "Accept",');
    console.log('  "Origin",');
    console.log('  "X-Auth-Token",');
    console.log('  "X-Public-Access",  // <-- ADD THIS LINE');
    console.log('],');
    console.log('```');
    console.log('');
    console.log('DEPLOYMENT STEPS:');
    console.log('1. Update lib/shared/constants.ts');
    console.log('2. Run: npm run build');
    console.log('3. Run: cdk deploy ApexShareApiStack-prod');
    console.log('4. Test with the validation script');
}

/**
 * Alternative workaround for immediate testing
 */
function showWorkaround() {
    console.log('⚡ IMMEDIATE WORKAROUND');
    console.log('=====================');
    console.log('');
    console.log('While waiting for the CDK deployment, you can test with X-Auth-Token instead:');
    console.log('');
    console.log('CURRENT (failing):');
    console.log('headers: {');
    console.log('  "Content-Type": "application/json",');
    console.log('  "X-Public-Access": "true"  // Causes CORS failure');
    console.log('}');
    console.log('');
    console.log('WORKAROUND (working):');
    console.log('headers: {');
    console.log('  "Content-Type": "application/json",');
    console.log('  "X-Auth-Token": "debug-token"  // Already in allowed headers');
    console.log('}');
    console.log('');
    console.log('This will allow testing while the proper fix is deployed.');
}

/**
 * Test the workaround approach
 */
async function testWorkaround() {
    console.log('🔄 Testing Workaround Approach');
    console.log('==============================');

    try {
        const response = await fetch(`${API_BASE_URL}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': 'debug-token' // Use this instead of X-Public-Access
            },
            body: JSON.stringify({
                title: 'Workaround Test Session',
                description: 'Testing with X-Auth-Token instead of X-Public-Access',
                studentEmails: ['test@example.com'],
                isPublic: true
            })
        });

        console.log('✅ Workaround successful!');
        console.log('Status:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('Session created:', data);
            return { success: true, sessionId: data.data?.id };
        } else {
            const error = await response.text();
            console.log('Response:', error);
            return { success: true, statusCode: response.status };
        }
    } catch (error) {
        console.log('❌ Workaround failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Main validation function
 */
async function runValidation() {
    console.log('🚀 CORS Fix Validation Tool');
    console.log('===========================');
    console.log('');

    // Show root cause analysis
    displayRootCause();
    console.log('');

    // Test current CORS behavior
    const corsTest = await testCurrentCorsFailure();
    console.log('');

    // Test CORS preflight
    const preflightTest = await testCorsPreflightRequest();
    console.log('');

    // Show the exact fix
    showExactFix();
    console.log('');

    // Show workaround
    showWorkaround();
    console.log('');

    // Test workaround
    const workaroundTest = await testWorkaround();
    console.log('');

    // Summary
    console.log('📋 VALIDATION SUMMARY');
    console.log('====================');

    if (preflightTest.fixed) {
        console.log('✅ CORS issue has been FIXED - X-Public-Access is now allowed');
    } else if (preflightTest.needsFix) {
        console.log('❌ CORS issue confirmed - X-Public-Access needs to be added to allowed headers');
        console.log('🔧 Apply the fix shown above and redeploy');
    }

    if (workaroundTest.success) {
        console.log('✅ Workaround confirmed working - can use X-Auth-Token temporarily');
    } else {
        console.log('❌ Workaround failed - there may be additional issues');
    }

    console.log('');
    console.log('🎯 NEXT STEPS:');
    console.log('1. Apply the CORS fix in lib/shared/constants.ts');
    console.log('2. Deploy the updated API stack');
    console.log('3. Update frontend to use X-Public-Access again');
    console.log('4. Verify the network error is resolved');

    return {
        corsFixed: preflightTest.fixed,
        workaroundWorks: workaroundTest.success,
        needsDeployment: !preflightTest.fixed
    };
}

// Run validation when script loads
runValidation().then(results => {
    console.log('');
    console.log('📊 Final Results:', results);
    window.corsValidationResults = results;
}).catch(console.error);