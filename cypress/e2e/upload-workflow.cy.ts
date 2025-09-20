/// <reference types="cypress" />

describe('Video Upload Workflow', () => {
  beforeEach(() => {
    cy.interceptUploadAPI();
    cy.visit('/upload');
  });

  describe('Upload Form Validation', () => {
    it('should display all required form fields', () => {
      cy.get('[data-cy="student-email"]').should('be.visible');
      cy.get('[data-cy="session-date"]').should('be.visible');
      cy.get('[data-cy="file-upload-zone"]').should('be.visible');
      cy.get('[data-cy="upload-button"]').should('be.visible');
    });

    it('should validate required fields', () => {
      cy.get('[data-cy="upload-button"]').click();

      cy.get('[data-cy="student-email"]').should('have.class', 'error');
      cy.get('[data-cy="session-date"]').should('have.class', 'error');

      cy.contains('Student email is required').should('be.visible');
      cy.contains('Session date is required').should('be.visible');
    });

    it('should validate email format', () => {
      cy.get('[data-cy="student-email"]').type('invalid-email');
      cy.get('[data-cy="session-date"]').type('2025-01-20');
      cy.get('[data-cy="upload-button"]').click();

      cy.contains('Please enter a valid email address').should('be.visible');
    });

    it('should validate session date format', () => {
      cy.get('[data-cy="student-email"]').type('test@example.com');
      cy.get('[data-cy="session-date"]').type('invalid-date');
      cy.get('[data-cy="upload-button"]').click();

      cy.contains('Please enter a valid date').should('be.visible');
    });

    it('should accept valid form data', () => {
      cy.fillUploadForm({
        studentEmail: 'test@example.com',
        studentName: 'Test Student',
        trainerName: 'Test Trainer',
        sessionDate: '2025-01-20',
        notes: 'Test session notes'
      });

      // Form should not show validation errors
      cy.get('[data-cy="student-email"]').should('not.have.class', 'error');
      cy.get('[data-cy="session-date"]').should('not.have.class', 'error');
    });
  });

  describe('File Upload', () => {
    beforeEach(() => {
      cy.fillUploadForm({
        studentEmail: 'test@example.com',
        sessionDate: '2025-01-20'
      });
    });

    it('should show drag and drop zone', () => {
      cy.get('[data-cy="file-upload-zone"]').should('be.visible');
      cy.contains('Drag and drop your video file here').should('be.visible');
      cy.contains('or click to browse').should('be.visible');
    });

    it('should accept video files', () => {
      cy.task('generateTestFile').then((filePath) => {
        cy.get('[data-cy="file-upload-zone"]').selectFile(filePath as string, {
          force: true
        });

        cy.get('[data-cy="selected-file"]').should('be.visible');
        cy.contains('test-video.mp4').should('be.visible');
      });
    });

    it('should reject non-video files', () => {
      cy.fixture('test-document.pdf', null).then((fileContent) => {
        const file = new File([fileContent], 'test-document.pdf', {
          type: 'application/pdf'
        });

        cy.get('[data-cy="file-upload-zone"]').selectFile({
          contents: file,
          fileName: 'test-document.pdf'
        }, { force: true });

        cy.contains('Only video files are allowed').should('be.visible');
      });
    });

    it('should show file size validation', () => {
      // Create a mock large file
      const largeFileContent = new Array(6 * 1024 * 1024 * 1024).fill('x').join(''); // 6GB
      const file = new File([largeFileContent], 'large-video.mp4', {
        type: 'video/mp4'
      });

      cy.get('[data-cy="file-upload-zone"]').selectFile({
        contents: file,
        fileName: 'large-video.mp4'
      }, { force: true });

      cy.contains('File size must be less than 5GB').should('be.visible');
    });

    it('should display upload progress', () => {
      cy.task('generateTestFile').then((filePath) => {
        cy.get('[data-cy="file-upload-zone"]').selectFile(filePath as string, {
          force: true
        });

        cy.get('[data-cy="upload-button"]').click();

        cy.get('[data-cy="upload-progress"]').should('be.visible');
        cy.get('[data-cy="progress-bar"]').should('be.visible');
      });
    });
  });

  describe('Upload Success Flow', () => {
    it('should show success message after upload', () => {
      cy.task('generateTestFile').then((filePath) => {
        cy.fillUploadForm({
          studentEmail: 'test@example.com',
          sessionDate: '2025-01-20'
        });

        cy.get('[data-cy="file-upload-zone"]').selectFile(filePath as string, {
          force: true
        });

        cy.get('[data-cy="upload-button"]').click();

        cy.wait('@uploadAPI');

        cy.get('[data-cy="upload-success"]').should('be.visible');
        cy.contains('Video uploaded successfully!').should('be.visible');
        cy.get('[data-cy="file-id"]').should('be.visible');
      });
    });

    it('should provide file ID for reference', () => {
      cy.task('generateTestFile').then((filePath) => {
        cy.fillUploadForm({
          studentEmail: 'test@example.com',
          sessionDate: '2025-01-20'
        });

        cy.get('[data-cy="file-upload-zone"]').selectFile(filePath as string, {
          force: true
        });

        cy.get('[data-cy="upload-button"]').click();

        cy.wait('@uploadAPI');

        cy.get('[data-cy="file-id"]').should('contain', 'test-file-id-123');
      });
    });

    it('should allow uploading another file', () => {
      cy.task('generateTestFile').then((filePath) => {
        cy.fillUploadForm({
          studentEmail: 'test@example.com',
          sessionDate: '2025-01-20'
        });

        cy.get('[data-cy="file-upload-zone"]').selectFile(filePath as string, {
          force: true
        });

        cy.get('[data-cy="upload-button"]').click();

        cy.wait('@uploadAPI');

        cy.get('[data-cy="upload-another"]').should('be.visible').click();

        // Form should be reset
        cy.get('[data-cy="student-email"]').should('have.value', '');
        cy.get('[data-cy="selected-file"]').should('not.exist');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle upload API errors', () => {
      cy.intercept('POST', `${Cypress.env('apiUrl')}/upload`, {
        statusCode: 500,
        body: {
          success: false,
          error: 'Internal server error'
        }
      }).as('uploadError');

      cy.task('generateTestFile').then((filePath) => {
        cy.fillUploadForm({
          studentEmail: 'test@example.com',
          sessionDate: '2025-01-20'
        });

        cy.get('[data-cy="file-upload-zone"]').selectFile(filePath as string, {
          force: true
        });

        cy.get('[data-cy="upload-button"]').click();

        cy.wait('@uploadError');

        cy.get('[data-cy="upload-error"]').should('be.visible');
        cy.contains('Internal server error').should('be.visible');
        cy.get('[data-cy="retry-upload"]').should('be.visible');
      });
    });

    it('should handle network errors', () => {
      cy.intercept('POST', `${Cypress.env('apiUrl')}/upload`, {
        forceNetworkError: true
      }).as('networkError');

      cy.task('generateTestFile').then((filePath) => {
        cy.fillUploadForm({
          studentEmail: 'test@example.com',
          sessionDate: '2025-01-20'
        });

        cy.get('[data-cy="file-upload-zone"]').selectFile(filePath as string, {
          force: true
        });

        cy.get('[data-cy="upload-button"]').click();

        cy.wait('@networkError');

        cy.get('[data-cy="upload-error"]').should('be.visible');
        cy.contains('Network error').should('be.visible');
      });
    });

    it('should allow retry after error', () => {
      cy.intercept('POST', `${Cypress.env('apiUrl')}/upload`, {
        statusCode: 500,
        body: { success: false, error: 'Server error' }
      }).as('uploadError');

      cy.task('generateTestFile').then((filePath) => {
        cy.fillUploadForm({
          studentEmail: 'test@example.com',
          sessionDate: '2025-01-20'
        });

        cy.get('[data-cy="file-upload-zone"]').selectFile(filePath as string, {
          force: true
        });

        cy.get('[data-cy="upload-button"]').click();

        cy.wait('@uploadError');

        // Fix the API response for retry
        cy.interceptUploadAPI();

        cy.get('[data-cy="retry-upload"]').click();

        cy.wait('@uploadAPI');

        cy.get('[data-cy="upload-success"]').should('be.visible');
      });
    });
  });

  describe('Accessibility', () => {
    it('should be accessible', () => {
      cy.checkAccessibility();
    });

    it('should support keyboard navigation', () => {
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-cy', 'student-email');

      cy.focused().tab();
      cy.focused().should('have.attr', 'data-cy', 'student-name');

      cy.focused().tab();
      cy.focused().should('have.attr', 'data-cy', 'trainer-name');

      cy.focused().tab();
      cy.focused().should('have.attr', 'data-cy', 'session-date');
    });

    it('should have proper ARIA labels', () => {
      cy.get('[data-cy="file-upload-zone"]').should('have.attr', 'aria-label');
      cy.get('[data-cy="upload-button"]').should('have.attr', 'aria-label');
    });
  });

  describe('Responsive Design', () => {
    it('should work on mobile devices', () => {
      cy.testMobileViewport();

      cy.get('[data-cy="upload-form"]').should('be.visible');
      cy.get('[data-cy="student-email"]').should('be.visible');
      cy.get('[data-cy="file-upload-zone"]').should('be.visible');

      // Form should be single column on mobile
      cy.get('[data-cy="form-row"]').should('have.css', 'flex-direction', 'column');
    });

    it('should work on tablet devices', () => {
      cy.testTabletViewport();

      cy.get('[data-cy="upload-form"]').should('be.visible');
      cy.get('[data-cy="student-email"]').should('be.visible');
      cy.get('[data-cy="file-upload-zone"]').should('be.visible');
    });

    it('should work on desktop devices', () => {
      cy.testDesktopViewport();

      cy.get('[data-cy="upload-form"]').should('be.visible');
      cy.get('[data-cy="student-email"]').should('be.visible');
      cy.get('[data-cy="file-upload-zone"]').should('be.visible');

      // Form should be two columns on desktop
      cy.get('[data-cy="form-row"]').should('have.css', 'flex-direction', 'row');
    });
  });
});