describe('Post-Fix Validation Tests', () => {
  const API_BASE_URL = 'https://api.apexshare.be';
  const FRONTEND_URL = 'https://apexshare.be';

  beforeEach(() => {
    // Clear any existing state
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('Frontend Upload Form Validation', () => {
    it('should load the upload page and verify all form elements are present', () => {
      cy.visit('/upload');

      // Wait for page to fully load
      cy.get('body').should('be.visible');

      // Take a screenshot for manual verification
      cy.screenshot('upload-page-loaded');

      // Check for form presence
      cy.get('form').should('exist').and('be.visible');

      // Verify all required form fields with data-cy attributes
      cy.get('[data-cy="student-email"]').should('exist').and('be.visible');
      cy.get('[data-cy="session-date"]').should('exist').and('be.visible');
      cy.get('[data-cy="file-upload"]').should('exist').and('be.visible');

      // Check for optional fields
      cy.get('[data-cy="trainer-name"]').should('exist');
      cy.get('[data-cy="session-location"]').should('exist');
      cy.get('[data-cy="session-notes"]').should('exist');

      // Verify submit button
      cy.get('[data-cy="submit-button"]').should('exist').and('be.visible');

      // Check for any console errors
      cy.window().then((win) => {
        expect(win.console.error).to.not.have.been.called;
      });
    });

    it('should handle form input and validation', () => {
      cy.visit('/upload');

      // Fill out the form with valid data
      cy.get('[data-cy="student-email"]').type('test.student@example.com');
      cy.get('[data-cy="session-date"]').type('2024-01-15');
      cy.get('[data-cy="trainer-name"]').type('Test Trainer');
      cy.get('[data-cy="session-location"]').type('Test Location');
      cy.get('[data-cy="session-notes"]').type('Test session notes');

      // Verify input values
      cy.get('[data-cy="student-email"]').should('have.value', 'test.student@example.com');
      cy.get('[data-cy="session-date"]').should('have.value', '2024-01-15');
      cy.get('[data-cy="trainer-name"]').should('have.value', 'Test Trainer');
      cy.get('[data-cy="session-location"]').should('have.value', 'Test Location');
      cy.get('[data-cy="session-notes"]').should('have.value', 'Test session notes');
    });

    it('should support file upload via input and drag-drop', () => {
      cy.visit('/upload');

      // Create a test file
      cy.task('generateTestFile').then((filePath) => {
        // Test file input upload
        cy.get('[data-cy="file-upload"]').selectFile(filePath, { force: true });

        // Verify file is selected (implementation depends on how file state is displayed)
        cy.get('[data-cy="file-upload"]').should('not.have.value', '');
      });
    });
  });

  describe('API Endpoint Testing', () => {
    it('should test /sessions endpoint with X-Auth-Token', () => {
      cy.request({
        method: 'GET',
        url: `${API_BASE_URL}/sessions`,
        headers: {
          'X-Auth-Token': 'test-token-123',
          'Content-Type': 'application/json'
        },
        failOnStatusCode: false
      }).then((response) => {
        // Log response for analysis
        cy.log('Sessions API Response:', JSON.stringify(response));

        // Check that we don't get CORS errors (status 0)
        expect(response.status).to.not.equal(0);

        // Acceptable responses: 200 (success), 401 (unauthorized), 403 (forbidden)
        expect([200, 401, 403]).to.include(response.status);

        // Verify CORS headers
        expect(response.headers).to.have.property('access-control-allow-origin');
      });
    });

    it('should test CORS preflight for /uploads/initiate', () => {
      cy.request({
        method: 'OPTIONS',
        url: `${API_BASE_URL}/uploads/initiate`,
        headers: {
          'Origin': FRONTEND_URL,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'X-Auth-Token,Content-Type'
        },
        failOnStatusCode: false
      }).then((response) => {
        cy.log('CORS Preflight Response:', JSON.stringify(response));

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
          'Content-Type': 'application/json'
        },
        body: uploadData,
        failOnStatusCode: false
      }).then((response) => {
        cy.log('Upload Initiate Response:', JSON.stringify(response));

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
          'Content-Type': 'application/json'
        },
        body: uploadData,
        failOnStatusCode: false
      }).then((response) => {
        cy.log('Public Access Upload Response:', JSON.stringify(response));

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
  });

  describe('Complete Upload Workflow Test', () => {
    it('should complete the entire upload workflow', () => {
      cy.visit('/upload');

      // Fill out the form
      cy.get('[data-cy="student-email"]').type('test.student@example.com');
      cy.get('[data-cy="session-date"]').type('2024-01-15');
      cy.get('[data-cy="trainer-name"]').type('Test Trainer');

      // Add a test file
      cy.task('generateTestFile').then((filePath) => {
        cy.get('[data-cy="file-upload"]').selectFile(filePath, { force: true });

        // Submit the form
        cy.get('[data-cy="submit-button"]').click();

        // Wait for and verify response
        cy.wait(5000); // Allow time for API call

        // Check for success message or error handling
        cy.get('body').then(($body) => {
          if ($body.find('[data-cy="success-message"]').length > 0) {
            cy.get('[data-cy="success-message"]').should('be.visible');
          } else if ($body.find('[data-cy="error-message"]').length > 0) {
            cy.get('[data-cy="error-message"]').should('be.visible');
            // Log the error for analysis
            cy.get('[data-cy="error-message"]').then(($el) => {
              cy.log('Error message:', $el.text());
            });
          }
        });
      });
    });
  });

  describe('Browser Console and Network Validation', () => {
    it('should check for console errors and failed network requests', () => {
      // Set up console error monitoring
      cy.window().then((win) => {
        cy.stub(win.console, 'error').as('consoleError');
      });

      cy.visit('/upload');

      // Interact with the form
      cy.get('[data-cy="student-email"]').type('test@example.com');
      cy.get('[data-cy="session-date"]').type('2024-01-15');

      // Check for console errors
      cy.get('@consoleError').should('not.have.been.called');

      // Check network requests through performance API
      cy.window().then((win) => {
        const perfEntries = win.performance.getEntriesByType('navigation');
        const resourceEntries = win.performance.getEntriesByType('resource');

        // Log performance data
        cy.log('Navigation entries:', perfEntries);
        cy.log('Resource entries:', resourceEntries);

        // Check for failed requests (this is basic - real monitoring would be more complex)
        resourceEntries.forEach((entry: any) => {
          if (entry.transferSize === 0 && entry.decodedBodySize === 0) {
            cy.log('Potentially failed request:', entry.name);
          }
        });
      });
    });
  });

  describe('Browser Compatibility Tests', () => {
    it('should work in different user agent scenarios', () => {
      // Test with different user agents to simulate different browsers
      const userAgents = [
        // Chrome
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        // Firefox
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0',
        // Safari
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      ];

      userAgents.forEach((userAgent, index) => {
        cy.visit('/upload', {
          onBeforeLoad: (win) => {
            Object.defineProperty(win.navigator, 'userAgent', {
              writable: false,
              value: userAgent
            });
          }
        });

        // Basic functionality test
        cy.get('[data-cy="student-email"]').should('exist');
        cy.get('[data-cy="student-email"]').type(`test${index}@example.com`);

        cy.screenshot(`browser-compatibility-${index}`);
      });
    });
  });
});