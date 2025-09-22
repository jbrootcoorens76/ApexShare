/**
 * ACTUAL USER ISSUE INVESTIGATION - Cypress E2E Test
 *
 * This test replicates the EXACT user workflow that is failing:
 * 1. User navigates to https://apexshare.be/upload-debug
 * 2. User can create session successfully (gets session ID a252882b-4997-4ca7-a646-0ac502309ba4)
 * 3. User gets "Failed to fetch" when requesting upload URL
 *
 * CRITICAL: We need to verify if our X-Public-Access header fix was actually deployed
 * and identify why it's not working.
 */

describe('Actual User Issue Investigation', () => {
  const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
  const DEBUG_UPLOAD_URL = 'https://apexshare.be/upload-debug';

  let networkRequests: any[] = [];
  let fetchErrors: any[] = [];
  let consoleErrors: any[] = [];

  beforeEach(() => {
    // Clear tracking arrays
    networkRequests = [];
    fetchErrors = [];
    consoleErrors = [];

    // Intercept ALL network requests to capture everything
    cy.intercept('**', (req) => {
      networkRequests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        timestamp: Date.now()
      });
    }).as('allRequests');

    // Specifically track session and upload requests
    cy.intercept('POST', `${API_BASE_URL}/sessions`).as('createSession');
    cy.intercept('POST', `${API_BASE_URL}/sessions/*/upload`).as('getUploadUrl');
    cy.intercept('OPTIONS', `${API_BASE_URL}/**`).as('corsPreflightOptions');
  });

  it('should load upload-debug page and capture all JavaScript errors', () => {
    cy.visit(DEBUG_UPLOAD_URL);

    // Monitor console errors
    cy.window().then((win) => {
      const originalError = win.console.error;
      const originalWarn = win.console.warn;

      win.console.error = (...args) => {
        consoleErrors.push({ type: 'error', message: args.join(' '), timestamp: Date.now() });
        originalError.apply(win.console, args);
      };

      win.console.warn = (...args) => {
        consoleErrors.push({ type: 'warn', message: args.join(' '), timestamp: Date.now() });
        originalWarn.apply(win.console, args);
      };
    });

    // Verify page loads
    cy.get('body').should('be.visible');

    // Look for any upload-related form elements
    cy.get('body').then(($body) => {
      cy.task('log', `Page HTML structure: ${$body.html().substring(0, 500)}...`);
    });

    // Wait for any async operations to complete
    cy.wait(3000);

    // Report any console errors found
    cy.then(() => {
      if (consoleErrors.length > 0) {
        cy.task('log', `Console errors found: ${JSON.stringify(consoleErrors, null, 2)}`);
      }
    });
  });

  it('should test the EXACT user workflow that is failing', () => {
    cy.visit(DEBUG_UPLOAD_URL);

    // Wait for page to fully load
    cy.wait(2000);

    cy.window().then(async (win) => {
      cy.task('log', 'Starting exact user workflow test...');

      // Step 1: Create session (this works according to user)
      const sessionData = {
        studentName: 'Test Student',
        studentEmail: 'test@example.com',
        sessionDate: '2025-01-22',
        notes: 'Testing exact user workflow'
      };

      cy.task('log', `Creating session with data: ${JSON.stringify(sessionData)}`);

      // Use the exact same fetch call that the frontend would make
      try {
        const sessionResponse = await win.fetch(`${API_BASE_URL}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true'
          },
          body: JSON.stringify(sessionData)
        });

        cy.task('log', `Session response status: ${sessionResponse.status}`);
        cy.task('log', `Session response headers: ${JSON.stringify([...sessionResponse.headers.entries()])}`);

        if (sessionResponse.ok) {
          const sessionResult = await sessionResponse.json();
          cy.task('log', `Session created successfully: ${JSON.stringify(sessionResult)}`);

          const sessionId = sessionResult.sessionId;

          // Step 2: Test upload URL request (this is what fails)
          const uploadData = {
            fileName: 'test-video.mp4',
            fileSize: 1048576,
            contentType: 'video/mp4'
          };

          cy.task('log', `Requesting upload URL for session ${sessionId} with data: ${JSON.stringify(uploadData)}`);

          try {
            const uploadResponse = await win.fetch(`${API_BASE_URL}/sessions/${sessionId}/upload`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Public-Access': 'true'
              },
              body: JSON.stringify(uploadData)
            });

            cy.task('log', `Upload URL response status: ${uploadResponse.status}`);
            cy.task('log', `Upload URL response headers: ${JSON.stringify([...uploadResponse.headers.entries()])}`);

            if (uploadResponse.ok) {
              const uploadResult = await uploadResponse.json();
              cy.task('log', `Upload URL received successfully: ${JSON.stringify(uploadResult)}`);
            } else {
              const errorText = await uploadResponse.text();
              cy.task('log', `Upload URL request failed with status ${uploadResponse.status}: ${errorText}`);
              fetchErrors.push({
                step: 'upload_url_request',
                status: uploadResponse.status,
                error: errorText,
                url: `${API_BASE_URL}/sessions/${sessionId}/upload`
              });
            }
          } catch (uploadError) {
            cy.task('log', `Upload URL fetch failed with error: ${uploadError.message}`);
            fetchErrors.push({
              step: 'upload_url_fetch',
              error: uploadError.message,
              url: `${API_BASE_URL}/sessions/${sessionId}/upload`
            });
          }
        } else {
          const errorText = await sessionResponse.text();
          cy.task('log', `Session creation failed with status ${sessionResponse.status}: ${errorText}`);
        }
      } catch (sessionError) {
        cy.task('log', `Session fetch failed with error: ${sessionError.message}`);
        fetchErrors.push({
          step: 'session_creation',
          error: sessionError.message,
          url: `${API_BASE_URL}/sessions`
        });
      }
    });

    // Report results
    cy.then(() => {
      cy.task('log', `Network requests made: ${networkRequests.length}`);
      networkRequests.forEach((req, index) => {
        cy.task('log', `Request ${index + 1}: ${req.method} ${req.url}`);
        cy.task('log', `  Headers: ${JSON.stringify(req.headers)}`);
      });

      if (fetchErrors.length > 0) {
        cy.task('log', `Fetch errors encountered: ${JSON.stringify(fetchErrors, null, 2)}`);
      }
    });
  });

  it('should verify if X-Public-Access header fix was actually deployed', () => {
    cy.visit(DEBUG_UPLOAD_URL);

    // Check the frontend JavaScript to see if X-Public-Access header is being added
    cy.window().then((win) => {
      // Look for the frontend JavaScript source
      cy.request('GET', DEBUG_UPLOAD_URL).then((response) => {
        const htmlContent = response.body;
        cy.task('log', `Page content length: ${htmlContent.length}`);

        // Look for script tags and fetch their content
        const scriptMatches = htmlContent.match(/<script[^>]*src="([^"]*)"[^>]*>/g);
        if (scriptMatches) {
          scriptMatches.forEach((scriptTag, index) => {
            const srcMatch = scriptTag.match(/src="([^"]*)"/);
            if (srcMatch && srcMatch[1]) {
              const scriptUrl = srcMatch[1].startsWith('http') ? srcMatch[1] : `https://apexshare.be${srcMatch[1]}`;
              cy.task('log', `Found script ${index + 1}: ${scriptUrl}`);

              // Fetch and examine the script content
              cy.request('GET', scriptUrl).then((scriptResponse) => {
                const scriptContent = scriptResponse.body;

                // Check if X-Public-Access header is mentioned in the script
                if (scriptContent.includes('X-Public-Access')) {
                  cy.task('log', `X-Public-Access header found in script: ${scriptUrl}`);

                  // Extract the relevant parts showing how the header is used
                  const lines = scriptContent.split('\n');
                  lines.forEach((line, lineIndex) => {
                    if (line.includes('X-Public-Access')) {
                      cy.task('log', `Line ${lineIndex + 1}: ${line.trim()}`);
                    }
                  });
                } else {
                  cy.task('log', `X-Public-Access header NOT found in script: ${scriptUrl}`);
                }
              });
            }
          });
        }
      });
    });
  });

  it('should test CORS preflight behavior for the failing request', () => {
    cy.visit(DEBUG_UPLOAD_URL);

    // Test OPTIONS request for sessions endpoint
    cy.request({
      method: 'OPTIONS',
      url: `${API_BASE_URL}/sessions`,
      headers: {
        'Origin': 'https://apexshare.be',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-public-access'
      },
      failOnStatusCode: false
    }).then((optionsResponse) => {
      cy.task('log', `Sessions OPTIONS response status: ${optionsResponse.status}`);
      cy.task('log', `Sessions OPTIONS headers: ${JSON.stringify(optionsResponse.headers)}`);

      const allowedHeaders = optionsResponse.headers['access-control-allow-headers'] || '';
      const allowedOrigin = optionsResponse.headers['access-control-allow-origin'] || '';

      cy.task('log', `Allowed headers: ${allowedHeaders}`);
      cy.task('log', `Allowed origin: ${allowedOrigin}`);

      if (!allowedHeaders.toLowerCase().includes('x-public-access')) {
        cy.task('log', 'ERROR: X-Public-Access header is NOT allowed by CORS!');
      }
    });

    // Test OPTIONS request for upload endpoint pattern
    cy.request({
      method: 'OPTIONS',
      url: `${API_BASE_URL}/sessions/test-session-id/upload`,
      headers: {
        'Origin': 'https://apexshare.be',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-public-access'
      },
      failOnStatusCode: false
    }).then((uploadOptionsResponse) => {
      cy.task('log', `Upload OPTIONS response status: ${uploadOptionsResponse.status}`);
      cy.task('log', `Upload OPTIONS headers: ${JSON.stringify(uploadOptionsResponse.headers)}`);

      const allowedHeaders = uploadOptionsResponse.headers['access-control-allow-headers'] || '';
      const allowedOrigin = uploadOptionsResponse.headers['access-control-allow-origin'] || '';

      cy.task('log', `Upload allowed headers: ${allowedHeaders}`);
      cy.task('log', `Upload allowed origin: ${allowedOrigin}`);

      if (!allowedHeaders.toLowerCase().includes('x-public-access')) {
        cy.task('log', 'ERROR: X-Public-Access header is NOT allowed by upload endpoint CORS!');
      }
    });
  });

  it('should test if the issue is specific to the debug upload route', () => {
    // Test the main upload page for comparison
    cy.visit('https://apexshare.be/upload');

    cy.wait(2000);

    cy.window().then(async (win) => {
      cy.task('log', 'Testing main upload page for comparison...');

      // Test main upload endpoint
      try {
        const mainUploadResponse = await win.fetch(`${API_BASE_URL}/uploads/initiate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true'
          },
          body: JSON.stringify({
            studentEmail: 'test@example.com',
            studentName: 'Test Student',
            fileName: 'test-video.mp4',
            fileSize: 1048576,
            contentType: 'video/mp4',
            sessionDate: '2025-01-22'
          })
        });

        cy.task('log', `Main upload response status: ${mainUploadResponse.status}`);

        if (mainUploadResponse.ok) {
          const result = await mainUploadResponse.json();
          cy.task('log', `Main upload successful: ${JSON.stringify(result)}`);
        } else {
          const errorText = await mainUploadResponse.text();
          cy.task('log', `Main upload failed: ${errorText}`);
        }
      } catch (mainUploadError) {
        cy.task('log', `Main upload fetch error: ${mainUploadError.message}`);
      }
    });
  });

  it('should inspect CloudFront caching behavior', () => {
    // Check if CloudFront is serving cached content
    cy.request('GET', DEBUG_UPLOAD_URL).then((response) => {
      const cacheHeaders = {
        'cache-control': response.headers['cache-control'],
        'cloudfront-viewer-country': response.headers['cloudfront-viewer-country'],
        'x-cache': response.headers['x-cache'],
        'x-amz-cf-pop': response.headers['x-amz-cf-pop'],
        'x-amz-cf-id': response.headers['x-amz-cf-id']
      };

      cy.task('log', `CloudFront cache headers: ${JSON.stringify(cacheHeaders, null, 2)}`);

      if (response.headers['x-cache'] && response.headers['x-cache'].includes('Hit')) {
        cy.task('log', 'WARNING: CloudFront is serving cached content - this might prevent fixes from being visible');
      }
    });

    // Check with cache-busting parameter
    const cacheBustUrl = `${DEBUG_UPLOAD_URL}?cb=${Date.now()}`;
    cy.request('GET', cacheBustUrl).then((response) => {
      cy.task('log', `Cache-busted request status: ${response.status}`);
      cy.task('log', `Cache-busted X-Cache header: ${response.headers['x-cache'] || 'none'}`);
    });
  });

  afterEach(() => {
    // Generate comprehensive report
    cy.then(() => {
      const report = {
        timestamp: new Date().toISOString(),
        testResults: {
          networkRequests: networkRequests.length,
          fetchErrors: fetchErrors,
          consoleErrors: consoleErrors
        },
        summary: {
          sessionCreationWorks: fetchErrors.filter(e => e.step === 'session_creation').length === 0,
          uploadUrlFails: fetchErrors.filter(e => e.step === 'upload_url_request' || e.step === 'upload_url_fetch').length > 0,
          hasConsoleErrors: consoleErrors.length > 0
        }
      };

      cy.task('log', `FINAL INVESTIGATION REPORT: ${JSON.stringify(report, null, 2)}`);
    });
  });
});

/**
 * Browser-Specific Testing
 * Test the exact scenario in different browser contexts
 */
describe('Browser-Specific Upload Issue Testing', () => {
  it('should test with Chrome-specific headers and behavior', () => {
    const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';

    cy.visit('https://apexshare.be/upload-debug', {
      onBeforeLoad: (win) => {
        // Mock Chrome User-Agent
        Object.defineProperty(win.navigator, 'userAgent', {
          writable: false,
          value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        });
      }
    });

    cy.window().then(async (win) => {
      // Test with Chrome-specific security headers
      try {
        const response = await win.fetch(`${API_BASE_URL}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty'
          },
          body: JSON.stringify({
            studentName: 'Chrome Test',
            studentEmail: 'chrome@test.com',
            sessionDate: '2025-01-22',
            notes: 'Chrome-specific test'
          })
        });

        cy.task('log', `Chrome-specific test response status: ${response.status}`);

        if (response.ok) {
          const result = await response.json();
          const sessionId = result.sessionId;

          // Test upload URL with Chrome headers
          const uploadResponse = await win.fetch(`${API_BASE_URL}/sessions/${sessionId}/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Public-Access': 'true',
              'Sec-Fetch-Site': 'cross-site',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Dest': 'empty'
            },
            body: JSON.stringify({
              fileName: 'chrome-test.mp4',
              fileSize: 1048576,
              contentType: 'video/mp4'
            })
          });

          cy.task('log', `Chrome upload URL response status: ${uploadResponse.status}`);

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            cy.task('log', `Chrome upload URL error: ${errorText}`);
          }
        }
      } catch (error) {
        cy.task('log', `Chrome-specific fetch error: ${error.message}`);
      }
    });
  });
});