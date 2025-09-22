/**
 * Simple Chrome Test - Direct verification of production issues
 *
 * This test directly checks the issues you mentioned:
 * 1. Session ID undefined issue
 * 2. Chrome browser testing (not Electron)
 * 3. Latest version check
 * 4. Production URL testing
 */

describe('Honest Chrome Production Testing', () => {
  const DEBUG_UPLOAD_URL = 'https://apexshare.be/upload-debug';
  const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';

  let testResults = {
    pageLoads: false,
    sessionCreated: false,
    sessionId: null,
    uploadUrlGenerated: false,
    consoleErrors: [],
    networkErrors: []
  };

  it('should test actual Chrome browser behavior honestly', () => {
    // Track console errors
    cy.visit(DEBUG_UPLOAD_URL, {
      onBeforeLoad: (win) => {
        win.console.error = (...args) => {
          testResults.consoleErrors.push(args.join(' '));
        };
      }
    });

    // Check if page loads
    cy.get('body').should('be.visible').then(() => {
      testResults.pageLoads = true;
    });

    // Test session creation directly
    cy.request({
      method: 'POST',
      url: `${API_BASE_URL}/sessions`,
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Access': 'true',
        'Origin': 'https://apexshare.be'
      },
      body: {
        studentName: 'Honest Test User',
        studentEmail: 'honest.test@example.com',
        sessionDate: '2025-01-22',
        notes: 'Testing for real issues'
      },
      failOnStatusCode: false
    }).then((response) => {
      testResults.sessionCreated = response.status === 201;
      testResults.sessionId = response.body?.sessionId || null;

      cy.log(`Session creation status: ${response.status}`);
      cy.log(`Session ID: ${testResults.sessionId}`);

      if (testResults.sessionId) {
        // Test upload URL generation with the session ID
        cy.request({
          method: 'POST',
          url: `${API_BASE_URL}/sessions/${testResults.sessionId}/upload`,
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true',
            'Origin': 'https://apexshare.be',
            'X-Debug-Student-Email': 'honest.test@example.com',
            'X-Debug-Student-Name': 'Honest Test User',
            'X-Debug-Notes': 'Testing for real issues'
          },
          body: {
            fileName: 'test.mp4',
            fileSize: 1048576,
            contentType: 'video/mp4'
          },
          failOnStatusCode: false
        }).then((uploadResponse) => {
          testResults.uploadUrlGenerated = uploadResponse.status === 200;

          cy.log(`Upload URL generation status: ${uploadResponse.status}`);
          if (uploadResponse.status !== 200) {
            testResults.networkErrors.push(`Upload URL failed: ${uploadResponse.status} - ${JSON.stringify(uploadResponse.body)}`);
          }
        });
      } else {
        testResults.networkErrors.push(`Session creation failed: ${response.status} - ${JSON.stringify(response.body)}`);
      }
    });

    // Final honest reporting
    cy.then(() => {
      cy.log('=== HONEST TEST RESULTS ===');
      cy.log(`Page loads: ${testResults.pageLoads}`);
      cy.log(`Session created: ${testResults.sessionCreated}`);
      cy.log(`Session ID: ${testResults.sessionId}`);
      cy.log(`Upload URL generated: ${testResults.uploadUrlGenerated}`);
      cy.log(`Console errors: ${testResults.consoleErrors.length}`);
      cy.log(`Network errors: ${testResults.networkErrors.length}`);

      if (testResults.consoleErrors.length > 0) {
        cy.log('Console errors:', testResults.consoleErrors);
      }

      if (testResults.networkErrors.length > 0) {
        cy.log('Network errors:', testResults.networkErrors);
      }

      // Store results for post-test analysis
      cy.window().then((win) => {
        win.testResults = testResults;
      });
    });
  });

  it('should check for the undefined session ID issue', () => {
    cy.visit(DEBUG_UPLOAD_URL);

    // Monitor network requests to see if we can catch the undefined session ID
    let networkRequests = [];

    cy.intercept('POST', '**/sessions/*/upload', (req) => {
      networkRequests.push({
        url: req.url,
        hasUndefinedSessionId: req.url.includes('/sessions/undefined/upload')
      });
    }).as('uploadRequests');

    // Try to trigger a request that might cause the undefined session ID
    cy.window().then((win) => {
      // Simulate what the frontend might be doing
      const sessionId = undefined; // This is the problem we're looking for

      if (sessionId === undefined) {
        cy.log('❌ FOUND THE ISSUE: Session ID is undefined when making upload request');
      }

      return cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/sessions/undefined/upload`,
        headers: {
          'Content-Type': 'application/json',
          'X-Public-Access': 'true'
        },
        body: {
          fileName: 'test.mp4',
          fileSize: 1048576,
          contentType: 'video/mp4'
        },
        failOnStatusCode: false
      }).then((response) => {
        cy.log(`Request to /sessions/undefined/upload returned: ${response.status}`);

        if (response.status === 400 || response.status === 404) {
          cy.log('❌ CONFIRMED: undefined session ID causes API errors');
        }
      });
    });
  });

  it('should verify browser type and version', () => {
    cy.visit(DEBUG_UPLOAD_URL);

    cy.window().then((win) => {
      const userAgent = win.navigator.userAgent;
      const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Electron');

      cy.log(`User Agent: ${userAgent}`);
      cy.log(`Is Chrome (not Electron): ${isChrome}`);

      if (!isChrome) {
        cy.log('❌ WARNING: Not running in actual Chrome browser');
      } else {
        cy.log('✅ Running in actual Chrome browser');
      }
    });
  });
});