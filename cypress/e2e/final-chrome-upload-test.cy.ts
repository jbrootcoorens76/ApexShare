/**
 * FINAL CHROME UPLOAD TEST
 *
 * This test will give us definitive evidence about whether the Chrome upload issue is resolved.
 */

describe('Final Chrome Upload Test', () => {
  const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';

  it('should test complete upload workflow step by step', () => {
    cy.log('🎯 FINAL TEST: Chrome Upload Issue Verification');

    // Step 1: Test session creation
    cy.log('📤 Step 1: Testing session creation...');
    cy.request({
      method: 'POST',
      url: `${API_BASE_URL}/sessions`,
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Access': 'true',
        'Origin': 'https://apexshare.be'
      },
      body: {
        studentName: 'Final Test Student',
        studentEmail: 'finaltest@test.com',
        sessionDate: '2025-01-22',
        notes: 'Final verification test'
      },
      failOnStatusCode: false
    }).then((sessionResponse) => {
      cy.log(`📊 Session Response Status: ${sessionResponse.status}`);
      cy.log(`📊 Session Response Body: ${JSON.stringify(sessionResponse.body)}`);

      if (sessionResponse.status >= 200 && sessionResponse.status < 300) {
        cy.log('✅ Session creation: SUCCESS');

        // Extract session ID from response (handle different response formats)
        let sessionId;
        if (sessionResponse.body.sessionId) {
          sessionId = sessionResponse.body.sessionId;
        } else if (sessionResponse.body.data && sessionResponse.body.data.sessionId) {
          sessionId = sessionResponse.body.data.sessionId;
        } else if (sessionResponse.body.id) {
          sessionId = sessionResponse.body.id;
        } else {
          cy.log('❌ Cannot find session ID in response');
          return;
        }

        cy.log(`🔑 Session ID: ${sessionId}`);

        // Step 2: Test upload URL request (the critical test)
        cy.log('📤 Step 2: Testing upload URL request (CRITICAL TEST)...');
        cy.request({
          method: 'POST',
          url: `${API_BASE_URL}/sessions/${sessionId}/upload`,
          headers: {
            'Content-Type': 'application/json',
            'X-Public-Access': 'true',
            'Origin': 'https://apexshare.be'
          },
          body: {
            fileName: 'GX010492.MP4',
            fileSize: 446676992,
            contentType: 'video/mp4'
          },
          failOnStatusCode: false
        }).then((uploadResponse) => {
          cy.log(`📊 Upload Response Status: ${uploadResponse.status}`);
          cy.log(`📊 Upload Response Body: ${JSON.stringify(uploadResponse.body)}`);

          if (uploadResponse.status === 200 && uploadResponse.body.uploadUrl) {
            cy.log('🎉 ISSUE RESOLVED: Upload URL request SUCCESS!');
            cy.log('✅ The Chrome "Failed to fetch" issue has been FIXED!');
            cy.log(`🔗 Upload URL received: ${uploadResponse.body.uploadUrl.substring(0, 100)}...`);
          } else {
            cy.log('❌ ISSUE NOT RESOLVED: Upload URL request still failing');
            cy.log(`💡 Status: ${uploadResponse.status}`);
            cy.log(`💡 Body: ${JSON.stringify(uploadResponse.body)}`);
          }
        });

      } else {
        cy.log('❌ Session creation failed');
        cy.log(`💡 Status: ${sessionResponse.status}`);
        cy.log(`💡 Body: ${JSON.stringify(sessionResponse.body)}`);
      }
    });
  });

  it('should verify CORS configuration for upload endpoint', () => {
    cy.log('🌐 Testing CORS configuration for upload endpoint');

    cy.request({
      method: 'OPTIONS',
      url: `${API_BASE_URL}/sessions/test/upload`,
      headers: {
        'Origin': 'https://apexshare.be',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-public-access'
      },
      failOnStatusCode: false
    }).then((response) => {
      cy.log(`📊 CORS Preflight Status: ${response.status}`);
      cy.log(`📊 CORS Headers: ${JSON.stringify(response.headers)}`);

      const allowedHeaders = (response.headers['access-control-allow-headers'] || '').toLowerCase();
      const allowedOrigin = response.headers['access-control-allow-origin'];

      if (allowedHeaders.includes('x-public-access')) {
        cy.log('✅ CORS: X-Public-Access header is allowed');
      } else {
        cy.log('❌ CORS: X-Public-Access header is NOT allowed');
        cy.log('💡 This would cause "Failed to fetch" errors in browsers');
      }

      if (allowedOrigin === '*' || allowedOrigin === 'https://apexshare.be') {
        cy.log('✅ CORS: Origin is allowed');
      } else {
        cy.log(`❌ CORS: Origin not properly configured (${allowedOrigin})`);
      }
    });
  });

  it('should check CloudFront cache status for frontend', () => {
    cy.log('📊 Checking CloudFront cache status');

    cy.request({
      method: 'GET',
      url: 'https://apexshare.be/upload-debug',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }).then((response) => {
      const cacheHeaders = {
        'x-cache': response.headers['x-cache'],
        'x-cache-hits': response.headers['x-cache-hits'],
        'cache-control': response.headers['cache-control']
      };

      cy.log(`📊 Cache Headers: ${JSON.stringify(cacheHeaders)}`);

      const cacheStatus = response.headers['x-cache'] || 'unknown';
      if (cacheStatus.includes('Hit')) {
        cy.log('⚠️ WARNING: Content still being served from CloudFront cache');
        cy.log('💡 The cache invalidation may not have fully propagated yet');
      } else if (cacheStatus.includes('Miss') || cacheStatus.includes('Refresh')) {
        cy.log('✅ SUCCESS: Fresh content being served from origin');
      } else {
        cy.log(`📊 Cache status: ${cacheStatus}`);
      }

      // Check if the HTML contains the latest build
      if (response.body.includes('index-DfPcGMHF.js')) {
        cy.log('✅ Latest frontend build detected');
      } else {
        cy.log('⚠️ May not be the latest frontend build');
      }
    });
  });

  after(() => {
    cy.log('');
    cy.log('🏁 FINAL CHROME UPLOAD TEST COMPLETE');
    cy.log('');
    cy.log('📋 SUMMARY:');
    cy.log('  Check the logs above for:');
    cy.log('  1. Session creation status');
    cy.log('  2. Upload URL request status (THE CRITICAL TEST)');
    cy.log('  3. CORS configuration status');
    cy.log('  4. Cache invalidation status');
    cy.log('');
    cy.log('🎯 If upload URL request shows status 200 with uploadUrl in response:');
    cy.log('   ✅ ISSUE IS RESOLVED!');
    cy.log('');
    cy.log('🎯 If upload URL request still fails:');
    cy.log('   ❌ Issue persists - may need additional cache invalidation time');
    cy.log('');
  });
});