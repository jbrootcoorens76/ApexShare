// Cypress E2E Support File
// This file is processed and loaded automatically before your test files.

import './commands';
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

// Custom error handling
Cypress.on('uncaught:exception', (err, runnable) => {
  // Ignore specific errors that might occur in the application
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false;
  }

  if (err.message.includes('Non-Error promise rejection captured')) {
    return false;
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