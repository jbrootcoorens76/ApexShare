describe('Detailed API Analysis', () => {
  const API_BASE_URL = 'https://api.apexshare.be';
  const FRONTEND_URL = 'https://apexshare.be';

  describe('Fixed API Tests', () => {
    it('should test CORS preflight for /uploads/initiate with 204 response', () => {
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

        // Should get 204 (No Content) for OPTIONS - this is actually correct!
        expect([200, 204]).to.include(response.status);

        // Check CORS headers
        expect(response.headers).to.have.property('access-control-allow-origin');
        expect(response.headers).to.have.property('access-control-allow-methods');
        expect(response.headers).to.have.property('access-control-allow-headers');

        // Verify X-Auth-Token is in allowed headers
        const allowedHeaders = response.headers['access-control-allow-headers'];
        expect(allowedHeaders.toLowerCase()).to.include('x-auth-token');
      });
    });

    it('should test CORS preflight for /sessions endpoint with 204 response', () => {
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

        // Should get 204 (No Content) for OPTIONS - this is correct!
        expect([200, 204]).to.include(response.status);

        // Check CORS headers
        expect(response.headers).to.have.property('access-control-allow-origin');
        expect(response.headers).to.have.property('access-control-allow-methods');
        expect(response.headers).to.have.property('access-control-allow-headers');
      });
    });

    it('should analyze all successful API calls', () => {
      const testCases = [
        {
          name: 'Sessions with X-Auth-Token',
          method: 'GET',
          url: `${API_BASE_URL}/sessions`,
          headers: {
            'X-Auth-Token': 'test-token-123',
            'Content-Type': 'application/json',
            'Origin': FRONTEND_URL
          }
        },
        {
          name: 'Upload initiate with X-Auth-Token',
          method: 'POST',
          url: `${API_BASE_URL}/uploads/initiate`,
          headers: {
            'X-Auth-Token': 'test-token-123',
            'Content-Type': 'application/json',
            'Origin': FRONTEND_URL
          },
          body: {
            fileName: 'test-video.mp4',
            fileSize: 1024000,
            fileType: 'video/mp4',
            studentEmail: 'test@example.com',
            sessionDate: '2024-01-15'
          }
        },
        {
          name: 'Upload initiate with X-Public-Access',
          method: 'POST',
          url: `${API_BASE_URL}/uploads/initiate`,
          headers: {
            'X-Public-Access': 'true',
            'Content-Type': 'application/json',
            'Origin': FRONTEND_URL
          },
          body: {
            fileName: 'test-video.mp4',
            fileSize: 1024000,
            fileType: 'video/mp4',
            studentEmail: 'test@example.com',
            sessionDate: '2024-01-15'
          }
        }
      ];

      testCases.forEach((testCase, index) => {
        cy.request({
          method: testCase.method,
          url: testCase.url,
          headers: testCase.headers,
          body: testCase.body,
          failOnStatusCode: false
        }).then((response) => {
          cy.log(`\\n=== ${testCase.name} ===`);
          cy.log('Status:', response.status);
          cy.log('Headers:', JSON.stringify(response.headers, null, 2));
          cy.log('Body:', JSON.stringify(response.body, null, 2));

          // All should have CORS headers
          if (response.headers['access-control-allow-origin']) {
            cy.log('✅ CORS allow-origin header present');
          } else {
            cy.log('❌ CORS allow-origin header missing');
          }

          // Check if X-Auth-Token was processed
          if (testCase.headers['X-Auth-Token']) {
            if (response.status === 401) {
              cy.log('✅ X-Auth-Token header was processed (got 401 unauthorized)');
            } else if (response.status === 200) {
              cy.log('✅ X-Auth-Token header was accepted (got 200 success)');
            } else {
              cy.log(`⚠️ X-Auth-Token processing unclear (got ${response.status})`);
            }
          }

          // Check if X-Public-Access was processed
          if (testCase.headers['X-Public-Access']) {
            if (response.status === 200) {
              cy.log('✅ X-Public-Access header was accepted (got 200 success)');
            } else {
              cy.log(`❌ X-Public-Access header failed (got ${response.status})`);
            }
          }
        });
      });
    });
  });

  describe('Frontend Page Analysis', () => {
    it('should analyze the upload page structure', () => {
      cy.visit('/upload');

      // Wait for any dynamic content to load
      cy.wait(3000);

      // Take a screenshot
      cy.screenshot('frontend-upload-page');

      // Get the page HTML to analyze
      cy.get('html').then(($html) => {
        const htmlContent = $html.html();
        cy.log('Page HTML length:', htmlContent.length);

        // Check for various form elements
        const hasForm = htmlContent.includes('<form');
        const hasInputs = htmlContent.includes('<input');
        const hasSelect = htmlContent.includes('<select');
        const hasTextarea = htmlContent.includes('<textarea');
        const hasDataCy = htmlContent.includes('data-cy');

        cy.log('Page Analysis:');
        cy.log('- Has form tags:', hasForm);
        cy.log('- Has input tags:', hasInputs);
        cy.log('- Has select tags:', hasSelect);
        cy.log('- Has textarea tags:', hasTextarea);
        cy.log('- Has data-cy attributes:', hasDataCy);

        // Look for specific patterns
        if (htmlContent.includes('email')) {
          cy.log('✅ Page contains email-related content');
        }
        if (htmlContent.includes('upload')) {
          cy.log('✅ Page contains upload-related content');
        }
        if (htmlContent.includes('session')) {
          cy.log('✅ Page contains session-related content');
        }
        if (htmlContent.includes('error')) {
          cy.log('⚠️ Page contains error-related content');
        }
        if (htmlContent.includes('loading')) {
          cy.log('⚠️ Page contains loading-related content');
        }

        // Check for React components that might not be rendered
        if (htmlContent.includes('react') || htmlContent.includes('React')) {
          cy.log('⚠️ Page might be in React loading state');
        }
      });

      // Check for any elements that exist
      cy.get('body').children().then(($children) => {
        cy.log('Number of body children:', $children.length);
        $children.each((index, element) => {
          cy.log(`Child ${index}:`, element.tagName, element.className, element.id);
        });
      });

      // Try to find any form elements without being specific
      cy.get('body').find('input, select, textarea, form, button').then(($formElements) => {
        cy.log('Found form elements:', $formElements.length);
        $formElements.each((index, element) => {
          cy.log(`Form element ${index}:`, element.tagName, element.type, element.name, element.id, element.getAttribute('data-cy'));
        });
      });
    });

    it('should check for JavaScript errors and console messages', () => {
      // Capture console logs
      cy.window().then((win) => {
        cy.stub(win.console, 'log').as('consoleLog');
        cy.stub(win.console, 'error').as('consoleError');
        cy.stub(win.console, 'warn').as('consoleWarn');
      });

      cy.visit('/upload');
      cy.wait(5000); // Wait for any async operations

      // Check console messages
      cy.get('@consoleLog').then((logStub) => {
        const calls = logStub.getCalls();
        cy.log('Console log calls:', calls.length);
        calls.forEach((call, index) => {
          cy.log(`Log ${index}:`, call.args.join(' '));
        });
      });

      cy.get('@consoleError').then((errorStub) => {
        const calls = errorStub.getCalls();
        cy.log('Console error calls:', calls.length);
        calls.forEach((call, index) => {
          cy.log(`Error ${index}:`, call.args.join(' '));
        });
      });

      cy.get('@consoleWarn').then((warnStub) => {
        const calls = warnStub.getCalls();
        cy.log('Console warn calls:', calls.length);
        calls.forEach((call, index) => {
          cy.log(`Warn ${index}:`, call.args.join(' '));
        });
      });
    });
  });
});