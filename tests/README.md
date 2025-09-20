# ApexShare Testing Framework

A comprehensive testing suite for the ApexShare motorcycle training video sharing system, covering unit tests, integration tests, end-to-end tests, performance testing, and security validation.

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- OWASP ZAP (for security testing)
- Python 3.8+ (for security scripts)

### Installation
```bash
# Install dependencies
npm install

# Install Cypress
npx cypress install

# Install Python dependencies for security testing
pip install python-owasp-zap-v2.4 requests
```

### Running Tests

```bash
# Run all unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run all Jest tests with coverage
npm test

# Run E2E tests (headless)
npx cypress run

# Run E2E tests (interactive)
npx cypress open

# Run performance tests
cd tests/performance && artillery run artillery-config.yml

# Run security tests
cd tests/security && node security-test-suite.js
```

## Test Structure

```
tests/
├── setup.ts                    # Global test configuration
├── unit/                       # Unit tests
│   └── lambda/                 # Lambda function tests
│       ├── upload-handler.test.ts
│       ├── download-handler.test.ts
│       └── email-sender.test.ts
├── integration/                # Integration tests
│   └── api-gateway.test.ts     # API endpoint tests
├── performance/                # Performance testing
│   ├── artillery-config.yml    # Load testing configuration
│   └── performance-utils.js    # Custom functions
├── security/                   # Security testing
│   ├── zap-security-scan.py    # OWASP ZAP automation
│   └── security-test-suite.js  # Custom security tests
├── data/                       # Test data management
│   └── test-data-manager.ts    # Test data utilities
└── mocks/                      # Mock services
    └── aws-mocks.ts            # AWS SDK mocks
```

## Testing Capabilities

### ✅ Unit Testing
- **Lambda Functions**: Upload, Download, Email handlers
- **Business Logic**: Validation, security, error handling
- **AWS Integration**: S3, DynamoDB, SES operations
- **Security**: Input validation, injection prevention
- **Coverage**: 90%+ code coverage target

### ✅ Integration Testing
- **API Gateway**: Endpoint functionality and CORS
- **Authentication**: Security validation
- **Rate Limiting**: Throttling and abuse prevention
- **Error Handling**: Structured error responses
- **Performance**: Response time validation

### ✅ End-to-End Testing
- **User Workflows**: Complete upload and download flows
- **UI Validation**: Form validation and user feedback
- **Responsive Design**: Mobile, tablet, desktop testing
- **Accessibility**: WCAG compliance checking
- **Cross-browser**: Chrome, Firefox, Safari, Edge

### ✅ Performance Testing
- **Load Testing**: Concurrent user simulation
- **Stress Testing**: System breaking point analysis
- **Response Time**: Latency and throughput measurement
- **Scalability**: Auto-scaling behavior validation
- **Cold Start**: Lambda initialization optimization

### ✅ Security Testing
- **Vulnerability Scanning**: OWASP ZAP automation
- **Injection Testing**: SQL, NoSQL, XSS prevention
- **Authentication**: Access control validation
- **File Upload**: Malicious file rejection
- **CORS**: Cross-origin request validation
- **Data Exposure**: Sensitive information protection

## Test Configuration

### Jest Configuration
The Jest configuration is optimized for serverless testing:

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};
```

### Cypress Configuration
Cypress is configured for both E2E and component testing:

```typescript
// cypress.config.ts
export default defineConfig({
  e2e: {
    baseUrl: 'https://apexshare.be',
    viewportWidth: 1280,
    viewportHeight: 720,
    retries: { runMode: 2, openMode: 0 }
  }
});
```

## Custom Test Utilities

### Test Data Manager
The `TestDataManager` provides utilities for creating and managing test data:

```typescript
import { getTestDataManager } from './tests/data/test-data-manager';

const manager = getTestDataManager();
const sessionId = manager.createSession();

// Create test upload
const upload = manager.createTestUpload(sessionId, {
  studentEmail: 'test@example.com',
  fileName: 'test-video.mp4',
  fileSize: 1048576
});

// Create test file
const file = await manager.createTestVideoFile('video.mp4', 10); // 10MB

// Cleanup when done
await manager.endSession(sessionId);
```

### AWS Mocks
Pre-configured mocks for AWS services:

```typescript
import { setupAWSMocks, mockS3Success, mockDynamoDBError } from './tests/mocks/aws-mocks';

// Setup mocks
setupAWSMocks();

// Mock specific scenarios
mockS3Success('putObject');
mockDynamoDBError('notFound');
```

### Cypress Commands
Custom Cypress commands for common operations:

```typescript
// Upload a test video
cy.uploadTestVideo({
  studentEmail: 'test@example.com',
  trainerName: 'Test Trainer'
});

// Check download functionality
cy.checkDownloadLink('file-id-123');

// Test responsive design
cy.testMobileViewport();
cy.testTabletViewport();
cy.testDesktopViewport();
```

## Performance Testing

### Artillery Configuration
Load testing scenarios with Artillery:

```yaml
# artillery-config.yml
config:
  target: 'https://api.apexshare.be'
  phases:
    - duration: 60
      arrivalRate: 1
      name: "Warm up"
    - duration: 120
      arrivalRate: 5
      rampTo: 20
      name: "Ramp up load"
    - duration: 300
      arrivalRate: 20
      name: "Sustained load"
```

### Performance Thresholds
- API Response Time: < 2 seconds average
- Lambda Cold Start: < 1 second
- File Upload: < 30 seconds for 1GB files
- Error Rate: < 1%
- Availability: > 99.5%

## Security Testing

### OWASP ZAP Integration
Automated security scanning with ZAP:

```bash
# Start ZAP proxy
zap.sh -daemon -port 8080

# Run security scan
cd tests/security
python zap-security-scan.py

# View results
open security-reports/security_report_*.html
```

### Custom Security Tests
Comprehensive security validation:

```javascript
// Run security test suite
const SecurityTestSuite = require('./tests/security/security-test-suite');
const suite = new SecurityTestSuite();

const results = await suite.runAllTests();
console.log(`Security Score: ${results.summary.successRate}%`);
```

## Test Data and Fixtures

### Test Files
The framework can generate various test files:

```typescript
// Create video file
const videoFile = await manager.createTestVideoFile('video.mp4', 50); // 50MB

// Create malicious file for security testing
const maliciousFile = await manager.createMaliciousTestFile(
  'script.js',
  'script'
);

// Bulk test data generation
const bulkData = await manager.generateBulkTestData(sessionId, 100, {
  userCount: 10,
  fileVariations: true,
  includeFiles: true
});
```

### Environment Configuration
Tests support multiple environments:

```bash
# Development testing
TARGET_URL=http://localhost:3000 npm test

# Staging testing
TARGET_URL=https://staging.apexshare.be npm test

# Production testing (read-only)
TARGET_URL=https://apexshare.be npm run test:readonly
```

## Continuous Integration

### GitHub Actions Example
```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Test Reports
Tests generate comprehensive reports:

- **Coverage Reports**: HTML and LCOV formats
- **Performance Reports**: Response time metrics
- **Security Reports**: Vulnerability assessments
- **E2E Reports**: Video recordings and screenshots

## Debugging Tests

### Jest Debugging
```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Run specific test file
npm test -- upload-handler.test.ts

# Run tests with verbose output
npm test -- --verbose
```

### Cypress Debugging
```bash
# Open Cypress in debug mode
DEBUG=cypress:* npx cypress open

# Run specific test file
npx cypress run --spec "cypress/e2e/upload-workflow.cy.ts"

# Generate screenshots and videos
npx cypress run --record --key <record_key>
```

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Include setup and teardown for each test
- Mock external dependencies

### Test Data
- Use deterministic test data
- Clean up test artifacts
- Isolate test scenarios
- Use realistic data volumes

### Performance
- Set appropriate timeouts
- Use parallel test execution
- Mock expensive operations
- Monitor test execution time

### Security
- Test with malicious inputs
- Validate error messages don't leak information
- Test authentication and authorization
- Include edge cases and boundary conditions

## Troubleshooting

### Common Issues

**Jest Tests Failing**
```bash
# Clear Jest cache
npx jest --clearCache

# Run tests in band (sequential)
npm test -- --runInBand
```

**Cypress Issues**
```bash
# Clear Cypress cache
npx cypress cache clear

# Verify Cypress installation
npx cypress verify
```

**Performance Test Issues**
```bash
# Check Artillery installation
artillery --version

# Run with debug output
DEBUG=* artillery run artillery-config.yml
```

**Security Test Issues**
```bash
# Verify ZAP is running
curl http://localhost:8080

# Check Python dependencies
pip list | grep owasp
```

## Contributing

### Adding New Tests
1. Create test file in appropriate directory
2. Follow naming conventions (`*.test.ts` for Jest, `*.cy.ts` for Cypress)
3. Include proper setup and teardown
4. Add documentation and comments
5. Update test scripts in package.json if needed

### Test Standards
- Minimum 80% code coverage for new code
- All tests must pass before merging
- Include both positive and negative test cases
- Test error conditions and edge cases
- Follow AAA pattern (Arrange, Act, Assert)

## Support

For issues with the testing framework:
1. Check this documentation
2. Review test logs and error messages
3. Consult individual test files for examples
4. Contact the development team

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Cypress Documentation](https://docs.cypress.io/)
- [Artillery Documentation](https://artillery.io/docs/)
- [OWASP ZAP Documentation](https://www.zaproxy.org/docs/)
- [Testing Best Practices](https://testingjavascript.com/)

---

**Last Updated**: January 2025
**Framework Version**: 1.0
**Maintainer**: ApexShare Development Team