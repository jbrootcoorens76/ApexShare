/// <reference types="cypress" />

/**
 * Simple API Test - No UI interaction, just API validation
 */

describe('Simple API Validation', () => {
  const API_URL = 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1';
  const FRONTEND_URL = 'https://apexshare.be';

  it('API Health Check', () => {
    cy.request({
      method: 'GET',
      url: `${API_URL}/health`,
      timeout: 15000,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(`Health Check - Status: ${response.status}`);
      cy.log(`Health Check - Body:`, response.body);
    });
  });

  it('Sessions Endpoint with X-Auth-Token', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/sessions`,
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': 'test-auth-token',
        'Origin': FRONTEND_URL
      },
      body: {
        studentEmail: 'qa-test@apexshare.be',
        trainerName: 'QA Test Trainer'
      },
      timeout: 15000,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(`Sessions X-Auth-Token - Status: ${response.status}`);
      cy.log(`Sessions X-Auth-Token - Headers:`, response.headers);
      cy.log(`Sessions X-Auth-Token - Body:`, response.body);

      // Check for CORS headers
      if (response.headers['access-control-allow-origin']) {
        cy.log('✓ CORS Allow-Origin header present');
      } else {
        cy.log('✗ CORS Allow-Origin header missing');
      }
    });
  });

  it('Upload Initiate with X-Auth-Token', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/uploads/initiate`,
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': 'test-auth-token',
        'Origin': FRONTEND_URL
      },
      body: {
        fileName: 'test-video.mp4',
        fileSize: 1024000,
        studentEmail: 'qa-test@apexshare.be',
        sessionDate: '2025-01-20',
        trainerName: 'QA Test Trainer'
      },
      timeout: 15000,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(`Upload X-Auth-Token - Status: ${response.status}`);
      cy.log(`Upload X-Auth-Token - Headers:`, response.headers);
      cy.log(`Upload X-Auth-Token - Body:`, response.body);

      // Check for specific success indicators
      if (response.status === 200 && response.body && response.body.uploadUrl) {
        cy.log('✓ Upload initiate successful with upload URL');
      } else if (response.status === 200) {
        cy.log('✓ Upload initiate returned 200 but check response structure');
      } else {
        cy.log(`✗ Upload initiate failed with status ${response.status}`);
      }
    });
  });

  it('Upload Initiate with X-Public-Access', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/uploads/initiate`,
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Access': 'true',
        'Origin': FRONTEND_URL
      },
      body: {
        fileName: 'test-video.mp4',
        fileSize: 1024000,
        studentEmail: 'qa-test@apexshare.be',
        sessionDate: '2025-01-20',
        trainerName: 'QA Test Trainer'
      },
      timeout: 15000,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(`Upload X-Public-Access - Status: ${response.status}`);
      cy.log(`Upload X-Public-Access - Headers:`, response.headers);
      cy.log(`Upload X-Public-Access - Body:`, response.body);

      // Check for specific success indicators
      if (response.status === 200 && response.body && response.body.uploadUrl) {
        cy.log('✓ Public upload initiate successful with upload URL');
      } else if (response.status === 200) {
        cy.log('✓ Public upload initiate returned 200 but check response structure');
      } else {
        cy.log(`✗ Public upload initiate failed with status ${response.status}`);
      }
    });
  });

  it('Upload Initiate without authentication', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/uploads/initiate`,
      headers: {
        'Content-Type': 'application/json',
        'Origin': FRONTEND_URL
      },
      body: {
        fileName: 'test-video.mp4',
        fileSize: 1024000,
        studentEmail: 'qa-test@apexshare.be',
        sessionDate: '2025-01-20',
        trainerName: 'QA Test Trainer'
      },
      timeout: 15000,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(`Upload No Auth - Status: ${response.status}`);
      cy.log(`Upload No Auth - Headers:`, response.headers);
      cy.log(`Upload No Auth - Body:`, response.body);

      // This should fail with 401 or 403
      if (response.status === 401 || response.status === 403) {
        cy.log('✓ No auth correctly rejected');
      } else if (response.status === 200) {
        cy.log('? No auth succeeded - check if public access is enabled');
      } else {
        cy.log(`? Unexpected status for no auth: ${response.status}`);
      }
    });
  });

  it('CORS Preflight Test', () => {
    cy.request({
      method: 'OPTIONS',
      url: `${API_URL}/uploads/initiate`,
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,X-Auth-Token,X-Public-Access'
      },
      timeout: 15000,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(`CORS Preflight - Status: ${response.status}`);
      cy.log(`CORS Preflight - Headers:`, response.headers);

      // 204 is the correct response for OPTIONS
      if (response.status === 204 || response.status === 200) {
        cy.log('✓ CORS Preflight successful');
      } else {
        cy.log(`✗ CORS Preflight failed with status ${response.status}`);
      }

      // Check CORS headers
      const corsHeaders = {
        'access-control-allow-origin': response.headers['access-control-allow-origin'],
        'access-control-allow-methods': response.headers['access-control-allow-methods'],
        'access-control-allow-headers': response.headers['access-control-allow-headers']
      };

      cy.log('CORS Headers Found:', corsHeaders);

      if (corsHeaders['access-control-allow-origin']) {
        cy.log('✓ CORS Allow-Origin configured');
      } else {
        cy.log('✗ CORS Allow-Origin missing');
      }
    });
  });
});