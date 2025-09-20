/// <reference types="cypress" />

describe('Video Download Workflow', () => {
  const testFileId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  beforeEach(() => {
    cy.interceptDownloadAPI();
  });

  describe('Download Page Access', () => {
    it('should load download page with valid file ID', () => {
      cy.visit(`/download/${testFileId}`);

      cy.get('[data-cy="download-page"]').should('be.visible');
      cy.get('[data-cy="video-info"]').should('be.visible');
      cy.get('[data-cy="download-button"]').should('be.visible');
    });

    it('should show error for invalid file ID format', () => {
      cy.visit('/download/invalid-uuid', { failOnStatusCode: false });

      cy.get('[data-cy="error-message"]').should('be.visible');
      cy.contains('Invalid file ID').should('be.visible');
    });

    it('should handle missing file ID', () => {
      cy.visit('/download/', { failOnStatusCode: false });

      cy.url().should('include', '/404');
    });
  });

  describe('Video Information Display', () => {
    beforeEach(() => {
      cy.visit(`/download/${testFileId}`);
      cy.wait('@downloadAPI');
    });

    it('should display video metadata', () => {
      cy.get('[data-cy="video-title"]').should('contain', 'test-video.mp4');
      cy.get('[data-cy="session-date"]').should('contain', '2025-01-20');
      cy.get('[data-cy="trainer-name"]').should('contain', 'Test Trainer');
      cy.get('[data-cy="file-size"]').should('contain', '1.0 MB');
    });

    it('should display session notes when available', () => {
      cy.get('[data-cy="session-notes"]').should('be.visible');
      cy.get('[data-cy="session-notes"]').should('contain', 'Test notes');
    });

    it('should show expiration information', () => {
      cy.get('[data-cy="expiration-info"]').should('be.visible');
      cy.contains('expires').should('be.visible');
    });

    it('should display download count', () => {
      cy.get('[data-cy="download-count"]').should('be.visible');
    });
  });

  describe('Download Functionality', () => {
    beforeEach(() => {
      cy.visit(`/download/${testFileId}`);
      cy.wait('@downloadAPI');
    });

    it('should initiate download when button is clicked', () => {
      // Mock the download
      cy.window().then((win) => {
        cy.stub(win, 'open').as('windowOpen');
      });

      cy.get('[data-cy="download-button"]').click();

      cy.get('@windowOpen').should('have.been.calledWith',
        'https://signed-url.example.com/video.mp4'
      );
    });

    it('should show download progress indicator', () => {
      cy.get('[data-cy="download-button"]').click();

      cy.get('[data-cy="download-progress"]').should('be.visible');
      cy.contains('Preparing download').should('be.visible');
    });

    it('should track download analytics', () => {
      cy.intercept('PUT', `${Cypress.env('apiUrl')}/download/${testFileId}/stats`, {
        statusCode: 200
      }).as('trackDownload');

      cy.get('[data-cy="download-button"]').click();

      cy.wait('@trackDownload');
    });
  });

  describe('Error Handling', () => {
    it('should handle file not found', () => {
      cy.intercept('GET', `${Cypress.env('apiUrl')}/download/*`, {
        statusCode: 404,
        body: {
          success: false,
          error: 'Video not found or expired'
        }
      }).as('fileNotFound');

      cy.visit(`/download/${testFileId}`);
      cy.wait('@fileNotFound');

      cy.get('[data-cy="error-message"]').should('be.visible');
      cy.contains('Video not found or expired').should('be.visible');
      cy.get('[data-cy="contact-support"]').should('be.visible');
    });

    it('should handle expired files', () => {
      cy.intercept('GET', `${Cypress.env('apiUrl')}/download/*`, {
        statusCode: 410,
        body: {
          success: false,
          error: 'Video has expired'
        }
      }).as('fileExpired');

      cy.visit(`/download/${testFileId}`);
      cy.wait('@fileExpired');

      cy.get('[data-cy="error-message"]').should('be.visible');
      cy.contains('Video has expired').should('be.visible');
    });

    it('should handle file not yet available', () => {
      cy.intercept('GET', `${Cypress.env('apiUrl')}/download/*`, {
        statusCode: 404,
        body: {
          success: false,
          error: 'Video not yet available'
        }
      }).as('fileProcessing');

      cy.visit(`/download/${testFileId}`);
      cy.wait('@fileProcessing');

      cy.get('[data-cy="processing-message"]').should('be.visible');
      cy.contains('still being processed').should('be.visible');
      cy.get('[data-cy="refresh-button"]').should('be.visible');
    });

    it('should handle server errors', () => {
      cy.intercept('GET', `${Cypress.env('apiUrl')}/download/*`, {
        statusCode: 500,
        body: {
          success: false,
          error: 'Internal server error'
        }
      }).as('serverError');

      cy.visit(`/download/${testFileId}`);
      cy.wait('@serverError');

      cy.get('[data-cy="error-message"]').should('be.visible');
      cy.contains('server error').should('be.visible');
      cy.get('[data-cy="retry-button"]').should('be.visible');
    });

    it('should allow retry after errors', () => {
      cy.intercept('GET', `${Cypress.env('apiUrl')}/download/*`, {
        statusCode: 500,
        body: { success: false, error: 'Server error' }
      }).as('serverError');

      cy.visit(`/download/${testFileId}`);
      cy.wait('@serverError');

      // Fix the API for retry
      cy.interceptDownloadAPI();

      cy.get('[data-cy="retry-button"]').click();

      cy.wait('@downloadAPI');

      cy.get('[data-cy="video-info"]').should('be.visible');
      cy.get('[data-cy="download-button"]').should('be.visible');
    });
  });

  describe('Security Features', () => {
    it('should show security warnings', () => {
      cy.visit(`/download/${testFileId}`);
      cy.wait('@downloadAPI');

      cy.get('[data-cy="security-notice"]').should('be.visible');
      cy.contains('This link is unique to you').should('be.visible');
      cy.contains('Do not share this link').should('be.visible');
    });

    it('should display expiration countdown', () => {
      cy.visit(`/download/${testFileId}`);
      cy.wait('@downloadAPI');

      cy.get('[data-cy="expiration-countdown"]').should('be.visible');
    });

    it('should warn about link sharing', () => {
      cy.visit(`/download/${testFileId}`);
      cy.wait('@downloadAPI');

      cy.get('[data-cy="sharing-warning"]').should('be.visible');
      cy.contains('should not be shared').should('be.visible');
    });
  });

  describe('Mobile Optimization', () => {
    beforeEach(() => {
      cy.visit(`/download/${testFileId}`);
      cy.wait('@downloadAPI');
    });

    it('should be responsive on mobile', () => {
      cy.testMobileViewport();

      cy.get('[data-cy="video-info"]').should('be.visible');
      cy.get('[data-cy="download-button"]').should('be.visible');

      // Button should be full width on mobile
      cy.get('[data-cy="download-button"]').should('have.css', 'width', '100%');
    });

    it('should handle mobile download behavior', () => {
      cy.testMobileViewport();

      // On mobile, downloads should open in new window/tab
      cy.window().then((win) => {
        cy.stub(win, 'open').as('windowOpen');
      });

      cy.get('[data-cy="download-button"]').click();

      cy.get('@windowOpen').should('have.been.calledWith',
        'https://signed-url.example.com/video.mp4', '_blank'
      );
    });
  });

  describe('Performance', () => {
    it('should load video info quickly', () => {
      const startTime = Date.now();

      cy.visit(`/download/${testFileId}`);
      cy.wait('@downloadAPI');

      cy.get('[data-cy="video-info"]').should('be.visible').then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(3000); // Should load within 3 seconds
      });
    });

    it('should preload critical resources', () => {
      cy.visit(`/download/${testFileId}`);

      cy.document().then((doc) => {
        const preloadLinks = doc.querySelectorAll('link[rel="preload"]');
        expect(preloadLinks.length).to.be.greaterThan(0);
      });
    });
  });

  describe('Analytics Tracking', () => {
    beforeEach(() => {
      cy.visit(`/download/${testFileId}`);
      cy.wait('@downloadAPI');
    });

    it('should track page views', () => {
      cy.window().then((win) => {
        // Check if analytics are being tracked
        expect(win.gtag || win.ga || win._gaq).to.exist;
      });
    });

    it('should track download events', () => {
      cy.window().then((win) => {
        cy.spy(win, 'gtag').as('analyticsCall');
      });

      cy.get('[data-cy="download-button"]').click();

      cy.get('@analyticsCall').should('have.been.calledWith', 'event', 'download');
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      cy.visit(`/download/${testFileId}`);
      cy.wait('@downloadAPI');
    });

    it('should be accessible', () => {
      cy.checkAccessibility();
    });

    it('should have proper focus management', () => {
      cy.get('[data-cy="download-button"]').focus();
      cy.focused().should('have.attr', 'data-cy', 'download-button');
    });

    it('should have descriptive button text', () => {
      cy.get('[data-cy="download-button"]').should('contain', 'Download Video');
      cy.get('[data-cy="download-button"]').should('have.attr', 'aria-label');
    });

    it('should announce status changes to screen readers', () => {
      cy.get('[data-cy="status-region"]').should('have.attr', 'aria-live', 'polite');
    });
  });

  describe('SEO and Meta Tags', () => {
    it('should have proper meta tags', () => {
      cy.visit(`/download/${testFileId}`);
      cy.wait('@downloadAPI');

      cy.document().then((doc) => {
        expect(doc.querySelector('meta[name="description"]')).to.exist;
        expect(doc.querySelector('meta[property="og:title"]')).to.exist;
        expect(doc.querySelector('meta[property="og:description"]')).to.exist;
      });
    });

    it('should have proper page title', () => {
      cy.visit(`/download/${testFileId}`);
      cy.wait('@downloadAPI');

      cy.title().should('include', 'Download Video');
      cy.title().should('include', 'ApexShare');
    });
  });
});