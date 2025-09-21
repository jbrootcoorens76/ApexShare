describe('Manual Form Validation', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  it('should successfully interact with the upload form', () => {
    cy.visit('/upload');
    cy.wait(2000);

    // Take screenshot
    cy.screenshot('form-loaded');

    // Try to find and interact with form elements by different selectors

    // Student Email - try multiple selectors
    cy.get('body').then(($body) => {
      if ($body.find('input[placeholder*="student"]').length > 0) {
        cy.get('input[placeholder*="student"]').type('test.student@example.com');
        cy.log('✅ Found student email by placeholder');
      } else if ($body.find('input[type="email"]').length > 0) {
        cy.get('input[type="email"]').first().type('test.student@example.com');
        cy.log('✅ Found email input by type');
      } else if ($body.find('input').length > 0) {
        cy.get('input').first().type('test.student@example.com');
        cy.log('⚠️ Used first input field');
      }
    });

    // Student Name
    cy.get('body').then(($body) => {
      if ($body.find('input[placeholder*="name"]').length > 0) {
        cy.get('input[placeholder*="name"]').first().type('John Doe');
        cy.log('✅ Found name input by placeholder');
      }
    });

    // Session Date
    cy.get('body').then(($body) => {
      if ($body.find('input[type="date"]').length > 0) {
        cy.get('input[type="date"]').type('2024-01-15');
        cy.log('✅ Found date input');
      } else if ($body.find('input[placeholder*="date"]').length > 0) {
        cy.get('input[placeholder*="date"]').type('2024-01-15');
        cy.log('✅ Found date input by placeholder');
      }
    });

    // Trainer Name
    cy.get('body').then(($body) => {
      if ($body.find('input[placeholder*="trainer"]').length > 0) {
        cy.get('input[placeholder*="trainer"]').type('Test Trainer');
        cy.log('✅ Found trainer input');
      }
    });

    // Notes
    cy.get('body').then(($body) => {
      if ($body.find('textarea').length > 0) {
        cy.get('textarea').type('Test session notes');
        cy.log('✅ Found textarea for notes');
      }
    });

    // File upload
    cy.task('generateTestFile').then((filePath) => {
      cy.get('body').then(($body) => {
        if ($body.find('input[type="file"]').length > 0) {
          cy.get('input[type="file"]').selectFile(filePath, { force: true });
          cy.log('✅ Found file input');
        } else if ($body.find('[class*="upload"]').length > 0) {
          // Try to find upload area
          cy.get('[class*="upload"]').first().selectFile(filePath, { force: true });
          cy.log('✅ Found upload area by class');
        }
      });
    });

    // Take screenshot after filling form
    cy.screenshot('form-filled');

    // Try to submit
    cy.get('body').then(($body) => {
      if ($body.find('button[type="submit"]').length > 0) {
        cy.get('button[type="submit"]').click();
        cy.log('✅ Found submit button by type');
      } else if ($body.find('button').length > 0) {
        cy.get('button').contains(/upload|submit/i).click();
        cy.log('✅ Found submit button by text');
      }
    });

    // Wait for response and check for success/error
    cy.wait(5000);
    cy.screenshot('after-submit');

    // Check for any response messages
    cy.get('body').then(($body) => {
      const bodyText = $body.text();
      if (bodyText.includes('success') || bodyText.includes('uploaded')) {
        cy.log('✅ Upload appears successful');
      } else if (bodyText.includes('error') || bodyText.includes('failed')) {
        cy.log('❌ Upload appears to have failed');
      } else {
        cy.log('⚠️ Upload status unclear');
      }
    });
  });

  it('should capture network activity during form submission', () => {
    // Intercept network requests
    cy.intercept('POST', '**/uploads/initiate*').as('uploadInitiate');
    cy.intercept('GET', '**/sessions*').as('getSessions');
    cy.intercept('OPTIONS', '**').as('preflightRequests');

    cy.visit('/upload');
    cy.wait(2000);

    // Fill minimal required fields
    cy.get('input[type="email"]').type('network.test@example.com');
    cy.get('input[type="date"]').type('2024-01-15');

    // Add a test file
    cy.task('generateTestFile').then((filePath) => {
      cy.get('input[type="file"]').selectFile(filePath, { force: true });
    });

    // Submit form
    cy.get('button').contains(/upload|submit/i).click();

    // Wait for network requests
    cy.wait(5000);

    // Check what network requests were made
    cy.get('@preflightRequests.all').then((preflights) => {
      cy.log(`Preflight requests: ${preflights.length}`);
      preflights.forEach((req, index) => {
        cy.log(`Preflight ${index}:`, req.request.url);
      });
    });

    cy.get('@uploadInitiate.all').then((uploads) => {
      cy.log(`Upload initiate requests: ${uploads.length}`);
      uploads.forEach((req, index) => {
        cy.log(`Upload ${index}:`, req.request.url);
        cy.log(`Upload ${index} status:`, req.response?.statusCode);
      });
    });

    cy.get('@getSessions.all').then((sessions) => {
      cy.log(`Sessions requests: ${sessions.length}`);
    });
  });
});