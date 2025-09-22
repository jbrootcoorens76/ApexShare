/**
 * Test utilities for upload workflow validation
 */

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Create a test video file for upload testing
       */
      createTestVideo(fileName?: string, sizeInMB?: number): Chainable<File>

      /**
       * Validate API response structure
       */
      validateApiResponse(response: any, expectedStatus: number[]): Chainable<any>

      /**
       * Monitor network requests for upload validation
       */
      monitorUploadRequests(): Chainable<any>

      /**
       * Validate that 400 errors are not occurring
       */
      validateNo400Errors(response: any): Chainable<any>
    }
  }
}

// Create a test video file
Cypress.Commands.add('createTestVideo', (fileName = 'test-video.mp4', sizeInMB = 1) => {
  const sizeInBytes = sizeInMB * 1024 * 1024;

  // Create a minimal video file blob
  const videoData = new Uint8Array(sizeInBytes);

  // Add MP4 header bytes to make it a valid video file
  const mp4Header = [
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6D, 0x70, 0x34, 0x32,
    0x00, 0x00, 0x00, 0x00, 0x6D, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6F, 0x6D
  ];

  for (let i = 0; i < mp4Header.length && i < sizeInBytes; i++) {
    videoData[i] = mp4Header[i];
  }

  const blob = new Blob([videoData], { type: 'video/mp4' });
  const file = new File([blob], fileName, { type: 'video/mp4' });

  return cy.wrap(file);
});

// Validate API response structure
Cypress.Commands.add('validateApiResponse', (response: any, expectedStatus: number[]) => {
  expect(response.status).to.be.oneOf(expectedStatus);

  if (response.status >= 200 && response.status < 300) {
    expect(response.body).to.exist;

    // Check for common success response structure
    if (response.body.data || response.body.uploadUrl) {
      cy.log('✅ Valid success response structure');
    }
  } else {
    // Check for proper error response structure
    if (response.body.error || response.body.message) {
      cy.log('✅ Valid error response structure');
    }
  }

  return cy.wrap(response);
});

// Monitor upload requests
Cypress.Commands.add('monitorUploadRequests', () => {
  // Intercept session creation
  cy.intercept('POST', '**/sessions', (req) => {
    cy.log('Session Creation Request:', JSON.stringify(req.body, null, 2));
  }).as('createSession');

  // Intercept upload URL requests
  cy.intercept('POST', '**/sessions/*/upload', (req) => {
    cy.log('Upload URL Request Headers:', JSON.stringify(req.headers, null, 2));
    cy.log('Upload URL Request Body:', JSON.stringify(req.body, null, 2));

    // Validate request body structure
    expect(req.body).to.have.property('fileName');
    expect(req.body).to.have.property('fileSize');
    expect(req.body).to.have.property('contentType');

    // Log if extra fields are present (should be handled gracefully)
    const extraFields = Object.keys(req.body).filter(
      key => !['fileName', 'fileSize', 'contentType'].includes(key)
    );

    if (extraFields.length > 0) {
      cy.log('Extra fields in request (should be handled gracefully):', extraFields);
    }
  }).as('getUploadUrl');

  // Intercept actual file upload to S3
  cy.intercept('PUT', '**amazonaws.com/**', (req) => {
    cy.log('S3 Upload Request detected');
  }).as('s3Upload');

  return cy.wrap(null);
});

// Validate that 400 errors are not occurring
Cypress.Commands.add('validateNo400Errors', (response: any) => {
  // Primary validation: No 400 status
  expect(response.status, 'Response should not be 400 Bad Request').to.not.equal(400);

  // Additional validations for error patterns
  if (response.body && typeof response.body === 'object') {
    const responseText = JSON.stringify(response.body).toLowerCase();

    // Check for common 400 error indicators
    const errorPatterns = [
      'bad request',
      'validation failed',
      'invalid payload',
      'malformed request',
      'schema validation'
    ];

    errorPatterns.forEach(pattern => {
      expect(responseText, `Response should not contain '${pattern}'`).to.not.include(pattern);
    });
  }

  // Log successful validation
  if (response.status === 200 || response.status === 201) {
    cy.log('✅ No 400 errors detected - Fix validated');
  } else if (response.status === 401 || response.status === 403) {
    cy.log('✅ Auth error (expected) - No 400 validation errors');
  }

  return cy.wrap(response);
});

export {};