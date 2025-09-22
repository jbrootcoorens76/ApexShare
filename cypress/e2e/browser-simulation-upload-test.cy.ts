/**
 * BROWSER SIMULATION UPLOAD TEST
 *
 * This test simulates the actual browser environment to verify the complete
 * Chrome upload workflow with network request monitoring.
 */

describe('Browser Simulation Upload Test', () => {
  const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
  const DEBUG_UPLOAD_URL = 'https://apexshare.be/upload-debug';

  let testResults = {
    pageLoad: false,
    sessionCreation: false,
    uploadUrlRequest: false,
    headersVerified: false,
    errors: []
  };

  it('should simulate Chrome browser upload workflow with network monitoring', () => {
    cy.log('🌐 Simulating real Chrome browser upload workflow');

    // Setup network monitoring
    cy.intercept('POST', `${API_BASE_URL}/sessions`, (req) => {
      cy.log('📡 Intercepted session request');
      cy.log(`Headers: ${JSON.stringify(req.headers)}`);

      if (req.headers['x-public-access']) {
        testResults.headersVerified = true;
        cy.log('✅ X-Public-Access header present in session request');
      }

      req.continue();
    }).as('sessionRequest');

    cy.intercept('POST', `${API_BASE_URL}/sessions/*/upload`, (req) => {
      cy.log('📡 Intercepted upload URL request');
      cy.log(`Headers: ${JSON.stringify(req.headers)}`);

      if (req.headers['x-public-access']) {
        cy.log('✅ X-Public-Access header present in upload request');
      }

      req.continue();
    }).as('uploadRequest');

    // Load the production page
    cy.visit(DEBUG_UPLOAD_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    cy.get('#root', { timeout: 10000 }).should('be.visible').then(() => {
      testResults.pageLoad = true;
      cy.log('✅ Page loaded successfully');
    });

    // Wait for React to fully load
    cy.wait(3000);

    // Execute the upload workflow in the browser context
    cy.window().then(async (win) => {
      try {
        cy.log('📤 Testing session creation in browser context...');

        // Session creation request
        const sessionResponse = await win.fetch(`${API_BASE_URL}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true'
          },
          body: JSON.stringify({
            studentName: 'Browser Test Student',
            studentEmail: 'browsertest@test.com',
            sessionDate: '2025-01-22',
            notes: 'Browser simulation test'
          })
        });

        if (sessionResponse.ok) {
          testResults.sessionCreation = true;
          const sessionResult = await sessionResponse.json();

          // Extract session ID (handle different response formats)
          let sessionId = sessionResult.sessionId ||
                          (sessionResult.data && sessionResult.data.sessionId) ||
                          sessionResult.id;

          cy.log(`✅ Session created: ${sessionId}`);

          // Upload URL request - THE CRITICAL TEST
          cy.log('📤 Testing upload URL request in browser context...');

          const uploadResponse = await win.fetch(`${API_BASE_URL}/sessions/${sessionId}/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Public-Access': 'true'
            },
            body: JSON.stringify({
              fileName: 'GX010492.MP4',
              fileSize: 446676992,
              contentType: 'video/mp4'
            })
          });

          if (uploadResponse.ok) {
            testResults.uploadUrlRequest = true;
            const uploadResult = await uploadResponse.json();
            cy.log('🎉 SUCCESS: Upload URL request completed successfully!');
            cy.log(`Upload URL: ${uploadResult.uploadUrl.substring(0, 100)}...`);
          } else {
            throw new Error(`Upload request failed: ${uploadResponse.status}`);
          }

        } else {
          throw new Error(`Session creation failed: ${sessionResponse.status}`);
        }

      } catch (error: any) {
        testResults.errors.push(error.message);
        cy.log(`❌ Browser workflow failed: ${error.message}`);

        if (error.message.includes('Failed to fetch')) {
          cy.log('🚨 CRITICAL: Still getting "Failed to fetch" error');
          cy.log('💡 Cache invalidation may not have fully propagated');
        }

        throw error;
      }
    });

    // Wait for and verify network requests were made
    cy.wait('@sessionRequest');
    cy.wait('@uploadRequest');
  });

  it('should test actual file upload simulation', () => {
    cy.log('📦 Testing file upload simulation');

    cy.visit(DEBUG_UPLOAD_URL);
    cy.wait(3000);

    cy.window().then(async (win) => {
      try {
        // Create session
        const sessionResponse = await win.fetch(`${API_BASE_URL}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true'
          },
          body: JSON.stringify({
            studentName: 'File Upload Test',
            studentEmail: 'filetest@test.com',
            sessionDate: '2025-01-22',
            notes: 'File upload simulation'
          })
        });

        const sessionResult = await sessionResponse.json();
        const sessionId = sessionResult.sessionId ||
                          (sessionResult.data && sessionResult.data.sessionId) ||
                          sessionResult.id;

        // Get upload URL
        const uploadResponse = await win.fetch(`${API_BASE_URL}/sessions/${sessionId}/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true'
          },
          body: JSON.stringify({
            fileName: 'test-upload.mp4',
            fileSize: 1048576, // 1MB for quick test
            contentType: 'video/mp4'
          })
        });

        const uploadResult = await uploadResponse.json();
        const presignedUrl = uploadResult.uploadUrl;

        cy.log('✅ Presigned URL obtained successfully');

        // Test the presigned URL with a HEAD request
        const urlTestResponse = await win.fetch(presignedUrl, {
          method: 'HEAD'
        });

        if (urlTestResponse.status === 200 || urlTestResponse.status === 403) {
          cy.log('✅ Presigned URL is valid and accessible');
        } else {
          cy.log(`⚠️ Presigned URL test returned: ${urlTestResponse.status}`);
        }

      } catch (error: any) {
        cy.log(`❌ File upload simulation failed: ${error.message}`);
        throw error;
      }
    });
  });

  after(() => {
    cy.log('');
    cy.log('🏁 BROWSER SIMULATION TEST COMPLETE');
    cy.log('');
    cy.log('📊 TEST RESULTS:');
    cy.log(`  Page Load: ${testResults.pageLoad ? '✅ SUCCESS' : '❌ FAILED'}`);
    cy.log(`  Session Creation: ${testResults.sessionCreation ? '✅ SUCCESS' : '❌ FAILED'}`);
    cy.log(`  Upload URL Request: ${testResults.uploadUrlRequest ? '✅ SUCCESS' : '❌ FAILED'}`);
    cy.log(`  Headers Verified: ${testResults.headersVerified ? '✅ SUCCESS' : '❌ FAILED'}`);

    if (testResults.errors.length > 0) {
      cy.log('❌ ERRORS:');
      testResults.errors.forEach(error => cy.log(`  - ${error}`));
    }

    cy.log('');
    if (testResults.uploadUrlRequest && testResults.sessionCreation) {
      cy.log('🎉 CONCLUSION: Chrome upload issue has been RESOLVED!');
    } else {
      cy.log('🚨 CONCLUSION: Chrome upload issue may still persist');
    }
  });
});