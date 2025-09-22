/**
 * FOCUSED USER ISSUE TEST
 *
 * Simple, focused test to identify exactly what's happening with the upload failure.
 * Based on user report:
 * - Session creation works (gets ID a252882b-4997-4ca7-a646-0ac502309ba4)
 * - Upload URL request fails with "Failed to fetch"
 */

describe('Focused User Issue Test', () => {
  const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
  const DEBUG_UPLOAD_URL = 'https://apexshare.be/upload-debug';

  it('should test the exact failing workflow step by step', () => {
    cy.visit(DEBUG_UPLOAD_URL);

    // Wait for page load
    cy.wait(3000);

    // Log the page state
    cy.get('body').then(($body) => {
      cy.log(`Page content: ${$body.html().substring(0, 200)}...`);
    });

    cy.window().then(async (win) => {
      // Step 1: Test session creation (should work)
      cy.log('Testing session creation...');

      const sessionData = {
        studentName: 'Test Student',
        studentEmail: 'test@example.com',
        sessionDate: '2025-01-22',
        notes: 'Testing exact user workflow'
      };

      try {
        const sessionResponse = await win.fetch(`${API_BASE_URL}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true'
          },
          body: JSON.stringify(sessionData)
        });

        cy.log(`Session response status: ${sessionResponse.status}`);

        if (sessionResponse.ok) {
          const sessionResult = await sessionResponse.json();
          cy.log(`Session created: ${sessionResult.sessionId}`);

          // Step 2: Test upload URL request (this should fail)
          cy.log('Testing upload URL request...');

          const uploadData = {
            fileName: 'test-video.mp4',
            fileSize: 1048576,
            contentType: 'video/mp4'
          };

          try {
            const uploadResponse = await win.fetch(`${API_BASE_URL}/sessions/${sessionResult.sessionId}/upload`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Public-Access': 'true'
              },
              body: JSON.stringify(uploadData)
            });

            cy.log(`Upload response status: ${uploadResponse.status}`);

            if (uploadResponse.ok) {
              const uploadResult = await uploadResponse.json();
              cy.log(`Upload URL received: ${uploadResult.uploadUrl}`);
              // If this succeeds, the issue might be resolved
              expect(uploadResult).to.have.property('uploadUrl');
            } else {
              const errorText = await uploadResponse.text();
              cy.log(`Upload failed with status ${uploadResponse.status}: ${errorText}`);
              // This is expected to fail based on user report
            }
          } catch (uploadError: any) {
            cy.log(`Upload fetch failed: ${uploadError.message}`);
            // This confirms the "Failed to fetch" error
            expect(uploadError.message).to.include('fetch');
          }
        } else {
          const errorText = await sessionResponse.text();
          cy.log(`Session creation failed: ${errorText}`);
          expect.fail(`Session creation should work but failed with: ${errorText}`);
        }
      } catch (sessionError: any) {
        cy.log(`Session fetch failed: ${sessionError.message}`);
        expect.fail(`Session creation should work but threw: ${sessionError.message}`);
      }
    });
  });

  it('should verify CORS headers for both endpoints', () => {
    // Test CORS for sessions endpoint
    cy.request({
      method: 'OPTIONS',
      url: `${API_BASE_URL}/sessions`,
      headers: {
        'Origin': 'https://apexshare.be',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-public-access'
      },
      failOnStatusCode: false
    }).then((response) => {
      cy.log(`Sessions CORS status: ${response.status}`);
      cy.log(`Sessions CORS allowed headers: ${response.headers['access-control-allow-headers'] || 'none'}`);
      cy.log(`Sessions CORS allowed origin: ${response.headers['access-control-allow-origin'] || 'none'}`);

      // Check if X-Public-Access is allowed
      const allowedHeaders = (response.headers['access-control-allow-headers'] || '').toLowerCase();
      if (!allowedHeaders.includes('x-public-access')) {
        cy.log('ERROR: X-Public-Access header not allowed for sessions endpoint');
      }
    });

    // Test CORS for upload endpoint
    cy.request({
      method: 'OPTIONS',
      url: `${API_BASE_URL}/sessions/test-session/upload`,
      headers: {
        'Origin': 'https://apexshare.be',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-public-access'
      },
      failOnStatusCode: false
    }).then((response) => {
      cy.log(`Upload CORS status: ${response.status}`);
      cy.log(`Upload CORS allowed headers: ${response.headers['access-control-allow-headers'] || 'none'}`);
      cy.log(`Upload CORS allowed origin: ${response.headers['access-control-allow-origin'] || 'none'}`);

      // Check if X-Public-Access is allowed
      const allowedHeaders = (response.headers['access-control-allow-headers'] || '').toLowerCase();
      if (!allowedHeaders.includes('x-public-access')) {
        cy.log('ERROR: X-Public-Access header not allowed for upload endpoint');
      }
    });
  });

  it('should check if the frontend is actually deployed', () => {
    cy.visit(DEBUG_UPLOAD_URL);

    // Check if the React app loads
    cy.get('#root', { timeout: 10000 }).should('be.visible');

    // Wait for React app to potentially load
    cy.wait(5000);

    // Check if there's more content than just the root div
    cy.get('#root').then(($root) => {
      const rootHtml = $root.html();
      cy.log(`Root content: ${rootHtml}`);

      if (rootHtml.trim() === '') {
        cy.log('ERROR: React app did not load - root div is empty');
      } else {
        cy.log('React app loaded successfully');
      }
    });

    // Check for any error messages in the page
    cy.get('body').then(($body) => {
      const bodyText = $body.text();
      if (bodyText.includes('error') || bodyText.includes('failed') || bodyText.includes('not found')) {
        cy.log(`Potential error in page: ${bodyText}`);
      }
    });
  });

  it('should test direct API requests without frontend', () => {
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
        studentName: 'Direct API Test',
        studentEmail: 'direct@test.com',
        sessionDate: '2025-01-22',
        notes: 'Direct API test'
      }
    }).then((sessionResponse) => {
      cy.log(`Direct session creation status: ${sessionResponse.status}`);
      expect(sessionResponse.status).to.eq(201);
      expect(sessionResponse.body).to.have.property('sessionId');

      const sessionId = sessionResponse.body.sessionId;

      // Test upload URL request directly
      cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/sessions/${sessionId}/upload`,
        headers: {
          'Content-Type': 'application/json',
          'X-Public-Access': 'true',
          'Origin': 'https://apexshare.be'
        },
        body: {
          fileName: 'direct-test.mp4',
          fileSize: 1048576,
          contentType: 'video/mp4'
        },
        failOnStatusCode: false
      }).then((uploadResponse) => {
        cy.log(`Direct upload URL status: ${uploadResponse.status}`);
        cy.log(`Direct upload URL body: ${JSON.stringify(uploadResponse.body)}`);

        if (uploadResponse.status === 200) {
          expect(uploadResponse.body).to.have.property('uploadUrl');
          cy.log('SUCCESS: Direct API calls work - issue might be in frontend');
        } else {
          cy.log(`ERROR: Direct API also fails with status ${uploadResponse.status}`);
        }
      });
    });
  });

  it('should check CloudFront caching', () => {
    cy.request({
      method: 'GET',
      url: DEBUG_UPLOAD_URL,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }).then((response) => {
      const cacheHeaders = {
        'x-cache': response.headers['x-cache'],
        'cache-control': response.headers['cache-control'],
        'expires': response.headers['expires']
      };

      cy.log(`CloudFront headers: ${JSON.stringify(cacheHeaders)}`);

      if (response.headers['x-cache'] && response.headers['x-cache'].includes('Hit')) {
        cy.log('WARNING: Content is being served from CloudFront cache');
      } else {
        cy.log('Content is fresh from origin');
      }
    });
  });
});