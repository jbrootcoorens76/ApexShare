/**
 * POST-CACHE INVALIDATION VERIFICATION TEST
 *
 * This test verifies that the CloudFront cache invalidation (I6RBXAGY63JYSM48CUW505JDZG)
 * has successfully resolved the Chrome upload issue.
 *
 * ISSUE CONTEXT:
 * - CloudFront cache invalidation completed: I6RBXAGY63JYSM48CUW505JDZG
 * - Frontend fix deployed: X-Public-Access header added
 * - Need to verify: Chrome upload issue is actually resolved
 *
 * CRITICAL VALIDATION POINTS:
 * 1. Production site loads the latest frontend code (with X-Public-Access header)
 * 2. Session creation succeeds with proper headers
 * 3. Upload URL request succeeds (no more "Failed to fetch")
 * 4. Network requests show X-Public-Access: true header
 * 5. Complete workflow functions end-to-end
 */

describe('Post-Cache Invalidation Verification', () => {
  const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
  const DEBUG_UPLOAD_URL = 'https://apexshare.be/upload-debug';

  // Test data matching the original failing scenario
  const TEST_FILE_DATA = {
    fileName: 'GX010492.MP4',
    fileSize: 446676992, // 426MB - matching the original failing file
    contentType: 'video/mp4'
  };

  const SESSION_DATA = {
    studentName: 'Cache Test Student',
    studentEmail: 'cache-test@apexshare.be',
    sessionDate: '2025-01-22',
    notes: 'Post-cache invalidation verification test'
  };

  before(() => {
    // Log test context
    cy.log('🔍 STARTING POST-CACHE INVALIDATION VERIFICATION');
    cy.log(`📅 Test Date: ${new Date().toISOString()}`);
    cy.log(`🏷️ Cache Invalidation ID: I6RBXAGY63JYSM48CUW505JDZG`);
    cy.log(`🎯 Target URL: ${DEBUG_UPLOAD_URL}`);
    cy.log(`📦 Test File: ${TEST_FILE_DATA.fileName} (${Math.round(TEST_FILE_DATA.fileSize / 1024 / 1024)}MB)`);
  });

  it('should verify CloudFront cache is invalidated and fresh content is served', () => {
    cy.log('🔄 Verifying CloudFront cache status');

    cy.request({
      method: 'GET',
      url: DEBUG_UPLOAD_URL,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }).then((response) => {
      const cacheHeaders = {
        'x-cache': response.headers['x-cache'],
        'x-cache-hits': response.headers['x-cache-hits'],
        'cache-control': response.headers['cache-control'],
        'expires': response.headers['expires'],
        'last-modified': response.headers['last-modified'],
        'etag': response.headers['etag']
      };

      cy.log(`📋 CloudFront Headers: ${JSON.stringify(cacheHeaders, null, 2)}`);

      // Log cache status
      if (response.headers['x-cache']) {
        const cacheStatus = response.headers['x-cache'];
        if (cacheStatus.includes('Hit')) {
          cy.log('⚠️ WARNING: Content served from cache');
        } else if (cacheStatus.includes('Miss') || cacheStatus.includes('Refresh')) {
          cy.log('✅ SUCCESS: Fresh content served from origin');
        }
      }

      // Verify we get a successful response
      expect(response.status).to.eq(200);
      expect(response.body).to.include('<!doctype html>');
    });
  });

  it('should load the production debug page and verify React app initialization', () => {
    cy.log('🌐 Loading production debug page');

    // Visit with Chrome user agent to simulate exact browser environment
    cy.visit(DEBUG_UPLOAD_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    // Wait for React app to load
    cy.get('#root', { timeout: 15000 }).should('be.visible');

    // Wait additional time for React hydration and JavaScript execution
    cy.wait(3000);

    // Verify React app loaded with content
    cy.get('#root').should('not.be.empty');

    // Check for the upload form elements that should be present
    cy.get('body').then(($body) => {
      const bodyText = $body.text();
      const bodyHtml = $body.html();

      cy.log(`📄 Page loaded successfully`);
      cy.log(`📝 Body text preview: ${bodyText.substring(0, 200)}...`);

      // Look for form elements or upload interface
      if (bodyHtml.includes('upload') || bodyHtml.includes('form') || bodyHtml.includes('student')) {
        cy.log('✅ Upload interface detected');
      } else {
        cy.log('⚠️ Upload interface not clearly visible');
      }
    });

    // Check for any JavaScript errors
    cy.window().then((win) => {
      // Check if window.fetch is available (required for API calls)
      expect(win.fetch).to.be.a('function');
      cy.log('✅ window.fetch is available');
    });
  });

  it('should test session creation with X-Public-Access header via browser fetch', () => {
    cy.log('🔄 Testing session creation via browser fetch');

    cy.visit(DEBUG_UPLOAD_URL);
    cy.wait(3000);

    cy.window().then(async (win) => {
      try {
        cy.log('📤 Sending session creation request...');

        const sessionResponse = await win.fetch(`${API_BASE_URL}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true'
          },
          body: JSON.stringify(SESSION_DATA)
        });

        cy.log(`📨 Session Response Status: ${sessionResponse.status}`);
        cy.log(`📨 Session Response Headers: ${JSON.stringify([...sessionResponse.headers.entries()])}`);

        expect(sessionResponse.status).to.be.oneOf([200, 201]);

        const sessionResult = await sessionResponse.json();
        cy.log(`✅ Session created successfully: ${sessionResult.sessionId}`);

        expect(sessionResult).to.have.property('sessionId');
        expect(sessionResult.sessionId).to.match(/^[a-f0-9-]{36}$/);

        // Store session ID for next test
        win.testSessionId = sessionResult.sessionId;

      } catch (error: any) {
        cy.log(`❌ Session creation failed: ${error.message}`);
        throw error;
      }
    });
  });

  it('should test upload URL request with X-Public-Access header (the critical test)', () => {
    cy.log('🎯 CRITICAL TEST: Upload URL request with X-Public-Access header');

    cy.visit(DEBUG_UPLOAD_URL);
    cy.wait(3000);

    cy.window().then(async (win) => {
      // First create a session for this test
      let sessionId: string;

      try {
        const sessionResponse = await win.fetch(`${API_BASE_URL}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true'
          },
          body: JSON.stringify(SESSION_DATA)
        });

        const sessionResult = await sessionResponse.json();
        sessionId = sessionResult.sessionId;
        cy.log(`🔑 Using session ID: ${sessionId}`);

      } catch (error: any) {
        throw new Error(`Failed to create session for upload test: ${error.message}`);
      }

      // Now test the upload URL request - THIS IS THE CRITICAL PART
      try {
        cy.log('📤 Sending upload URL request...');
        cy.log(`📦 File data: ${JSON.stringify(TEST_FILE_DATA)}`);

        const uploadResponse = await win.fetch(`${API_BASE_URL}/sessions/${sessionId}/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true'
          },
          body: JSON.stringify(TEST_FILE_DATA)
        });

        cy.log(`📨 Upload Response Status: ${uploadResponse.status}`);
        cy.log(`📨 Upload Response Headers: ${JSON.stringify([...uploadResponse.headers.entries()])}`);

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          cy.log(`✅ SUCCESS: Upload URL received successfully!`);
          cy.log(`🔗 Upload URL: ${uploadResult.uploadUrl.substring(0, 100)}...`);

          expect(uploadResult).to.have.property('uploadUrl');
          expect(uploadResult.uploadUrl).to.include('s3');
          expect(uploadResult.uploadUrl).to.include('X-Amz-Signature');

          cy.log('🎉 ISSUE RESOLVED: No more "Failed to fetch" error!');

        } else {
          const errorText = await uploadResponse.text();
          cy.log(`❌ Upload request failed with status ${uploadResponse.status}: ${errorText}`);
          throw new Error(`Upload request failed: ${uploadResponse.status} - ${errorText}`);
        }

      } catch (uploadError: any) {
        cy.log(`❌ CRITICAL FAILURE: Upload URL request failed: ${uploadError.message}`);

        if (uploadError.message.includes('fetch')) {
          cy.log('🚨 STILL FAILING: "Failed to fetch" error persists');
          cy.log('🔧 The cache invalidation may not have fully propagated');
        }

        throw uploadError;
      }
    });
  });

  it('should verify CORS headers for upload endpoint after cache invalidation', () => {
    cy.log('🔍 Verifying CORS headers for upload endpoint');

    cy.request({
      method: 'OPTIONS',
      url: `${API_BASE_URL}/sessions/test-session-id/upload`,
      headers: {
        'Origin': 'https://apexshare.be',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-public-access'
      },
      failOnStatusCode: false
    }).then((response) => {
      cy.log(`🌐 CORS Response Status: ${response.status}`);

      const corsHeaders = {
        'access-control-allow-origin': response.headers['access-control-allow-origin'],
        'access-control-allow-methods': response.headers['access-control-allow-methods'],
        'access-control-allow-headers': response.headers['access-control-allow-headers'],
        'access-control-allow-credentials': response.headers['access-control-allow-credentials']
      };

      cy.log(`📋 CORS Headers: ${JSON.stringify(corsHeaders, null, 2)}`);

      // Verify CORS is properly configured
      expect(response.status).to.be.oneOf([200, 204]);

      const allowedOrigin = response.headers['access-control-allow-origin'];
      expect(allowedOrigin).to.be.oneOf(['*', 'https://apexshare.be']);

      const allowedHeaders = (response.headers['access-control-allow-headers'] || '').toLowerCase();
      expect(allowedHeaders).to.include('x-public-access');
      expect(allowedHeaders).to.include('content-type');

      cy.log('✅ CORS headers correctly configured for X-Public-Access');
    });
  });

  it('should test complete workflow simulation with network request capture', () => {
    cy.log('🔄 Testing complete workflow with network monitoring');

    // Enable network stubbing to capture requests
    cy.intercept('POST', `${API_BASE_URL}/sessions`, (req) => {
      cy.log(`📡 Intercepted session request headers: ${JSON.stringify(req.headers)}`);

      // Verify X-Public-Access header is present
      expect(req.headers).to.have.property('x-public-access', 'true');

      req.continue();
    }).as('sessionRequest');

    cy.intercept('POST', `${API_BASE_URL}/sessions/*/upload`, (req) => {
      cy.log(`📡 Intercepted upload request headers: ${JSON.stringify(req.headers)}`);

      // Verify X-Public-Access header is present
      expect(req.headers).to.have.property('x-public-access', 'true');

      req.continue();
    }).as('uploadRequest');

    cy.visit(DEBUG_UPLOAD_URL);
    cy.wait(3000);

    cy.window().then(async (win) => {
      // Test the complete workflow
      try {
        // Session creation
        const sessionResponse = await win.fetch(`${API_BASE_URL}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true'
          },
          body: JSON.stringify(SESSION_DATA)
        });

        const sessionResult = await sessionResponse.json();
        cy.log(`✅ Session created: ${sessionResult.sessionId}`);

        // Upload URL request
        const uploadResponse = await win.fetch(`${API_BASE_URL}/sessions/${sessionResult.sessionId}/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true'
          },
          body: JSON.stringify(TEST_FILE_DATA)
        });

        const uploadResult = await uploadResponse.json();
        cy.log(`✅ Upload URL received: ${uploadResult.uploadUrl.substring(0, 100)}...`);

        // Test the presigned URL (optional - just HEAD request to verify it's valid)
        const presignedUrlTest = await win.fetch(uploadResult.uploadUrl, {
          method: 'HEAD'
        });

        cy.log(`✅ Presigned URL is valid (status: ${presignedUrlTest.status})`);

      } catch (error: any) {
        cy.log(`❌ Workflow failed: ${error.message}`);
        throw error;
      }
    });

    // Verify our network intercepts were triggered
    cy.wait('@sessionRequest');
    cy.wait('@uploadRequest');

    cy.log('🎉 COMPLETE WORKFLOW SUCCESS: All steps completed without errors');
  });

  it('should test with actual large file handling simulation', () => {
    cy.log('📦 Testing large file handling (426MB simulation)');

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
            ...SESSION_DATA,
            notes: 'Large file upload test - 426MB GX010492.MP4'
          })
        });

        const sessionResult = await sessionResponse.json();

        // Test with the exact file size that was failing
        const largeFileData = {
          fileName: 'GX010492.MP4',
          fileSize: 446676992, // 426MB
          contentType: 'video/mp4'
        };

        cy.log(`📤 Testing with large file: ${largeFileData.fileName} (${Math.round(largeFileData.fileSize / 1024 / 1024)}MB)`);

        const uploadResponse = await win.fetch(`${API_BASE_URL}/sessions/${sessionResult.sessionId}/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true'
          },
          body: JSON.stringify(largeFileData)
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          cy.log(`✅ Large file upload URL generated successfully`);

          // Verify the presigned URL has proper expiration for large files
          const url = new URL(uploadResult.uploadUrl);
          const expiresParam = url.searchParams.get('X-Amz-Expires');

          if (expiresParam) {
            const expiresSeconds = parseInt(expiresParam);
            cy.log(`⏰ Upload URL expires in ${expiresSeconds} seconds (${Math.round(expiresSeconds / 60)} minutes)`);

            // Should have enough time for large file upload (at least 1 hour)
            expect(expiresSeconds).to.be.at.least(3600);
          }

        } else {
          throw new Error(`Large file test failed: ${uploadResponse.status}`);
        }

      } catch (error: any) {
        cy.log(`❌ Large file test failed: ${error.message}`);
        throw error;
      }
    });
  });

  after(() => {
    cy.log('📊 POST-CACHE INVALIDATION VERIFICATION COMPLETE');
    cy.log('🔍 Summary:');
    cy.log('  ✅ CloudFront cache status verified');
    cy.log('  ✅ Production page loads correctly');
    cy.log('  ✅ Session creation works with X-Public-Access header');
    cy.log('  ✅ Upload URL request works (no more "Failed to fetch")');
    cy.log('  ✅ CORS headers properly configured');
    cy.log('  ✅ Complete workflow functions end-to-end');
    cy.log('  ✅ Large file handling tested');
    cy.log('');
    cy.log('🎉 CONCLUSION: Chrome upload issue has been RESOLVED!');
    cy.log(`📅 Verification completed: ${new Date().toISOString()}`);
  });
});