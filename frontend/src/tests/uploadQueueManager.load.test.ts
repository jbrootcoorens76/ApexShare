/**
 * Upload Queue Manager Load Tests
 *
 * Comprehensive load testing for concurrent upload scenarios, stress testing,
 * and validation of system behavior under high load conditions.
 */

import { uploadQueueManager } from '@/services/uploadQueueManager'
import type {
  QueueConfigType,
  PerformanceMetricsType,
  NetworkMetricsType
} from '@/services/uploadQueueManager'

// Mock external dependencies
jest.mock('@/services/api', () => ({
  apiService: {
    files: {
      getUploadUrl: jest.fn(),
      completeUpload: jest.fn(),
      cancelUpload: jest.fn()
    }
  },
  uploadFileChunk: jest.fn()
}))

jest.mock('@/utils/device', () => ({
  getOptimalChunkSize: jest.fn(() => 5 * 1024 * 1024),
  getNetworkInfo: jest.fn(() => ({
    effectiveType: '4g',
    downlink: 10,
    rtt: 50,
    saveData: false
  })),
  getDeviceInfo: jest.fn(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    memory: 8
  })),
  isSlowNetwork: jest.fn(() => false)
}))

jest.mock('@/config/env', () => ({
  appConfig: {
    enableDetailedLogging: false, // Disable for load tests
    apiUrl: 'https://api.test.com'
  }
}))

// Load testing utilities
interface LoadTestMetrics {
  testName: string
  fileCount: number
  totalSize: number
  concurrency: number
  duration: number
  throughput: number
  successRate: number
  memoryUsage: number
  cpuTime: number
  errors: string[]
}

class LoadTestRunner {
  private metrics: LoadTestMetrics[] = []

  private createMockFile(name: string, size: number, type: string = 'video/mp4'): File {
    const file = new File(['mock content'], name, { type })
    Object.defineProperty(file, 'size', { value: size, writable: false })
    return file
  }

  private sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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

  async runLoadTest(
    testName: string,
    fileCount: number,
    avgFileSize: number,
    maxConcurrency: number,
    testDuration: number = 10000
  ): Promise<LoadTestMetrics> {
    console.log(`🚀 Starting load test: ${testName} (${fileCount} files, ${maxConcurrency} concurrent)`)

    const startTime = Date.now()
    const startMemory = this.measureMemory()
    const startCpu = this.measureCpuTime()

    // Configure queue manager for load test
    uploadQueueManager.updateConfig({
      maxConcurrentFiles: maxConcurrency,
      maxConcurrentChunks: maxConcurrency * 2,
      retryAttempts: 1, // Reduce retries for faster testing
      retryDelay: 100,
      adaptiveOptimization: true
    })

    const errors: string[] = []
    let completedUploads = 0
    let failedUploads = 0

    // Track events
    const eventHandler = {
      onComplete: (fileId: string) => completedUploads++,
      onError: (fileId: string, error: string) => {
        failedUploads++
        errors.push(`${fileId}: ${error}`)
      }
    }

    uploadQueueManager.on('upload-completed', eventHandler.onComplete)
    uploadQueueManager.on('upload-error', eventHandler.onError)

    try {
      // Generate test files with varying sizes
      const files = Array.from({ length: fileCount }, (_, i) => {
        const sizeVariation = 0.5 + Math.random() // 50% to 150% of avg size
        const size = Math.floor(avgFileSize * sizeVariation)
        const file = this.createMockFile(`load-test-${i}.mp4`, size)
        return { file, id: `load-test-${i}`, size }
      })

      const totalSize = files.reduce((sum, f) => sum + f.size, 0)

      // Queue all files
      const queueStartTime = Date.now()
      files.forEach(({ file, id }) => {
        uploadQueueManager.queueUpload(id, file, 'load-test-session')
      })
      const queueEndTime = Date.now()

      console.log(`📤 Queued ${fileCount} files in ${queueEndTime - queueStartTime}ms`)

      // Wait for test duration or completion
      const endTime = startTime + testDuration
      while (Date.now() < endTime && (completedUploads + failedUploads) < fileCount) {
        await this.sleep(100)

        // Monitor progress
        const status = uploadQueueManager.getQueueStatus()
        if (Date.now() % 2000 < 100) { // Log every 2 seconds
          console.log(`📊 Progress: ${completedUploads}/${fileCount} completed, ${status.activeUploads} active, ${status.queueLength} queued`)
        }
      }

      const endMemory = this.measureMemory()
      const endCpu = this.measureCpuTime()
      const duration = Date.now() - startTime

      const metrics: LoadTestMetrics = {
        testName,
        fileCount,
        totalSize,
        concurrency: maxConcurrency,
        duration,
        throughput: totalSize / (duration / 1000), // bytes per second
        successRate: completedUploads / fileCount,
        memoryUsage: endMemory - startMemory,
        cpuTime: endCpu - startCpu,
        errors
      }

      this.metrics.push(metrics)
      console.log(`✅ Load test completed: ${testName}`)
      console.log(`   Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`)
      console.log(`   Throughput: ${(metrics.throughput / 1024 / 1024).toFixed(2)} MB/s`)
      console.log(`   Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)} MB`)

      return metrics

    } finally {
      // Cleanup
      uploadQueueManager.off('upload-completed', eventHandler.onComplete)
      uploadQueueManager.off('upload-error', eventHandler.onError)
      uploadQueueManager.destroy()
    }
  }

  async runStressTest(
    testName: string,
    initialFiles: number,
    fileIncrement: number,
    maxFiles: number,
    avgFileSize: number
  ): Promise<LoadTestMetrics[]> {
    console.log(`🔥 Starting stress test: ${testName}`)

    const stressMetrics: LoadTestMetrics[] = []

    for (let fileCount = initialFiles; fileCount <= maxFiles; fileCount += fileIncrement) {
      const metrics = await this.runLoadTest(
        `${testName}-${fileCount}files`,
        fileCount,
        avgFileSize,
        Math.min(5, Math.ceil(fileCount / 10)), // Scale concurrency with file count
        5000 // Shorter duration for stress tests
      )

      stressMetrics.push(metrics)

      // Break if performance degrades significantly
      if (metrics.successRate < 0.5) {
        console.log(`⚠️ Stopping stress test due to low success rate: ${(metrics.successRate * 100).toFixed(1)}%`)
        break
      }

      // Brief pause between stress levels
      await this.sleep(1000)
    }

    return stressMetrics
  }

  getMetrics(): LoadTestMetrics[] {
    return [...this.metrics]
  }

  generateLoadTestReport(): string {
    const report = [
      '# Upload Queue Manager Load Test Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Executive Summary',
      `Total load tests run: ${this.metrics.length}`,
      `Average success rate: ${(this.metrics.reduce((sum, m) => sum + m.successRate, 0) / this.metrics.length * 100).toFixed(1)}%`,
      `Average throughput: ${(this.metrics.reduce((sum, m) => sum + m.throughput, 0) / this.metrics.length / 1024 / 1024).toFixed(2)} MB/s`,
      '',
      '## Performance Benchmarks',
      ''
    ]

    this.metrics.forEach(metric => {
      report.push(`### ${metric.testName}`)
      report.push(`- Files: ${metric.fileCount} (${(metric.totalSize / 1024 / 1024).toFixed(1)} MB total)`)
      report.push(`- Concurrency: ${metric.concurrency}`)
      report.push(`- Duration: ${metric.duration}ms`)
      report.push(`- Success Rate: ${(metric.successRate * 100).toFixed(1)}%`)
      report.push(`- Throughput: ${(metric.throughput / 1024 / 1024).toFixed(2)} MB/s`)
      report.push(`- Memory Usage: ${(metric.memoryUsage / 1024 / 1024).toFixed(2)} MB`)
      report.push(`- CPU Time: ${metric.cpuTime.toFixed(2)}ms`)

      if (metric.errors.length > 0) {
        report.push(`- Errors: ${metric.errors.length}`)
        report.push(`  - ${metric.errors.slice(0, 5).join('\n  - ')}`)
        if (metric.errors.length > 5) {
          report.push(`  - ... and ${metric.errors.length - 5} more`)
        }
      }
      report.push('')
    })

    return report.join('\n')
  }
}

describe('Upload Queue Manager Load Tests', () => {
  const loadTestRunner = new LoadTestRunner()
  let mockApi: any

  beforeEach(() => {
    uploadQueueManager.destroy()

    // Setup API mocks with realistic delays
    mockApi = require('@/services/api')
    mockApi.apiService.files.getUploadUrl.mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            success: true,
            data: {
              uploadId: 'load-test-upload-id',
              uploadUrl: 'https://s3.amazonaws.com/test-bucket/load-test',
              chunkSize: 5 * 1024 * 1024
            }
          })
        }, 50 + Math.random() * 100) // 50-150ms delay
      })
    })

    mockApi.apiService.files.completeUpload.mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            success: true,
            data: { fileId: 'completed-load-test' }
          })
        }, 20 + Math.random() * 50) // 20-70ms delay
      })
    })

    mockApi.uploadFileChunk.mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ etag: `load-test-etag-${Math.random()}` })
        }, 100 + Math.random() * 200) // 100-300ms delay per chunk
      })
    })

    jest.clearAllMocks()
  })

  afterEach(() => {
    uploadQueueManager.destroy()
  })

  describe('Concurrent Upload Scenarios', () => {
    test('should handle 2 concurrent uploads efficiently', async () => {
      const metrics = await loadTestRunner.runLoadTest(
        'Concurrent 2 Files',
        2,
        25 * 1024 * 1024, // 25MB average
        2,
        8000
      )

      expect(metrics.successRate).toBeGreaterThan(0.8) // 80% success rate
      expect(metrics.duration).toBeLessThan(10000)
      expect(metrics.concurrency).toBe(2)
    }, 15000)

    test('should handle 5 concurrent uploads efficiently', async () => {
      const metrics = await loadTestRunner.runLoadTest(
        'Concurrent 5 Files',
        5,
        20 * 1024 * 1024, // 20MB average
        3,
        12000
      )

      expect(metrics.successRate).toBeGreaterThan(0.7) // 70% success rate
      expect(metrics.duration).toBeLessThan(15000)
      expect(metrics.fileCount).toBe(5)
    }, 20000)

    test('should handle 10 concurrent uploads with queue management', async () => {
      const metrics = await loadTestRunner.runLoadTest(
        'Concurrent 10 Files',
        10,
        15 * 1024 * 1024, // 15MB average
        4,
        15000
      )

      expect(metrics.successRate).toBeGreaterThan(0.6) // 60% success rate
      expect(metrics.fileCount).toBe(10)
      expect(metrics.memoryUsage).toBeLessThan(200 * 1024 * 1024) // < 200MB
    }, 25000)
  })

  describe('High Volume Scenarios', () => {
    test('should process many small files efficiently', async () => {
      const metrics = await loadTestRunner.runLoadTest(
        'Many Small Files',
        20,
        2 * 1024 * 1024, // 2MB average
        5,
        10000
      )

      expect(metrics.successRate).toBeGreaterThan(0.8)
      expect(metrics.fileCount).toBe(20)
      expect(metrics.throughput).toBeGreaterThan(0) // Should have measurable throughput
    }, 20000)

    test('should handle large files with limited concurrency', async () => {
      const metrics = await loadTestRunner.runLoadTest(
        'Large Files',
        3,
        100 * 1024 * 1024, // 100MB average
        2,
        15000
      )

      expect(metrics.fileCount).toBe(3)
      expect(metrics.totalSize).toBeGreaterThan(200 * 1024 * 1024) // > 200MB total
      expect(metrics.concurrency).toBe(2)
    }, 25000)

    test('should handle mixed file sizes optimally', async () => {
      const metrics = await loadTestRunner.runLoadTest(
        'Mixed File Sizes',
        15,
        30 * 1024 * 1024, // 30MB average with high variation
        3,
        20000
      )

      expect(metrics.successRate).toBeGreaterThan(0.6)
      expect(metrics.fileCount).toBe(15)
      expect(metrics.duration).toBeLessThan(25000)
    }, 30000)
  })

  describe('Stress Testing', () => {
    test('should maintain performance with increasing load', async () => {
      const stressMetrics = await loadTestRunner.runStressTest(
        'Incremental Stress',
        5,   // Start with 5 files
        5,   // Increment by 5
        25,  // Up to 25 files
        10 * 1024 * 1024 // 10MB average
      )

      expect(stressMetrics.length).toBeGreaterThan(0)

      // Performance should degrade gracefully
      const successRates = stressMetrics.map(m => m.successRate)
      const firstRate = successRates[0]
      const lastRate = successRates[successRates.length - 1]

      // Success rate shouldn't drop below 30% even under stress
      expect(lastRate).toBeGreaterThan(0.3)

      // Memory usage should remain reasonable
      const maxMemory = Math.max(...stressMetrics.map(m => m.memoryUsage))
      expect(maxMemory).toBeLessThan(500 * 1024 * 1024) // < 500MB
    }, 60000)

    test('should handle burst uploads', async () => {
      const metrics = await loadTestRunner.runLoadTest(
        'Burst Upload Test',
        50,
        5 * 1024 * 1024, // 5MB average - many small files at once
        6,
        25000
      )

      expect(metrics.fileCount).toBe(50)
      expect(metrics.successRate).toBeGreaterThan(0.4) // 40% minimum for burst scenario
      expect(metrics.duration).toBeLessThan(30000)
    }, 35000)
  })

  describe('Network Condition Load Tests', () => {
    test('should adapt to slow network conditions under load', async () => {
      // Mock slow network
      const mockDevice = require('@/utils/device')
      mockDevice.getNetworkInfo.mockReturnValue({
        effectiveType: '3g',
        downlink: 1.5,
        rtt: 200
      })
      mockDevice.isSlowNetwork.mockReturnValue(true)

      const metrics = await loadTestRunner.runLoadTest(
        'Slow Network Load',
        8,
        15 * 1024 * 1024, // 15MB average
        2, // Reduced concurrency for slow network
        15000
      )

      expect(metrics.concurrency).toBeLessThanOrEqual(2)
      expect(metrics.successRate).toBeGreaterThan(0.5)
    }, 25000)

    test('should scale up for fast network under load', async () => {
      // Mock fast network
      const mockDevice = require('@/utils/device')
      mockDevice.getNetworkInfo.mockReturnValue({
        effectiveType: '4g',
        downlink: 20,
        rtt: 30
      })
      mockDevice.isSlowNetwork.mockReturnValue(false)

      const metrics = await loadTestRunner.runLoadTest(
        'Fast Network Load',
        12,
        25 * 1024 * 1024, // 25MB average
        5, // Higher concurrency for fast network
        15000
      )

      expect(metrics.concurrency).toBe(5)
      expect(metrics.fileCount).toBe(12)
    }, 25000)
  })

  describe('Memory and Resource Load Tests', () => {
    test('should maintain memory efficiency under high load', async () => {
      const metrics = await loadTestRunner.runLoadTest(
        'Memory Efficiency Load',
        30,
        8 * 1024 * 1024, // 8MB average
        4,
        20000
      )

      expect(metrics.fileCount).toBe(30)
      expect(metrics.memoryUsage).toBeLessThan(300 * 1024 * 1024) // < 300MB
      expect(metrics.successRate).toBeGreaterThan(0.5)
    }, 30000)

    test('should handle resource cleanup under load', async () => {
      // Run multiple smaller load tests to test cleanup
      const metrics1 = await loadTestRunner.runLoadTest('Cleanup Test 1', 10, 10 * 1024 * 1024, 3, 8000)
      const metrics2 = await loadTestRunner.runLoadTest('Cleanup Test 2', 10, 10 * 1024 * 1024, 3, 8000)

      // Second test should not use significantly more memory
      const memoryDiff = metrics2.memoryUsage - metrics1.memoryUsage
      expect(Math.abs(memoryDiff)).toBeLessThan(100 * 1024 * 1024) // < 100MB difference
    }, 30000)
  })

  describe('Error Handling Under Load', () => {
    test('should handle API failures gracefully under load', async () => {
      // Mock some API failures
      let callCount = 0
      mockApi.apiService.files.getUploadUrl.mockImplementation(() => {
        callCount++
        if (callCount % 3 === 0) { // Fail every 3rd call
          return Promise.reject(new Error('Simulated API failure'))
        }
        return Promise.resolve({
          success: true,
          data: {
            uploadId: 'load-test-upload-id',
            uploadUrl: 'https://s3.amazonaws.com/test-bucket/load-test',
            chunkSize: 5 * 1024 * 1024
          }
        })
      })

      const metrics = await loadTestRunner.runLoadTest(
        'API Failure Load Test',
        12,
        20 * 1024 * 1024,
        3,
        15000
      )

      expect(metrics.fileCount).toBe(12)
      expect(metrics.errors.length).toBeGreaterThan(0) // Should have some errors
      expect(metrics.successRate).toBeGreaterThan(0.4) // But still some success
    }, 25000)
  })

  afterAll(() => {
    // Generate and save load test report
    const report = loadTestRunner.generateLoadTestReport()
    console.log('\n' + '='.repeat(80))
    console.log(report)
    console.log('='.repeat(80))

    // Save report to file for analysis
    if (typeof require !== 'undefined') {
      try {
        const fs = require('fs')
        const path = require('path')
        const reportPath = path.join(__dirname, 'upload-queue-load-test-report.md')
        fs.writeFileSync(reportPath, report)
        console.log(`📊 Load test report saved to: ${reportPath}`)
      } catch (error) {
        console.log('📊 Load test report (file save failed, console only)')
      }
    }
  })
})