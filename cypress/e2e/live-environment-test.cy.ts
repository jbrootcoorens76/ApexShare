/// <reference types="cypress" />

/**
 * Live Environment Upload Test
 * Tests against the actual production environment to reproduce user issues
 */

describe('Live Environment Upload Test', () => {
  const LIVE_CONFIG = {
    frontendUrl: 'https://apexshare.be',
    apiUrl: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
    testEmail: 'qa-test@apexshare.be',
    testTrainer: 'QA Test Trainer'
  };

  before(() => {
    // Set the base URL for this test suite
    Cypress.config('baseUrl', LIVE_CONFIG.frontendUrl);
  });

  beforeEach(() => {
    // Clear all cookies and local storage
    cy.clearCookies();
    cy.clearLocalStorage();

    // Add headers for CORS and authentication testing
    cy.intercept('**/*', (req) => {
      req.headers['Origin'] = LIVE_CONFIG.frontendUrl;
    });
  });

  describe('Environment Connectivity', () => {
    it('should connect to the live frontend', () => {
      cy.visit('/', { timeout: 30000 });

      cy.get('body').should('be.visible');
      cy.title().should('not.be.empty');

      // Log the page title and URL for debugging
      cy.title().then(title => {
        cy.log(`Page title: ${title}`);
      });

      cy.url().then(url => {
        cy.log(`Current URL: ${url}`);
      });
    });

    it('should connect to the API health endpoint', () => {
      cy.request({
        method: 'GET',
        url: `${LIVE_CONFIG.apiUrl}/health`,
        timeout: 15000,
        failOnStatusCode: false
      }).then((response) => {
        cy.log(`API Health Status: ${response.status}`);
        cy.log(`API Health Response:`, response.body);

        // Log response for analysis even if it fails
        if (response.status !== 200) {
          cy.log(`API Health Check Failed: ${response.status} - ${JSON.stringify(response.body)}`);
        }
      });
    });

    it('should test CORS preflight requests', () => {
      cy.request({
        method: 'OPTIONS',
        url: LIVE_CONFIG.apiUrl,
        headers: {
          'Origin': LIVE_CONFIG.frontendUrl,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,X-Auth-Token,Authorization'
        },
        timeout: 15000,
        failOnStatusCode: false
      }).then((response) => {
        cy.log(`CORS Preflight Status: ${response.status}`);
        cy.log(`CORS Headers:`, response.headers);

        // Check CORS headers
        const corsHeaders = {
          'access-control-allow-origin': response.headers['access-control-allow-origin'],
          'access-control-allow-methods': response.headers['access-control-allow-methods'],
          'access-control-allow-headers': response.headers['access-control-allow-headers']
        };

        cy.log('CORS Configuration:', corsHeaders);
      });
    });
  });

  describe('Upload Page Functionality', () => {
    it('should load the upload page', () => {
      cy.visit('/upload', { timeout: 30000 });

      // Wait for the page to fully load
      cy.get('body').should('be.visible');

      // Check for form elements using multiple possible selectors
      cy.get('input[type="email"], [data-cy="student-email"], #studentEmail, [name="studentEmail"]')
        .first()
        .should('be.visible')
        .as('emailInput');

      cy.get('input[type="date"], [data-cy="session-date"], #sessionDate, [name="sessionDate"]')
        .first()
        .should('be.visible')
        .as('dateInput');

      cy.get('input[type="file"], [data-cy="file-upload-zone"], #fileUpload, [name="file"]')
        .first()
        .should('exist')
        .as('fileInput');

      cy.get('button[type="submit"], [data-cy="upload-button"], #uploadButton, button:contains("Upload")')
        .first()
        .should('be.visible')
        .as('submitButton');
    });

    it('should handle form validation', () => {
      cy.visit('/upload');

      // Try to submit empty form
      cy.get('button[type="submit"], [data-cy="upload-button"], #uploadButton, button:contains("Upload")')
        .first()
        .click();

      // Wait for validation messages (they might appear)
      cy.wait(1000);

      // Log current page state for debugging
      cy.get('body').then($body => {
        cy.log('Page HTML after validation:', $body.html());
      });
    });

    it('should fill out the form with test data', () => {
      cy.visit('/upload');

      // Fill email field
      cy.get('input[type="email"], [data-cy="student-email"], #studentEmail, [name="studentEmail"]')
        .first()
        .clear()
        .type(LIVE_CONFIG.testEmail)
        .should('have.value', LIVE_CONFIG.testEmail);

      // Fill date field
      const testDate = '2025-01-20';
      cy.get('input[type="date"], [data-cy="session-date"], #sessionDate, [name="sessionDate"]')
        .first()
        .clear()
        .type(testDate)
        .should('have.value', testDate);

      // Fill trainer name if field exists
      cy.get('body').then($body => {
        const trainerField = $body.find('input[name="trainerName"], [data-cy="trainer-name"], #trainerName');
        if (trainerField.length > 0) {
          cy.wrap(trainerField.first())
            .clear()
            .type(LIVE_CONFIG.testTrainer);
        }
      });

      // Fill student name if field exists
      cy.get('body').then($body => {
        const studentNameField = $body.find('input[name="studentName"], [data-cy="student-name"], #studentName');
        if (studentNameField.length > 0) {
          cy.wrap(studentNameField.first())
            .clear()
            .type('QA Test Student');
        }
      });
    });
  });

  describe('Authentication Testing', () => {
    it('should test X-Auth-Token authentication', () => {
      const testData = {
        studentEmail: LIVE_CONFIG.testEmail,
        studentName: 'QA Test Student',
        trainerName: LIVE_CONFIG.testTrainer,
        sessionDate: '2025-01-20',
        notes: 'Authentication test - X-Auth-Token'
      };

      cy.request({
        method: 'POST',
        url: `${LIVE_CONFIG.apiUrl}/upload`,
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': 'test-auth-token',
          'Origin': LIVE_CONFIG.frontendUrl
        },
        body: testData,
        timeout: 15000,
        failOnStatusCode: false
      }).then((response) => {
        cy.log(`X-Auth-Token Test - Status: ${response.status}`);
        cy.log(`X-Auth-Token Test - Response:`, response.body);
        cy.log(`X-Auth-Token Test - Headers:`, response.headers);

        // Store result for analysis
        cy.wrap(response).as('xAuthTokenResponse');
      });
    });

    it('should test Authorization Bearer authentication', () => {
      const testData = {
        studentEmail: LIVE_CONFIG.testEmail,
        studentName: 'QA Test Student',
        trainerName: LIVE_CONFIG.testTrainer,
        sessionDate: '2025-01-20',
        notes: 'Authentication test - Authorization Bearer'
      };

      cy.request({
        method: 'POST',
        url: `${LIVE_CONFIG.apiUrl}/upload`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-bearer-token',
          'Origin': LIVE_CONFIG.frontendUrl
        },
        body: testData,
        timeout: 15000,
        failOnStatusCode: false
      }).then((response) => {
        cy.log(`Authorization Bearer Test - Status: ${response.status}`);
        cy.log(`Authorization Bearer Test - Response:`, response.body);
        cy.log(`Authorization Bearer Test - Headers:`, response.headers);

        // Store result for analysis
        cy.wrap(response).as('authBearerResponse');
      });
    });

    it('should test request without authentication', () => {
      const testData = {
        studentEmail: LIVE_CONFIG.testEmail,
        studentName: 'QA Test Student',
        trainerName: LIVE_CONFIG.testTrainer,
        sessionDate: '2025-01-20',
        notes: 'Authentication test - No Auth'
      };

      cy.request({
        method: 'POST',
        url: `${LIVE_CONFIG.apiUrl}/upload`,
        headers: {
          'Content-Type': 'application/json',
          'Origin': LIVE_CONFIG.frontendUrl
        },
        body: testData,
        timeout: 15000,
        failOnStatusCode: false
      }).then((response) => {
        cy.log(`No Auth Test - Status: ${response.status}`);
        cy.log(`No Auth Test - Response:`, response.body);
        cy.log(`No Auth Test - Headers:`, response.headers);

        // Store result for analysis
        cy.wrap(response).as('noAuthResponse');
      });
    });
  });

  describe('Browser Upload Simulation', () => {
    it('should monitor network requests during upload attempt', () => {
      const networkRequests: any[] = [];
      const networkResponses: any[] = [];

      // Intercept all requests to monitor network activity
      cy.intercept('**/*', (req) => {
        networkRequests.push({
          url: req.url,
          method: req.method,
          headers: req.headers,
          body: req.body
        });

        req.continue((res) => {
          networkResponses.push({
            url: req.url,
            status: res.statusCode,
            headers: res.headers,
            body: res.body
          });
        });
      }).as('allRequests');

      cy.visit('/upload');

      // Fill form
      cy.get('input[type="email"], [data-cy="student-email"], #studentEmail, [name="studentEmail"]')
        .first()
        .type(LIVE_CONFIG.testEmail);

      cy.get('input[type="date"], [data-cy="session-date"], #sessionDate, [name="sessionDate"]')
        .first()
        .type('2025-01-20');

      // Create a test file
      cy.writeFile('cypress/fixtures/test-video.mp4', 'test video content');

      // Upload file
      cy.get('input[type="file"], [data-cy="file-upload-zone"], #fileUpload, [name="file"]')
        .first()
        .selectFile('cypress/fixtures/test-video.mp4', { force: true });

      // Click submit and monitor requests
      cy.get('button[type="submit"], [data-cy="upload-button"], #uploadButton, button:contains("Upload")')
        .first()
        .click();

      // Wait for any API calls
      cy.wait(5000);

      // Log all network activity
      cy.then(() => {
        cy.log(`Total requests made: ${networkRequests.length}`);
        cy.log(`Total responses received: ${networkResponses.length}`);

        const apiRequests = networkRequests.filter(req =>
          req.url.includes(LIVE_CONFIG.apiUrl)
        );

        const apiResponses = networkResponses.filter(res =>
          res.url.includes(LIVE_CONFIG.apiUrl)
        );

        cy.log(`API requests: ${apiRequests.length}`);
        cy.log(`API responses: ${apiResponses.length}`);

        if (apiRequests.length > 0) {
          cy.log('API Requests:', apiRequests);
        }

        if (apiResponses.length > 0) {
          cy.log('API Responses:', apiResponses);
        }
      });
    });
  });

  describe('Incognito Mode Simulation', () => {
    it('should test upload functionality in incognito-like conditions', () => {
      // Clear everything to simulate incognito
      cy.clearCookies();
      cy.clearLocalStorage();
      cy.window().then((win) => {
        win.sessionStorage.clear();
      });

      // Visit upload page
      cy.visit('/upload');

      // Try to use the form
      cy.get('input[type="email"], [data-cy="student-email"], #studentEmail, [name="studentEmail"]')
        .first()
        .should('be.visible')
        .type(LIVE_CONFIG.testEmail);

      cy.get('input[type="date"], [data-cy="session-date"], #sessionDate, [name="sessionDate"]')
        .first()
        .should('be.visible')
        .type('2025-01-20');

      // Check if submit button works
      cy.get('button[type="submit"], [data-cy="upload-button"], #uploadButton, button:contains("Upload")')
        .first()
        .should('be.visible')
        .should('not.be.disabled');

      cy.log('Incognito mode simulation completed successfully');
    });
  });

  describe('Error Reproduction', () => {
    it('should attempt to reproduce connection errors', () => {
      // Monitor console errors
      const consoleErrors: string[] = [];

      cy.window().then((win) => {
        cy.stub(win.console, 'error').callsFake((message) => {
          consoleErrors.push(message);
        });
      });

      cy.visit('/upload');

      // Fill form with test data
      cy.get('input[type="email"], [data-cy="student-email"], #studentEmail, [name="studentEmail"]')
        .first()
        .type(LIVE_CONFIG.testEmail);

      cy.get('input[type="date"], [data-cy="session-date"], #sessionDate, [name="sessionDate"]')
        .first()
        .type('2025-01-20');

      // Try to submit without file (might trigger errors)
      cy.get('button[type="submit"], [data-cy="upload-button"], #uploadButton, button:contains("Upload")')
        .first()
        .click();

      // Wait and check for errors
      cy.wait(3000);

      cy.then(() => {
        if (consoleErrors.length > 0) {
          cy.log('Console errors detected:', consoleErrors);
        }
      });
    });

    it('should check for JavaScript errors on page load', () => {
      cy.visit('/upload', {
        onBeforeLoad: (win) => {
          cy.stub(win.console, 'error').as('consoleError');
        }
      });

      // Wait for page to fully load
      cy.wait(3000);

      // Check if there were any console errors
      cy.get('@consoleError').should('not.have.been.called');
    });
  });

  describe('Cache and CDN Testing', () => {
    it('should test if CloudFront cache was properly invalidated', () => {
      cy.visit('/', { timeout: 30000 });

      // Check for cache headers
      cy.request({
        url: LIVE_CONFIG.frontendUrl,
        timeout: 15000
      }).then((response) => {
        cy.log('CloudFront headers:', response.headers);

        const cacheHeaders = {
          'cache-control': response.headers['cache-control'],
          'cloudfront-cache': response.headers['x-cache'],
          'cloudfront-id': response.headers['x-amzn-requestid'],
          'last-modified': response.headers['last-modified'],
          'etag': response.headers['etag']
        };

        cy.log('Cache information:', cacheHeaders);
      });
    });

    it('should test asset loading', () => {
      cy.visit('/upload');

      // Check if all assets load properly
      cy.get('script, link[rel="stylesheet"], img').each(($element) => {
        const src = $element.attr('src') || $element.attr('href');
        if (src && !src.startsWith('data:')) {
          cy.request({
            url: src,
            failOnStatusCode: false,
            timeout: 10000
          }).then((response) => {
            if (response.status !== 200) {
              cy.log(`Asset failed to load: ${src} (${response.status})`);
            }
          });
        }
      });
    });
  });

  after(() => {
    // Generate a summary of all test results
    cy.log('='.repeat(50));
    cy.log('LIVE ENVIRONMENT TEST SUMMARY');
    cy.log('='.repeat(50));
    cy.log(`Frontend URL: ${LIVE_CONFIG.frontendUrl}`);
    cy.log(`API URL: ${LIVE_CONFIG.apiUrl}`);
    cy.log(`Test completed at: ${new Date().toISOString()}`);
  });
});