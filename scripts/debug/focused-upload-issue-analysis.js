/**
 * Focused Upload Issue Analysis
 * Identifies specific issues with the upload functionality
 */

const axios = require('axios');
const puppeteer = require('puppeteer');

class FocusedUploadAnalyzer {
  constructor() {
    this.config = {
      frontendUrl: 'https://apexshare.be',
      apiUrl: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
      testEmail: 'qa-test@apexshare.be'
    };

    this.issues = [];
    this.findings = [];
  }

  log(category, message, data = null) {
    const timestamp = new Date().toISOString();
    const finding = { timestamp, category, message, data };
    this.findings.push(finding);
    console.log(`[${category}] ${message}`);
    if (data) {
      console.log(`    Details:`, JSON.stringify(data, null, 2));
    }
  }

  addIssue(issue) {
    this.issues.push(issue);
    this.log('ISSUE', issue);
  }

  async analyzeAPI() {
    console.log('\n🔍 ANALYZING API ENDPOINTS...');

    // Test health endpoint
    try {
      const healthResponse = await axios.get(`${this.config.apiUrl}/health`, {
        timeout: 10000,
        validateStatus: () => true
      });

      if (healthResponse.status === 200) {
        this.log('API', 'Health endpoint working', healthResponse.data);
      } else {
        this.addIssue(`Health endpoint returned ${healthResponse.status}`);
      }
    } catch (error) {
      this.addIssue(`Health endpoint failed: ${error.message}`);
    }

    // Test upload endpoint authentication
    const testData = {
      studentEmail: this.config.testEmail,
      sessionDate: '2025-01-20'
    };

    // Test different authentication methods
    const authTests = [
      { name: 'No Auth', headers: { 'Content-Type': 'application/json' } },
      { name: 'X-Auth-Token', headers: { 'Content-Type': 'application/json', 'X-Auth-Token': 'test-token' } },
      { name: 'Authorization Bearer', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-token' } }
    ];

    for (const authTest of authTests) {
      try {
        const response = await axios.post(`${this.config.apiUrl}/upload`, testData, {
          headers: {
            ...authTest.headers,
            'Origin': this.config.frontendUrl
          },
          timeout: 10000,
          validateStatus: () => true
        });

        this.log('AUTH', `${authTest.name}: ${response.status}`, {
          status: response.status,
          message: response.data?.message,
          errorType: response.headers['x-amzn-errortype']
        });

        if (response.status === 403 && response.data?.message === 'Missing Authentication Token') {
          this.log('FINDING', `${authTest.name}: API Gateway is not recognizing authentication headers`);
        }

      } catch (error) {
        this.addIssue(`${authTest.name} test failed: ${error.message}`);
      }
    }

    // Test CORS
    try {
      const corsResponse = await axios.options(this.config.apiUrl, {
        headers: {
          'Origin': this.config.frontendUrl,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,X-Auth-Token,Authorization'
        },
        timeout: 10000,
        validateStatus: () => true
      });

      this.log('CORS', `Preflight response: ${corsResponse.status}`, {
        allowedOrigin: corsResponse.headers['access-control-allow-origin'],
        allowedMethods: corsResponse.headers['access-control-allow-methods'],
        allowedHeaders: corsResponse.headers['access-control-allow-headers']
      });

      if (corsResponse.headers['access-control-allow-origin'] !== this.config.frontendUrl) {
        this.addIssue('CORS origin mismatch - frontend cannot communicate with API');
      }

      if (!corsResponse.headers['access-control-allow-headers']?.includes('X-Auth-Token')) {
        this.addIssue('CORS does not allow X-Auth-Token header');
      }

    } catch (error) {
      this.addIssue(`CORS test failed: ${error.message}`);
    }
  }

  async analyzeFrontend() {
    console.log('\n🌐 ANALYZING FRONTEND...');

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();

      // Monitor console errors
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Monitor network requests
      const networkRequests = [];
      const networkFailures = [];

      page.on('request', request => {
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers()
        });
      });

      page.on('requestfailed', request => {
        networkFailures.push({
          url: request.url(),
          method: request.method(),
          failure: request.failure()
        });
      });

      // Visit the upload page
      this.log('FRONTEND', 'Loading upload page...');

      try {
        await page.goto(`${this.config.frontendUrl}/upload`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        this.log('FRONTEND', 'Upload page loaded successfully');

        // Check for form elements
        const formElements = await page.evaluate(() => {
          const results = {};

          // Look for email input
          const emailSelectors = [
            'input[type="email"]',
            '[data-cy="student-email"]',
            '#studentEmail',
            '[name="studentEmail"]'
          ];

          for (const selector of emailSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              results.emailInput = { selector, found: true };
              break;
            }
          }

          if (!results.emailInput) {
            results.emailInput = { found: false };
          }

          // Look for date input
          const dateSelectors = [
            'input[type="date"]',
            '[data-cy="session-date"]',
            '#sessionDate',
            '[name="sessionDate"]'
          ];

          for (const selector of dateSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              results.dateInput = { selector, found: true };
              break;
            }
          }

          if (!results.dateInput) {
            results.dateInput = { found: false };
          }

          // Look for file input
          const fileSelectors = [
            'input[type="file"]',
            '[data-cy="file-upload-zone"]',
            '#fileUpload',
            '[name="file"]'
          ];

          for (const selector of fileSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              results.fileInput = { selector, found: true };
              break;
            }
          }

          if (!results.fileInput) {
            results.fileInput = { found: false };
          }

          // Look for submit button
          const submitSelectors = [
            'button[type="submit"]',
            '[data-cy="upload-button"]',
            '#uploadButton',
            'button:contains("Upload")'
          ];

          for (const selector of submitSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              results.submitButton = { selector, found: true };
              break;
            }
          }

          if (!results.submitButton) {
            results.submitButton = { found: false };
          }

          // Get page HTML for debugging
          results.pageHtml = document.body.innerHTML.substring(0, 500);

          return results;
        });

        this.log('FRONTEND', 'Form elements analysis', formElements);

        // Check for missing elements
        if (!formElements.emailInput.found) {
          this.addIssue('Email input field not found on upload page');
        }
        if (!formElements.dateInput.found) {
          this.addIssue('Date input field not found on upload page');
        }
        if (!formElements.fileInput.found) {
          this.addIssue('File input field not found on upload page');
        }
        if (!formElements.submitButton.found) {
          this.addIssue('Submit button not found on upload page');
        }

        // Test form interaction if elements exist
        if (formElements.emailInput.found && formElements.submitButton.found) {
          this.log('FRONTEND', 'Testing form interaction...');

          try {
            // Fill email field
            await page.type(formElements.emailInput.selector, this.config.testEmail);

            if (formElements.dateInput.found) {
              await page.type(formElements.dateInput.selector, '2025-01-20');
            }

            // Click submit button
            await page.click(formElements.submitButton.selector);

            // Wait a moment for any API calls
            await page.waitForTimeout(3000);

            this.log('FRONTEND', 'Form submission attempted');

          } catch (error) {
            this.addIssue(`Form interaction failed: ${error.message}`);
          }
        }

        // Check for console errors
        if (consoleErrors.length > 0) {
          this.log('FRONTEND', 'Console errors detected', consoleErrors);
          consoleErrors.forEach(error => {
            this.addIssue(`Console error: ${error}`);
          });
        }

        // Check for network failures
        if (networkFailures.length > 0) {
          this.log('FRONTEND', 'Network failures detected', networkFailures);
          networkFailures.forEach(failure => {
            this.addIssue(`Network failure: ${failure.url} - ${failure.failure?.errorText}`);
          });
        }

        // Analyze API calls made by frontend
        const apiCalls = networkRequests.filter(req => req.url.includes(this.config.apiUrl));
        if (apiCalls.length > 0) {
          this.log('FRONTEND', 'API calls made by frontend', apiCalls);
        } else {
          this.log('FRONTEND', 'No API calls detected from frontend');
        }

      } catch (error) {
        this.addIssue(`Failed to load upload page: ${error.message}`);
      }

    } finally {
      await browser.close();
    }
  }

  async analyzeAuthentication() {
    console.log('\n🔐 ANALYZING AUTHENTICATION IMPLEMENTATION...');

    // Check if API Gateway has authentication configured
    try {
      const response = await axios.get(`${this.config.apiUrl}/upload`, {
        timeout: 10000,
        validateStatus: () => true
      });

      this.log('AUTH', 'GET request to upload endpoint', {
        status: response.status,
        message: response.data?.message,
        errorType: response.headers['x-amzn-errortype']
      });

      if (response.status === 403 && response.headers['x-amzn-errortype'] === 'MissingAuthenticationTokenException') {
        this.log('FINDING', 'API Gateway is configured for authentication but not recognizing custom headers');
        this.addIssue('API Gateway authentication configuration issue - custom headers not working');
      }

    } catch (error) {
      this.addIssue(`Authentication analysis failed: ${error.message}`);
    }
  }

  async run() {
    console.log('🚀 STARTING FOCUSED UPLOAD ISSUE ANALYSIS');
    console.log(`Frontend: ${this.config.frontendUrl}`);
    console.log(`API: ${this.config.apiUrl}`);

    await this.analyzeAPI();
    await this.analyzeFrontend();
    await this.analyzeAuthentication();

    this.generateReport();
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 FOCUSED UPLOAD ISSUE ANALYSIS REPORT');
    console.log('='.repeat(80));

    console.log(`\n🕐 Analysis completed at: ${new Date().toISOString()}`);
    console.log(`🌐 Frontend: ${this.config.frontendUrl}`);
    console.log(`🔗 API: ${this.config.apiUrl}`);

    if (this.issues.length === 0) {
      console.log('\n✅ No critical issues detected!');
    } else {
      console.log(`\n🚨 ${this.issues.length} CRITICAL ISSUES FOUND:`);
      this.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }

    console.log('\n🔍 KEY FINDINGS:');

    // Authentication findings
    const authFindings = this.findings.filter(f => f.category === 'AUTH' || f.category === 'FINDING');
    if (authFindings.length > 0) {
      console.log('\n  Authentication Status:');
      authFindings.forEach(finding => {
        console.log(`    • ${finding.message}`);
      });
    }

    // Frontend findings
    const frontendFindings = this.findings.filter(f => f.category === 'FRONTEND');
    if (frontendFindings.length > 0) {
      console.log('\n  Frontend Status:');
      frontendFindings.forEach(finding => {
        console.log(`    • ${finding.message}`);
      });
    }

    // CORS findings
    const corsFindings = this.findings.filter(f => f.category === 'CORS');
    if (corsFindings.length > 0) {
      console.log('\n  CORS Status:');
      corsFindings.forEach(finding => {
        console.log(`    • ${finding.message}`);
      });
    }

    console.log('\n💡 RECOMMENDATIONS:');
    this.generateRecommendations();

    console.log('\n' + '='.repeat(80));
  }

  generateRecommendations() {
    const recommendations = [];

    // Check for common issues based on findings
    const hasAuthIssues = this.issues.some(issue => issue.includes('Authentication Token'));
    const hasCorsIssues = this.issues.some(issue => issue.includes('CORS'));
    const hasFrontendIssues = this.issues.some(issue => issue.includes('not found'));

    if (hasAuthIssues) {
      recommendations.push('1. Review API Gateway authentication configuration');
      recommendations.push('   - Check if custom authorizer is properly configured');
      recommendations.push('   - Verify X-Auth-Token header is being processed');
      recommendations.push('   - Consider using API Keys instead of custom headers');
    }

    if (hasCorsIssues) {
      recommendations.push('2. Fix CORS configuration in API Gateway');
      recommendations.push('   - Ensure frontend domain is allowed in CORS origin');
      recommendations.push('   - Add X-Auth-Token to allowed headers');
    }

    if (hasFrontendIssues) {
      recommendations.push('3. Fix frontend form elements');
      recommendations.push('   - Ensure all required form fields are present');
      recommendations.push('   - Check if JavaScript is loading correctly');
      recommendations.push('   - Verify React components are rendering properly');
    }

    const apiGatewayIssues = this.findings.some(f =>
      f.data?.errorType === 'MissingAuthenticationTokenException'
    );

    if (apiGatewayIssues) {
      recommendations.push('4. API Gateway Configuration Issues Detected:');
      recommendations.push('   - The API is rejecting ALL requests with "Missing Authentication Token"');
      recommendations.push('   - This suggests the API Gateway has authentication enabled but is not recognizing any auth headers');
      recommendations.push('   - Possible solutions:');
      recommendations.push('     a) Configure a custom authorizer that accepts X-Auth-Token');
      recommendations.push('     b) Use API Keys with x-api-key header');
      recommendations.push('     c) Disable authentication temporarily for testing');
      recommendations.push('     d) Implement IAM authentication with proper signature');
    }

    if (recommendations.length === 0) {
      recommendations.push('All tests passed! The system appears to be working correctly.');
    }

    recommendations.forEach(rec => {
      console.log(`  ${rec}`);
    });
  }
}

// Run the analysis
if (require.main === module) {
  const analyzer = new FocusedUploadAnalyzer();
  analyzer.run().catch(console.error);
}

module.exports = FocusedUploadAnalyzer;