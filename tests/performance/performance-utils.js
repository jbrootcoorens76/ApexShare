/**
 * Artillery Performance Testing Utilities
 * Custom functions and processors for load testing
 */

const crypto = require('crypto');

// Sample file IDs for testing (these would be real IDs in actual testing)
const SAMPLE_FILE_IDS = [
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '12345678-90ab-cdef-1234-567890abcdef',
  '87654321-ba09-fedc-4321-098765432100',
  '11111111-2222-3333-4444-555555555555'
];

// Performance metrics collection
let performanceMetrics = {
  uploadRequests: 0,
  downloadRequests: 0,
  errorRequests: 0,
  responseTimes: [],
  errors: []
};

/**
 * Generate random file ID for testing
 */
function randomFileId(userContext, events, done) {
  const fileId = SAMPLE_FILE_IDS[Math.floor(Math.random() * SAMPLE_FILE_IDS.length)];
  userContext.vars.randomFileId = fileId;
  return done();
}

/**
 * Generate random string for unique identifiers
 */
function randomString(userContext, events, done) {
  const length = 8;
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  userContext.vars.randomString = result;
  return done();
}

/**
 * Generate random integer within range
 */
function randomInt(userContext, events, done) {
  const min = 1048576; // 1MB
  const max = 104857600; // 100MB
  const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;

  userContext.vars.randomInt = randomValue;
  return done();
}

/**
 * Get current timestamp
 */
function timestamp(userContext, events, done) {
  userContext.vars.timestamp = Date.now();
  return done();
}

/**
 * Log upload request metrics
 */
function logUploadMetrics(userContext, events, done) {
  performanceMetrics.uploadRequests++;

  const responseTime = userContext.vars.$responseTime;
  if (responseTime) {
    performanceMetrics.responseTimes.push({
      endpoint: 'upload',
      time: responseTime,
      timestamp: Date.now()
    });
  }

  console.log(`Upload request completed - Response time: ${responseTime}ms`);
  return done();
}

/**
 * Log download request metrics
 */
function logDownloadMetrics(userContext, events, done) {
  performanceMetrics.downloadRequests++;

  const responseTime = userContext.vars.$responseTime;
  if (responseTime) {
    performanceMetrics.responseTimes.push({
      endpoint: 'download',
      time: responseTime,
      timestamp: Date.now()
    });
  }

  console.log(`Download request completed - Response time: ${responseTime}ms`);
  return done();
}

/**
 * Log error request metrics
 */
function logErrorMetrics(userContext, events, done) {
  performanceMetrics.errorRequests++;

  const responseTime = userContext.vars.$responseTime;
  const statusCode = userContext.vars.$statusCode;

  if (responseTime) {
    performanceMetrics.responseTimes.push({
      endpoint: 'error',
      time: responseTime,
      timestamp: Date.now(),
      statusCode: statusCode
    });
  }

  console.log(`Error request completed - Status: ${statusCode}, Response time: ${responseTime}ms`);
  return done();
}

/**
 * Custom request processor to add authentication or headers
 */
function addCustomHeaders(requestParams, userContext, events, done) {
  // Add custom headers for load testing identification
  requestParams.headers = requestParams.headers || {};
  requestParams.headers['X-Load-Test'] = 'artillery';
  requestParams.headers['X-Test-Session'] = userContext.vars.testSessionId || 'default';

  return done();
}

/**
 * Validate response data
 */
function validateResponse(requestParams, response, userContext, events, done) {
  const statusCode = response.statusCode;
  const responseTime = Date.now() - userContext.vars.requestStartTime;

  // Log slow responses
  if (responseTime > 5000) {
    console.warn(`Slow response detected: ${responseTime}ms for ${requestParams.url}`);
    performanceMetrics.errors.push({
      type: 'slow_response',
      url: requestParams.url,
      responseTime: responseTime,
      timestamp: Date.now()
    });
  }

  // Log error responses
  if (statusCode >= 500) {
    console.error(`Server error: ${statusCode} for ${requestParams.url}`);
    performanceMetrics.errors.push({
      type: 'server_error',
      url: requestParams.url,
      statusCode: statusCode,
      timestamp: Date.now()
    });
  }

  userContext.vars.$responseTime = responseTime;
  userContext.vars.$statusCode = statusCode;

  return done();
}

/**
 * Setup function called before test execution
 */
function setupTest(userContext, events, done) {
  // Initialize test session
  userContext.vars.testSessionId = crypto.randomUUID();
  userContext.vars.testStartTime = Date.now();

  console.log(`Starting test session: ${userContext.vars.testSessionId}`);
  return done();
}

/**
 * Teardown function called after test execution
 */
function teardownTest(userContext, events, done) {
  const testDuration = Date.now() - userContext.vars.testStartTime;
  console.log(`Test session ${userContext.vars.testSessionId} completed in ${testDuration}ms`);
  return done();
}

/**
 * Generate performance report
 */
function generateReport() {
  const totalRequests = performanceMetrics.uploadRequests +
                       performanceMetrics.downloadRequests +
                       performanceMetrics.errorRequests;

  const avgResponseTime = performanceMetrics.responseTimes.length > 0
    ? performanceMetrics.responseTimes.reduce((sum, rt) => sum + rt.time, 0) / performanceMetrics.responseTimes.length
    : 0;

  const errorRate = totalRequests > 0
    ? (performanceMetrics.errors.length / totalRequests) * 100
    : 0;

  const report = {
    summary: {
      totalRequests: totalRequests,
      uploadRequests: performanceMetrics.uploadRequests,
      downloadRequests: performanceMetrics.downloadRequests,
      errorRequests: performanceMetrics.errorRequests,
      averageResponseTime: Math.round(avgResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      totalErrors: performanceMetrics.errors.length
    },
    responseTimes: {
      p50: calculatePercentile(performanceMetrics.responseTimes.map(rt => rt.time), 50),
      p95: calculatePercentile(performanceMetrics.responseTimes.map(rt => rt.time), 95),
      p99: calculatePercentile(performanceMetrics.responseTimes.map(rt => rt.time), 99),
      max: Math.max(...performanceMetrics.responseTimes.map(rt => rt.time))
    },
    errors: performanceMetrics.errors,
    recommendations: generateRecommendations(avgResponseTime, errorRate)
  };

  return report;
}

/**
 * Calculate percentile from array of values
 */
function calculatePercentile(values, percentile) {
  if (values.length === 0) return 0;

  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

/**
 * Generate performance recommendations
 */
function generateRecommendations(avgResponseTime, errorRate) {
  const recommendations = [];

  if (avgResponseTime > 3000) {
    recommendations.push('Average response time exceeds 3 seconds - consider optimizing Lambda cold starts');
  }

  if (avgResponseTime > 1000) {
    recommendations.push('Response times could be improved - review database query performance');
  }

  if (errorRate > 5) {
    recommendations.push('Error rate is high - investigate server-side issues');
  }

  if (errorRate > 1) {
    recommendations.push('Consider implementing better error handling and retry mechanisms');
  }

  if (recommendations.length === 0) {
    recommendations.push('Performance looks good! Consider running extended load tests');
  }

  return recommendations;
}

/**
 * Hook for Artillery to call after test completion
 */
function afterResponse(requestParams, response, userContext, ee, next) {
  validateResponse(requestParams, response, userContext, {}, next);
}

/**
 * Hook for Artillery to call before each request
 */
function beforeRequest(requestParams, userContext, ee, next) {
  userContext.vars.requestStartTime = Date.now();
  addCustomHeaders(requestParams, userContext, {}, next);
}

// Export all functions for Artillery
module.exports = {
  randomFileId,
  randomString,
  randomInt,
  timestamp,
  logUploadMetrics,
  logDownloadMetrics,
  logErrorMetrics,
  addCustomHeaders,
  validateResponse,
  setupTest,
  teardownTest,
  generateReport,
  afterResponse,
  beforeRequest,

  // Template functions for Artillery variables
  $randomFileId: () => SAMPLE_FILE_IDS[Math.floor(Math.random() * SAMPLE_FILE_IDS.length)],
  $randomString: () => crypto.randomBytes(4).toString('hex'),
  $randomInt: (min = 1048576, max = 104857600) => Math.floor(Math.random() * (max - min + 1)) + min,
  $timestamp: () => Date.now()
};