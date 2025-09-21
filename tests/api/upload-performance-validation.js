/**
 * Upload Performance Validation Test
 *
 * Tests upload workflow performance and concurrent handling
 * to ensure the fixes don't impact performance negatively.
 */

const axios = require('axios');

const config = {
  baseURL: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
  timeout: 30000,
  concurrentRequests: 5,
  testDuration: 30000 // 30 seconds
};

class UploadPerformanceValidator {
  constructor() {
    this.results = {
      requests: [],
      errors: [],
      statistics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        minResponseTime: Number.MAX_VALUE,
        maxResponseTime: 0,
        requestsPerSecond: 0
      }
    };
    this.startTime = Date.now();
  }

  async runPerformanceTest() {
    console.log('⚡ Upload Performance Validation Test');
    console.log('='.repeat(50));
    console.log(`Testing ${config.concurrentRequests} concurrent requests`);
    console.log(`Base URL: ${config.baseURL}`);

    // Test 1: Single request baseline
    await this.testSingleRequestBaseline();

    // Test 2: Concurrent requests
    await this.testConcurrentRequests();

    // Test 3: Load simulation
    await this.testLoadSimulation();

    // Generate performance report
    this.generatePerformanceReport();
  }

  async testSingleRequestBaseline() {
    console.log('\n📊 Single Request Baseline');
    console.log('-'.repeat(30));

    const startTime = Date.now();

    try {
      const requestBody = {
        studentEmail: 'performance-baseline@example.com',
        sessionDate: '2024-09-21',
        fileName: 'baseline-test.mp4',
        fileSize: 10485760, // 10MB
        contentType: 'video/mp4'
      };

      const response = await axios.post(
        `${config.baseURL}/uploads/initiate`,
        requestBody,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: config.timeout
        }
      );

      const duration = Date.now() - startTime;

      console.log(`✅ Baseline request: ${duration}ms`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Success: ${response.data.success}`);

      // Verify no performance issues in response
      const responseString = JSON.stringify(response.data);
      if (responseString.includes('NaN') || responseString.includes('undefined')) {
        console.log('❌ Performance baseline: Response format issues detected');
      } else {
        console.log('✅ Performance baseline: Clean response format');
      }

      this.results.requests.push({
        type: 'baseline',
        duration,
        success: response.status === 200 && response.data.success,
        timestamp: Date.now()
      });

    } catch (error) {
      console.log(`❌ Baseline request failed: ${error.message}`);
      this.results.errors.push({
        type: 'baseline',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  async testConcurrentRequests() {
    console.log('\n🔥 Concurrent Requests Test');
    console.log('-'.repeat(30));

    const promises = [];

    for (let i = 0; i < config.concurrentRequests; i++) {
      const requestBody = {
        studentEmail: `concurrent-${i}@example.com`,
        sessionDate: '2024-09-21',
        fileName: `concurrent-${i}.mp4`,
        fileSize: 5242880, // 5MB
        contentType: 'video/mp4'
      };

      const startTime = Date.now();

      const promise = axios.post(
        `${config.baseURL}/uploads/initiate`,
        requestBody,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: config.timeout
        }
      ).then(response => {
        const duration = Date.now() - startTime;
        return {
          type: 'concurrent',
          requestId: i,
          duration,
          success: response.status === 200 && response.data.success,
          status: response.status,
          data: response.data,
          timestamp: Date.now()
        };
      }).catch(error => {
        const duration = Date.now() - startTime;
        return {
          type: 'concurrent',
          requestId: i,
          duration,
          success: false,
          error: error.message,
          timestamp: Date.now()
        };
      });

      promises.push(promise);
    }

    console.log(`Executing ${config.concurrentRequests} concurrent requests...`);

    const results = await Promise.all(promises);

    console.log('\nConcurrent Request Results:');
    results.forEach(result => {
      if (result.success) {
        console.log(`  ✅ Request ${result.requestId}: ${result.duration}ms`);

        // Check for formatting issues in concurrent responses
        if (result.data) {
          const responseString = JSON.stringify(result.data);
          if (responseString.includes('NaN') || responseString.includes('undefined')) {
            console.log(`     ⚠️  Response format issues detected`);
          }
        }
      } else {
        console.log(`  ❌ Request ${result.requestId}: ${result.error || 'Failed'}`);
      }
    });

    this.results.requests.push(...results);

    // Calculate concurrent performance metrics
    const successfulRequests = results.filter(r => r.success);
    const avgConcurrentTime = successfulRequests.reduce((sum, r) => sum + r.duration, 0) / successfulRequests.length;

    console.log(`\nConcurrent Performance:`);
    console.log(`  Success rate: ${successfulRequests.length}/${results.length}`);
    console.log(`  Average time: ${avgConcurrentTime.toFixed(2)}ms`);
  }

  async testLoadSimulation() {
    console.log('\n⚡ Load Simulation Test');
    console.log('-'.repeat(25));

    const endTime = Date.now() + 15000; // 15 seconds of load testing
    let requestCounter = 0;

    console.log('Running load simulation for 15 seconds...');

    while (Date.now() < endTime) {
      const batchPromises = [];

      // Send a batch of 3 requests
      for (let i = 0; i < 3; i++) {
        const requestBody = {
          studentEmail: `load-test-${requestCounter}-${i}@example.com`,
          sessionDate: '2024-09-21',
          fileName: `load-test-${requestCounter}-${i}.mp4`,
          fileSize: 2097152, // 2MB for faster testing
          contentType: 'video/mp4'
        };

        const startTime = Date.now();

        const promise = axios.post(
          `${config.baseURL}/uploads/initiate`,
          requestBody,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000 // Shorter timeout for load test
          }
        ).then(response => {
          const duration = Date.now() - startTime;
          return {
            type: 'load',
            requestId: `${requestCounter}-${i}`,
            duration,
            success: response.status === 200 && response.data.success,
            timestamp: Date.now()
          };
        }).catch(error => {
          const duration = Date.now() - startTime;
          return {
            type: 'load',
            requestId: `${requestCounter}-${i}`,
            duration,
            success: false,
            error: error.message,
            timestamp: Date.now()
          };
        });

        batchPromises.push(promise);
      }

      try {
        const batchResults = await Promise.all(batchPromises);
        this.results.requests.push(...batchResults);

        const successCount = batchResults.filter(r => r.success).length;
        process.stdout.write(`\r  Batch ${requestCounter}: ${successCount}/3 successful`);

        requestCounter++;

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.log(`\nBatch ${requestCounter} error:`, error.message);
      }
    }

    console.log(`\n✅ Load simulation completed: ${requestCounter} batches processed`);
  }

  generatePerformanceReport() {
    console.log('\n📊 Performance Validation Report');
    console.log('='.repeat(50));

    // Calculate statistics
    const allRequests = this.results.requests;
    const successfulRequests = allRequests.filter(r => r.success);
    const failedRequests = allRequests.filter(r => !r.success);

    this.results.statistics.totalRequests = allRequests.length;
    this.results.statistics.successfulRequests = successfulRequests.length;
    this.results.statistics.failedRequests = failedRequests.length;

    if (successfulRequests.length > 0) {
      const durations = successfulRequests.map(r => r.duration);
      this.results.statistics.averageResponseTime = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      this.results.statistics.minResponseTime = Math.min(...durations);
      this.results.statistics.maxResponseTime = Math.max(...durations);
    }

    const testDuration = Date.now() - this.startTime;
    this.results.statistics.requestsPerSecond = (this.results.statistics.totalRequests / testDuration) * 1000;

    // Display results
    console.log(`\n⏱️  Test Duration: ${testDuration}ms`);
    console.log(`📈 Total Requests: ${this.results.statistics.totalRequests}`);
    console.log(`✅ Successful: ${this.results.statistics.successfulRequests}`);
    console.log(`❌ Failed: ${this.results.statistics.failedRequests}`);
    console.log(`📊 Success Rate: ${((this.results.statistics.successfulRequests / this.results.statistics.totalRequests) * 100).toFixed(2)}%`);

    if (successfulRequests.length > 0) {
      console.log(`⚡ Average Response Time: ${this.results.statistics.averageResponseTime.toFixed(2)}ms`);
      console.log(`⚡ Min Response Time: ${this.results.statistics.minResponseTime}ms`);
      console.log(`⚡ Max Response Time: ${this.results.statistics.maxResponseTime}ms`);
    }

    console.log(`🔥 Requests/Second: ${this.results.statistics.requestsPerSecond.toFixed(2)}`);

    // Performance assessment
    console.log('\n🎯 Performance Assessment:');

    if (this.results.statistics.successfulRequests > 0) {
      if (this.results.statistics.averageResponseTime < 1000) {
        console.log('✅ Response times are good (< 1s average)');
      } else if (this.results.statistics.averageResponseTime < 3000) {
        console.log('⚠️  Response times are acceptable (1-3s average)');
      } else {
        console.log('❌ Response times are concerning (> 3s average)');
      }

      const successRate = (this.results.statistics.successfulRequests / this.results.statistics.totalRequests) * 100;
      if (successRate >= 95) {
        console.log('✅ Excellent success rate (>= 95%)');
      } else if (successRate >= 90) {
        console.log('⚠️  Good success rate (90-95%)');
      } else {
        console.log('❌ Poor success rate (< 90%)');
      }

      if (this.results.statistics.requestsPerSecond > 2) {
        console.log('✅ Good throughput (> 2 req/s)');
      } else if (this.results.statistics.requestsPerSecond > 1) {
        console.log('⚠️  Acceptable throughput (1-2 req/s)');
      } else {
        console.log('❌ Low throughput (< 1 req/s)');
      }
    }

    // Error analysis
    if (this.results.errors.length > 0) {
      console.log('\n❌ Error Analysis:');
      const errorCounts = {};
      this.results.errors.forEach(error => {
        errorCounts[error.error] = (errorCounts[error.error] || 0) + 1;
      });

      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`  • ${error}: ${count} occurrences`);
      });
    }

    // Final assessment
    console.log('\n🏁 Final Performance Assessment:');

    const successRate = (this.results.statistics.successfulRequests / this.results.statistics.totalRequests) * 100;
    const avgResponseTime = this.results.statistics.averageResponseTime;

    if (successRate >= 90 && avgResponseTime < 2000 && this.results.statistics.totalRequests > 10) {
      console.log('✅ PERFORMANCE VALIDATION: PASSED');
      console.log('   - Upload workflow performs well under load');
      console.log('   - No significant performance degradation detected');
      console.log('   - System ready for production use');
    } else if (successRate >= 80 && avgResponseTime < 5000) {
      console.log('⚠️  PERFORMANCE VALIDATION: ACCEPTABLE');
      console.log('   - Upload workflow functional but may need optimization');
      console.log('   - Monitor performance in production');
    } else {
      console.log('❌ PERFORMANCE VALIDATION: NEEDS ATTENTION');
      console.log('   - Performance issues detected');
      console.log('   - Investigation and optimization required');
    }

    console.log('\n' + '='.repeat(50));

    return this.results;
  }
}

// Export for use in other test suites
module.exports = UploadPerformanceValidator;

// Run tests if this file is executed directly
if (require.main === module) {
  const performanceTest = new UploadPerformanceValidator();
  performanceTest.runPerformanceTest()
    .then(() => {
      const successRate = (performanceTest.results.statistics.successfulRequests / performanceTest.results.statistics.totalRequests) * 100;
      process.exit(successRate >= 80 ? 0 : 1);
    })
    .catch((error) => {
      console.error('Performance test failed:', error);
      process.exit(1);
    });
}