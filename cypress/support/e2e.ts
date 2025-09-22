// Cypress E2E Support File
// This file is processed and loaded automatically before your test files.

import './commands';
import './test-utils';
import '@cypress/code-coverage/support';

// Hide XHR requests by default
Cypress.on('window:before:load', (win) => {
  cy.stub(win.console, 'error').callThrough().as('consoleError');
  cy.stub(win.console, 'warn').callThrough().as('consoleWarn');
});

// Global configuration
Cypress.Commands.add('skipOn', (nameOrFlag, cb) => {
  if (nameOrFlag === true) {
    cy.log('Skipping test due to condition');
    return;
  }

  if (Cypress.browser.name === nameOrFlag || Cypress.browser.family === nameOrFlag) {
    cy.log(`Skipping test on ${nameOrFlag}`);
    return;
  }

  cb();
});

// Chrome-specific browser detection and configuration
before(() => {
  if (Cypress.browser.name !== 'chrome') {
    throw new Error('These tests must run in Chrome browser for accurate validation');
  }

  // Set Chrome-specific user agent to match real users
  cy.window().then((win) => {
    Object.defineProperty(win.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      configurable: true
    });
  });
});

// Custom error handling
Cypress.on('uncaught:exception', (err, runnable) => {
  // Log Chrome-specific errors for debugging
  if (Cypress.browser.name === 'chrome') {
    cy.task('log', `Chrome Error: ${err.message} - ${err.stack}`);
  }

  // Ignore specific errors that might occur in the application
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false;
  }

  if (err.message.includes('Non-Error promise rejection captured')) {
    return false;
  }

  // Don't ignore fetch errors - these are what we're testing
  if (err.message.includes('Failed to fetch')) {
    cy.task('log', `CRITICAL: Failed to fetch error detected in Chrome - ${err.message}`);
    return true; // Let this error fail the test
  }

  // Return false to prevent the test from failing
  return false;
});

// Performance monitoring
beforeEach(() => {
  cy.window().then((win) => {
    if ('performance' in win && 'mark' in win.performance) {
      win.performance.mark('test-start');
    }
  });
});

afterEach(() => {
  cy.window().then((win) => {
    if ('performance' in win && 'mark' in win.performance) {
      win.performance.mark('test-end');
      win.performance.measure('test-duration', 'test-start', 'test-end');

      const measures = win.performance.getEntriesByType('measure');
      const testDuration = measures.find(m => m.name === 'test-duration');

      if (testDuration) {
        cy.log(`Test completed in ${Math.round(testDuration.duration)}ms`);
      }
    }
  });
});