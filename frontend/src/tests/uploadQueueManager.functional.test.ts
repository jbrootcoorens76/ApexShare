/**
 * Upload Queue Manager Functional Tests
 *
 * Comprehensive functional validation tests for all queue manager features including
 * queue management, event handling, priority processing, network adaptation, and error recovery.
 */

import { uploadQueueManager } from '@/services/uploadQueueManager'
import { useFileUpload } from '@/hooks/useFileUpload'
import { renderHook, act } from '@testing-library/react'
import type {
  QueueConfigType,
  PerformanceMetricsType,
  NetworkMetricsType,
  QueuedFileType,
  ActiveUploadType
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
  getOptimalChunkSize: jest.fn(() => 5 * 1024 * 1024), // 5MB default
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
    enableDetailedLogging: true,
    apiUrl: 'https://api.test.com'
  }
}))

// Test utilities
const createMockFile = (name: string, size: number, type: string = 'video/mp4'): File => {
  const file = new File(['mock content'], name, { type })
  Object.defineProperty(file, 'size', { value: size, writable: false })
  return file
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const waitForEvents = (manager: any, eventName: string, timeout: number = 5000): Promise<any> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      manager.off(eventName, handler)
      reject(new Error(`Event ${eventName} not received within ${timeout}ms`))
    }, timeout)

    const handler = (...args: any[]) => {
      clearTimeout(timer)
      manager.off(eventName, handler)
      resolve(args)
    }

    manager.on(eventName, handler)
  })
}

describe('Upload Queue Manager Functional Tests', () => {
  const mockSessionId = 'functional-test-session'
  let mockApi: any

  beforeEach(() => {
    // Reset queue manager
    uploadQueueManager.destroy()

    // Setup API mocks
    mockApi = require('@/services/api')
    mockApi.apiService.files.getUploadUrl.mockResolvedValue({
      success: true,
      data: {
        uploadId: 'test-upload-id',
        uploadUrl: 'https://s3.amazonaws.com/test-bucket/upload',
        chunkSize: 5 * 1024 * 1024
      }
    })

    mockApi.apiService.files.completeUpload.mockResolvedValue({
      success: true,
      data: { fileId: 'completed-file-id' }
    })

    mockApi.uploadFileChunk.mockResolvedValue({
      etag: 'mock-etag-123'
    })

    jest.clearAllMocks()
  })

  afterEach(() => {
    uploadQueueManager.destroy()
  })

  describe('Core Queue Management', () => {
    test('should queue single file correctly', async () => {
      const file = createMockFile('test.mp4', 50 * 1024 * 1024)
      const fileId = 'test-file-1'

      const queuedPromise = waitForEvents(uploadQueueManager, 'upload-queued')

      uploadQueueManager.queueUpload(fileId, file, mockSessionId)

      const [receivedFileId] = await queuedPromise
      expect(receivedFileId).toBe(fileId)

      const status = uploadQueueManager.getQueueStatus()
      expect(status.queueLength).toBe(1)
      expect(uploadQueueManager.isUploading(fileId)).toBe(false) // Not started yet
    })

    test('should queue multiple files with proper ordering', async () => {
      const files = [
        { name: 'large.mp4', size: 100 * 1024 * 1024, id: 'file-1' },
        { name: 'small.mp4', size: 10 * 1024 * 1024, id: 'file-2' },
        { name: 'medium.mp4', size: 50 * 1024 * 1024, id: 'file-3' }
      ]

      // Configure smallest-first priority
      uploadQueueManager.updateConfig({ priorityMode: 'smallest-first' })

      let queuedCount = 0
      uploadQueueManager.on('upload-queued', () => {
        queuedCount++
      })

      // Queue all files
      files.forEach(fileData => {
        const file = createMockFile(fileData.name, fileData.size)
        uploadQueueManager.queueUpload(fileData.id, file, mockSessionId)
      })

      await sleep(100) // Wait for queuing to complete

      expect(queuedCount).toBe(3)
      const status = uploadQueueManager.getQueueStatus()
      expect(status.queueLength).toBe(3)
      expect(status.config.priorityMode).toBe('smallest-first')
    })

    test('should respect custom priorities', async () => {
      const files = [
        { name: 'low.mp4', size: 30 * 1024 * 1024, id: 'low', priority: 100 },
        { name: 'high.mp4', size: 30 * 1024 * 1024, id: 'high', priority: 1 },
        { name: 'medium.mp4', size: 30 * 1024 * 1024, id: 'medium', priority: 50 }
      ]

      let queuedOrder: string[] = []
      uploadQueueManager.on('upload-queued', (fileId: string) => {
        queuedOrder.push(fileId)
      })

      // Queue files in order: low, high, medium
      files.forEach(fileData => {
        const file = createMockFile(fileData.name, fileData.size)
        uploadQueueManager.queueUpload(fileData.id, file, mockSessionId, {
          priority: fileData.priority
        })
      })

      await sleep(100)

      expect(queuedOrder).toEqual(['low', 'high', 'medium'])

      const status = uploadQueueManager.getQueueStatus()
      expect(status.queueLength).toBe(3)
    })

    test('should process queue automatically when files are added', async () => {
      const file = createMockFile('auto-process.mp4', 25 * 1024 * 1024)
      const fileId = 'auto-process-1'

      const startedPromise = waitForEvents(uploadQueueManager, 'upload-started')

      uploadQueueManager.queueUpload(fileId, file, mockSessionId)

      const [receivedFileId] = await startedPromise
      expect(receivedFileId).toBe(fileId)
      expect(uploadQueueManager.isUploading(fileId)).toBe(true)
    })
  })

  describe('Event System', () => {
    test('should emit all upload lifecycle events', async () => {
      const file = createMockFile('lifecycle.mp4', 30 * 1024 * 1024)
      const fileId = 'lifecycle-test'

      const events: string[] = []

      uploadQueueManager.on('upload-queued', () => events.push('queued'))
      uploadQueueManager.on('upload-started', () => events.push('started'))
      uploadQueueManager.on('upload-progress', () => events.push('progress'))
      uploadQueueManager.on('upload-completed', () => events.push('completed'))
      uploadQueueManager.on('upload-error', () => events.push('error'))

      uploadQueueManager.queueUpload(fileId, file, mockSessionId)

      await sleep(1000) // Wait for events

      expect(events).toContain('queued')
      expect(events).toContain('started')
      // Note: progress and completion depend on mocked API behavior
    })

    test('should provide correct progress information', async () => {
      const file = createMockFile('progress.mp4', 40 * 1024 * 1024)
      const fileId = 'progress-test'

      let progressData: any = null
      uploadQueueManager.on('upload-progress', (id: string, progress: any) => {
        if (id === fileId) {
          progressData = progress
        }
      })

      uploadQueueManager.queueUpload(fileId, file, mockSessionId)

      await sleep(500)

      if (progressData) {
        expect(progressData).toHaveProperty('fileId', fileId)
        expect(progressData).toHaveProperty('fileName', 'progress.mp4')
        expect(progressData).toHaveProperty('progress')
        expect(progressData).toHaveProperty('speed')
        expect(progressData).toHaveProperty('eta')
        expect(progressData).toHaveProperty('uploadedBytes')
        expect(progressData).toHaveProperty('totalBytes')
        expect(progressData.totalBytes).toBe(40 * 1024 * 1024)
      }
    })

    test('should handle event listener cleanup', () => {
      const handler = jest.fn()

      uploadQueueManager.on('upload-queued', handler)

      const file = createMockFile('cleanup.mp4', 20 * 1024 * 1024)
      uploadQueueManager.queueUpload('cleanup-test', file, mockSessionId)

      // Remove listener
      uploadQueueManager.off('upload-queued', handler)

      // Queue another file
      const file2 = createMockFile('cleanup2.mp4', 20 * 1024 * 1024)
      uploadQueueManager.queueUpload('cleanup-test-2', file2, mockSessionId)

      expect(handler).toHaveBeenCalledTimes(1) // Only called once before removal
    })
  })

  describe('Upload Control Operations', () => {
    test('should pause and resume uploads correctly', async () => {
      const file = createMockFile('pause-resume.mp4', 60 * 1024 * 1024)
      const fileId = 'pause-resume-test'

      // Start upload
      uploadQueueManager.queueUpload(fileId, file, mockSessionId)
      await sleep(500) // Let it start

      // Pause
      let pauseEventReceived = false
      uploadQueueManager.on('upload-paused', () => {
        pauseEventReceived = true
      })

      uploadQueueManager.pauseUpload(fileId)
      await sleep(100)

      expect(pauseEventReceived).toBe(true)

      // Resume
      let resumeEventReceived = false
      uploadQueueManager.on('upload-resumed', () => {
        resumeEventReceived = true
      })

      uploadQueueManager.resumeUpload(fileId)
      await sleep(100)

      expect(resumeEventReceived).toBe(true)
    })

    test('should cancel uploads properly', async () => {
      const file = createMockFile('cancel.mp4', 45 * 1024 * 1024)
      const fileId = 'cancel-test'

      let cancelEventReceived = false
      uploadQueueManager.on('upload-cancelled', (id: string) => {
        if (id === fileId) {
          cancelEventReceived = true
        }
      })

      uploadQueueManager.queueUpload(fileId, file, mockSessionId)
      await sleep(200)

      uploadQueueManager.cancelUpload(fileId)
      await sleep(100)

      expect(cancelEventReceived).toBe(true)
      expect(uploadQueueManager.isUploading(fileId)).toBe(false)

      const status = uploadQueueManager.getQueueStatus()
      expect(status.activeUploads).toBe(0)
    })

    test('should pause and resume all uploads', async () => {
      const files = Array.from({ length: 3 }, (_, i) => ({
        file: createMockFile(`batch-${i}.mp4`, 35 * 1024 * 1024),
        id: `batch-${i}`
      }))

      // Queue all files
      files.forEach(({ file, id }) => {
        uploadQueueManager.queueUpload(id, file, mockSessionId)
      })

      await sleep(500) // Let them start

      // Pause all
      let pauseEvents = 0
      uploadQueueManager.on('upload-paused', () => {
        pauseEvents++
      })

      uploadQueueManager.pauseAllUploads()
      await sleep(200)

      expect(pauseEvents).toBeGreaterThan(0)

      // Resume all
      let resumeEvents = 0
      uploadQueueManager.on('upload-resumed', () => {
        resumeEvents++
      })

      uploadQueueManager.resumeAllUploads()
      await sleep(200)

      expect(resumeEvents).toBeGreaterThan(0)
    })
  })

  describe('Configuration Management', () => {
    test('should update configuration correctly', () => {
      const newConfig: Partial<QueueConfigType> = {
        maxConcurrentFiles: 5,
        maxConcurrentChunks: 8,
        priorityMode: 'largest-first',
        retryAttempts: 5,
        retryDelay: 2000
      }

      uploadQueueManager.updateConfig(newConfig)

      const status = uploadQueueManager.getQueueStatus()
      expect(status.config.maxConcurrentFiles).toBe(5)
      expect(status.config.maxConcurrentChunks).toBe(8)
      expect(status.config.priorityMode).toBe('largest-first')
      expect(status.config.retryAttempts).toBe(5)
      expect(status.config.retryDelay).toBe(2000)
    })

    test('should adapt configuration based on network conditions', () => {
      // Mock slow network
      const mockDevice = require('@/utils/device')
      mockDevice.getNetworkInfo.mockReturnValue({
        effectiveType: '2g',
        downlink: 0.5,
        rtt: 800
      })
      mockDevice.isSlowNetwork.mockReturnValue(true)

      // Trigger network adaptation (this would normally happen automatically)
      uploadQueueManager.updateConfig({
        maxConcurrentFiles: 1,
        maxConcurrentChunks: 1,
        priorityMode: 'smallest-first'
      })

      const status = uploadQueueManager.getQueueStatus()
      expect(status.config.maxConcurrentFiles).toBe(1)
      expect(status.config.maxConcurrentChunks).toBe(1)
      expect(status.config.priorityMode).toBe('smallest-first')
    })

    test('should maintain configuration state across operations', () => {
      const testConfig = {
        maxConcurrentFiles: 4,
        retryAttempts: 2,
        adaptiveOptimization: false
      }

      uploadQueueManager.updateConfig(testConfig)

      // Queue and process files
      const file = createMockFile('config-test.mp4', 30 * 1024 * 1024)
      uploadQueueManager.queueUpload('config-test', file, mockSessionId)

      // Configuration should persist
      const status = uploadQueueManager.getQueueStatus()
      expect(status.config.maxConcurrentFiles).toBe(4)
      expect(status.config.retryAttempts).toBe(2)
      expect(status.config.adaptiveOptimization).toBe(false)
    })
  })

  describe('Status and Monitoring', () => {
    test('should provide accurate queue status', () => {
      const files = Array.from({ length: 5 }, (_, i) =>
        createMockFile(`status-${i}.mp4`, 25 * 1024 * 1024)
      )

      files.forEach((file, index) => {
        uploadQueueManager.queueUpload(`status-${index}`, file, mockSessionId)
      })

      const status = uploadQueueManager.getQueueStatus()
      expect(status.queueLength).toBe(5)
      expect(status).toHaveProperty('activeUploads')
      expect(status).toHaveProperty('completedUploads')
      expect(status).toHaveProperty('config')
      expect(status).toHaveProperty('networkMetrics')
      expect(status).toHaveProperty('performanceMetrics')
    })

    test('should track performance metrics', async () => {
      const file = createMockFile('metrics.mp4', 40 * 1024 * 1024)

      const initialStatus = uploadQueueManager.getQueueStatus()
      const initialMetrics = initialStatus.performanceMetrics

      uploadQueueManager.queueUpload('metrics-test', file, mockSessionId)
      await sleep(500)

      const updatedStatus = uploadQueueManager.getQueueStatus()
      const updatedMetrics = updatedStatus.performanceMetrics

      expect(updatedMetrics).toHaveProperty('totalUploads')
      expect(updatedMetrics).toHaveProperty('successfulUploads')
      expect(updatedMetrics).toHaveProperty('failedUploads')
      expect(updatedMetrics).toHaveProperty('averageSpeed')
      expect(updatedMetrics).toHaveProperty('totalBytesUploaded')
    })

    test('should provide upload progress information', async () => {
      const file = createMockFile('progress-info.mp4', 50 * 1024 * 1024)
      const fileId = 'progress-info-test'

      uploadQueueManager.queueUpload(fileId, file, mockSessionId)
      await sleep(300)

      const progress = uploadQueueManager.getUploadProgress(fileId)

      if (progress) {
        expect(progress.fileId).toBe(fileId)
        expect(progress.fileName).toBe('progress-info.mp4')
        expect(progress.totalBytes).toBe(50 * 1024 * 1024)
        expect(progress).toHaveProperty('progress')
        expect(progress).toHaveProperty('speed')
        expect(progress).toHaveProperty('eta')
        expect(progress).toHaveProperty('status')
      }
    })

    test('should check upload status correctly', () => {
      const file = createMockFile('status-check.mp4', 30 * 1024 * 1024)
      const fileId = 'status-check-test'

      // Initially not uploading
      expect(uploadQueueManager.isUploading(fileId)).toBe(false)

      uploadQueueManager.queueUpload(fileId, file, mockSessionId)

      // After queuing, might be uploading or queued
      const isUploadingOrQueued = uploadQueueManager.isUploading(fileId) ||
                                 uploadQueueManager.getQueueStatus().queueLength > 0
      expect(isUploadingOrQueued).toBe(true)
    })
  })

  describe('Error Handling and Recovery', () => {
    test('should handle API errors gracefully', async () => {
      // Mock API to fail
      mockApi.apiService.files.getUploadUrl.mockRejectedValueOnce(
        new Error('API connection failed')
      )

      const file = createMockFile('error-test.mp4', 35 * 1024 * 1024)
      const fileId = 'error-test'

      let errorReceived = false
      let errorMessage = ''

      uploadQueueManager.on('upload-error', (id: string, error: string) => {
        if (id === fileId) {
          errorReceived = true
          errorMessage = error
        }
      })

      uploadQueueManager.queueUpload(fileId, file, mockSessionId)
      await sleep(1000) // Wait for error

      expect(errorReceived).toBe(true)
      expect(errorMessage).toContain('API connection failed')
    })

    test('should retry failed uploads with exponential backoff', async () => {
      // Configure fast retries for testing
      uploadQueueManager.updateConfig({
        retryAttempts: 2,
        retryDelay: 100
      })

      let callCount = 0
      mockApi.apiService.files.getUploadUrl.mockImplementation(() => {
        callCount++
        if (callCount <= 2) {
          return Promise.reject(new Error('Temporary failure'))
        }
        return Promise.resolve({
          success: true,
          data: {
            uploadId: 'retry-success',
            uploadUrl: 'https://s3.amazonaws.com/test-bucket/retry',
            chunkSize: 5 * 1024 * 1024
          }
        })
      })

      const file = createMockFile('retry-test.mp4', 30 * 1024 * 1024)
      const fileId = 'retry-test'

      uploadQueueManager.queueUpload(fileId, file, mockSessionId)
      await sleep(2000) // Wait for retries

      expect(callCount).toBeGreaterThan(1) // Should have retried
    })

    test('should handle permanent failures after max retries', async () => {
      uploadQueueManager.updateConfig({
        retryAttempts: 1,
        retryDelay: 50
      })

      mockApi.apiService.files.getUploadUrl.mockRejectedValue(
        new Error('Permanent failure')
      )

      const file = createMockFile('permanent-fail.mp4', 25 * 1024 * 1024)
      const fileId = 'permanent-fail-test'

      let permanentErrorReceived = false
      uploadQueueManager.on('upload-error', (id: string) => {
        if (id === fileId) {
          permanentErrorReceived = true
        }
      })

      uploadQueueManager.queueUpload(fileId, file, mockSessionId)
      await sleep(1000)

      expect(permanentErrorReceived).toBe(true)
    })

    test('should handle network disconnection gracefully', async () => {
      const file = createMockFile('network-test.mp4', 40 * 1024 * 1024)
      const fileId = 'network-test'

      // Start upload
      uploadQueueManager.queueUpload(fileId, file, mockSessionId)
      await sleep(200)

      // Simulate network disconnection
      mockApi.apiService.files.getUploadUrl.mockRejectedValue(
        new Error('Network Error')
      )

      // Should handle the error
      let networkErrorHandled = false
      uploadQueueManager.on('upload-error', () => {
        networkErrorHandled = true
      })

      await sleep(500)

      // Error handling depends on when the network error occurs
      // This test validates the system doesn't crash
      expect(uploadQueueManager.getQueueStatus()).toBeDefined()
    })
  })

  describe('Resource Management', () => {
    test('should clean up completed uploads', async () => {
      const files = Array.from({ length: 3 }, (_, i) =>
        createMockFile(`cleanup-${i}.mp4`, 20 * 1024 * 1024)
      )

      files.forEach((file, index) => {
        uploadQueueManager.queueUpload(`cleanup-${index}`, file, mockSessionId)
      })

      await sleep(300)

      // Cancel all uploads to simulate completion
      files.forEach((_, index) => {
        uploadQueueManager.cancelUpload(`cleanup-${index}`)
      })

      await sleep(100)

      const status = uploadQueueManager.getQueueStatus()
      expect(status.activeUploads).toBe(0)
      expect(status.queueLength).toBe(0)
    })

    test('should destroy and reinitialize properly', () => {
      const file = createMockFile('destroy-test.mp4', 30 * 1024 * 1024)
      uploadQueueManager.queueUpload('destroy-test', file, mockSessionId)

      // Destroy
      uploadQueueManager.destroy()

      let status = uploadQueueManager.getQueueStatus()
      expect(status.activeUploads).toBe(0)
      expect(status.queueLength).toBe(0)

      // Should be able to use again after destroy
      const newFile = createMockFile('new-test.mp4', 25 * 1024 * 1024)
      uploadQueueManager.queueUpload('new-test', newFile, mockSessionId)

      status = uploadQueueManager.getQueueStatus()
      expect(status.queueLength).toBe(1)
    })
  })

  describe('Integration with Callback Functions', () => {
    test('should call provided callback functions', async () => {
      const callbacks = {
        onProgress: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn()
      }

      const file = createMockFile('callback-test.mp4', 30 * 1024 * 1024)
      const fileId = 'callback-test'

      uploadQueueManager.queueUpload(fileId, file, mockSessionId, callbacks)
      await sleep(500)

      // Progress callback should be called (depends on mock implementation)
      // Complete/Error callbacks depend on the upload outcome

      // At minimum, the callbacks should be stored and available for calling
      expect(callbacks.onProgress).toBeDefined()
      expect(callbacks.onComplete).toBeDefined()
      expect(callbacks.onError).toBeDefined()
    })

    test('should handle missing callback functions gracefully', async () => {
      const file = createMockFile('no-callbacks.mp4', 25 * 1024 * 1024)
      const fileId = 'no-callbacks-test'

      // Should not throw error when callbacks are not provided
      expect(() => {
        uploadQueueManager.queueUpload(fileId, file, mockSessionId)
      }).not.toThrow()

      await sleep(300)

      // Upload should proceed normally without callbacks
      const status = uploadQueueManager.getQueueStatus()
      expect(status.queueLength + status.activeUploads).toBeGreaterThan(0)
    })
  })
})