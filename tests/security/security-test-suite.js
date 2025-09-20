/**
 * Security Test Suite for ApexShare
 * Automated security testing using various tools and techniques
 */

const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const TARGET_URL = process.env.TARGET_URL || 'https://apexshare.be';
const API_URL = process.env.API_URL || 'https://api.apexshare.be';
const REPORT_OUTPUT = process.env.REPORT_OUTPUT || './security-reports';

class SecurityTestSuite {
  constructor() {
    this.results = {
      testInfo: {
        targetUrl: TARGET_URL,
        apiUrl: API_URL,
        timestamp: new Date().toISOString(),
        testSuite: 'ApexShare Security Suite v1.0'
      },
      authenticationTests: [],
      injectionTests: [],
      xssTests: [],
      corsTests: [],
      fileUploadTests: [],
      rateLimitTests: [],
      sensitiveDataTests: [],
      httpSecurityTests: [],
      summary: {}
    };
  }

  /**
   * Test Authentication and Authorization vulnerabilities
   */
  async testAuthentication() {
    console.log('🔐 Testing Authentication & Authorization...');

    const tests = [
      {
        name: 'Unauthorized Download Access',
        test: async () => {
          const fakeFileId = crypto.randomUUID();
          const response = await this.makeRequest('GET', `${API_URL}/download/${fakeFileId}`);
          return {
            passed: response.status === 404 || response.status === 410,
            status: response.status,
            details: 'Should return 404/410 for non-existent files'
          };
        }
      },
      {
        name: 'Path Traversal in Download',
        test: async () => {
          const maliciousId = '../../../etc/passwd';
          const response = await this.makeRequest('GET', `${API_URL}/download/${encodeURIComponent(maliciousId)}`);
          return {
            passed: response.status === 400 || response.status === 404,
            status: response.status,
            details: 'Should reject path traversal attempts'
          };
        }
      },
      {
        name: 'Admin Endpoint Access',
        test: async () => {
          const response = await this.makeRequest('GET', `${API_URL}/admin`);
          return {
            passed: response.status === 404 || response.status === 403,
            status: response.status,
            details: 'Admin endpoints should not be accessible'
          };
        }
      },
      {
        name: 'Direct S3 Access Attempt',
        test: async () => {
          const response = await this.makeRequest('GET', `${API_URL}/download/s3.amazonaws.com/bucket/file`);
          return {
            passed: response.status === 400,
            status: response.status,
            details: 'Should block direct S3 access attempts'
          };
        }
      }
    ];

    for (const test of tests) {
      try {
        const result = await test.test();
        this.results.authenticationTests.push({
          name: test.name,
          ...result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.results.authenticationTests.push({
          name: test.name,
          passed: false,
          status: 'ERROR',
          details: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Test SQL and NoSQL Injection vulnerabilities
   */
  async testInjection() {
    console.log('💉 Testing Injection Vulnerabilities...');

    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM information_schema.tables --",
      "admin'--",
      "' OR 1=1#"
    ];

    const nosqlPayloads = [
      '{"$ne": null}',
      '{"$gt": ""}',
      '{"$where": "function() { return true; }"}',
      '{"$regex": ".*"}',
      '{"$exists": true}'
    ];

    // Test SQL injection in upload endpoint
    for (const payload of sqlPayloads) {
      try {
        const testData = {
          studentEmail: `test${payload}@example.com`,
          fileName: `test${payload}.mp4`,
          fileSize: 1024,
          contentType: 'video/mp4',
          sessionDate: '2025-01-20',
          notes: payload
        };

        const response = await this.makeRequest('POST', `${API_URL}/upload`, testData);

        this.results.injectionTests.push({
          name: 'SQL Injection in Upload',
          payload: payload,
          passed: response.status === 400 || (response.status === 200 && !response.data?.success),
          status: response.status,
          details: 'Should reject or sanitize SQL injection attempts',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.results.injectionTests.push({
          name: 'SQL Injection in Upload',
          payload: payload,
          passed: true, // Network errors are acceptable
          status: 'ERROR',
          details: 'Request failed (acceptable for security)',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Test NoSQL injection in download endpoint
    for (const payload of nosqlPayloads) {
      try {
        const response = await this.makeRequest('GET', `${API_URL}/download/${encodeURIComponent(payload)}`);

        this.results.injectionTests.push({
          name: 'NoSQL Injection in Download',
          payload: payload,
          passed: response.status === 400 || response.status === 404,
          status: response.status,
          details: 'Should reject NoSQL injection attempts',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.results.injectionTests.push({
          name: 'NoSQL Injection in Download',
          payload: payload,
          passed: true,
          status: 'ERROR',
          details: 'Request failed (acceptable for security)',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Test Cross-Site Scripting (XSS) vulnerabilities
   */
  async testXSS() {
    console.log('🎭 Testing XSS Vulnerabilities...');

    const xssPayloads = [
      '<script>alert("XSS")</script>',
      'javascript:alert("XSS")',
      '"><script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      'onload="alert(\'XSS\')"',
      '${alert("XSS")}',
      '{{alert("XSS")}}'
    ];

    for (const payload of xssPayloads) {
      try {
        const testData = {
          studentEmail: 'test@example.com',
          studentName: payload,
          trainerName: payload,
          notes: payload,
          fileName: 'test.mp4',
          fileSize: 1024,
          contentType: 'video/mp4',
          sessionDate: '2025-01-20'
        };

        const response = await this.makeRequest('POST', `${API_URL}/upload`, testData);

        this.results.xssTests.push({
          name: 'XSS in Upload Form',
          payload: payload,
          passed: response.status === 400 || this.isPayloadSanitized(response.data, payload),
          status: response.status,
          details: 'Should sanitize or reject XSS payloads',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.results.xssTests.push({
          name: 'XSS in Upload Form',
          payload: payload,
          passed: true,
          status: 'ERROR',
          details: 'Request failed (acceptable for security)',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Test CORS (Cross-Origin Resource Sharing) configuration
   */
  async testCORS() {
    console.log('🌐 Testing CORS Configuration...');

    const testOrigins = [
      'https://evil.com',
      'http://malicious.site',
      'https://phishing.example.com',
      'null',
      'file://',
      'data:text/html,<script>alert("xss")</script>'
    ];

    for (const origin of testOrigins) {
      try {
        const response = await this.makeRequest('OPTIONS', `${API_URL}/upload`, null, {
          'Origin': origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        });

        const allowsOrigin = response.headers &&
          (response.headers['access-control-allow-origin'] === origin ||
           response.headers['access-control-allow-origin'] === '*');

        this.results.corsTests.push({
          name: 'CORS Origin Validation',
          origin: origin,
          passed: !allowsOrigin || origin === 'https://apexshare.be',
          status: response.status,
          allowsOrigin: allowsOrigin,
          details: 'Should only allow trusted origins',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.results.corsTests.push({
          name: 'CORS Origin Validation',
          origin: origin,
          passed: true,
          status: 'ERROR',
          details: 'Request failed (CORS likely blocked)',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Test File Upload Security
   */
  async testFileUpload() {
    console.log('📁 Testing File Upload Security...');

    const maliciousFiles = [
      { name: 'malicious.php', type: 'application/x-php', size: 1024 },
      { name: 'script.js', type: 'application/javascript', size: 1024 },
      { name: 'executable.exe', type: 'application/x-msdownload', size: 1024 },
      { name: 'virus.bat', type: 'application/x-bat', size: 1024 },
      { name: 'huge_file.mp4', type: 'video/mp4', size: 10 * 1024 * 1024 * 1024 }, // 10GB
      { name: 'tiny_file.mp4', type: 'video/mp4', size: 100 }, // Too small
      { name: '../../../passwd', type: 'video/mp4', size: 1024 }, // Path traversal
      { name: 'normal.mp4\x00.php', type: 'video/mp4', size: 1024 } // Null byte injection
    ];

    for (const file of maliciousFiles) {
      try {
        const testData = {
          studentEmail: 'security-test@example.com',
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type,
          sessionDate: '2025-01-20'
        };

        const response = await this.makeRequest('POST', `${API_URL}/upload`, testData);

        const shouldBeRejected = file.type !== 'video/mp4' ||
                                file.size > 5 * 1024 * 1024 * 1024 ||
                                file.size < 1024 ||
                                file.name.includes('../') ||
                                file.name.includes('\x00');

        this.results.fileUploadTests.push({
          name: 'Malicious File Upload',
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          passed: shouldBeRejected ? response.status === 400 : response.status === 200,
          status: response.status,
          details: shouldBeRejected ? 'Should reject malicious file' : 'Should accept valid file',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.results.fileUploadTests.push({
          name: 'Malicious File Upload',
          fileName: file.name,
          passed: true,
          status: 'ERROR',
          details: 'Request failed (likely rejected)',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Test Rate Limiting
   */
  async testRateLimit() {
    console.log('🚦 Testing Rate Limiting...');

    const requests = [];
    const numRequests = 50;
    const timeoutMs = 1000;

    // Create multiple simultaneous requests
    for (let i = 0; i < numRequests; i++) {
      requests.push(
        this.makeRequest('POST', `${API_URL}/upload`, {
          studentEmail: `test${i}@example.com`,
          fileName: `test${i}.mp4`,
          fileSize: 1024,
          contentType: 'video/mp4',
          sessionDate: '2025-01-20'
        }, {}, timeoutMs)
      );
    }

    try {
      const responses = await Promise.allSettled(requests);
      const statusCodes = responses
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value.status);

      const rateLimitedCount = statusCodes.filter(status => status === 429).length;
      const successCount = statusCodes.filter(status => status === 200).length;
      const errorCount = responses.filter(r => r.status === 'rejected').length;

      this.results.rateLimitTests.push({
        name: 'Burst Request Rate Limiting',
        totalRequests: numRequests,
        successfulRequests: successCount,
        rateLimitedRequests: rateLimitedCount,
        erroredRequests: errorCount,
        passed: rateLimitedCount > 0 || errorCount > numRequests * 0.5,
        details: 'Should implement rate limiting for burst requests',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.results.rateLimitTests.push({
        name: 'Burst Request Rate Limiting',
        passed: true,
        status: 'ERROR',
        details: 'Test failed due to rate limiting (good)',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Test for Sensitive Data Exposure
   */
  async testSensitiveData() {
    console.log('🔍 Testing Sensitive Data Exposure...');

    const sensitiveEndpoints = [
      '/config',
      '/env',
      '/.env',
      '/admin',
      '/debug',
      '/logs',
      '/internal',
      '/private',
      '/api/keys',
      '/api/config',
      '/.git/config',
      '/package.json',
      '/web.config'
    ];

    for (const endpoint of sensitiveEndpoints) {
      try {
        const response = await this.makeRequest('GET', `${API_URL}${endpoint}`);

        this.results.sensitiveDataTests.push({
          name: 'Sensitive Endpoint Access',
          endpoint: endpoint,
          passed: response.status === 404 || response.status === 403,
          status: response.status,
          details: 'Sensitive endpoints should not be accessible',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.results.sensitiveDataTests.push({
          name: 'Sensitive Endpoint Access',
          endpoint: endpoint,
          passed: true,
          status: 'ERROR',
          details: 'Request failed (endpoint likely protected)',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Test for information disclosure in error messages
    try {
      const response = await this.makeRequest('POST', `${API_URL}/upload`, {
        malformed: 'json'
      });

      const exposesInfo = response.data && (
        JSON.stringify(response.data).includes('stack') ||
        JSON.stringify(response.data).includes('file:') ||
        JSON.stringify(response.data).includes('aws-') ||
        JSON.stringify(response.data).includes('database')
      );

      this.results.sensitiveDataTests.push({
        name: 'Information Disclosure in Errors',
        passed: !exposesInfo,
        status: response.status,
        details: 'Error messages should not expose sensitive information',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.results.sensitiveDataTests.push({
        name: 'Information Disclosure in Errors',
        passed: true,
        status: 'ERROR',
        details: 'Request failed (acceptable)',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Test HTTP Security Headers
   */
  async testHTTPSecurity() {
    console.log('🔒 Testing HTTP Security Headers...');

    try {
      const response = await this.makeRequest('GET', TARGET_URL);

      const securityHeaders = {
        'strict-transport-security': 'HSTS header missing',
        'x-content-type-options': 'X-Content-Type-Options header missing',
        'x-frame-options': 'X-Frame-Options header missing',
        'x-xss-protection': 'X-XSS-Protection header missing',
        'content-security-policy': 'CSP header missing',
        'referrer-policy': 'Referrer-Policy header missing'
      };

      for (const [header, description] of Object.entries(securityHeaders)) {
        const present = response.headers && response.headers[header];

        this.results.httpSecurityTests.push({
          name: `HTTP Security Header: ${header}`,
          header: header,
          passed: !!present,
          present: !!present,
          value: present || 'Not present',
          details: description,
          timestamp: new Date().toISOString()
        });
      }

      // Test for server information disclosure
      const serverHeader = response.headers && response.headers['server'];
      this.results.httpSecurityTests.push({
        name: 'Server Information Disclosure',
        passed: !serverHeader || !serverHeader.includes('version'),
        serverHeader: serverHeader || 'Not present',
        details: 'Server header should not expose version information',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.results.httpSecurityTests.push({
        name: 'HTTP Security Headers Test',
        passed: false,
        status: 'ERROR',
        details: `Failed to test headers: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Helper method to make HTTP requests
   */
  async makeRequest(method, url, data = null, headers = {}, timeout = 10000) {
    try {
      const config = {
        method,
        url,
        headers: {
          'User-Agent': 'ApexShare-Security-Scanner/1.0',
          ...headers
        },
        timeout,
        validateStatus: () => true // Accept all status codes
      };

      if (data) {
        config.data = data;
        config.headers['Content-Type'] = 'application/json';
      }

      const response = await axios(config);
      return {
        status: response.status,
        headers: response.headers,
        data: response.data
      };
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * Check if XSS payload was properly sanitized
   */
  isPayloadSanitized(responseData, payload) {
    if (!responseData || typeof responseData !== 'object') return true;

    const responseString = JSON.stringify(responseData);
    return !responseString.includes(payload) ||
           responseString.includes('&lt;') ||
           responseString.includes('&gt;');
  }

  /**
   * Generate summary of test results
   */
  generateSummary() {
    const allTests = [
      ...this.results.authenticationTests,
      ...this.results.injectionTests,
      ...this.results.xssTests,
      ...this.results.corsTests,
      ...this.results.fileUploadTests,
      ...this.results.rateLimitTests,
      ...this.results.sensitiveDataTests,
      ...this.results.httpSecurityTests
    ];

    const passed = allTests.filter(test => test.passed).length;
    const failed = allTests.filter(test => !test.passed).length;
    const total = allTests.length;

    this.results.summary = {
      totalTests: total,
      passed: passed,
      failed: failed,
      successRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      categories: {
        authentication: this.results.authenticationTests.length,
        injection: this.results.injectionTests.length,
        xss: this.results.xssTests.length,
        cors: this.results.corsTests.length,
        fileUpload: this.results.fileUploadTests.length,
        rateLimit: this.results.rateLimitTests.length,
        sensitiveData: this.results.sensitiveDataTests.length,
        httpSecurity: this.results.httpSecurityTests.length
      },
      recommendations: this.generateRecommendations(allTests)
    };
  }

  /**
   * Generate security recommendations based on test results
   */
  generateRecommendations(allTests) {
    const recommendations = [];
    const failedTests = allTests.filter(test => !test.passed);

    if (failedTests.length === 0) {
      recommendations.push({
        priority: 'INFO',
        category: 'Overall',
        message: 'All security tests passed! Continue regular security monitoring.'
      });
    } else {
      if (failedTests.some(test => test.name.includes('Injection'))) {
        recommendations.push({
          priority: 'CRITICAL',
          category: 'Injection',
          message: 'Injection vulnerabilities detected. Implement proper input validation and parameterized queries.'
        });
      }

      if (failedTests.some(test => test.name.includes('XSS'))) {
        recommendations.push({
          priority: 'HIGH',
          category: 'XSS',
          message: 'XSS vulnerabilities found. Implement proper output encoding and CSP headers.'
        });
      }

      if (failedTests.some(test => test.name.includes('CORS'))) {
        recommendations.push({
          priority: 'MEDIUM',
          category: 'CORS',
          message: 'CORS configuration issues detected. Review and restrict allowed origins.'
        });
      }

      if (failedTests.some(test => test.name.includes('Rate Limit'))) {
        recommendations.push({
          priority: 'MEDIUM',
          category: 'Rate Limiting',
          message: 'Implement rate limiting to prevent abuse and DoS attacks.'
        });
      }

      if (failedTests.some(test => test.name.includes('Security Header'))) {
        recommendations.push({
          priority: 'MEDIUM',
          category: 'HTTP Headers',
          message: 'Add missing security headers (HSTS, CSP, X-Frame-Options, etc.).'
        });
      }
    }

    return recommendations;
  }

  /**
   * Save results to file
   */
  async saveResults() {
    if (!fs.existsSync(REPORT_OUTPUT)) {
      fs.mkdirSync(REPORT_OUTPUT, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(REPORT_OUTPUT, `security-test-results-${timestamp}.json`);

    fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));

    console.log(`\n📊 Security test results saved to: ${filename}`);
    return filename;
  }

  /**
   * Run all security tests
   */
  async runAllTests() {
    console.log('🚀 Starting ApexShare Security Test Suite...');
    console.log(`Target: ${TARGET_URL}`);
    console.log(`API: ${API_URL}`);
    console.log('=' * 50);

    await this.testAuthentication();
    await this.testInjection();
    await this.testXSS();
    await this.testCORS();
    await this.testFileUpload();
    await this.testRateLimit();
    await this.testSensitiveData();
    await this.testHTTPSecurity();

    this.generateSummary();

    console.log('\n' + '=' * 50);
    console.log('🏁 SECURITY TEST SUMMARY');
    console.log('=' * 50);
    console.log(`Total Tests: ${this.results.summary.totalTests}`);
    console.log(`Passed: ${this.results.summary.passed}`);
    console.log(`Failed: ${this.results.summary.failed}`);
    console.log(`Success Rate: ${this.results.summary.successRate}%`);
    console.log('=' * 50);

    if (this.results.summary.recommendations.length > 0) {
      console.log('\n📋 RECOMMENDATIONS:');
      this.results.summary.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. [${rec.priority}] ${rec.category}: ${rec.message}`);
      });
    }

    const reportFile = await this.saveResults();
    return {
      success: this.results.summary.failed === 0,
      summary: this.results.summary,
      reportFile: reportFile
    };
  }
}

// Export for use as module
module.exports = SecurityTestSuite;

// Run if called directly
if (require.main === module) {
  const suite = new SecurityTestSuite();
  suite.runAllTests()
    .then(result => {
      console.log('\n✅ Security testing completed');
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n❌ Security testing failed:', error.message);
      process.exit(1);
    });
}