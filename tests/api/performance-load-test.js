/**
 * Performance and Load Testing for Dashboard API
 * Tests API performance under various load conditions
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

class PerformanceTest {
    constructor() {
        this.results = {
            concurrent: {},
            sequential: {},
            stress: {},
            summary: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                averageResponseTime: 0,
                maxResponseTime: 0,
                minResponseTime: Number.MAX_VALUE
            }
        };
    }

    async makeRequest(endpoint, method = 'GET', data = null) {
        const startTime = Date.now();
        try {
            const response = await axios({
                method,
                url: `${config.baseURL}${endpoint}`,
                data,
                headers: config.headers,
                timeout: config.timeout
            });

            const responseTime = Date.now() - startTime;
            this.updateStats(responseTime, true);

            return {
                success: true,
                status: response.status,
                responseTime,
                data: response.data
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.updateStats(responseTime, false);

            return {
                success: false,
                status: error.response?.status,
                responseTime,
                error: error.message
            };
        }
    }

    updateStats(responseTime, success) {
        this.results.summary.totalRequests++;
        if (success) {
            this.results.summary.successfulRequests++;
        } else {
            this.results.summary.failedRequests++;
        }

        this.results.summary.maxResponseTime = Math.max(this.results.summary.maxResponseTime, responseTime);
        this.results.summary.minResponseTime = Math.min(this.results.summary.minResponseTime, responseTime);
    }

    async testConcurrentRequests() {
        console.log('\n=== Testing Concurrent Requests ===');

        const endpoints = [
            '/analytics/usage?period=30d',
            '/analytics/usage?period=7d',
            '/analytics/usage?period=1d'
        ];

        // Test 5 concurrent requests
        const concurrency = 5;
        const requests = [];

        for (let i = 0; i < concurrency; i++) {
            const endpoint = endpoints[i % endpoints.length];
            requests.push(this.makeRequest(endpoint));
        }

        const startTime = Date.now();
        const results = await Promise.all(requests);
        const totalTime = Date.now() - startTime;

        const successful = results.filter(r => r.success).length;
        const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

        this.results.concurrent = {
            concurrency,
            totalTime,
            successful,
            failed: results.length - successful,
            averageResponseTime: avgResponseTime,
            maxResponseTime: Math.max(...results.map(r => r.responseTime)),
            minResponseTime: Math.min(...results.map(r => r.responseTime)),
            throughput: (results.length / totalTime) * 1000 // requests per second
        };

        console.log(`Concurrent requests: ${concurrency}`);
        console.log(`Total time: ${totalTime}ms`);
        console.log(`Successful: ${successful}/${results.length}`);
        console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`Throughput: ${this.results.concurrent.throughput.toFixed(2)} req/s`);
    }

    async testSequentialRequests() {
        console.log('\n=== Testing Sequential Requests ===');

        const endpoints = [
            '/analytics/usage?period=30d',
            '/analytics/usage?period=7d',
            '/analytics/usage?period=1d',
            '/analytics/events'
        ];

        const results = [];
        const startTime = Date.now();

        for (const endpoint of endpoints) {
            const method = endpoint.includes('events') ? 'POST' : 'GET';
            const data = method === 'POST' ? {
                eventType: 'page_view',
                page: '/dashboard',
                userId: 'test-user-123',
                timestamp: new Date().toISOString()
            } : null;

            const result = await this.makeRequest(endpoint, method, data);
            results.push(result);
        }

        const totalTime = Date.now() - startTime;
        const successful = results.filter(r => r.success).length;
        const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

        this.results.sequential = {
            totalRequests: results.length,
            totalTime,
            successful,
            failed: results.length - successful,
            averageResponseTime: avgResponseTime,
            maxResponseTime: Math.max(...results.map(r => r.responseTime)),
            minResponseTime: Math.min(...results.map(r => r.responseTime))
        };

        console.log(`Sequential requests: ${results.length}`);
        console.log(`Total time: ${totalTime}ms`);
        console.log(`Successful: ${successful}/${results.length}`);
        console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);
    }

    async testStressLoad() {
        console.log('\n=== Testing Stress Load ===');

        const requestCount = 20;
        const batchSize = 5;
        const batches = Math.ceil(requestCount / batchSize);

        const allResults = [];
        const startTime = Date.now();

        for (let batch = 0; batch < batches; batch++) {
            const batchRequests = [];

            for (let i = 0; i < batchSize && (batch * batchSize + i) < requestCount; i++) {
                batchRequests.push(this.makeRequest('/analytics/usage?period=30d'));
            }

            const batchResults = await Promise.all(batchRequests);
            allResults.push(...batchResults);

            // Small delay between batches to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const totalTime = Date.now() - startTime;
        const successful = allResults.filter(r => r.success).length;
        const failed = allResults.length - successful;
        const avgResponseTime = allResults.reduce((sum, r) => sum + r.responseTime, 0) / allResults.length;

        // Calculate percentiles
        const sortedTimes = allResults.map(r => r.responseTime).sort((a, b) => a - b);
        const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
        const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
        const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

        this.results.stress = {
            totalRequests: allResults.length,
            totalTime,
            successful,
            failed,
            averageResponseTime: avgResponseTime,
            maxResponseTime: Math.max(...allResults.map(r => r.responseTime)),
            minResponseTime: Math.min(...allResults.map(r => r.responseTime)),
            throughput: (allResults.length / totalTime) * 1000,
            percentiles: { p50, p95, p99 },
            errorRate: (failed / allResults.length) * 100
        };

        console.log(`Stress test requests: ${allResults.length}`);
        console.log(`Total time: ${totalTime}ms`);
        console.log(`Successful: ${successful}/${allResults.length}`);
        console.log(`Failed: ${failed} (${this.results.stress.errorRate.toFixed(2)}%)`);
        console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`P50: ${p50}ms, P95: ${p95}ms, P99: ${p99}ms`);
        console.log(`Throughput: ${this.results.stress.throughput.toFixed(2)} req/s`);
    }

    async testSessionOperations() {
        console.log('\n=== Testing Session Operations Performance ===');

        const sessionData = {
            name: 'Performance Test Session',
            description: 'Session created for performance testing',
            status: 'active'
        };

        // Test session creation performance
        const createResults = [];
        for (let i = 0; i < 5; i++) {
            const result = await this.makeRequest('/sessions', 'POST', {
                ...sessionData,
                name: `${sessionData.name} ${i + 1}`
            });
            createResults.push(result);
        }

        const avgCreateTime = createResults.reduce((sum, r) => sum + r.responseTime, 0) / createResults.length;
        const successful = createResults.filter(r => r.success).length;

        console.log(`Session creation tests: ${createResults.length}`);
        console.log(`Successful: ${successful}/${createResults.length}`);
        console.log(`Average creation time: ${avgCreateTime.toFixed(2)}ms`);

        // Test operations on created sessions
        const sessionIds = createResults
            .filter(r => r.success && r.data?.data?.id)
            .map(r => r.data.data.id);

        if (sessionIds.length > 0) {
            // Test reading sessions
            const readResults = [];
            for (const sessionId of sessionIds) {
                const result = await this.makeRequest(`/sessions/${sessionId}`);
                readResults.push(result);
            }

            const avgReadTime = readResults.reduce((sum, r) => sum + r.responseTime, 0) / readResults.length;
            console.log(`Average session read time: ${avgReadTime.toFixed(2)}ms`);

            // Clean up - delete created sessions
            for (const sessionId of sessionIds) {
                await this.makeRequest(`/sessions/${sessionId}`, 'DELETE');
            }
        }
    }

    calculateOverallStats() {
        if (this.results.summary.totalRequests > 0) {
            this.results.summary.averageResponseTime =
                (this.results.concurrent.averageResponseTime || 0) +
                (this.results.sequential.averageResponseTime || 0) +
                (this.results.stress.averageResponseTime || 0);

            this.results.summary.averageResponseTime /= 3; // Average of test types
        }
    }

    generateReport() {
        this.calculateOverallStats();

        console.log('\n=== Performance Test Report ===');
        console.log('Generated:', new Date().toISOString());
        console.log('\nOVERALL SUMMARY:');
        console.log(`Total Requests: ${this.results.summary.totalRequests}`);
        console.log(`Successful: ${this.results.summary.successfulRequests}`);
        console.log(`Failed: ${this.results.summary.failedRequests}`);
        console.log(`Success Rate: ${((this.results.summary.successfulRequests / this.results.summary.totalRequests) * 100).toFixed(2)}%`);
        console.log(`Response Time Range: ${this.results.summary.minResponseTime}ms - ${this.results.summary.maxResponseTime}ms`);

        console.log('\nPERFORMANCE ANALYSIS:');

        // Response time assessment
        const avgTime = this.results.stress?.averageResponseTime || this.results.sequential?.averageResponseTime || 0;
        if (avgTime < 200) {
            console.log('✅ Excellent response times (< 200ms average)');
        } else if (avgTime < 500) {
            console.log('✅ Good response times (< 500ms average)');
        } else if (avgTime < 1000) {
            console.log('⚠️  Acceptable response times (< 1s average)');
        } else {
            console.log('❌ Slow response times (> 1s average)');
        }

        // Throughput assessment
        const throughput = this.results.stress?.throughput || this.results.concurrent?.throughput || 0;
        if (throughput > 10) {
            console.log('✅ High throughput (> 10 req/s)');
        } else if (throughput > 5) {
            console.log('✅ Good throughput (> 5 req/s)');
        } else if (throughput > 1) {
            console.log('⚠️  Moderate throughput (> 1 req/s)');
        } else {
            console.log('❌ Low throughput (< 1 req/s)');
        }

        // Error rate assessment
        const errorRate = this.results.stress?.errorRate || 0;
        if (errorRate < 1) {
            console.log('✅ Excellent reliability (< 1% error rate)');
        } else if (errorRate < 5) {
            console.log('✅ Good reliability (< 5% error rate)');
        } else if (errorRate < 10) {
            console.log('⚠️  Acceptable reliability (< 10% error rate)');
        } else {
            console.log('❌ Poor reliability (> 10% error rate)');
        }

        console.log('\nRECOMMENDations:');
        if (avgTime > 500) {
            console.log('- Consider API caching for improved response times');
            console.log('- Monitor Lambda cold starts');
        }
        if (errorRate > 5) {
            console.log('- Investigate error causes and implement retry logic');
            console.log('- Check API Gateway and Lambda error logs');
        }
        if (throughput < 5) {
            console.log('- Consider increasing Lambda concurrency limits');
            console.log('- Implement connection pooling if using databases');
        }

        console.log('\nPERFORMANCE READINESS: ' +
            (avgTime < 500 && errorRate < 5 && throughput > 5 ? 'READY' : 'NEEDS_OPTIMIZATION'));

        return this.results;
    }
}

async function runPerformanceTests() {
    console.log('Starting performance and load tests...');

    const performanceTest = new PerformanceTest();

    try {
        await performanceTest.testSequentialRequests();
        await performanceTest.testConcurrentRequests();
        await performanceTest.testStressLoad();
        await performanceTest.testSessionOperations();

        const results = performanceTest.generateReport();

        // Save results
        const fs = require('fs');
        const reportPath = '/Users/jimmybrootcoorens/Library/Mobile Documents/com~apple~CloudDocs/JBIT /apps/ApexShare/tests/api/performance-test-results.json';
        fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
        console.log(`\nPerformance results saved to: ${reportPath}`);

        return results;

    } catch (error) {
        console.error('Performance test failed:', error);
        return { error: error.message };
    }
}

module.exports = { PerformanceTest, runPerformanceTests };

if (require.main === module) {
    runPerformanceTests().catch(console.error);
}