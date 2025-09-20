/// <reference types="cypress" />

// Custom commands for ApexShare testing

declare global {
  namespace Cypress {
    interface Chainable {
      skipOn(nameOrFlag: string | boolean, cb?: () => void): Chainable<void>;
      uploadTestVideo(options?: UploadOptions): Chainable<string>;
      waitForUploadToComplete(fileId: string): Chainable<void>;
      checkDownloadLink(fileId: string): Chainable<void>;
      fillUploadForm(data: UploadFormData): Chainable<void>;
      interceptUploadAPI(): Chainable<void>;
      interceptDownloadAPI(): Chainable<void>;
      checkAccessibility(): Chainable<void>;
      testMobileViewport(): Chainable<void>;
      testTabletViewport(): Chainable<void>;
      testDesktopViewport(): Chainable<void>;
    }
  }
}

interface UploadOptions {
  studentEmail?: string;
  studentName?: string;
  trainerName?: string;
  sessionDate?: string;
  notes?: string;
  fileName?: string;
}

interface UploadFormData {
  studentEmail: string;
  studentName?: string;
  trainerName?: string;
  sessionDate: string;
  notes?: string;
}

// Upload a test video file
Cypress.Commands.add('uploadTestVideo', (options: UploadOptions = {}) => {
  const defaultOptions = {
    studentEmail: Cypress.env('testEmail') || 'test@apexshare.be',
    studentName: 'Cypress Test Student',
    trainerName: Cypress.env('testTrainer') || 'Cypress Test Trainer',
    sessionDate: new Date().toISOString().split('T')[0],
    notes: 'Automated test upload',
    fileName: 'test-video.mp4'
  };

  const uploadData = { ...defaultOptions, ...options };

  // Create test file
  cy.task('generateTestFile').then((filePath) => {
    // Visit upload page
    cy.visit('/upload');

    // Fill form
    cy.fillUploadForm(uploadData);

    // Upload file
    cy.get('[data-cy="file-upload-zone"]').selectFile(filePath as string, {
      force: true
    });

    // Wait for upload to initiate
    cy.get('[data-cy="upload-button"]').click();

    // Get file ID from success response
    cy.get('[data-cy="upload-success"]', { timeout: 30000 }).should('be.visible');

    cy.get('[data-cy="file-id"]').invoke('text').then((fileId) => {
      return cy.wrap(fileId.trim());
    });
  });
});

// Wait for upload to complete processing
Cypress.Commands.add('waitForUploadToComplete', (fileId: string) => {
  cy.intercept('GET', `${Cypress.env('apiUrl')}/download/${fileId}`).as('checkDownload');

  // Poll the download endpoint until file is ready
  const checkFile = () => {
    cy.request({
      method: 'GET',
      url: `${Cypress.env('apiUrl')}/download/${fileId}`,
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 200) {
        cy.log('File processing completed');
        return;
      } else if (response.status === 404 && response.body.error?.includes('not yet available')) {
        cy.wait(2000);
        checkFile();
      } else {
        throw new Error(`Unexpected status: ${response.status}`);
      }
    });
  };

  checkFile();
});

// Check if download link works
Cypress.Commands.add('checkDownloadLink', (fileId: string) => {
  cy.request(`${Cypress.env('apiUrl')}/download/${fileId}`).then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body).to.have.property('success', true);
    expect(response.body.data).to.have.property('downloadUrl');
    expect(response.body.data).to.have.property('videoInfo');
  });
});

// Fill upload form with data
Cypress.Commands.add('fillUploadForm', (data: UploadFormData) => {
  cy.get('[data-cy="student-email"]').clear().type(data.studentEmail);

  if (data.studentName) {
    cy.get('[data-cy="student-name"]').clear().type(data.studentName);
  }

  if (data.trainerName) {
    cy.get('[data-cy="trainer-name"]').clear().type(data.trainerName);
  }

  cy.get('[data-cy="session-date"]').clear().type(data.sessionDate);

  if (data.notes) {
    cy.get('[data-cy="session-notes"]').clear().type(data.notes);
  }
});

// Intercept upload API calls
Cypress.Commands.add('interceptUploadAPI', () => {
  cy.intercept('POST', `${Cypress.env('apiUrl')}/upload`, {
    statusCode: 200,
    body: {
      success: true,
      data: {
        fileId: 'test-file-id-123',
        uploadUrl: 'https://test-bucket.s3.amazonaws.com',
        fields: {
          key: 'test-key',
          'Content-Type': 'video/mp4'
        },
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }
    }
  }).as('uploadAPI');
});

// Intercept download API calls
Cypress.Commands.add('interceptDownloadAPI', () => {
  cy.intercept('GET', `${Cypress.env('apiUrl')}/download/*`, {
    statusCode: 200,
    body: {
      success: true,
      data: {
        downloadUrl: 'https://signed-url.example.com/video.mp4',
        videoInfo: {
          fileName: 'test-video.mp4',
          fileSize: 1048576,
          sessionDate: '2025-01-20',
          trainerName: 'Test Trainer',
          notes: 'Test notes',
          expiresAt: new Date(Date.now() + 86400000).toISOString()
        }
      }
    }
  }).as('downloadAPI');
});

// Basic accessibility check
Cypress.Commands.add('checkAccessibility', () => {
  // Check for alt text on images
  cy.get('img').each(($img) => {
    cy.wrap($img).should('have.attr', 'alt');
  });

  // Check for proper heading hierarchy
  cy.get('h1, h2, h3, h4, h5, h6').then(($headings) => {
    const headings = Array.from($headings).map(h => parseInt(h.tagName.slice(1)));

    // Should start with h1
    expect(headings[0]).to.equal(1);

    // No level should be skipped
    for (let i = 1; i < headings.length; i++) {
      const diff = headings[i] - headings[i - 1];
      expect(diff).to.be.at.most(1);
    }
  });

  // Check for form labels
  cy.get('input, textarea, select').each(($element) => {
    const id = $element.attr('id');
    if (id) {
      cy.get(`label[for="${id}"]`).should('exist');
    }
  });

  // Check color contrast (basic check)
  cy.get('body').should('have.css', 'color').and('not.equal', 'rgb(255, 255, 255)');
});

// Test mobile viewport
Cypress.Commands.add('testMobileViewport', () => {
  cy.viewport(375, 667); // iPhone SE
  cy.log('Testing mobile viewport (375x667)');
});

// Test tablet viewport
Cypress.Commands.add('testTabletViewport', () => {
  cy.viewport(768, 1024); // iPad
  cy.log('Testing tablet viewport (768x1024)');
});

// Test desktop viewport
Cypress.Commands.add('testDesktopViewport', () => {
  cy.viewport(1280, 720); // Desktop
  cy.log('Testing desktop viewport (1280x720)');
});