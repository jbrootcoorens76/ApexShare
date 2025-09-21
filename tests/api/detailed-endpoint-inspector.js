/**
 * Detailed Endpoint Inspector
 * Examines the actual response structures to identify issues
 */

const axios = require('axios');

const config = {
    baseURL: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token-12345'
    }
};

async function inspectEndpoint(method, endpoint, data = null) {
    console.log(`\n=== Inspecting ${method} ${endpoint} ===`);

    try {
        const requestConfig = {
            method,
            url: `${config.baseURL}${endpoint}`,
            timeout: config.timeout,
            headers: config.headers
        };

        if (data) {
            requestConfig.data = data;
        }

        const response = await axios(requestConfig);

        console.log(`Status: ${response.status}`);
        console.log(`Headers:`, response.headers);
        console.log(`Response Data:`, JSON.stringify(response.data, null, 2));

        return response;
    } catch (error) {
        console.log(`Status: ${error.response?.status || 'No response'}`);
        console.log(`Error: ${error.message}`);
        if (error.response?.data) {
            console.log(`Error Response:`, JSON.stringify(error.response.data, null, 2));
        }
        return error.response;
    }
}

async function runInspection() {
    console.log('Starting detailed endpoint inspection...');

    // Inspect analytics endpoints
    await inspectEndpoint('GET', '/analytics/usage?period=30d');
    await inspectEndpoint('GET', '/analytics/usage?period=7d');
    await inspectEndpoint('GET', '/analytics/usage?period=1d');
    await inspectEndpoint('GET', '/analytics/usage'); // Without period parameter

    await inspectEndpoint('POST', '/analytics/events', {
        eventType: 'page_view',
        page: '/dashboard',
        userId: 'test-user-123',
        timestamp: new Date().toISOString()
    });

    // Inspect sessions endpoints
    await inspectEndpoint('GET', '/sessions');
    await inspectEndpoint('POST', '/sessions', {
        name: 'Test Session',
        description: 'Test session for API validation',
        status: 'active'
    });

    // Test authentication scenarios
    console.log('\n=== Testing Authentication Scenarios ===');

    // Valid token (already tested above)

    // Invalid token
    try {
        const invalidResponse = await axios({
            method: 'GET',
            url: `${config.baseURL}/analytics/usage`,
            timeout: config.timeout,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer invalid-token'
            }
        });
        console.log('Invalid token - Unexpected success:', invalidResponse.status, invalidResponse.data);
    } catch (error) {
        console.log('Invalid token - Expected failure:', error.response?.status, error.response?.data);
    }

    // No token
    try {
        const noTokenResponse = await axios({
            method: 'GET',
            url: `${config.baseURL}/analytics/usage`,
            timeout: config.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('No token - Unexpected success:', noTokenResponse.status, noTokenResponse.data);
    } catch (error) {
        console.log('No token - Expected failure:', error.response?.status, error.response?.data);
    }
}

if (require.main === module) {
    runInspection().catch(console.error);
}

module.exports = { inspectEndpoint, runInspection };