/**
 * Upload Queue Manager Comprehensive Benchmark Tests
 *
 * Advanced benchmarking suite that uses the benchmark runner to collect
 * detailed performance metrics and generate comprehensive reports.
 */

import { benchmarkRunner, BenchmarkUtils } from './benchmark-runner'
import { uploadQueueManager } from '@/services/uploadQueueManager'

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
    enableDetailedLogging: false,
    apiUrl: 'https://api.test.com'
  }
}))

describe('Upload Queue Manager Comprehensive Benchmarks', () => {
  const mockSessionId = 'benchmark-session'
  let mockApi: any

  beforeAll(() => {
    // Clear any existing benchmark data
    benchmarkRunner.clear()
  })

  beforeEach(() => {
    uploadQueueManager.destroy()

    // Setup API mocks with realistic timing
    mockApi = require('@/services/api')
    mockApi.apiService.files.getUploadUrl.mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            success: true,
            data: {
              uploadId: 'benchmark-upload-id',
              uploadUrl: 'https://s3.amazonaws.com/test-bucket/benchmark',
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
            data: { fileId: 'benchmark-completed' }
          })
        }, 30 + Math.random() * 70) // 30-100ms delay
      })
    })

    mockApi.uploadFileChunk.mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ etag: `benchmark-etag-${Math.random()}` })
        }, 200 + Math.random() * 300) // 200-500ms delay per chunk
      })
    })

    jest.clearAllMocks()
  })

  afterEach(() => {
    uploadQueueManager.destroy()
  })

  describe('Performance Baseline Benchmarks', () => {
    beforeAll(() => {
      benchmarkRunner.startSuite('Performance Baseline Tests')
    })

    afterAll(() => {
      benchmarkRunner.endSuite()
    })

    test('should benchmark single file upload performance', async () => {
      await benchmarkRunner.runBenchmark(
        'Single File Upload Baseline',
        async () => {
          const file = BenchmarkUtils.createMockFile('baseline.mp4', 25 * 1024 * 1024)
          const fileId = 'baseline-single'

          let completed = false
          let errors: any[] = []

          uploadQueueManager.on('upload-completed', () => { completed = true })
          uploadQueueManager.on('upload-error', (id, error) => {
            errors.push({ fileId: id, error, timestamp: Date.now() })
          })

          uploadQueueManager.queueUpload(fileId, file, mockSessionId)

          // Wait for completion or timeout
          const timeout = 10000
          const startTime = Date.now()
          while (!completed && !errors.length && (Date.now() - startTime) < timeout) {
            await BenchmarkUtils.sleep(100)
          }

          return {
            fileCount: 1,
            totalSize: 25 * 1024 * 1024,
            concurrency: 1,
            successRate: completed ? 1 : 0,
            errors
          }
        },
        '4g'
      )
    }, 15000)

    test('should benchmark concurrent file upload performance', async () => {
      await benchmarkRunner.runBenchmark(
        'Concurrent Files Baseline',
        async () => {
          const files = Array.from({ length: 3 }, (_, i) =>
            BenchmarkUtils.createMockFile(`concurrent-${i}.mp4`, 20 * 1024 * 1024)
          )

          let completedCount = 0
          let errors: any[] = []

          uploadQueueManager.on('upload-completed', () => { completedCount++ })
          uploadQueueManager.on('upload-error', (id, error) => {
            errors.push({ fileId: id, error, timestamp: Date.now() })
          })

          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`concurrent-${index}`, file, mockSessionId)
          })

          // Wait for completion or timeout
          const timeout = 15000
          const startTime = Date.now()
          while ((completedCount + errors.length) < files.length && (Date.now() - startTime) < timeout) {
            await BenchmarkUtils.sleep(100)
          }

          return {
            fileCount: files.length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            concurrency: 3,
            successRate: completedCount / files.length,
            errors
          }
        },
        '4g'
      )
    }, 20000)

    test('should benchmark queue management overhead', async () => {
      await benchmarkRunner.runBenchmark(
        'Queue Management Overhead',
        async () => {
          const fileCount = 20
          const files = Array.from({ length: fileCount }, (_, i) =>
            BenchmarkUtils.createMockFile(`queue-overhead-${i}.mp4`, 5 * 1024 * 1024)
          )

          const queueStartTime = Date.now()

          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`queue-overhead-${index}`, file, mockSessionId)
          })

          const queueEndTime = Date.now()
          console.log(`Queue overhead: ${queueEndTime - queueStartTime}ms for ${fileCount} files`)

          await BenchmarkUtils.sleep(500) // Let initial processing start

          // Cancel all to measure cleanup overhead
          const cleanupStartTime = Date.now()
          files.forEach((_, index) => {
            uploadQueueManager.cancelUpload(`queue-overhead-${index}`)
          })
          const cleanupEndTime = Date.now()
          console.log(`Cleanup overhead: ${cleanupEndTime - cleanupStartTime}ms`)

          return {
            fileCount,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            concurrency: 0, // Measuring queue overhead, not upload concurrency
            successRate: 1, // Success means no crashes during queue operations
            errors: []
          }
        },
        '4g'
      )
    }, 10000)
  })

  describe('Network Condition Benchmarks', () => {
    beforeAll(() => {
      benchmarkRunner.startSuite('Network Condition Performance Tests')
    })

    afterAll(() => {
      benchmarkRunner.endSuite()
    })

    test('should benchmark performance on slow 2G network', async () => {
      // Mock slow network
      const mockDevice = require('@/utils/device')
      mockDevice.getNetworkInfo.mockReturnValue({
        effectiveType: '2g',
        downlink: 0.25,
        rtt: 800
      })
      mockDevice.isSlowNetwork.mockReturnValue(true)

      uploadQueueManager.updateConfig({
        maxConcurrentFiles: 1,
        maxConcurrentChunks: 1,
        priorityMode: 'smallest-first'
      })

      await benchmarkRunner.runBenchmark(
        'Slow 2G Network Performance',
        async () => {
          const files = [
            BenchmarkUtils.createMockFile('2g-small.mp4', 5 * 1024 * 1024),
            BenchmarkUtils.createMockFile('2g-medium.mp4', 15 * 1024 * 1024)
          ]

          let completedCount = 0
          let errors: any[] = []

          uploadQueueManager.on('upload-completed', () => { completedCount++ })
          uploadQueueManager.on('upload-error', (id, error) => {
            errors.push({ fileId: id, error, timestamp: Date.now() })
          })

          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`2g-${index}`, file, mockSessionId)
          })

          // Longer timeout for slow network
          const timeout = 20000
          const startTime = Date.now()
          while ((completedCount + errors.length) < files.length && (Date.now() - startTime) < timeout) {
            await BenchmarkUtils.sleep(200)
          }

          return {
            fileCount: files.length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            concurrency: 1,
            successRate: completedCount / files.length,
            errors
          }
        },
        '2g'
      )
    }, 25000)

    test('should benchmark performance on fast 4G network', async () => {
      // Mock fast network
      const mockDevice = require('@/utils/device')
      mockDevice.getNetworkInfo.mockReturnValue({
        effectiveType: '4g',
        downlink: 25,
        rtt: 30
      })
      mockDevice.isSlowNetwork.mockReturnValue(false)

      uploadQueueManager.updateConfig({
        maxConcurrentFiles: 5,
        maxConcurrentChunks: 8,
        priorityMode: 'fifo'
      })

      await benchmarkRunner.runBenchmark(
        'Fast 4G Network Performance',
        async () => {
          const files = Array.from({ length: 5 }, (_, i) =>
            BenchmarkUtils.createMockFile(`4g-${i}.mp4`, 30 * 1024 * 1024)
          )

          let completedCount = 0
          let errors: any[] = []

          uploadQueueManager.on('upload-completed', () => { completedCount++ })
          uploadQueueManager.on('upload-error', (id, error) => {
            errors.push({ fileId: id, error, timestamp: Date.now() })
          })

          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`4g-${index}`, file, mockSessionId)
          })

          const timeout = 15000
          const startTime = Date.now()
          while ((completedCount + errors.length) < files.length && (Date.now() - startTime) < timeout) {
            await BenchmarkUtils.sleep(100)
          }

          return {
            fileCount: files.length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            concurrency: 5,
            successRate: completedCount / files.length,
            errors
          }
        },
        '4g'
      )
    }, 20000)
  })

  describe('File Size Benchmarks', () => {
    beforeAll(() => {
      benchmarkRunner.startSuite('File Size Performance Tests')
    })

    afterAll(() => {
      benchmarkRunner.endSuite()
    })

    test('should benchmark small files performance', async () => {
      await benchmarkRunner.runBenchmark(
        'Small Files Performance',
        async () => {
          const files = Array.from({ length: 10 }, (_, i) =>
            BenchmarkUtils.createMockFile(`small-${i}.mp4`, 2 * 1024 * 1024)
          )

          let completedCount = 0
          let errors: any[] = []

          uploadQueueManager.on('upload-completed', () => { completedCount++ })
          uploadQueueManager.on('upload-error', (id, error) => {
            errors.push({ fileId: id, error, timestamp: Date.now() })
          })

          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`small-${index}`, file, mockSessionId)
          })

          const timeout = 12000
          const startTime = Date.now()
          while ((completedCount + errors.length) < files.length && (Date.now() - startTime) < timeout) {
            await BenchmarkUtils.sleep(100)
          }

          return {
            fileCount: files.length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            concurrency: 3,
            successRate: completedCount / files.length,
            errors
          }
        },
        '4g'
      )
    }, 15000)

    test('should benchmark large files performance', async () => {
      await benchmarkRunner.runBenchmark(
        'Large Files Performance',
        async () => {
          const files = [
            BenchmarkUtils.createMockFile('large-1.mp4', 100 * 1024 * 1024),
            BenchmarkUtils.createMockFile('large-2.mp4', 150 * 1024 * 1024)
          ]

          let completedCount = 0
          let errors: any[] = []

          uploadQueueManager.on('upload-completed', () => { completedCount++ })
          uploadQueueManager.on('upload-error', (id, error) => {
            errors.push({ fileId: id, error, timestamp: Date.now() })
          })

          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`large-${index}`, file, mockSessionId)
          })

          const timeout = 25000
          const startTime = Date.now()
          while ((completedCount + errors.length) < files.length && (Date.now() - startTime) < timeout) {
            await BenchmarkUtils.sleep(200)
          }

          return {
            fileCount: files.length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            concurrency: 2,
            successRate: completedCount / files.length,
            errors
          }
        },
        '4g'
      )
    }, 30000)

    test('should benchmark mixed file sizes performance', async () => {
      await benchmarkRunner.runBenchmark(
        'Mixed File Sizes Performance',
        async () => {
          const fileSizes = [5, 25, 10, 75, 15, 50, 20].map(mb => mb * 1024 * 1024)
          const files = fileSizes.map((size, i) =>
            BenchmarkUtils.createMockFile(`mixed-${i}.mp4`, size)
          )

          let completedCount = 0
          let errors: any[] = []

          uploadQueueManager.on('upload-completed', () => { completedCount++ })
          uploadQueueManager.on('upload-error', (id, error) => {
            errors.push({ fileId: id, error, timestamp: Date.now() })
          })

          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`mixed-${index}`, file, mockSessionId)
          })

          const timeout = 20000
          const startTime = Date.now()
          while ((completedCount + errors.length) < files.length && (Date.now() - startTime) < timeout) {
            await BenchmarkUtils.sleep(150)
          }

          return {
            fileCount: files.length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            concurrency: 3,
            successRate: completedCount / files.length,
            errors
          }
        },
        '4g'
      )
    }, 25000)
  })

  describe('Priority Mode Benchmarks', () => {
    beforeAll(() => {
      benchmarkRunner.startSuite('Priority Mode Performance Tests')
    })

    afterAll(() => {
      benchmarkRunner.endSuite()
    })

    test('should benchmark smallest-first priority mode', async () => {
      uploadQueueManager.updateConfig({ priorityMode: 'smallest-first' })

      await benchmarkRunner.runBenchmark(
        'Smallest-First Priority Mode',
        async () => {
          const fileSizes = [50, 10, 30, 5, 80, 15].map(mb => mb * 1024 * 1024)
          const files = fileSizes.map((size, i) =>
            BenchmarkUtils.createMockFile(`priority-smallest-${i}.mp4`, size)
          )

          let completedCount = 0
          let completionOrder: string[] = []
          let errors: any[] = []

          uploadQueueManager.on('upload-completed', (fileId) => {
            completedCount++
            completionOrder.push(fileId)
          })
          uploadQueueManager.on('upload-error', (id, error) => {
            errors.push({ fileId: id, error, timestamp: Date.now() })
          })

          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`priority-smallest-${index}`, file, mockSessionId)
          })

          const timeout = 18000
          const startTime = Date.now()
          while ((completedCount + errors.length) < files.length && (Date.now() - startTime) < timeout) {
            await BenchmarkUtils.sleep(150)
          }

          console.log('Completion order:', completionOrder)

          return {
            fileCount: files.length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            concurrency: 3,
            successRate: completedCount / files.length,
            errors
          }
        },
        '4g'
      )
    }, 25000)

    test('should benchmark FIFO priority mode', async () => {
      uploadQueueManager.updateConfig({ priorityMode: 'fifo' })

      await benchmarkRunner.runBenchmark(
        'FIFO Priority Mode',
        async () => {
          const files = Array.from({ length: 6 }, (_, i) =>
            BenchmarkUtils.createMockFile(`priority-fifo-${i}.mp4`, 25 * 1024 * 1024)
          )

          let completedCount = 0
          let completionOrder: string[] = []
          let errors: any[] = []

          uploadQueueManager.on('upload-completed', (fileId) => {
            completedCount++
            completionOrder.push(fileId)
          })
          uploadQueueManager.on('upload-error', (id, error) => {
            errors.push({ fileId: id, error, timestamp: Date.now() })
          })

          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`priority-fifo-${index}`, file, mockSessionId)
          })

          const timeout = 18000
          const startTime = Date.now()
          while ((completedCount + errors.length) < files.length && (Date.now() - startTime) < timeout) {
            await BenchmarkUtils.sleep(150)
          }

          console.log('FIFO completion order:', completionOrder)

          return {
            fileCount: files.length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            concurrency: 3,
            successRate: completedCount / files.length,
            errors
          }
        },
        '4g'
      )
    }, 25000)
  })

  describe('Error Recovery Benchmarks', () => {
    beforeAll(() => {
      benchmarkRunner.startSuite('Error Recovery Performance Tests')
    })

    afterAll(() => {
      benchmarkRunner.endSuite()
    })

    test('should benchmark retry mechanism performance', async () => {
      // Configure fast retries for testing
      uploadQueueManager.updateConfig({
        retryAttempts: 2,
        retryDelay: 200
      })

      // Mock intermittent failures
      let callCount = 0
      mockApi.apiService.files.getUploadUrl.mockImplementation(() => {
        callCount++
        if (callCount % 3 === 0) {
          return Promise.reject(new Error('Simulated failure'))
        }
        return Promise.resolve({
          success: true,
          data: {
            uploadId: 'retry-upload-id',
            uploadUrl: 'https://s3.amazonaws.com/test-bucket/retry',
            chunkSize: 5 * 1024 * 1024
          }
        })
      })

      await benchmarkRunner.runBenchmark(
        'Retry Mechanism Performance',
        async () => {
          const files = Array.from({ length: 6 }, (_, i) =>
            BenchmarkUtils.createMockFile(`retry-${i}.mp4`, 20 * 1024 * 1024)
          )

          let completedCount = 0
          let errors: any[] = []

          uploadQueueManager.on('upload-completed', () => { completedCount++ })
          uploadQueueManager.on('upload-error', (id, error) => {
            errors.push({ fileId: id, error, timestamp: Date.now() })
          })

          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`retry-${index}`, file, mockSessionId)
          })

          const timeout = 20000
          const startTime = Date.now()
          while ((completedCount + errors.length) < files.length && (Date.now() - startTime) < timeout) {
            await BenchmarkUtils.sleep(200)
          }

          return {
            fileCount: files.length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            concurrency: 3,
            successRate: completedCount / files.length,
            errors
          }
        },
        '4g'
      )
    }, 25000)
  })

  afterAll(() => {
    // Generate comprehensive benchmark report
    const report = benchmarkRunner.generateReport()
    console.log('\n' + '='.repeat(100))
    console.log('COMPREHENSIVE UPLOAD QUEUE MANAGER BENCHMARK REPORT')
    console.log('='.repeat(100))
    console.log(report)
    console.log('='.repeat(100))

    // Export benchmark data
    const data = benchmarkRunner.exportData()

    // Save report and data to files
    if (typeof require !== 'undefined') {
      try {
        const fs = require('fs')
        const path = require('path')

        const reportPath = path.join(__dirname, 'upload-queue-benchmark-report.md')
        const dataPath = path.join(__dirname, 'upload-queue-benchmark-data.json')

        fs.writeFileSync(reportPath, report)
        fs.writeFileSync(dataPath, data)

        console.log(`📊 Benchmark report saved to: ${reportPath}`)
        console.log(`📊 Benchmark data saved to: ${dataPath}`)
      } catch (error) {
        console.log('📊 Benchmark report generated (file save failed, console only)')
      }
    }

    // Performance analysis summary
    const suites = benchmarkRunner.getSuites()
    if (suites.length > 0) {
      const overallMetrics = suites.flatMap(s => s.metrics)
      const avgThroughput = overallMetrics.reduce((sum, m) => sum + m.throughput, 0) / overallMetrics.length
      const avgSuccessRate = overallMetrics.reduce((sum, m) => sum + m.successRate, 0) / overallMetrics.length

      console.log('\n🎯 PERFORMANCE SUMMARY:')
      console.log(`   Average Throughput: ${(avgThroughput / 1024 / 1024).toFixed(2)} MB/s`)
      console.log(`   Average Success Rate: ${(avgSuccessRate * 100).toFixed(1)}%`)
      console.log(`   Total Test Suites: ${suites.length}`)
      console.log(`   Total Benchmarks: ${overallMetrics.length}`)

      // Production readiness assessment
      const productionReady = avgThroughput > 5 * 1024 * 1024 && avgSuccessRate > 0.8
      console.log(`\n🚀 PRODUCTION READINESS: ${productionReady ? 'READY ✅' : 'NEEDS OPTIMIZATION ⚠️'}`)

      if (!productionReady) {
        console.log('   Recommendations:')
        if (avgThroughput <= 5 * 1024 * 1024) {
          console.log('   - Optimize throughput (target: >5 MB/s)')
        }
        if (avgSuccessRate <= 0.8) {
          console.log('   - Improve reliability (target: >80% success rate)')
        }
      }
    }
  })
})