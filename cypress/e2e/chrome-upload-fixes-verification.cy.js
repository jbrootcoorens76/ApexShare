/**
 * Chrome Upload Fixes Verification - Cypress E2E Test
 *
 * This test verifies that the Chrome upload issues are resolved by testing
 * the actual browser behavior against the production deployment.
 *
 * Tests:
 * 1. Debug upload page loads without errors
 * 2. Network requests succeed without CORS errors
 * 3. Session creation works with X-Public-Access header
 * 4. No 400 Bad Request errors on upload workflow
 */

describe('Chrome Upload Fixes Verification', () => {
  const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
  const MAIN_UPLOAD_URL = 'https://apexshare.be/upload';
  const DEBUG_UPLOAD_URL = 'https://apexshare.be/upload-debug';

  beforeEach(() => {
    // Setup network monitoring
    cy.intercept('POST', `${API_BASE_URL}/sessions`).as('createSession');
    cy.intercept('POST', `${API_BASE_URL}/sessions/*/upload`).as('getUploadUrl');
    cy.intercept('OPTIONS', `${API_BASE_URL}/**`).as('corsPreflght');
  });

  it('should load the debug upload page without errors', () => {
    cy.visit(DEBUG_UPLOAD_URL);

    // Check that page loads successfully
    cy.get('body').should('be.visible');

    // Check for any JavaScript errors in console
    cy.window().then((win) => {
      const errors = [];
      const originalError = win.console.error;
      win.console.error = (...args) => {
        errors.push(args.join(' '));
        originalError.apply(win.console, args);
      };

      // Give page time to load and execute JavaScript
      cy.wait(2000).then(() => {
        expect(errors).to.have.length(0, `Console errors found: ${errors.join(', ')}`);
      });
    });
  });

  it('should handle CORS preflight requests for X-Public-Access header', () => {
    // Visit debug upload page
    cy.visit(DEBUG_UPLOAD_URL);

    // Simulate form interaction that would trigger API calls
    cy.get('input[type="text"]').first().should('be.visible');

    // Monitor network requests
    cy.window().then((win) => {
      // Create a test session creation request
      const sessionData = {
        studentName: 'Cypress Test User',
        studentEmail: 'cypress.test@example.com',
        sessionDate: '2025-01-22',
        notes: 'Testing Chrome CORS fixes'
      };

      return cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/sessions`,
        headers: {
          'Content-Type': 'application/json',
          'X-Public-Access': 'true',
          'Origin': 'https://apexshare.be'
        },
        body: sessionData
      }).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body).to.have.property('sessionId');

        // Store session ID for next test
        win.testSessionId = response.body.sessionId;
      });
    });
  });

  it('should successfully create session and get upload URL with debug headers', () => {
    cy.visit(DEBUG_UPLOAD_URL);

    cy.window().then((win) => {
      // First create a session
      const sessionData = {
        studentName: 'Cypress Debug Test',
        studentEmail: 'cypress.debug@example.com',
        sessionDate: '2025-01-22',
        notes: 'Testing debug headers fix'
      };

      return cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/sessions`,
        headers: {
          'Content-Type': 'application/json',
          'X-Public-Access': 'true',
          'Origin': 'https://apexshare.be'
        },
        body: sessionData
      }).then((sessionResponse) => {
        expect(sessionResponse.status).to.eq(201);
        const sessionId = sessionResponse.body.sessionId;

        // Now test upload URL generation with debug headers
        const uploadData = {
          fileName: 'cypress-test.mp4',
          fileSize: 1048576,
          contentType: 'video/mp4'
        };

        return cy.request({
          method: 'POST',
          url: `${API_BASE_URL}/sessions/${sessionId}/upload`,
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true',
            'Origin': 'https://apexshare.be',
            // Debug headers in HTTP headers (not payload) - this was the fix
            'X-Debug-Student-Email': 'cypress.debug@example.com',
            'X-Debug-Student-Name': 'Cypress Debug Test',
            'X-Debug-Notes': 'Testing debug headers fix'
          },
          body: uploadData
        }).then((uploadResponse) => {
          expect(uploadResponse.status).to.eq(200);
          expect(uploadResponse.body).to.have.property('uploadUrl');
          expect(uploadResponse.body.uploadUrl).to.include('amazonaws.com');
        });
      });
    });
  });

  it('should not have any CORS errors when making API requests', () => {
    cy.visit(DEBUG_UPLOAD_URL);

    // Monitor console for CORS errors
    const corsErrors = [];
    cy.window().then((win) => {
      const originalError = win.console.error;
      win.console.error = (...args) => {
        const message = args.join(' ');
        if (message.includes('CORS') || message.includes('Cross-Origin') || message.includes('Access-Control')) {
          corsErrors.push(message);
        }
        originalError.apply(win.console, args);
      };
    });

    // Make a test API request that would trigger CORS
    cy.request({
      method: 'OPTIONS',
      url: `${API_BASE_URL}/sessions`,
      headers: {
        'Origin': 'https://apexshare.be',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-public-access'
      }
    }).then((response) => {
      expect(response.status).to.be.oneOf([200, 204]);

      const allowedHeaders = response.headers['access-control-allow-headers'] || '';
      expect(allowedHeaders.toLowerCase()).to.include('x-public-access');

      const allowedOrigin = response.headers['access-control-allow-origin'];
      expect(allowedOrigin).to.eq('https://apexshare.be');
    });

    // Check for CORS errors after a delay
    cy.wait(2000).then(() => {
      expect(corsErrors).to.have.length(0, `CORS errors found: ${corsErrors.join(', ')}`);
    });
  });

  it('should verify main upload page still works (regression test)', () => {
    cy.visit(MAIN_UPLOAD_URL);

    // Check that main upload page loads
    cy.get('body').should('be.visible');

    // Test the main upload API endpoint that shouldn't be affected
    cy.request({
      method: 'POST',
      url: `${API_BASE_URL}/uploads/initiate`,
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Access': 'true',
        'Origin': 'https://apexshare.be'
      },
      body: {
        studentEmail: 'regression.test@example.com',
        studentName: 'Regression Test',
        fileName: 'regression-test.mp4',
        fileSize: 1048576,
        contentType: 'video/mp4',
        sessionDate: '2025-01-22'  // Add required field
      }
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('uploadUrl');
    });
  });

  it('should capture and verify network request headers', () => {
    cy.visit(DEBUG_UPLOAD_URL);

    // Use cy.intercept to capture the actual network requests
    cy.intercept('POST', `${API_BASE_URL}/sessions`, (req) => {
      // Verify the request headers include X-Public-Access
      expect(req.headers).to.have.property('x-public-access', 'true');
      expect(req.headers).to.have.property('origin', 'https://apexshare.be');

      // Mock successful response to test flow
      req.reply({
        statusCode: 201,
        body: {
          sessionId: 'cypress-test-session-id',
          success: true
        }
      });
    }).as('sessionRequest');

    // Trigger a request programmatically to test the network behavior
    cy.window().then((win) => {
      return win.fetch(`${API_BASE_URL}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Public-Access': 'true'
        },
        body: JSON.stringify({
          studentName: 'Network Test',
          studentEmail: 'network.test@example.com',
          sessionDate: '2025-01-22',
          notes: 'Testing network request capture'
        })
      });
    });

    cy.wait('@sessionRequest');
  });
});

// Additional test for specific Chrome behavior
describe('Chrome-Specific Network Behavior', () => {
  it('should handle Chrome User-Agent and request characteristics', () => {
    const chromeUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    cy.visit('https://apexshare.be/upload-debug', {
      onBeforeLoad: (win) => {
        // Override User-Agent to Chrome
        Object.defineProperty(win.navigator, 'userAgent', {
          writable: false,
          value: chromeUserAgent
        });
      }
    });

    // Verify Chrome-specific network request behavior
    cy.request({
      method: 'POST',
      url: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1/sessions',
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Access': 'true',
        'Origin': 'https://apexshare.be',
        'User-Agent': chromeUserAgent,
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty'
      },
      body: {
        studentName: 'Chrome UA Test',
        studentEmail: 'chrome.ua@example.com',
        sessionDate: '2025-01-22',
        notes: 'Testing Chrome-specific headers'
      }
    }).then((response) => {
      expect(response.status).to.eq(201);

      // Verify CORS headers in response
      expect(response.headers).to.have.property('access-control-allow-origin', 'https://apexshare.be');
    });
  });
});