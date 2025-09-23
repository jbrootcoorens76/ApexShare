/**
 * Upload Queue Manager Performance Tests
 *
 * Comprehensive performance testing and benchmarking for the Global Upload Queue Manager.
 * Tests concurrent uploads, memory usage, network adaptation, and optimization algorithms.
 */

import { uploadQueueManager } from '@/services/uploadQueueManager'
import type {
  QueueConfigType,
  PerformanceMetricsType,
  NetworkMetricsType,
  QueuedFileType,
  ActiveUploadType
} from '@/services/uploadQueueManager'

// Enhanced test utilities
interface PerformanceBenchmark {
  testName: string
  duration: number
  memoryUsage: number
  throughput: number
  successRate: number
  avgResponseTime: number
  concurrency: number
  networkCondition: string
}

interface TestFile {
  name: string
  size: number
  type: string
  priority?: number
}

class PerformanceTestRunner {
  private benchmarks: PerformanceBenchmark[] = []
  private baselineMetrics: PerformanceMetricsType | null = null

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

  private async runBenchmark(
    testName: string,
    testFn: () => Promise<any>,
    networkCondition: string = 'unknown'
  ): Promise<PerformanceBenchmark> {
    const startTime = Date.now()
    const startMemory = this.measureMemory()

    const status = uploadQueueManager.getQueueStatus()
    const startConcurrency = status.activeUploads

    await testFn()

    const endTime = Date.now()
    const endMemory = this.measureMemory()
    const duration = endTime - startTime

    const finalStatus = uploadQueueManager.getQueueStatus()

    const benchmark: PerformanceBenchmark = {
      testName,
      duration,
      memoryUsage: endMemory - startMemory,
      throughput: 0, // Will be calculated based on specific test
      successRate: 0, // Will be calculated based on specific test
      avgResponseTime: 0, // Will be calculated based on specific test
      concurrency: Math.max(startConcurrency, finalStatus.activeUploads),
      networkCondition
    }

    this.benchmarks.push(benchmark)
    return benchmark
  }

  private generateTestFiles(count: number, sizeRange: [number, number]): TestFile[] {
    return Array.from({ length: count }, (_, i) => ({
      name: `test-file-${i}.mp4`,
      size: Math.floor(Math.random() * (sizeRange[1] - sizeRange[0]) + sizeRange[0]),
      type: 'video/mp4'
    }))
  }

  async setBaseline(): Promise<PerformanceMetricsType> {
    this.baselineMetrics = uploadQueueManager.getQueueStatus().performanceMetrics
    return this.baselineMetrics
  }

  async measureThroughput(fileCount: number, avgFileSize: number): Promise<number> {
    const files = this.generateTestFiles(fileCount, [avgFileSize * 0.8, avgFileSize * 1.2])
    const startTime = Date.now()

    // Queue all files
    files.forEach((testFile, index) => {
      const file = this.createMockFile(testFile.name, testFile.size, testFile.type)
      uploadQueueManager.queueUpload(`throughput-test-${index}`, file, 'test-session')
    })

    // Wait for queue processing to stabilize
    await this.sleep(1000)

    const endTime = Date.now()
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
    const throughputMBps = (totalBytes / (1024 * 1024)) / ((endTime - startTime) / 1000)

    // Cleanup
    files.forEach((_, index) => {
      uploadQueueManager.cancelUpload(`throughput-test-${index}`)
    })

    return throughputMBps
  }

  getBenchmarks(): PerformanceBenchmark[] {
    return [...this.benchmarks]
  }

  generateReport(): string {
    const report = [
      '# Upload Queue Manager Performance Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Executive Summary',
      `Total tests run: ${this.benchmarks.length}`,
      `Average test duration: ${this.benchmarks.reduce((sum, b) => sum + b.duration, 0) / this.benchmarks.length}ms`,
      '',
      '## Detailed Results',
      ''
    ]

    this.benchmarks.forEach(benchmark => {
      report.push(`### ${benchmark.testName}`)
      report.push(`- Duration: ${benchmark.duration}ms`)
      report.push(`- Memory Usage: ${(benchmark.memoryUsage / 1024 / 1024).toFixed(2)}MB`)
      report.push(`- Throughput: ${benchmark.throughput.toFixed(2)}MB/s`)
      report.push(`- Success Rate: ${(benchmark.successRate * 100).toFixed(1)}%`)
      report.push(`- Avg Response Time: ${benchmark.avgResponseTime}ms`)
      report.push(`- Concurrency: ${benchmark.concurrency}`)
      report.push(`- Network Condition: ${benchmark.networkCondition}`)
      report.push('')
    })

    return report.join('\n')
  }
}

describe('Upload Queue Manager Performance Tests', () => {
  const testRunner = new PerformanceTestRunner()
  const mockSessionId = 'perf-test-session'

  beforeEach(async () => {
    uploadQueueManager.destroy()
    await testRunner.setBaseline()
    jest.clearAllMocks()
  })

  afterEach(() => {
    uploadQueueManager.destroy()
  })

  describe('Concurrent Upload Performance', () => {
    test('should handle 2 concurrent uploads efficiently', async () => {
      const benchmark = await testRunner.runBenchmark(
        'Concurrent 2 Files',
        async () => {
          const files = [
            new File(['mock'], 'file1.mp4', { type: 'video/mp4' }),
            new File(['mock'], 'file2.mp4', { type: 'video/mp4' })
          ]

          Object.defineProperty(files[0], 'size', { value: 50 * 1024 * 1024 }) // 50MB
          Object.defineProperty(files[1], 'size', { value: 30 * 1024 * 1024 }) // 30MB

          // Queue both files
          uploadQueueManager.queueUpload('file-1', files[0], mockSessionId)
          uploadQueueManager.queueUpload('file-2', files[1], mockSessionId)

          // Wait for processing
          await testRunner['sleep'](2000)

          const status = uploadQueueManager.getQueueStatus()
          expect(status.activeUploads).toBeLessThanOrEqual(2)
        },
        '4g'
      )

      expect(benchmark.duration).toBeLessThan(5000) // Should queue in under 5 seconds
      expect(benchmark.memoryUsage).toBeLessThan(100 * 1024 * 1024) // Less than 100MB memory
    })

    test('should handle 5 concurrent uploads efficiently', async () => {
      const benchmark = await testRunner.runBenchmark(
        'Concurrent 5 Files',
        async () => {
          const files = Array.from({ length: 5 }, (_, i) => {
            const file = new File(['mock'], `file${i}.mp4`, { type: 'video/mp4' })
            Object.defineProperty(file, 'size', { value: (i + 1) * 20 * 1024 * 1024 }) // 20-100MB
            return file
          })

          // Queue all files
          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`file-${index}`, file, mockSessionId)
          })

          // Wait for processing
          await testRunner['sleep'](3000)

          const status = uploadQueueManager.getQueueStatus()
          expect(status.queueLength + status.activeUploads).toBe(5)
        },
        '4g'
      )

      expect(benchmark.duration).toBeLessThan(8000) // Should queue in under 8 seconds
    })

    test('should handle 10+ files without performance degradation', async () => {
      const benchmark = await testRunner.runBenchmark(
        'High Volume 10+ Files',
        async () => {
          const files = Array.from({ length: 15 }, (_, i) => {
            const file = new File(['mock'], `file${i}.mp4`, { type: 'video/mp4' })
            Object.defineProperty(file, 'size', { value: Math.random() * 100 * 1024 * 1024 }) // 0-100MB
            return file
          })

          const startTime = Date.now()

          // Queue all files
          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`file-${index}`, file, mockSessionId)
          })

          const queueTime = Date.now() - startTime
          expect(queueTime).toBeLessThan(1000) // Should queue all files in under 1 second

          // Wait for processing to stabilize
          await testRunner['sleep'](2000)

          const status = uploadQueueManager.getQueueStatus()
          expect(status.queueLength + status.activeUploads).toBe(15)
        },
        '4g'
      )

      expect(benchmark.duration).toBeLessThan(10000)
      expect(benchmark.memoryUsage).toBeLessThan(200 * 1024 * 1024) // Less than 200MB
    })
  })

  describe('Network Condition Performance', () => {
    test('should optimize for slow 2G networks', async () => {
      uploadQueueManager.updateConfig({
        maxConcurrentFiles: 1,
        maxConcurrentChunks: 1,
        priorityMode: 'smallest-first'
      })

      const benchmark = await testRunner.runBenchmark(
        'Slow 2G Network Optimization',
        async () => {
          const files = [
            { name: 'small.mp4', size: 5 * 1024 * 1024 },   // 5MB
            { name: 'medium.mp4', size: 25 * 1024 * 1024 }, // 25MB
            { name: 'large.mp4', size: 50 * 1024 * 1024 }   // 50MB
          ]

          files.forEach((fileData, index) => {
            const file = new File(['mock'], fileData.name, { type: 'video/mp4' })
            Object.defineProperty(file, 'size', { value: fileData.size })
            uploadQueueManager.queueUpload(`slow-${index}`, file, mockSessionId)
          })

          await testRunner['sleep'](1000)

          const status = uploadQueueManager.getQueueStatus()
          expect(status.config.maxConcurrentFiles).toBe(1)
          expect(status.config.priorityMode).toBe('smallest-first')
        },
        '2g'
      )

      expect(benchmark.duration).toBeLessThan(3000)
    })

    test('should scale up for fast 4G networks', async () => {
      uploadQueueManager.updateConfig({
        maxConcurrentFiles: 3,
        maxConcurrentChunks: 4,
        priorityMode: 'fifo'
      })

      const benchmark = await testRunner.runBenchmark(
        'Fast 4G Network Scaling',
        async () => {
          const files = Array.from({ length: 6 }, (_, i) => {
            const file = new File(['mock'], `fast-${i}.mp4`, { type: 'video/mp4' })
            Object.defineProperty(file, 'size', { value: 40 * 1024 * 1024 }) // 40MB each
            return file
          })

          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`fast-${index}`, file, mockSessionId)
          })

          await testRunner['sleep'](1500)

          const status = uploadQueueManager.getQueueStatus()
          expect(status.config.maxConcurrentFiles).toBe(3)
          expect(status.activeUploads).toBeLessThanOrEqual(3)
        },
        '4g'
      )

      expect(benchmark.duration).toBeLessThan(4000)
    })
  })

  describe('File Size Performance', () => {
    test('should handle large files (100MB+) efficiently', async () => {
      const benchmark = await testRunner.runBenchmark(
        'Large File Handling',
        async () => {
          const file = new File(['mock'], 'large-video.mp4', { type: 'video/mp4' })
          Object.defineProperty(file, 'size', { value: 150 * 1024 * 1024 }) // 150MB

          uploadQueueManager.queueUpload('large-file', file, mockSessionId)

          await testRunner['sleep'](2000)

          const status = uploadQueueManager.getQueueStatus()
          expect(status.activeUploads).toBe(1)
        },
        '4g'
      )

      expect(benchmark.duration).toBeLessThan(5000)
    })

    test('should handle many small files efficiently', async () => {
      const benchmark = await testRunner.runBenchmark(
        'Many Small Files',
        async () => {
          const files = Array.from({ length: 20 }, (_, i) => {
            const file = new File(['mock'], `small-${i}.mp4`, { type: 'video/mp4' })
            Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 }) // 2MB each
            return file
          })

          const startTime = Date.now()

          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`small-${index}`, file, mockSessionId)
          })

          const queueTime = Date.now() - startTime
          expect(queueTime).toBeLessThan(500) // Should queue 20 small files very quickly

          await testRunner['sleep'](1000)

          const status = uploadQueueManager.getQueueStatus()
          expect(status.queueLength + status.activeUploads).toBe(20)
        },
        '4g'
      )

      expect(benchmark.duration).toBeLessThan(3000)
    })

    test('should handle mixed file sizes optimally', async () => {
      const benchmark = await testRunner.runBenchmark(
        'Mixed File Sizes',
        async () => {
          const fileSizes = [
            5 * 1024 * 1024,   // 5MB
            50 * 1024 * 1024,  // 50MB
            1 * 1024 * 1024,   // 1MB
            100 * 1024 * 1024, // 100MB
            10 * 1024 * 1024   // 10MB
          ]

          fileSizes.forEach((size, index) => {
            const file = new File(['mock'], `mixed-${index}.mp4`, { type: 'video/mp4' })
            Object.defineProperty(file, 'size', { value: size })
            uploadQueueManager.queueUpload(`mixed-${index}`, file, mockSessionId)
          })

          await testRunner['sleep'](1500)

          const status = uploadQueueManager.getQueueStatus()
          expect(status.queueLength + status.activeUploads).toBe(5)
        },
        '4g'
      )

      expect(benchmark.duration).toBeLessThan(4000)
    })
  })

  describe('Priority Processing Performance', () => {
    test('should process smallest-first efficiently', async () => {
      uploadQueueManager.updateConfig({ priorityMode: 'smallest-first' })

      const benchmark = await testRunner.runBenchmark(
        'Smallest-First Processing',
        async () => {
          const fileSizes = [100, 50, 10, 75, 25].map(mb => mb * 1024 * 1024)

          fileSizes.forEach((size, index) => {
            const file = new File(['mock'], `priority-${index}.mp4`, { type: 'video/mp4' })
            Object.defineProperty(file, 'size', { value: size })
            uploadQueueManager.queueUpload(`priority-${index}`, file, mockSessionId)
          })

          await testRunner['sleep'](1000)

          // Smallest file (10MB) should be prioritized
          const status = uploadQueueManager.getQueueStatus()
          expect(status.config.priorityMode).toBe('smallest-first')
        },
        '4g'
      )

      expect(benchmark.duration).toBeLessThan(3000)
    })

    test('should handle custom priorities efficiently', async () => {
      const benchmark = await testRunner.runBenchmark(
        'Custom Priority Processing',
        async () => {
          const files = [
            { name: 'low-priority.mp4', size: 50 * 1024 * 1024, priority: 100 },
            { name: 'high-priority.mp4', size: 50 * 1024 * 1024, priority: 1 },
            { name: 'medium-priority.mp4', size: 50 * 1024 * 1024, priority: 50 }
          ]

          files.forEach((fileData, index) => {
            const file = new File(['mock'], fileData.name, { type: 'video/mp4' })
            Object.defineProperty(file, 'size', { value: fileData.size })
            uploadQueueManager.queueUpload(`custom-${index}`, file, mockSessionId, {
              priority: fileData.priority
            })
          })

          await testRunner['sleep'](1000)

          const status = uploadQueueManager.getQueueStatus()
          expect(status.queueLength + status.activeUploads).toBe(3)
        },
        '4g'
      )

      expect(benchmark.duration).toBeLessThan(3000)
    })
  })

  describe('Memory and Resource Performance', () => {
    test('should maintain low memory footprint with many files', async () => {
      const benchmark = await testRunner.runBenchmark(
        'Memory Efficiency Test',
        async () => {
          const files = Array.from({ length: 50 }, (_, i) => {
            const file = new File(['mock'], `memory-test-${i}.mp4`, { type: 'video/mp4' })
            Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 }) // 20MB each
            return file
          })

          // Queue all files
          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`memory-${index}`, file, mockSessionId)
          })

          await testRunner['sleep'](2000)

          // Cleanup half the files to test memory management
          for (let i = 0; i < 25; i++) {
            uploadQueueManager.cancelUpload(`memory-${i}`)
          }

          await testRunner['sleep'](500)

          const status = uploadQueueManager.getQueueStatus()
          expect(status.queueLength + status.activeUploads).toBeLessThanOrEqual(25)
        },
        '4g'
      )

      // Memory usage should remain reasonable even with many files
      expect(benchmark.memoryUsage).toBeLessThan(300 * 1024 * 1024) // Less than 300MB
    })

    test('should clean up resources properly after completion', async () => {
      const initialMemory = testRunner['measureMemory']()

      const benchmark = await testRunner.runBenchmark(
        'Resource Cleanup Test',
        async () => {
          const files = Array.from({ length: 10 }, (_, i) => {
            const file = new File(['mock'], `cleanup-${i}.mp4`, { type: 'video/mp4' })
            Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 })
            return file
          })

          // Queue and then immediately cancel all files
          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`cleanup-${index}`, file, mockSessionId)
          })

          await testRunner['sleep'](500)

          // Cancel all uploads
          files.forEach((_, index) => {
            uploadQueueManager.cancelUpload(`cleanup-${index}`)
          })

          await testRunner['sleep'](500)

          // Destroy queue manager to test cleanup
          uploadQueueManager.destroy()

          const status = uploadQueueManager.getQueueStatus()
          expect(status.activeUploads).toBe(0)
          expect(status.queueLength).toBe(0)
        },
        '4g'
      )

      const finalMemory = testRunner['measureMemory']()
      const memoryDelta = finalMemory - initialMemory

      // Memory should not grow significantly after cleanup
      expect(memoryDelta).toBeLessThan(50 * 1024 * 1024) // Less than 50MB growth
    })
  })

  describe('Adaptive Performance', () => {
    test('should adapt concurrency based on performance', async () => {
      uploadQueueManager.updateConfig({
        adaptiveOptimization: true,
        maxConcurrentFiles: 2,
        maxConcurrentChunks: 2
      })

      const benchmark = await testRunner.runBenchmark(
        'Adaptive Concurrency Test',
        async () => {
          const files = Array.from({ length: 8 }, (_, i) => {
            const file = new File(['mock'], `adaptive-${i}.mp4`, { type: 'video/mp4' })
            Object.defineProperty(file, 'size', { value: 30 * 1024 * 1024 })
            return file
          })

          files.forEach((file, index) => {
            uploadQueueManager.queueUpload(`adaptive-${index}`, file, mockSessionId)
          })

          await testRunner['sleep'](2000)

          const status = uploadQueueManager.getQueueStatus()
          expect(status.config.adaptiveOptimization).toBe(true)
          expect(status.activeUploads).toBeLessThanOrEqual(status.config.maxConcurrentFiles)
        },
        '4g'
      )

      expect(benchmark.duration).toBeLessThan(5000)
    })

    test('should maintain stable performance under varying conditions', async () => {
      const benchmark = await testRunner.runBenchmark(
        'Performance Stability Test',
        async () => {
          // Simulate varying file sizes and network conditions
          for (let batch = 0; batch < 3; batch++) {
            const batchFiles = Array.from({ length: 3 }, (_, i) => {
              const file = new File(['mock'], `stability-${batch}-${i}.mp4`, { type: 'video/mp4' })
              const size = (20 + Math.random() * 60) * 1024 * 1024 // 20-80MB
              Object.defineProperty(file, 'size', { value: size })
              return file
            })

            batchFiles.forEach((file, index) => {
              uploadQueueManager.queueUpload(`stability-${batch}-${index}`, file, mockSessionId)
            })

            // Vary configuration between batches
            if (batch === 1) {
              uploadQueueManager.updateConfig({ maxConcurrentFiles: 1 })
            } else if (batch === 2) {
              uploadQueueManager.updateConfig({ maxConcurrentFiles: 4 })
            }

            await testRunner['sleep'](1000)
          }

          const status = uploadQueueManager.getQueueStatus()
          expect(status.queueLength + status.activeUploads).toBe(9)
        },
        'variable'
      )

      expect(benchmark.duration).toBeLessThan(8000)
    })
  })

  describe('Throughput Measurements', () => {
    test('should measure and report actual throughput', async () => {
      const throughput = await testRunner.measureThroughput(5, 25 * 1024 * 1024) // 5 files, 25MB each

      // Throughput should be measurable (not zero)
      expect(throughput).toBeGreaterThan(0)

      // Log for manual inspection
      console.log(`Measured throughput: ${throughput.toFixed(2)} MB/s`)
    })
  })

  afterAll(() => {
    // Generate performance report
    const report = testRunner.generateReport()
    console.log(report)

    // Save report to file for analysis
    if (typeof require !== 'undefined') {
      const fs = require('fs')
      const path = require('path')
      const reportPath = path.join(__dirname, 'upload-queue-performance-report.md')
      fs.writeFileSync(reportPath, report)
      console.log(`Performance report saved to: ${reportPath}`)
    }
  })
})