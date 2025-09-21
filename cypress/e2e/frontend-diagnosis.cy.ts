/// <reference types="cypress" />

/**
 * Frontend Diagnosis Test
 * Comprehensive diagnosis of frontend loading issues
 */

describe('Frontend Diagnosis', () => {
  const URLS = {
    frontend: 'https://apexshare.be',
    api: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1'
  };

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  describe('Basic Connectivity', () => {
    it('should load the homepage', () => {
      cy.visit('/', { timeout: 30000 });

      // Wait for page to load
      cy.get('body').should('be.visible');

      // Log page details
      cy.document().then((doc) => {
        cy.log('Page title:', doc.title);
        cy.log('HTML length:', doc.documentElement.outerHTML.length);
      });

      // Take screenshot
      cy.screenshot('homepage-loaded');
    });

    it('should load the upload page', () => {
      cy.visit('/upload', { timeout: 30000 });

      // Wait for page to load
      cy.get('body').should('be.visible');

      // Log page details
      cy.document().then((doc) => {
        cy.log('Upload page title:', doc.title);
        cy.log('Upload page HTML length:', doc.documentElement.outerHTML.length);

        // Log the actual HTML content for debugging
        const bodyContent = doc.body.innerHTML;
        cy.log('Body content preview:', bodyContent.substring(0, 500));
      });

      // Take screenshot
      cy.screenshot('upload-page-loaded');

      // Check for any JavaScript frameworks or libraries loading
      cy.window().then((win) => {
        cy.log('React available:', typeof win.React !== 'undefined');
        cy.log('jQuery available:', typeof win.$ !== 'undefined');
        cy.log('Vue available:', typeof win.Vue !== 'undefined');
      });
    });
  });

  describe('Page Content Analysis', () => {
    it('should analyze upload page structure', () => {
      cy.visit('/upload');
      cy.wait(5000); // Wait for any dynamic content to load

      // Look for any forms
      cy.get('body').then(($body) => {
        const forms = $body.find('form');
        cy.log(`Found ${forms.length} forms on the page`);

        // Look for input elements
        const inputs = $body.find('input');
        cy.log(`Found ${inputs.length} input elements`);

        // Look for any upload-related elements
        const uploadElements = $body.find('[*|*="upload"], [class*="upload"], [id*="upload"]');
        cy.log(`Found ${uploadElements.length} upload-related elements`);

        // Look for buttons
        const buttons = $body.find('button');
        cy.log(`Found ${buttons.length} buttons`);

        // Check for any error messages or loading states
        const errorElements = $body.find('[class*="error"], [class*="loading"], [class*="spinner"]');
        cy.log(`Found ${errorElements.length} error/loading elements`);

        // Log all visible text content
        const visibleText = $body.text().trim();
        cy.log('Visible text content:', visibleText);
      });
    });

    it('should check for JavaScript console errors', () => {
      const consoleErrors: string[] = [];

      cy.visit('/upload', {
        onBeforeLoad: (win) => {
          cy.stub(win.console, 'error').callsFake((message) => {
            consoleErrors.push(message);
          });
        }
      });

      cy.wait(5000);

      cy.then(() => {
        if (consoleErrors.length > 0) {
          cy.log('JavaScript errors found:', consoleErrors);
        } else {
          cy.log('No JavaScript errors detected');
        }
      });
    });

    it('should check network requests', () => {
      const networkRequests: any[] = [];

      cy.intercept('**/*', (req) => {
        networkRequests.push({
          method: req.method,
          url: req.url,
          headers: req.headers
        });
      });

      cy.visit('/upload');
      cy.wait(5000);

      cy.then(() => {
        cy.log(`Total network requests: ${networkRequests.length}`);

        const jsRequests = networkRequests.filter(req =>
          req.url.includes('.js') || req.url.includes('javascript')
        );
        cy.log(`JavaScript requests: ${jsRequests.length}`);

        const cssRequests = networkRequests.filter(req =>
          req.url.includes('.css') || req.url.includes('stylesheet')
        );
        cy.log(`CSS requests: ${cssRequests.length}`);

        const apiRequests = networkRequests.filter(req =>
          req.url.includes(URLS.api)
        );
        cy.log(`API requests: ${apiRequests.length}`);

        if (apiRequests.length > 0) {
          cy.log('API requests details:', apiRequests);
        }
      });
    });
  });

  describe('API Connectivity', () => {
    it('should test direct API endpoints', () => {
      // Test sessions endpoint with X-Auth-Token
      cy.request({
        method: 'POST',
        url: `${URLS.api}/sessions`,
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': 'test-token',
          'Origin': URLS.frontend
        },
        body: {
          studentEmail: 'test@apexshare.be',
          trainerName: 'Test Trainer'
        },
        failOnStatusCode: false
      }).then((response) => {
        cy.log(`Sessions endpoint - Status: ${response.status}`);
        cy.log(`Sessions endpoint - Response:`, response.body);
        cy.log(`Sessions endpoint - Headers:`, response.headers);
      });

      // Test uploads/initiate endpoint with X-Auth-Token
      cy.request({
        method: 'POST',
        url: `${URLS.api}/uploads/initiate`,
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': 'test-token',
          'Origin': URLS.frontend
        },
        body: {
          fileName: 'test-video.mp4',
          fileSize: 1024000,
          studentEmail: 'test@apexshare.be',
          sessionDate: '2025-01-20',
          trainerName: 'Test Trainer'
        },
        failOnStatusCode: false
      }).then((response) => {
        cy.log(`Upload initiate - Status: ${response.status}`);
        cy.log(`Upload initiate - Response:`, response.body);
        cy.log(`Upload initiate - Headers:`, response.headers);
      });

      // Test uploads/initiate endpoint with X-Public-Access
      cy.request({
        method: 'POST',
        url: `${URLS.api}/uploads/initiate`,
        headers: {
          'Content-Type': 'application/json',
          'X-Public-Access': 'true',
          'Origin': URLS.frontend
        },
        body: {
          fileName: 'test-video.mp4',
          fileSize: 1024000,
          studentEmail: 'test@apexshare.be',
          sessionDate: '2025-01-20',
          trainerName: 'Test Trainer'
        },
        failOnStatusCode: false
      }).then((response) => {
        cy.log(`Upload public access - Status: ${response.status}`);
        cy.log(`Upload public access - Response:`, response.body);
        cy.log(`Upload public access - Headers:`, response.headers);
      });
    });
  });

  describe('CORS Testing', () => {
    it('should test CORS preflight requests', () => {
      cy.request({
        method: 'OPTIONS',
        url: `${URLS.api}/uploads/initiate`,
        headers: {
          'Origin': URLS.frontend,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,X-Auth-Token,X-Public-Access'
        },
        failOnStatusCode: false
      }).then((response) => {
        cy.log(`CORS preflight - Status: ${response.status}`);
        cy.log(`CORS preflight - Headers:`, response.headers);

        // Check for CORS headers
        const corsHeaders = {
          'access-control-allow-origin': response.headers['access-control-allow-origin'],
          'access-control-allow-methods': response.headers['access-control-allow-methods'],
          'access-control-allow-headers': response.headers['access-control-allow-headers'],
          'access-control-max-age': response.headers['access-control-max-age']
        };

        cy.log('CORS headers:', corsHeaders);
      });
    });
  });

  after(() => {
    cy.log('='.repeat(50));
    cy.log('FRONTEND DIAGNOSIS COMPLETE');
    cy.log('='.repeat(50));
    cy.log('Check the logs above for detailed analysis');
    cy.log('Screenshots saved for visual inspection');
  });
});