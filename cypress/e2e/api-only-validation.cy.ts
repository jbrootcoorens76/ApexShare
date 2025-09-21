describe('API-Only Validation Tests', () => {
  const API_BASE_URL = 'https://api.apexshare.be';
  const FRONTEND_URL = 'https://apexshare.be';

  describe('CORS and API Endpoint Testing', () => {
    it('should test CORS preflight for /uploads/initiate', () => {
      cy.request({
        method: 'OPTIONS',
        url: `${API_BASE_URL}/uploads/initiate`,
        headers: {
          'Origin': FRONTEND_URL,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'X-Auth-Token,Content-Type,X-Public-Access'
        },
        failOnStatusCode: false
      }).then((response) => {
        cy.log('CORS Preflight Response Status:', response.status);
        cy.log('CORS Preflight Response Headers:', JSON.stringify(response.headers, null, 2));
        cy.log('CORS Preflight Response Body:', JSON.stringify(response.body, null, 2));

        // Should get 200 for OPTIONS
        expect(response.status).to.equal(200);

        // Check CORS headers
        expect(response.headers).to.have.property('access-control-allow-origin');
        expect(response.headers).to.have.property('access-control-allow-methods');
        expect(response.headers).to.have.property('access-control-allow-headers');

        // Verify X-Auth-Token is in allowed headers
        const allowedHeaders = response.headers['access-control-allow-headers'];
        expect(allowedHeaders.toLowerCase()).to.include('x-auth-token');
      });
    });

    it('should test CORS preflight for /sessions endpoint', () => {
      cy.request({
        method: 'OPTIONS',
        url: `${API_BASE_URL}/sessions`,
        headers: {
          'Origin': FRONTEND_URL,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'X-Auth-Token,Content-Type'
        },
        failOnStatusCode: false
      }).then((response) => {
        cy.log('Sessions CORS Preflight Response Status:', response.status);
        cy.log('Sessions CORS Preflight Response Headers:', JSON.stringify(response.headers, null, 2));

        // Should get 200 for OPTIONS
        expect(response.status).to.equal(200);

        // Check CORS headers
        expect(response.headers).to.have.property('access-control-allow-origin');
        expect(response.headers).to.have.property('access-control-allow-methods');
        expect(response.headers).to.have.property('access-control-allow-headers');
      });
    });

    it('should test /sessions endpoint with X-Auth-Token', () => {
      cy.request({
        method: 'GET',
        url: `${API_BASE_URL}/sessions`,
        headers: {
          'X-Auth-Token': 'test-token-123',
          'Content-Type': 'application/json',
          'Origin': FRONTEND_URL
        },
        failOnStatusCode: false
      }).then((response) => {
        cy.log('Sessions API Response Status:', response.status);
        cy.log('Sessions API Response Headers:', JSON.stringify(response.headers, null, 2));
        cy.log('Sessions API Response Body:', JSON.stringify(response.body, null, 2));

        // Check that we don't get CORS errors (status 0)
        expect(response.status).to.not.equal(0);

        // Acceptable responses: 200 (success), 401 (unauthorized), 403 (forbidden)
        expect([200, 401, 403]).to.include(response.status);

        // Verify CORS headers
        expect(response.headers).to.have.property('access-control-allow-origin');
      });
    });

    it('should test /uploads/initiate with X-Auth-Token authentication', () => {
      const uploadData = {
        fileName: 'test-video.mp4',
        fileSize: 1024000,
        fileType: 'video/mp4',
        studentEmail: 'test@example.com',
        sessionDate: '2024-01-15',
        trainerName: 'Test Trainer',
        sessionLocation: 'Test Location',
        sessionNotes: 'Test notes'
      };

      cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/uploads/initiate`,
        headers: {
          'X-Auth-Token': 'test-token-123',
          'Content-Type': 'application/json',
          'Origin': FRONTEND_URL
        },
        body: uploadData,
        failOnStatusCode: false
      }).then((response) => {
        cy.log('Upload Initiate Response Status:', response.status);
        cy.log('Upload Initiate Response Headers:', JSON.stringify(response.headers, null, 2));
        cy.log('Upload Initiate Response Body:', JSON.stringify(response.body, null, 2));

        // Should not be a CORS error
        expect(response.status).to.not.equal(0);

        // Check for proper status codes
        if (response.status === 200) {
          // Success case
          expect(response.body).to.have.property('uploadUrl');
          expect(response.body).to.have.property('uploadId');
        } else if (response.status === 401) {
          // Unauthorized (expected with test token)
          expect(response.body).to.have.property('message');
        } else if (response.status === 400) {
          // Bad request - check error details
          cy.log('Bad Request Error:', response.body);
        } else if (response.status === 403) {
          // Forbidden
          cy.log('Forbidden Error:', response.body);
        }
      });
    });

    it('should test /uploads/initiate with X-Public-Access header', () => {
      const uploadData = {
        fileName: 'test-video.mp4',
        fileSize: 1024000,
        fileType: 'video/mp4',
        studentEmail: 'test@example.com',
        sessionDate: '2024-01-15',
        trainerName: 'Test Trainer',
        sessionLocation: 'Test Location',
        sessionNotes: 'Test notes'
      };

      cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/uploads/initiate`,
        headers: {
          'X-Public-Access': 'true',
          'Content-Type': 'application/json',
          'Origin': FRONTEND_URL
        },
        body: uploadData,
        failOnStatusCode: false
      }).then((response) => {
        cy.log('Public Access Upload Response Status:', response.status);
        cy.log('Public Access Upload Response Headers:', JSON.stringify(response.headers, null, 2));
        cy.log('Public Access Upload Response Body:', JSON.stringify(response.body, null, 2));

        // Should not be a CORS error
        expect(response.status).to.not.equal(0);

        // Public access should work
        if (response.status === 200) {
          expect(response.body).to.have.property('uploadUrl');
          expect(response.body).to.have.property('uploadId');
        } else {
          cy.log('Public access failed with status:', response.status);
          cy.log('Response body:', response.body);
        }
      });
    });

    it('should test /uploads/initiate without any auth headers', () => {
      const uploadData = {
        fileName: 'test-video.mp4',
        fileSize: 1024000,
        fileType: 'video/mp4',
        studentEmail: 'test@example.com',
        sessionDate: '2024-01-15',
        trainerName: 'Test Trainer',
        sessionLocation: 'Test Location',
        sessionNotes: 'Test notes'
      };

      cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/uploads/initiate`,
        headers: {
          'Content-Type': 'application/json',
          'Origin': FRONTEND_URL
        },
        body: uploadData,
        failOnStatusCode: false
      }).then((response) => {
        cy.log('No Auth Upload Response Status:', response.status);
        cy.log('No Auth Upload Response Headers:', JSON.stringify(response.headers, null, 2));
        cy.log('No Auth Upload Response Body:', JSON.stringify(response.body, null, 2));

        // Should not be a CORS error
        expect(response.status).to.not.equal(0);

        // This should probably fail with 401/403
        expect([401, 403, 400]).to.include(response.status);
      });
    });
  });

  describe('API Response Structure Validation', () => {
    it('should validate error response format for missing authentication', () => {
      cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/uploads/initiate`,
        headers: {
          'Content-Type': 'application/json',
          'Origin': FRONTEND_URL
        },
        body: {},
        failOnStatusCode: false
      }).then((response) => {
        // Should have proper error structure
        if (response.status >= 400) {
          expect(response.body).to.have.property('message');
          // Check if error message is informative
          expect(response.body.message).to.be.a('string');
          expect(response.body.message.length).to.be.greaterThan(0);
        }
      });
    });

    it('should validate required CORS headers are present in all responses', () => {
      const endpoints = [
        { method: 'GET', url: `${API_BASE_URL}/sessions` },
        { method: 'POST', url: `${API_BASE_URL}/uploads/initiate` }
      ];

      endpoints.forEach(endpoint => {
        cy.request({
          method: endpoint.method,
          url: endpoint.url,
          headers: {
            'Content-Type': 'application/json',
            'Origin': FRONTEND_URL
          },
          body: endpoint.method === 'POST' ? {} : undefined,
          failOnStatusCode: false
        }).then((response) => {
          cy.log(`Testing CORS headers for ${endpoint.method} ${endpoint.url}`);

          // All responses should have CORS headers
          expect(response.headers).to.have.property('access-control-allow-origin');

          // The origin should be allowed
          const allowedOrigin = response.headers['access-control-allow-origin'];
          expect(allowedOrigin === '*' || allowedOrigin === FRONTEND_URL).to.be.true;
        });
      });
    });
  });
});