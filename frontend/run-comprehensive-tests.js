#!/usr/bin/env node

/**
 * Comprehensive Test Runner Script
 *
 * Runs all Upload Queue Manager tests and generates production readiness reports.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Upload Queue Manager - Comprehensive Testing Suite');
console.log('='.repeat(80));
console.log('Starting comprehensive validation of the Upload Queue Manager system...');
console.log('');

const testSuites = [
  {
    name: 'Basic Functionality Tests',
    command: 'npm test uploadQueueManager.test.ts',
    description: 'Core queue manager functionality validation'
  },
  {
    name: 'Performance Tests',
    command: 'npm test uploadQueueManager.performance.test.ts',
    description: 'Performance benchmarking and optimization validation'
  },
  {
    name: 'Functional Validation',
    command: 'npm test uploadQueueManager.functional.test.ts',
    description: 'Complete functional validation of all features'
  },
  {
    name: 'Load Testing',
    command: 'npm test uploadQueueManager.load.test.ts',
    description: 'Concurrent upload scenarios and stress testing'
  },
  {
    name: 'Integration Testing',
    command: 'npm test uploadQueueManager.integration.test.ts',
    description: 'Frontend component integration validation'
  },
  {
    name: 'Edge Cases Testing',
    command: 'npm test uploadQueueManager.edge-cases.test.ts',
    description: 'Boundary conditions and failure mode testing'
  },
  {
    name: 'Comprehensive Benchmarks',
    command: 'npm test uploadQueueManager.benchmark.test.ts',
    description: 'Advanced benchmarking with detailed metrics'
  },
  {
    name: 'Production Readiness Assessment',
    command: 'npm test production-readiness.test.ts',
    description: 'Final production readiness evaluation'
  }
];

async function runTestSuite(suite) {
  console.log(`🧪 Running ${suite.name}...`);
  console.log(`   ${suite.description}`);

  const startTime = Date.now();

  try {
    execSync(suite.command, {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    const duration = Date.now() - startTime;
    console.log(`✅ ${suite.name} completed successfully (${duration}ms)`);
    return { success: true, duration, error: null };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ ${suite.name} failed (${duration}ms)`);
    console.error(error.message);
    return { success: false, duration, error: error.message };
  }
}

async function generateSummaryReport(results) {
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  const totalDuration = results.reduce((sum, r) => sum + r.result.duration, 0);

  const report = [
    '# Upload Queue Manager - Test Execution Summary',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Executive Summary',
    `**Total Test Suites:** ${totalTests}`,
    `**Passed:** ${passedTests}`,
    `**Failed:** ${failedTests}`,
    `**Success Rate:** ${((passedTests / totalTests) * 100).toFixed(1)}%`,
    `**Total Duration:** ${(totalDuration / 1000).toFixed(1)} seconds`,
    '',
    '## Test Suite Results',
    ''
  ];

  results.forEach(({ suite, result }) => {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    report.push(`### ${status} - ${suite.name}`);
    report.push(`**Description:** ${suite.description}`);
    report.push(`**Duration:** ${result.duration}ms`);

    if (!result.success && result.error) {
      report.push(`**Error:** ${result.error}`);
    }

    report.push('');
  });

  // Add recommendations
  report.push('## Recommendations');

  if (failedTests === 0) {
    report.push('🟢 **All tests passed!** The Upload Queue Manager is ready for production deployment.');
    report.push('- Implement monitoring and alerting for production environment');
    report.push('- Set up continuous integration for regression testing');
    report.push('- Consider gradual rollout for initial production deployment');
  } else if (failedTests <= 2) {
    report.push('🟡 **Minor issues detected.** Address failing tests before production deployment.');
    report.push('- Review and fix failing test cases');
    report.push('- Re-run test suite to confirm fixes');
    report.push('- Implement enhanced monitoring for identified weak points');
  } else {
    report.push('🔴 **Significant issues detected.** Comprehensive fixes required before production.');
    report.push('- Prioritize fixing critical functionality issues');
    report.push('- Review system architecture for fundamental problems');
    report.push('- Consider additional development cycle before production readiness');
  }

  report.push('');
  report.push('## Next Steps');
  report.push('1. Review detailed test results and error messages');
  report.push('2. Address any failing tests and their root causes');
  report.push('3. Re-run affected test suites after fixes');
  report.push('4. Update documentation with any discovered limitations');
  report.push('5. Prepare deployment checklist and monitoring setup');

  return report.join('\n');
}

async function main() {
  const startTime = Date.now();
  const results = [];

  console.log(`📋 Test Suite Overview:`);
  testSuites.forEach((suite, index) => {
    console.log(`   ${index + 1}. ${suite.name}: ${suite.description}`);
  });
  console.log(`\nEstimated total duration: ~20-30 minutes\n`);

  // Run each test suite
  for (let i = 0; i < testSuites.length; i++) {
    const suite = testSuites[i];
    console.log(`\n[${i + 1}/${testSuites.length}] Starting ${suite.name}`);
    console.log('-'.repeat(60));

    const result = await runTestSuite(suite);
    results.push({ suite, result });

    if (!result.success) {
      console.log(`\n⚠️  Warning: ${suite.name} failed. Continuing with remaining tests...`);
    }

    // Brief pause between test suites
    if (i < testSuites.length - 1) {
      console.log('\n⏸️  Brief pause before next test suite...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const totalDuration = Date.now() - startTime;

  console.log('\n' + '='.repeat(80));
  console.log('🏁 COMPREHENSIVE TESTING COMPLETE');
  console.log('='.repeat(80));

  const passedTests = results.filter(r => r.success).length;
  const failedTests = results.length - passedTests;

  console.log(`\n📊 FINAL RESULTS:`);
  console.log(`   Total Test Suites: ${results.length}`);
  console.log(`   Passed: ${passedTests}`);
  console.log(`   Failed: ${failedTests}`);
  console.log(`   Success Rate: ${((passedTests / results.length) * 100).toFixed(1)}%`);
  console.log(`   Total Duration: ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);

  // Generate summary report
  console.log('\n📝 Generating test execution summary...');
  const summaryReport = await generateSummaryReport(results);

  // Save summary report
  try {
    const reportPath = path.join(__dirname, 'src', 'tests', 'test-execution-summary.md');
    fs.writeFileSync(reportPath, summaryReport);
    console.log(`📄 Test execution summary saved to: ${reportPath}`);
  } catch (error) {
    console.log('📄 Test execution summary generated (file save failed, console only)');
  }

  // Display summary
  console.log('\n' + '='.repeat(80));
  console.log('📋 TEST EXECUTION SUMMARY');
  console.log('='.repeat(80));
  console.log(summaryReport);

  // Exit with appropriate code
  const exitCode = failedTests > 0 ? 1 : 0;

  if (exitCode === 0) {
    console.log('\n🎉 All tests completed successfully! Upload Queue Manager is ready for production.');
  } else {
    console.log('\n⚠️  Some tests failed. Review the results and address issues before production deployment.');
  }

  process.exit(exitCode);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 Unhandled Rejection:', reason);
  process.exit(1);
});

// Run the comprehensive test suite
main().catch((error) => {
  console.error('\n💥 Test runner failed:', error);
  process.exit(1);
});