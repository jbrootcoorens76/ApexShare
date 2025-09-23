/**
 * Performance Benchmark Collection and Reporting System
 *
 * Comprehensive benchmarking system to collect, analyze, and report
 * performance metrics for the Upload Queue Manager system.
 */

import { uploadQueueManager } from '@/services/uploadQueueManager'
import type {
  QueueConfigType,
  PerformanceMetricsType,
  NetworkMetricsType
} from '@/services/uploadQueueManager'

// Benchmark data structures
export interface BenchmarkMetrics {
  testName: string
  timestamp: number
  duration: number
  fileCount: number
  totalSize: number
  concurrency: number
  throughput: number
  successRate: number
  memoryUsage: number
  cpuTime: number
  networkCondition: string
  configuration: QueueConfigType
  errors: Array<{
    fileId: string
    error: string
    timestamp: number
  }>
  details: {
    queueTime: number
    processingTime: number
    avgFileSize: number
    maxMemoryUsage: number
    minThroughput: number
    maxThroughput: number
    avgResponseTime: number
    errorRate: number
  }
}

export interface BenchmarkSuite {
  suiteName: string
  startTime: number
  endTime: number
  totalTests: number
  passedTests: number
  failedTests: number
  metrics: BenchmarkMetrics[]
  summary: {
    avgThroughput: number
    avgSuccessRate: number
    avgMemoryUsage: number
    avgDuration: number
    bestPerformingTest: string
    worstPerformingTest: string
    recommendations: string[]
  }
}

export interface ComparisonReport {
  baseline: BenchmarkMetrics
  current: BenchmarkMetrics
  improvements: {
    throughputImprovement: number
    successRateImprovement: number
    memoryImprovement: number
    durationImprovement: number
  }
  regressions: string[]
  verdict: 'IMPROVED' | 'STABLE' | 'REGRESSED'
}

// Performance monitoring utilities
class PerformanceMonitor {
  private startTime: number = 0
  private startMemory: number = 0
  private startCpu: number = 0

  start(): void {
    this.startTime = Date.now()
    this.startMemory = this.measureMemory()
    this.startCpu = this.measureCpuTime()
  }

  stop(): { duration: number; memoryUsage: number; cpuTime: number } {
    return {
      duration: Date.now() - this.startTime,
      memoryUsage: this.measureMemory() - this.startMemory,
      cpuTime: this.measureCpuTime() - this.startCpu
    }
  }

  private measureMemory(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }

  private measureCpuTime(): number {
    if (typeof performance !== 'undefined') {
      return performance.now()
    }
    return Date.now()
  }
}

// Main benchmark runner class
export class BenchmarkRunner {
  private suites: BenchmarkSuite[] = []
  private currentSuite: BenchmarkSuite | null = null
  private monitor = new PerformanceMonitor()

  /**
   * Start a new benchmark suite
   */
  startSuite(suiteName: string): void {
    this.currentSuite = {
      suiteName,
      startTime: Date.now(),
      endTime: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      metrics: [],
      summary: {
        avgThroughput: 0,
        avgSuccessRate: 0,
        avgMemoryUsage: 0,
        avgDuration: 0,
        bestPerformingTest: '',
        worstPerformingTest: '',
        recommendations: []
      }
    }
  }

  /**
   * End the current benchmark suite
   */
  endSuite(): BenchmarkSuite | null {
    if (!this.currentSuite) return null

    this.currentSuite.endTime = Date.now()
    this.generateSuiteSummary()
    this.suites.push(this.currentSuite)

    const completedSuite = this.currentSuite
    this.currentSuite = null
    return completedSuite
  }

  /**
   * Run a single benchmark test
   */
  async runBenchmark(
    testName: string,
    testFn: () => Promise<{
      fileCount: number
      totalSize: number
      concurrency: number
      successRate: number
      errors: Array<{ fileId: string; error: string; timestamp: number }>
    }>,
    networkCondition: string = 'unknown'
  ): Promise<BenchmarkMetrics> {
    if (!this.currentSuite) {
      throw new Error('No active benchmark suite. Call startSuite() first.')
    }

    console.log(`🏃 Running benchmark: ${testName}`)

    this.monitor.start()
    const testStartTime = Date.now()

    let testResult: any
    let testSuccess = false

    try {
      testResult = await testFn()
      testSuccess = true
      this.currentSuite.passedTests++
    } catch (error) {
      console.error(`❌ Benchmark failed: ${testName}`, error)
      testResult = {
        fileCount: 0,
        totalSize: 0,
        concurrency: 0,
        successRate: 0,
        errors: [{ fileId: 'test-error', error: String(error), timestamp: Date.now() }]
      }
      this.currentSuite.failedTests++
    }

    const performance = this.monitor.stop()
    const queueStatus = uploadQueueManager.getQueueStatus()

    const metrics: BenchmarkMetrics = {
      testName,
      timestamp: testStartTime,
      duration: performance.duration,
      fileCount: testResult.fileCount,
      totalSize: testResult.totalSize,
      concurrency: testResult.concurrency,
      throughput: testResult.totalSize > 0 ? testResult.totalSize / (performance.duration / 1000) : 0,
      successRate: testResult.successRate,
      memoryUsage: performance.memoryUsage,
      cpuTime: performance.cpuTime,
      networkCondition,
      configuration: { ...queueStatus.config },
      errors: testResult.errors || [],
      details: {
        queueTime: 0, // Would need to be measured separately
        processingTime: performance.duration,
        avgFileSize: testResult.fileCount > 0 ? testResult.totalSize / testResult.fileCount : 0,
        maxMemoryUsage: performance.memoryUsage,
        minThroughput: 0, // Would need continuous monitoring
        maxThroughput: 0, // Would need continuous monitoring
        avgResponseTime: testResult.fileCount > 0 ? performance.duration / testResult.fileCount : 0,
        errorRate: testResult.errors ? testResult.errors.length / Math.max(testResult.fileCount, 1) : 0
      }
    }

    this.currentSuite.totalTests++
    this.currentSuite.metrics.push(metrics)

    console.log(`✅ Benchmark completed: ${testName}`)
    console.log(`   Duration: ${metrics.duration}ms`)
    console.log(`   Throughput: ${(metrics.throughput / 1024 / 1024).toFixed(2)} MB/s`)
    console.log(`   Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`)
    console.log(`   Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)} MB`)

    return metrics
  }

  /**
   * Generate summary for the current suite
   */
  private generateSuiteSummary(): void {
    if (!this.currentSuite || this.currentSuite.metrics.length === 0) return

    const metrics = this.currentSuite.metrics
    const validMetrics = metrics.filter(m => m.successRate > 0)

    if (validMetrics.length === 0) {
      this.currentSuite.summary.recommendations.push('All tests failed - system requires debugging')
      return
    }

    // Calculate averages
    this.currentSuite.summary.avgThroughput = validMetrics.reduce((sum, m) => sum + m.throughput, 0) / validMetrics.length
    this.currentSuite.summary.avgSuccessRate = validMetrics.reduce((sum, m) => sum + m.successRate, 0) / validMetrics.length
    this.currentSuite.summary.avgMemoryUsage = validMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / validMetrics.length
    this.currentSuite.summary.avgDuration = validMetrics.reduce((sum, m) => sum + m.duration, 0) / validMetrics.length

    // Find best and worst performing tests
    const throughputSorted = [...validMetrics].sort((a, b) => b.throughput - a.throughput)
    this.currentSuite.summary.bestPerformingTest = throughputSorted[0]?.testName || 'none'
    this.currentSuite.summary.worstPerformingTest = throughputSorted[throughputSorted.length - 1]?.testName || 'none'

    // Generate recommendations
    this.generateRecommendations()
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): void {
    if (!this.currentSuite) return

    const summary = this.currentSuite.summary
    const recommendations: string[] = []

    // Throughput recommendations
    if (summary.avgThroughput < 5 * 1024 * 1024) { // Less than 5 MB/s
      recommendations.push('Low throughput detected - consider increasing concurrency or optimizing chunk size')
    }

    // Success rate recommendations
    if (summary.avgSuccessRate < 0.8) {
      recommendations.push('Low success rate - implement more robust error handling and retry logic')
    }

    // Memory usage recommendations
    if (summary.avgMemoryUsage > 500 * 1024 * 1024) { // More than 500MB
      recommendations.push('High memory usage - implement better resource cleanup and memory management')
    }

    // Duration recommendations
    if (summary.avgDuration > 30000) { // More than 30 seconds
      recommendations.push('Long test duration - optimize queue processing and reduce unnecessary delays')
    }

    // Error analysis
    const totalErrors = this.currentSuite.metrics.reduce((sum, m) => sum + m.errors.length, 0)
    if (totalErrors > this.currentSuite.totalTests * 0.1) {
      recommendations.push('High error rate - review error handling and network resilience')
    }

    // Concurrency analysis
    const avgConcurrency = this.currentSuite.metrics.reduce((sum, m) => sum + m.concurrency, 0) / this.currentSuite.metrics.length
    if (avgConcurrency < 2) {
      recommendations.push('Low concurrency - consider increasing parallel processing for better performance')
    }

    this.currentSuite.summary.recommendations = recommendations
  }

  /**
   * Compare two benchmark results
   */
  compareBenchmarks(baseline: BenchmarkMetrics, current: BenchmarkMetrics): ComparisonReport {
    const improvements = {
      throughputImprovement: ((current.throughput - baseline.throughput) / baseline.throughput) * 100,
      successRateImprovement: ((current.successRate - baseline.successRate) / baseline.successRate) * 100,
      memoryImprovement: ((baseline.memoryUsage - current.memoryUsage) / baseline.memoryUsage) * 100, // Negative is improvement
      durationImprovement: ((baseline.duration - current.duration) / baseline.duration) * 100 // Negative is improvement
    }

    const regressions: string[] = []

    if (improvements.throughputImprovement < -10) {
      regressions.push(`Throughput decreased by ${Math.abs(improvements.throughputImprovement).toFixed(1)}%`)
    }

    if (improvements.successRateImprovement < -5) {
      regressions.push(`Success rate decreased by ${Math.abs(improvements.successRateImprovement).toFixed(1)}%`)
    }

    if (improvements.memoryImprovement < -20) {
      regressions.push(`Memory usage increased by ${Math.abs(improvements.memoryImprovement).toFixed(1)}%`)
    }

    if (improvements.durationImprovement < -20) {
      regressions.push(`Duration increased by ${Math.abs(improvements.durationImprovement).toFixed(1)}%`)
    }

    let verdict: 'IMPROVED' | 'STABLE' | 'REGRESSED' = 'STABLE'

    if (regressions.length > 0) {
      verdict = 'REGRESSED'
    } else if (
      improvements.throughputImprovement > 5 ||
      improvements.successRateImprovement > 2 ||
      improvements.memoryImprovement > 10 ||
      improvements.durationImprovement > 10
    ) {
      verdict = 'IMPROVED'
    }

    return {
      baseline,
      current,
      improvements,
      regressions,
      verdict
    }
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(): string {
    const report = [
      '# Upload Queue Manager Performance Benchmark Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Executive Summary',
      `Total benchmark suites: ${this.suites.length}`,
      ''
    ]

    this.suites.forEach(suite => {
      report.push(`### ${suite.suiteName}`)
      report.push(`**Duration:** ${new Date(suite.endTime - suite.startTime).toISOString().substr(11, 8)}`)
      report.push(`**Tests:** ${suite.passedTests}/${suite.totalTests} passed`)
      report.push(`**Average Throughput:** ${(suite.summary.avgThroughput / 1024 / 1024).toFixed(2)} MB/s`)
      report.push(`**Average Success Rate:** ${(suite.summary.avgSuccessRate * 100).toFixed(1)}%`)
      report.push(`**Average Memory Usage:** ${(suite.summary.avgMemoryUsage / 1024 / 1024).toFixed(2)} MB`)
      report.push(`**Best Test:** ${suite.summary.bestPerformingTest}`)
      report.push(`**Worst Test:** ${suite.summary.worstPerformingTest}`)

      if (suite.summary.recommendations.length > 0) {
        report.push('**Recommendations:**')
        suite.summary.recommendations.forEach(rec => {
          report.push(`- ${rec}`)
        })
      }

      report.push('')

      // Detailed test results
      report.push('#### Detailed Results')
      suite.metrics.forEach(metric => {
        report.push(`**${metric.testName}**`)
        report.push(`- Duration: ${metric.duration}ms`)
        report.push(`- Files: ${metric.fileCount} (${(metric.totalSize / 1024 / 1024).toFixed(1)} MB total)`)
        report.push(`- Concurrency: ${metric.concurrency}`)
        report.push(`- Throughput: ${(metric.throughput / 1024 / 1024).toFixed(2)} MB/s`)
        report.push(`- Success Rate: ${(metric.successRate * 100).toFixed(1)}%`)
        report.push(`- Memory Usage: ${(metric.memoryUsage / 1024 / 1024).toFixed(2)} MB`)
        report.push(`- Network: ${metric.networkCondition}`)

        if (metric.errors.length > 0) {
          report.push(`- Errors: ${metric.errors.length}`)
          report.push(`  - ${metric.errors.slice(0, 3).map(e => e.error).join('\n  - ')}`)
          if (metric.errors.length > 3) {
            report.push(`  - ... and ${metric.errors.length - 3} more`)
          }
        }

        report.push('')
      })
    })

    // Overall analysis
    if (this.suites.length > 0) {
      const allMetrics = this.suites.flatMap(s => s.metrics)
      const overallAvgThroughput = allMetrics.reduce((sum, m) => sum + m.throughput, 0) / allMetrics.length
      const overallAvgSuccessRate = allMetrics.reduce((sum, m) => sum + m.successRate, 0) / allMetrics.length

      report.push('## Overall Analysis')
      report.push(`**Overall Average Throughput:** ${(overallAvgThroughput / 1024 / 1024).toFixed(2)} MB/s`)
      report.push(`**Overall Average Success Rate:** ${(overallAvgSuccessRate * 100).toFixed(1)}%`)
      report.push('')

      // Performance trends
      if (this.suites.length > 1) {
        const firstSuite = this.suites[0]
        const lastSuite = this.suites[this.suites.length - 1]

        const throughputTrend = ((lastSuite.summary.avgThroughput - firstSuite.summary.avgThroughput) / firstSuite.summary.avgThroughput) * 100
        const successRateTrend = ((lastSuite.summary.avgSuccessRate - firstSuite.summary.avgSuccessRate) / firstSuite.summary.avgSuccessRate) * 100

        report.push('## Performance Trends')
        report.push(`**Throughput Trend:** ${throughputTrend > 0 ? '+' : ''}${throughputTrend.toFixed(1)}%`)
        report.push(`**Success Rate Trend:** ${successRateTrend > 0 ? '+' : ''}${successRateTrend.toFixed(1)}%`)
        report.push('')
      }
    }

    return report.join('\n')
  }

  /**
   * Export benchmark data as JSON
   */
  exportData(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      suites: this.suites
    }, null, 2)
  }

  /**
   * Get all benchmark suites
   */
  getSuites(): BenchmarkSuite[] {
    return [...this.suites]
  }

  /**
   * Clear all benchmark data
   */
  clear(): void {
    this.suites = []
    this.currentSuite = null
  }
}

// Utility functions for common benchmark scenarios
export const BenchmarkUtils = {
  /**
   * Create a mock file for testing
   */
  createMockFile(name: string, size: number, type: string = 'video/mp4'): File {
    const file = new File(['mock content'], name, { type })
    Object.defineProperty(file, 'size', { value: size, writable: false })
    return file
  },

  /**
   * Wait for a specified duration
   */
  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  /**
   * Generate test files with varying sizes
   */
  generateTestFiles(count: number, sizeRange: [number, number]): Array<{ name: string; size: number }> {
    return Array.from({ length: count }, (_, i) => ({
      name: `test-file-${i}.mp4`,
      size: Math.floor(Math.random() * (sizeRange[1] - sizeRange[0]) + sizeRange[0])
    }))
  },

  /**
   * Calculate statistical metrics
   */
  calculateStats(values: number[]): {
    mean: number
    median: number
    min: number
    max: number
    stdDev: number
  } {
    if (values.length === 0) {
      return { mean: 0, median: 0, min: 0, max: 0, stdDev: 0 }
    }

    const sorted = [...values].sort((a, b) => a - b)
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length

    return {
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      stdDev: Math.sqrt(variance)
    }
  }
}

// Singleton instance for global use
export const benchmarkRunner = new BenchmarkRunner()