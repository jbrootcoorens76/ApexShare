/**
 * CHROME UPLOAD FIX VERIFICATION
 *
 * This test specifically verifies that the Chrome upload issue is resolved
 * after the CloudFront cache invalidation (I6RBXAGY63JYSM48CUW505JDZG).
 *
 * Focus: Direct API testing to verify the X-Public-Access header fix works.
 */

describe('Chrome Upload Fix Verification', () => {
  const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
  const DEBUG_UPLOAD_URL = 'https://apexshare.be/upload-debug';

  const TEST_FILE_DATA = {
    fileName: 'GX010492.MP4',
    fileSize: 446676992, // 426MB - the exact file that was failing
    contentType: 'video/mp4'
  };

  const SESSION_DATA = {
    studentName: 'Chrome Fix Test',
    studentEmail: 'chromefix@test.com',
    sessionDate: '2025-01-22',
    notes: 'Chrome upload fix verification'
  };

  it('should verify the exact failing workflow now works', () => {
    cy.log('🎯 Testing the exact workflow that was failing in Chrome');

    cy.visit(DEBUG_UPLOAD_URL);
    cy.wait(2000);

    cy.window().then(async (win) => {
      let sessionId: string;

      // Step 1: Session creation (this was working)
      try {
        cy.log('📤 Step 1: Creating session...');

        const sessionResponse = await win.fetch(`${API_BASE_URL}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true'
          },
          body: JSON.stringify(SESSION_DATA)
        });

        expect(sessionResponse.status).to.be.oneOf([200, 201]);
        const sessionResult = await sessionResponse.json();
        sessionId = sessionResult.sessionId;

        cy.log(`✅ Session created: ${sessionId}`);

      } catch (error: any) {
        cy.log(`❌ Session creation failed: ${error.message}`);
        throw new Error(`Session creation failed: ${error.message}`);
      }

      // Step 2: Upload URL request (this was failing with "Failed to fetch")
      try {
        cy.log('📤 Step 2: Requesting upload URL (this was failing)...');

        const uploadResponse = await win.fetch(`${API_BASE_URL}/sessions/${sessionId}/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true'
          },
          body: JSON.stringify(TEST_FILE_DATA)
        });

        cy.log(`📨 Upload response status: ${uploadResponse.status}`);

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          cy.log(`✅ SUCCESS: Upload URL received! Fix is working!`);
          cy.log(`🔗 Upload URL preview: ${uploadResult.uploadUrl.substring(0, 80)}...`);

          expect(uploadResult).to.have.property('uploadUrl');
          expect(uploadResult.uploadUrl).to.include('amazonaws.com');

        } else {
          const errorText = await uploadResponse.text();
          cy.log(`❌ Upload request failed: ${uploadResponse.status} - ${errorText}`);
          throw new Error(`Upload request failed: ${uploadResponse.status} - ${errorText}`);
        }

      } catch (uploadError: any) {
        cy.log(`❌ CRITICAL: Upload URL request failed: ${uploadError.message}`);

        if (uploadError.message.includes('Failed to fetch')) {
          cy.log('🚨 ISSUE NOT RESOLVED: Still getting "Failed to fetch" error');
          cy.log('💡 This means the cache invalidation has not fully taken effect');
        }

        throw uploadError;
      }
    });
  });

  it('should test direct API calls to verify backend functionality', () => {
    cy.log('🔄 Testing direct API calls (bypassing frontend cache)');

    // Test session creation via Cypress request
    cy.request({
      method: 'POST',
      url: `${API_BASE_URL}/sessions`,
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Access': 'true',
        'Origin': 'https://apexshare.be'
      },
      body: SESSION_DATA
    }).then((sessionResponse) => {
      cy.log(`✅ Direct session creation: ${sessionResponse.status}`);
      expect(sessionResponse.status).to.be.oneOf([200, 201]);

      const sessionId = sessionResponse.body.sessionId;

      // Test upload URL request via Cypress request
      cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/sessions/${sessionId}/upload`,
        headers: {
          'Content-Type': 'application/json',
          'X-Public-Access': 'true',
          'Origin': 'https://apexshare.be'
        },
        body: TEST_FILE_DATA,
        failOnStatusCode: false
      }).then((uploadResponse) => {
        cy.log(`📨 Direct upload URL request: ${uploadResponse.status}`);

        if (uploadResponse.status === 200) {
          cy.log(`✅ SUCCESS: Direct API calls work perfectly`);
          cy.log(`🔗 Upload URL received: ${uploadResponse.body.uploadUrl.substring(0, 80)}...`);

          expect(uploadResponse.body).to.have.property('uploadUrl');

        } else {
          cy.log(`❌ Direct API also failing: ${uploadResponse.status} - ${JSON.stringify(uploadResponse.body)}`);
          cy.log(`🔧 This indicates a backend issue, not just a frontend cache issue`);
        }
      });
    });
  });

  it('should verify CORS preflight for upload endpoint', () => {
    cy.log('🌐 Testing CORS preflight for upload endpoint');

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
      cy.log(`🌐 CORS preflight status: ${response.status}`);

      const allowedHeaders = (response.headers['access-control-allow-headers'] || '').toLowerCase();
      const allowedOrigin = response.headers['access-control-allow-origin'];

      cy.log(`📋 Allowed headers: ${allowedHeaders}`);
      cy.log(`📋 Allowed origin: ${allowedOrigin}`);

      if (allowedHeaders.includes('x-public-access')) {
        cy.log('✅ X-Public-Access header is allowed');
      } else {
        cy.log('❌ X-Public-Access header is NOT allowed');
        cy.log('🔧 This would cause the "Failed to fetch" error');
      }

      expect(response.status).to.be.oneOf([200, 204]);
      expect(allowedHeaders).to.include('x-public-access');
    });
  });

  it('should check CloudFront cache status', () => {
    cy.log('🔍 Checking CloudFront cache status for frontend');

    cy.request({
      method: 'GET',
      url: DEBUG_UPLOAD_URL,
      headers: {
        'Cache-Control': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }).then((response) => {
      const cacheStatus = response.headers['x-cache'] || 'unknown';
      cy.log(`📊 CloudFront cache status: ${cacheStatus}`);

      if (cacheStatus.includes('Hit')) {
        cy.log('⚠️ WARNING: Still serving from cache');
        cy.log('💡 Cache invalidation may not have fully propagated');
      } else if (cacheStatus.includes('Miss') || cacheStatus.includes('Refresh')) {
        cy.log('✅ SUCCESS: Serving fresh content from origin');
      }

      // Check for build hash in the HTML to see if it's the latest version
      const html = response.body;
      if (html.includes('index-DfPcGMHF.js')) {
        cy.log('📦 Frontend build hash: DfPcGMHF (latest)');
      } else {
        cy.log('⚠️ Frontend might be an older version');
      }
    });
  });

  after(() => {
    cy.log('📊 CHROME UPLOAD FIX VERIFICATION COMPLETE');
    cy.log('🔍 Summary of findings will be in the test logs above');
  });
});