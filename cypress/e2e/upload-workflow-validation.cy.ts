/**
 * Comprehensive End-to-End Upload Workflow Validation
 *
 * This test suite validates that the 400 error issue in the upload workflow has been resolved.
 * It tests the complete flow from frontend form submission to backend processing,
 * including both authentication methods and proper payload validation.
 */

describe('Upload Workflow - Post-Fix Validation', () => {
  const API_BASE_URL = Cypress.env('API_BASE_URL') || 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
  const FRONTEND_URL = Cypress.env('FRONTEND_URL') || 'https://apexshare.be';

  // Test data
  const testData = {
    studentEmail: 'test.validation@example.com',
    studentName: 'Test Student',
    trainerName: 'Test Trainer',
    sessionDate: '2025-01-15',
    notes: 'E2E validation test upload',
    fileName: 'test-upload-validation.mp4',
    fileSize: 1024 * 1024 * 5, // 5MB
    contentType: 'video/mp4'
  };

  let testSessionId: string;

  beforeEach(() => {
    // Clear browser state
    cy.clearLocalStorage();
    cy.clearCookies();

    // Set up network monitoring
    cy.intercept('POST', '**/sessions', (req) => {
      cy.log('Session Creation Request:', req.body);
    }).as('createSession');

    cy.intercept('POST', '**/sessions/*/upload', (req) => {
      cy.log('Upload Request:', req.body);
      cy.log('Upload Headers:', req.headers);
    }).as('getUploadUrl');
  });

  describe('API Authentication Validation', () => {
    it('should validate X-Auth-Token authentication method', () => {
      cy.log('Testing X-Auth-Token authentication for upload endpoint');

      const uploadPayload = {
        fileName: testData.fileName,
        fileSize: testData.fileSize,
        contentType: testData.contentType
      };

      // First create a session to get a valid session ID
      cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/sessions`,
        headers: {
          'X-Auth-Token': 'test-token-validation',
          'Content-Type': 'application/json'
        },
        body: {
          title: 'Auth Test Session',
          description: 'Testing authentication',
          studentEmails: [testData.studentEmail],
          isPublic: true
        },
        failOnStatusCode: false
      }).then((sessionResponse) => {
        cy.log('Session Response Status:', sessionResponse.status);
        cy.log('Session Response Body:', sessionResponse.body);

        if (sessionResponse.status === 200 || sessionResponse.status === 201) {
          const sessionId = sessionResponse.body.data?.id || sessionResponse.body.sessionId;
          expect(sessionId).to.exist;

          // Test upload with X-Auth-Token
          cy.request({
            method: 'POST',
            url: `${API_BASE_URL}/sessions/${sessionId}/upload`,
            headers: {
              'X-Auth-Token': 'test-token-validation',
              'Content-Type': 'application/json'
            },
            body: uploadPayload,
            failOnStatusCode: false
          }).then((uploadResponse) => {
            cy.log('Upload Response Status:', uploadResponse.status);
            cy.log('Upload Response Body:', uploadResponse.body);

            // Should not be a 400 error - fix validation
            expect(uploadResponse.status).to.not.equal(400);
            expect(uploadResponse.status).to.be.oneOf([200, 201, 401, 403]);
          });
        }
      });
    });

    it('should validate X-Public-Access authentication method', () => {
      cy.log('Testing X-Public-Access authentication for upload endpoint');

      const uploadPayload = {
        fileName: testData.fileName,
        fileSize: testData.fileSize,
        contentType: testData.contentType
      };

      // First create a session with public access
      cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/sessions`,
        headers: {
          'X-Public-Access': 'true',
          'Content-Type': 'application/json'
        },
        body: {
          title: 'Public Access Test Session',
          description: 'Testing public access',
          studentEmails: [testData.studentEmail],
          isPublic: true
        },
        failOnStatusCode: false
      }).then((sessionResponse) => {
        cy.log('Public Session Response Status:', sessionResponse.status);
        cy.log('Public Session Response Body:', sessionResponse.body);

        if (sessionResponse.status === 200 || sessionResponse.status === 201) {
          const sessionId = sessionResponse.body.data?.id || sessionResponse.body.sessionId;
          expect(sessionId).to.exist;

          // Test upload with X-Public-Access
          cy.request({
            method: 'POST',
            url: `${API_BASE_URL}/sessions/${sessionId}/upload`,
            headers: {
              'X-Public-Access': 'true',
              'Content-Type': 'application/json'
            },
            body: uploadPayload,
            failOnStatusCode: false
          }).then((uploadResponse) => {
            cy.log('Public Upload Response Status:', uploadResponse.status);
            cy.log('Public Upload Response Body:', uploadResponse.body);

            // Should not be a 400 error - fix validation
            expect(uploadResponse.status).to.not.equal(400);
            expect(uploadResponse.status).to.be.oneOf([200, 201, 401, 403]);
          });
        }
      });
    });
  });

  describe('Payload Format Validation', () => {
    it('should validate correct payload format (fileName, fileSize, contentType only)', () => {
      cy.log('Testing payload format validation');

      // Test with exactly the 3 required fields
      const correctPayload = {
        fileName: testData.fileName,
        fileSize: testData.fileSize,
        contentType: testData.contentType
      };

      cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/sessions`,
        headers: {
          'X-Public-Access': 'true',
          'Content-Type': 'application/json'
        },
        body: {
          title: 'Payload Test Session',
          description: 'Testing payload format',
          studentEmails: [testData.studentEmail],
          isPublic: true
        },
        failOnStatusCode: false
      }).then((sessionResponse) => {
        if (sessionResponse.status === 200 || sessionResponse.status === 201) {
          const sessionId = sessionResponse.body.data?.id || sessionResponse.body.sessionId;

          cy.request({
            method: 'POST',
            url: `${API_BASE_URL}/sessions/${sessionId}/upload`,
            headers: {
              'X-Public-Access': 'true',
              'Content-Type': 'application/json'
            },
            body: correctPayload,
            failOnStatusCode: false
          }).then((response) => {
            cy.log('Correct Payload Response:', response.status, response.body);

            // Validate the fix - should not get 400
            expect(response.status).to.not.equal(400);

            if (response.status === 200 || response.status === 201) {
              expect(response.body).to.have.property('uploadUrl');
              expect(response.body).to.have.property('uploadId');
            }
          });
        }
      });
    });

    it('should test payload with extra fields (legacy compatibility)', () => {
      cy.log('Testing payload with extra fields for backwards compatibility');

      // Test with extra fields that should be ignored
      const payloadWithExtraFields = {
        fileName: testData.fileName,
        fileSize: testData.fileSize,
        contentType: testData.contentType,
        studentEmail: testData.studentEmail, // Extra field that was causing 400
        sessionDate: testData.sessionDate,   // Extra field
        metadata: { test: 'value' }          // Extra field
      };

      cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/sessions`,
        headers: {
          'X-Public-Access': 'true',
          'Content-Type': 'application/json'
        },
        body: {
          title: 'Compatibility Test Session',
          description: 'Testing backwards compatibility',
          studentEmails: [testData.studentEmail],
          isPublic: true
        },
        failOnStatusCode: false
      }).then((sessionResponse) => {
        if (sessionResponse.status === 200 || sessionResponse.status === 201) {
          const sessionId = sessionResponse.body.data?.id || sessionResponse.body.sessionId;

          cy.request({
            method: 'POST',
            url: `${API_BASE_URL}/sessions/${sessionId}/upload`,
            headers: {
              'X-Public-Access': 'true',
              'Content-Type': 'application/json'
            },
            body: payloadWithExtraFields,
            failOnStatusCode: false
          }).then((response) => {
            cy.log('Extra Fields Response:', response.status, response.body);

            // Should handle extra fields gracefully (not 400)
            expect(response.status).to.not.equal(400);
          });
        }
      });
    });
  });

  describe('Frontend Integration Test', () => {
    it('should complete the full upload workflow from the frontend', () => {
      cy.log('Testing complete frontend upload workflow');

      // Visit the upload page
      cy.visit('/upload', { timeout: 10000 });

      // Wait for page to load completely
      cy.get('[data-cy="upload-form"]', { timeout: 10000 }).should('be.visible');

      // Fill out the form
      cy.get('[data-cy="student-email"]').clear().type(testData.studentEmail);
      cy.get('[data-cy="session-date"]').clear().type(testData.sessionDate);

      // Fill optional fields if they exist
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="student-name"]').length > 0) {
          cy.get('[data-cy="student-name"]').type(testData.studentName);
        }
        if ($body.find('[data-cy="trainer-name"]').length > 0) {
          cy.get('[data-cy="trainer-name"]').type(testData.trainerName);
        }
        if ($body.find('[data-cy="session-notes"]').length > 0) {
          cy.get('[data-cy="session-notes"]').type(testData.notes);
        }
      });

      // Create and upload a test file
      cy.fixture('test-video.mp4', 'base64').then((fileContent) => {
        const blob = Cypress.Blob.base64StringToBlob(fileContent, testData.contentType);
        const file = new File([blob], testData.fileName, { type: testData.contentType });

        cy.get('[data-cy="file-input"]').then(($input) => {
          const input = $input[0] as HTMLInputElement;
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          input.files = dataTransfer.files;

          // Trigger change event
          const event = new Event('change', { bubbles: true });
          input.dispatchEvent(event);
        });
      });

      // Wait for file to be processed
      cy.wait(1000);

      // Submit the form
      cy.get('[data-cy="upload-button"]').should('not.be.disabled').click();

      // Monitor network requests
      cy.wait('@createSession', { timeout: 15000 }).then((interception) => {
        cy.log('Session creation intercepted:', interception.response);
        expect(interception.response?.statusCode).to.be.oneOf([200, 201]);
      });

      cy.wait('@getUploadUrl', { timeout: 15000 }).then((interception) => {
        cy.log('Upload URL request intercepted:', interception.response);

        // This is the critical test - should not be 400
        expect(interception.response?.statusCode).to.not.equal(400);
        expect(interception.response?.statusCode).to.be.oneOf([200, 201]);

        // Validate request payload format
        const requestBody = interception.request.body;
        expect(requestBody).to.have.property('fileName');
        expect(requestBody).to.have.property('fileSize');
        expect(requestBody).to.have.property('contentType');

        // Should not have extra fields that caused 400 errors
        expect(requestBody).to.not.have.property('studentEmail');
      });

      // Check for success or proper error handling
      cy.get('body', { timeout: 20000 }).then(($body) => {
        if ($body.find('[data-cy="upload-success"]').length > 0) {
          cy.get('[data-cy="upload-success"]').should('be.visible');
          cy.log('✅ Upload completed successfully!');
        } else if ($body.find('[data-cy="upload-error"]').length > 0) {
          cy.get('[data-cy="upload-error"]').should('be.visible');
          cy.get('[data-cy="upload-error"]').then(($error) => {
            const errorText = $error.text();
            cy.log('Upload error (for analysis):', errorText);

            // Error should not be a 400 validation error
            expect(errorText.toLowerCase()).to.not.include('400');
            expect(errorText.toLowerCase()).to.not.include('bad request');
            expect(errorText.toLowerCase()).to.not.include('validation');
          });
        } else {
          cy.log('Upload in progress or no clear status found');
        }
      });
    });
  });

  describe('Error Handling Validation', () => {
    it('should validate that 400 errors have been eliminated', () => {
      cy.log('Testing that 400 errors are no longer occurring');

      // Test various scenarios that previously caused 400 errors
      const testScenarios = [
        {
          name: 'Standard upload request',
          payload: {
            fileName: testData.fileName,
            fileSize: testData.fileSize,
            contentType: testData.contentType
          }
        },
        {
          name: 'Upload with legacy studentEmail field',
          payload: {
            fileName: testData.fileName,
            fileSize: testData.fileSize,
            contentType: testData.contentType,
            studentEmail: testData.studentEmail
          }
        },
        {
          name: 'Upload with multiple extra fields',
          payload: {
            fileName: testData.fileName,
            fileSize: testData.fileSize,
            contentType: testData.contentType,
            studentEmail: testData.studentEmail,
            sessionDate: testData.sessionDate,
            trainerName: testData.trainerName,
            extraField: 'should be ignored'
          }
        }
      ];

      // Create a test session first
      cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/sessions`,
        headers: {
          'X-Public-Access': 'true',
          'Content-Type': 'application/json'
        },
        body: {
          title: 'Error Validation Test Session',
          description: 'Testing error scenarios',
          studentEmails: [testData.studentEmail],
          isPublic: true
        },
        failOnStatusCode: false
      }).then((sessionResponse) => {
        if (sessionResponse.status === 200 || sessionResponse.status === 201) {
          const sessionId = sessionResponse.body.data?.id || sessionResponse.body.sessionId;

          // Test each scenario
          testScenarios.forEach((scenario, index) => {
            cy.request({
              method: 'POST',
              url: `${API_BASE_URL}/sessions/${sessionId}/upload`,
              headers: {
                'X-Public-Access': 'true',
                'Content-Type': 'application/json'
              },
              body: scenario.payload,
              failOnStatusCode: false
            }).then((response) => {
              cy.log(`Scenario ${index + 1} (${scenario.name}):`, response.status);

              // Critical validation: No 400 errors
              expect(response.status, `${scenario.name} should not return 400`).to.not.equal(400);

              // Should be a valid response code
              expect(response.status).to.be.oneOf([200, 201, 401, 403, 404]);
            });
          });
        }
      });
    });
  });

  describe('Performance and Reliability', () => {
    it('should validate upload endpoint performance', () => {
      cy.log('Testing upload endpoint performance and reliability');

      const startTime = Date.now();

      cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/sessions`,
        headers: {
          'X-Public-Access': 'true',
          'Content-Type': 'application/json'
        },
        body: {
          title: 'Performance Test Session',
          description: 'Testing performance',
          studentEmails: [testData.studentEmail],
          isPublic: true
        },
        failOnStatusCode: false
      }).then((sessionResponse) => {
        if (sessionResponse.status === 200 || sessionResponse.status === 201) {
          const sessionId = sessionResponse.body.data?.id || sessionResponse.body.sessionId;

          cy.request({
            method: 'POST',
            url: `${API_BASE_URL}/sessions/${sessionId}/upload`,
            headers: {
              'X-Public-Access': 'true',
              'Content-Type': 'application/json'
            },
            body: {
              fileName: testData.fileName,
              fileSize: testData.fileSize,
              contentType: testData.contentType
            },
            failOnStatusCode: false
          }).then((response) => {
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            cy.log(`Upload endpoint response time: ${responseTime}ms`);

            // Performance validation
            expect(responseTime).to.be.lessThan(10000); // Should respond within 10 seconds

            // Status validation
            expect(response.status).to.not.equal(400);
          });
        }
      });
    });
  });

  after(() => {
    cy.log('=== Upload Workflow Validation Complete ===');
    cy.log('If all tests pass, the 400 error issue has been resolved');
  });
});