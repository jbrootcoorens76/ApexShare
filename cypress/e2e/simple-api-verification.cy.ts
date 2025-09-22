/**
 * SIMPLE API VERIFICATION
 *
 * Direct test of the API endpoints to determine if the issue is resolved.
 */

describe('Simple API Verification', () => {
  const API_BASE_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';

  it('should test session creation with direct API call', () => {
    cy.request({
      method: 'POST',
      url: `${API_BASE_URL}/sessions`,
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Access': 'true',
        'Origin': 'https://apexshare.be'
      },
      body: {
        studentName: 'API Test Student',
        studentEmail: 'apitest@test.com',
        sessionDate: '2025-01-22',
        notes: 'Direct API test'
      }
    }).then((response) => {
      cy.log(`Session creation status: ${response.status}`);
      cy.log(`Session response body: ${JSON.stringify(response.body)}`);

      expect(response.status).to.be.oneOf([200, 201]);
      expect(response.body).to.have.property('sessionId');

      const sessionId = response.body.sessionId;

      // Now test upload URL request
      cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/sessions/${sessionId}/upload`,
        headers: {
          'Content-Type': 'application/json',
          'X-Public-Access': 'true',
          'Origin': 'https://apexshare.be'
        },
        body: {
          fileName: 'test-video.mp4',
          fileSize: 446676992,
          contentType: 'video/mp4'
        },
        failOnStatusCode: false
      }).then((uploadResponse) => {
        cy.log(`Upload request status: ${uploadResponse.status}`);
        cy.log(`Upload response body: ${JSON.stringify(uploadResponse.body)}`);

        if (uploadResponse.status === 200) {
          cy.log('✅ SUCCESS: Upload URL request works');
          expect(uploadResponse.body).to.have.property('uploadUrl');
        } else {
          cy.log(`❌ STILL FAILING: Upload request failed with ${uploadResponse.status}`);
          cy.log(`Error details: ${JSON.stringify(uploadResponse.body)}`);
        }
      });
    });
  });

  it('should test CORS preflight for upload endpoint', () => {
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
      cy.log(`CORS preflight status: ${response.status}`);
      cy.log(`CORS headers: ${JSON.stringify(response.headers)}`);

      const allowedHeaders = (response.headers['access-control-allow-headers'] || '').toLowerCase();
      if (allowedHeaders.includes('x-public-access')) {
        cy.log('✅ X-Public-Access header is allowed');
      } else {
        cy.log('❌ X-Public-Access header is NOT allowed - this is the problem');
      }
    });
  });

  it('should check frontend cache status', () => {
    cy.request({
      method: 'GET',
      url: 'https://apexshare.be/upload-debug',
      headers: {
        'Cache-Control': 'no-cache'
      }
    }).then((response) => {
      cy.log(`Frontend status: ${response.status}`);
      cy.log(`Cache headers: ${JSON.stringify({
        'x-cache': response.headers['x-cache'],
        'cache-control': response.headers['cache-control']
      })}`);

      const cacheStatus = response.headers['x-cache'] || 'unknown';
      if (cacheStatus.includes('Hit')) {
        cy.log('⚠️ WARNING: Still serving from cache');
      } else {
        cy.log('✅ Serving fresh content');
      }
    });
  });
});