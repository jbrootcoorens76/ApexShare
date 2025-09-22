import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'https://apexshare.be',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 30000,
    responseTimeout: 30000,
    pageLoadTimeout: 30000,
    retries: {
      runMode: 2,
      openMode: 0
    },
    // Force Chrome browser for real-world testing
    browser: 'chrome',
    chromeWebSecurity: false, // Disable web security for cross-origin testing
    experimentalSessionAndOrigin: true,
    env: {
      apiUrl: 'https://api.apexshare.be',
      testEmail: 'test@apexshare.be',
      testTrainer: 'Cypress Test Trainer'
    },
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    videosFolder: 'cypress/videos',
    screenshotsFolder: 'cypress/screenshots',
    downloadsFolder: 'cypress/downloads',
    fixturesFolder: 'cypress/fixtures',
    excludeSpecPattern: [
      '**/__snapshots__/*',
      '**/__image_snapshots__/*'
    ],
    setupNodeEvents(on, config) {
      // implement node event listeners here
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        generateTestFile() {
          const fs = require('fs');
          const path = require('path');

          // Create a test video file for upload testing
          const testVideoPath = path.join(config.fixturesFolder, 'test-video.mp4');
          if (!fs.existsSync(testVideoPath)) {
            // Create a minimal MP4 file (just for testing - not a real video)
            const buffer = Buffer.from([
              0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D,
              0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
              0x6D, 0x70, 0x34, 0x31, 0x00, 0x00, 0x00, 0x08, 0x6D, 0x64, 0x61, 0x74
            ]);
            fs.writeFileSync(testVideoPath, buffer);
          }
          return testVideoPath;
        }
      });

      // Code coverage collection
      require('@cypress/code-coverage/task')(on, config);

      return config;
    }
  },

  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    specPattern: 'frontend/src/**/*.cy.{js,jsx,ts,tsx}',
    indexHtmlFile: 'cypress/support/component-index.html',
    supportFile: 'cypress/support/component.ts'
  },

  experimentalStudio: true,
  experimentalWebKitSupport: true,
});