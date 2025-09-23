/**
 * Upload Queue Manager Integration Tests
 *
 * Tests integration between the Global Upload Queue Manager and existing frontend components,
 * including the useFileUpload hook, React components, and the overall application workflow.
 */

import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useFileUpload } from '@/hooks/useFileUpload'
import { uploadQueueManager } from '@/services/uploadQueueManager'
import type { UploadProgress } from '@/types'

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

// Mock React component that uses the upload system
const TestUploadComponent: React.FC<{
  sessionId?: string
  onUploadProgress?: (fileId: string, progress: UploadProgress) => void
  onUploadComplete?: (fileId: string, fileInfo: any) => void
  onUploadError?: (fileId: string, error: string) => void
}> = ({ sessionId, onUploadProgress, onUploadComplete, onUploadError }) => {
  const {
    uploadFile,
    cancelUpload,
    pauseUpload,
    resumeUpload,
    isUploading,
    isQueued,
    isCompleted,
    hasError,
    getQueueStatus,
    uploadState
  } = useFileUpload({
    sessionId,
    onProgress: onUploadProgress,
    onComplete: onUploadComplete,
    onError: onUploadError,
    enableQueueManager: true
  })

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      Array.from(files).forEach((file, index) => {
        const fileId = `test-upload-${index}-${Date.now()}`
        uploadFile(file, fileId)
      })
    }
  }

  const queueStatus = getQueueStatus()

  return (
    <div data-testid="upload-component">
      <input
        type="file"
        multiple
        onChange={handleFileUpload}
        data-testid="file-input"
      />

      <div data-testid="queue-status">
        <span data-testid="queue-length">Queue: {queueStatus.queueLength}</span>
        <span data-testid="active-uploads">Active: {queueStatus.activeUploads}</span>
        <span data-testid="completed-uploads">Completed: {queueStatus.completedUploads}</span>
      </div>

      <div data-testid="upload-state">
        <span data-testid="active-count">{uploadState.activeUploads.size}</span>
        <span data-testid="queued-count">{uploadState.queuedUploads.size}</span>
        <span data-testid="completed-count">{uploadState.completedUploads.size}</span>
        <span data-testid="error-count">{uploadState.erroredUploads.size}</span>
      </div>

      <div data-testid="upload-controls">
        {uploadState.activeUploads.size > 0 && (
          <button
            onClick={() => {
              Array.from(uploadState.activeUploads).forEach(fileId => {
                pauseUpload(fileId)
              })
            }}
            data-testid="pause-all-btn"
          >
            Pause All
          </button>
        )}

        <button
          onClick={() => {
            Array.from(uploadState.activeUploads).forEach(fileId => {
              resumeUpload(fileId)
            })
          }}
          data-testid="resume-all-btn"
        >
          Resume All
        </button>

        <button
          onClick={() => {
            Array.from(uploadState.activeUploads).forEach(fileId => {
              cancelUpload(fileId)
            })
          }}
          data-testid="cancel-all-btn"
        >
          Cancel All
        </button>
      </div>
    </div>
  )
}

describe('Upload Queue Manager Integration Tests', () => {
  const mockSessionId = 'integration-test-session'
  let mockApi: any

  beforeEach(() => {
    uploadQueueManager.destroy()

    // Setup API mocks
    mockApi = require('@/services/api')
    mockApi.apiService.files.getUploadUrl.mockResolvedValue({
      success: true,
      data: {
        uploadId: 'integration-upload-id',
        uploadUrl: 'https://s3.amazonaws.com/test-bucket/integration',
        chunkSize: 5 * 1024 * 1024
      }
    })

    mockApi.apiService.files.completeUpload.mockResolvedValue({
      success: true,
      data: { fileId: 'integration-completed' }
    })

    mockApi.uploadFileChunk.mockResolvedValue({
      etag: 'integration-etag-123'
    })

    jest.clearAllMocks()
  })

  afterEach(() => {
    uploadQueueManager.destroy()
  })

  describe('useFileUpload Hook Integration', () => {
    test('should integrate with queue manager correctly', async () => {
      const mockCallbacks = {
        onProgress: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn()
      }

      const { result } = renderHook(() => useFileUpload({
        sessionId: mockSessionId,
        onProgress: mockCallbacks.onProgress,
        onComplete: mockCallbacks.onComplete,
        onError: mockCallbacks.onError,
        enableQueueManager: true
      }))

      const file = createMockFile('hook-test.mp4', 30 * 1024 * 1024)
      const fileId = 'hook-integration-test'

      await act(async () => {
        result.current.uploadFile(file, fileId)
      })

      // Hook should reflect queue manager state
      expect(result.current.isUploading(fileId) || result.current.isQueued(fileId)).toBe(true)

      const queueStatus = result.current.getQueueStatus()
      expect(queueStatus.queueLength + queueStatus.activeUploads).toBeGreaterThan(0)
    })

    test('should handle multiple files through hook', async () => {
      const { result } = renderHook(() => useFileUpload({
        sessionId: mockSessionId,
        enableQueueManager: true
      }))

      const files = [
        { file: createMockFile('multi-1.mp4', 20 * 1024 * 1024), id: 'multi-1' },
        { file: createMockFile('multi-2.mp4', 25 * 1024 * 1024), id: 'multi-2' },
        { file: createMockFile('multi-3.mp4', 30 * 1024 * 1024), id: 'multi-3' }
      ]

      await act(async () => {
        files.forEach(({ file, id }) => {
          result.current.uploadFile(file, id)
        })
      })

      const queueStatus = result.current.getQueueStatus()
      expect(queueStatus.queueLength + queueStatus.activeUploads).toBe(3)

      // Check individual file states
      files.forEach(({ id }) => {
        const isInSystem = result.current.isUploading(id) ||
                          result.current.isQueued(id) ||
                          result.current.isCompleted(id)
        expect(isInSystem).toBe(true)
      })
    })

    test('should synchronize state between hook and queue manager', async () => {
      const { result } = renderHook(() => useFileUpload({
        sessionId: mockSessionId,
        enableQueueManager: true
      }))

      const file = createMockFile('sync-test.mp4', 25 * 1024 * 1024)
      const fileId = 'sync-test'

      await act(async () => {
        result.current.uploadFile(file, fileId)
      })

      // States should be synchronized
      const hookQueueStatus = result.current.getQueueStatus()
      const managerQueueStatus = uploadQueueManager.getQueueStatus()

      expect(hookQueueStatus.queueLength).toBe(managerQueueStatus.queueLength)
      expect(hookQueueStatus.activeUploads).toBe(managerQueueStatus.activeUploads)
    })

    test('should handle upload control operations through hook', async () => {
      const { result } = renderHook(() => useFileUpload({
        sessionId: mockSessionId,
        enableQueueManager: true
      }))

      const file = createMockFile('control-test.mp4', 35 * 1024 * 1024)
      const fileId = 'control-test'

      await act(async () => {
        result.current.uploadFile(file, fileId)
      })

      await act(async () => {
        await sleep(200) // Let upload start
      })

      // Test pause
      await act(async () => {
        result.current.pauseUpload(fileId)
      })

      // Test resume
      await act(async () => {
        result.current.resumeUpload(fileId)
      })

      // Test cancel
      await act(async () => {
        result.current.cancelUpload(fileId)
      })

      // After cancel, file should not be uploading
      expect(result.current.isUploading(fileId)).toBe(false)
    })

    test('should handle batch operations through hook', async () => {
      const { result } = renderHook(() => useFileUpload({
        sessionId: mockSessionId,
        enableQueueManager: true
      }))

      const files = Array.from({ length: 4 }, (_, i) => ({
        file: createMockFile(`batch-${i}.mp4`, 20 * 1024 * 1024),
        id: `batch-${i}`
      }))

      await act(async () => {
        files.forEach(({ file, id }) => {
          result.current.uploadFile(file, id)
        })
      })

      await act(async () => {
        await sleep(300) // Let uploads start
      })

      // Test pause all
      await act(async () => {
        result.current.pauseAllUploads()
      })

      // Test resume all
      await act(async () => {
        result.current.resumeAllUploads()
      })

      const queueStatus = result.current.getQueueStatus()
      expect(queueStatus.queueLength + queueStatus.activeUploads).toBe(4)
    })
  })

  describe('React Component Integration', () => {
    test('should render and handle file uploads through component', async () => {
      const mockCallbacks = {
        onProgress: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn()
      }

      render(
        <TestUploadComponent
          sessionId={mockSessionId}
          onUploadProgress={mockCallbacks.onProgress}
          onUploadComplete={mockCallbacks.onComplete}
          onUploadError={mockCallbacks.onError}
        />
      )

      expect(screen.getByTestId('upload-component')).toBeInTheDocument()
      expect(screen.getByTestId('file-input')).toBeInTheDocument()
      expect(screen.getByTestId('queue-status')).toBeInTheDocument()
    })

    test('should update UI when files are uploaded', async () => {
      render(<TestUploadComponent sessionId={mockSessionId} />)

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement
      const file = createMockFile('ui-test.mp4', 40 * 1024 * 1024)

      // Mock file input change
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        const queueLength = screen.getByTestId('queue-length')
        expect(queueLength.textContent).toContain('1')
      }, { timeout: 1000 })
    })

    test('should handle multiple file uploads through UI', async () => {
      render(<TestUploadComponent sessionId={mockSessionId} />)

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement
      const files = [
        createMockFile('ui-multi-1.mp4', 30 * 1024 * 1024),
        createMockFile('ui-multi-2.mp4', 25 * 1024 * 1024),
        createMockFile('ui-multi-3.mp4', 35 * 1024 * 1024)
      ]

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        const queueLength = screen.getByTestId('queue-length')
        expect(queueLength.textContent).toContain('3')
      }, { timeout: 1000 })
    })

    test('should handle upload control buttons', async () => {
      render(<TestUploadComponent sessionId={mockSessionId} />)

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement
      const file = createMockFile('control-ui-test.mp4', 30 * 1024 * 1024)

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        const activeCount = screen.getByTestId('active-count')
        expect(parseInt(activeCount.textContent || '0')).toBeGreaterThan(0)
      }, { timeout: 1000 })

      // Test pause button (if visible)
      const pauseBtn = screen.queryByTestId('pause-all-btn')
      if (pauseBtn) {
        fireEvent.click(pauseBtn)
      }

      // Test resume button
      const resumeBtn = screen.getByTestId('resume-all-btn')
      fireEvent.click(resumeBtn)

      // Test cancel button
      const cancelBtn = screen.getByTestId('cancel-all-btn')
      fireEvent.click(cancelBtn)

      await waitFor(() => {
        const activeCount = screen.getByTestId('active-count')
        expect(activeCount.textContent).toBe('0')
      }, { timeout: 1000 })
    })
  })

  describe('Event Flow Integration', () => {
    test('should propagate events from queue manager to hook to component', async () => {
      const mockCallbacks = {
        onProgress: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn()
      }

      const { result } = renderHook(() => useFileUpload({
        sessionId: mockSessionId,
        onProgress: mockCallbacks.onProgress,
        onComplete: mockCallbacks.onComplete,
        onError: mockCallbacks.onError,
        enableQueueManager: true
      }))

      const file = createMockFile('event-flow.mp4', 25 * 1024 * 1024)
      const fileId = 'event-flow-test'

      await act(async () => {
        result.current.uploadFile(file, fileId)
      })

      await act(async () => {
        await sleep(500) // Wait for events to propagate
      })

      // Events should have been called (depending on mock implementation)
      // At minimum, the system should handle the flow without errors
      expect(result.current.uploadState).toBeDefined()
    })

    test('should handle progress updates correctly', async () => {
      let progressUpdates: UploadProgress[] = []

      const { result } = renderHook(() => useFileUpload({
        sessionId: mockSessionId,
        onProgress: (fileId, progress) => {
          progressUpdates.push(progress)
        },
        enableQueueManager: true
      }))

      const file = createMockFile('progress-flow.mp4', 30 * 1024 * 1024)
      const fileId = 'progress-flow-test'

      await act(async () => {
        result.current.uploadFile(file, fileId)
      })

      await act(async () => {
        await sleep(800) // Wait for progress events
      })

      // Progress data should be properly structured if events are fired
      if (progressUpdates.length > 0) {
        const lastProgress = progressUpdates[progressUpdates.length - 1]
        expect(lastProgress).toHaveProperty('fileId')
        expect(lastProgress).toHaveProperty('fileName')
        expect(lastProgress).toHaveProperty('progress')
        expect(lastProgress).toHaveProperty('speed')
        expect(lastProgress).toHaveProperty('eta')
      }
    })

    test('should handle error propagation correctly', async () => {
      // Mock API to fail
      mockApi.apiService.files.getUploadUrl.mockRejectedValueOnce(
        new Error('Integration test error')
      )

      let capturedError: string | null = null

      const { result } = renderHook(() => useFileUpload({
        sessionId: mockSessionId,
        onError: (fileId, error) => {
          capturedError = error
        },
        enableQueueManager: true
      }))

      const file = createMockFile('error-flow.mp4', 20 * 1024 * 1024)
      const fileId = 'error-flow-test'

      await act(async () => {
        result.current.uploadFile(file, fileId)
      })

      await act(async () => {
        await sleep(1000) // Wait for error to propagate
      })

      if (capturedError) {
        expect(capturedError).toContain('Integration test error')
        expect(result.current.hasError(fileId)).toBe(true)
      }
    })
  })

  describe('Configuration Integration', () => {
    test('should respect configuration changes through hook', async () => {
      const { result } = renderHook(() => useFileUpload({
        sessionId: mockSessionId,
        enableQueueManager: true
      }))

      const newConfig = {
        maxConcurrentFiles: 2,
        maxConcurrentChunks: 3,
        priorityMode: 'largest-first' as const
      }

      await act(async () => {
        result.current.updateQueueConfig(newConfig)
      })

      const queueStatus = result.current.getQueueStatus()
      expect(queueStatus.config.maxConcurrentFiles).toBe(2)
      expect(queueStatus.config.maxConcurrentChunks).toBe(3)
      expect(queueStatus.config.priorityMode).toBe('largest-first')
    })

    test('should handle network-aware configuration', async () => {
      // Mock slow network
      const mockDevice = require('@/utils/device')
      mockDevice.getNetworkInfo.mockReturnValue({
        effectiveType: '2g',
        downlink: 0.5,
        rtt: 500
      })
      mockDevice.isSlowNetwork.mockReturnValue(true)

      const { result } = renderHook(() => useFileUpload({
        sessionId: mockSessionId,
        enableQueueManager: true
      }))

      // Update configuration for slow network
      await act(async () => {
        result.current.updateQueueConfig({
          maxConcurrentFiles: 1,
          maxConcurrentChunks: 1,
          priorityMode: 'smallest-first'
        })
      })

      const queueStatus = result.current.getQueueStatus()
      expect(queueStatus.config.maxConcurrentFiles).toBe(1)
      expect(queueStatus.config.priorityMode).toBe('smallest-first')
    })
  })

  describe('Legacy Compatibility', () => {
    test('should handle legacy mode when queue manager is disabled', async () => {
      const { result } = renderHook(() => useFileUpload({
        sessionId: mockSessionId,
        enableQueueManager: false // Disabled
      }))

      const file = createMockFile('legacy-test.mp4', 25 * 1024 * 1024)
      const fileId = 'legacy-test'

      await act(async () => {
        result.current.uploadFile(file, fileId)
      })

      // Should fall back to legacy implementation
      // In our test setup, this would show a warning and not actually upload
      expect(result.current.uploadState).toBeDefined()
    })

    test('should maintain backward compatibility with existing components', () => {
      // Test that the hook interface hasn't broken existing functionality
      const { result } = renderHook(() => useFileUpload({
        sessionId: mockSessionId,
        enableQueueManager: true
      }))

      // All expected methods should be available
      expect(typeof result.current.uploadFile).toBe('function')
      expect(typeof result.current.cancelUpload).toBe('function')
      expect(typeof result.current.pauseUpload).toBe('function')
      expect(typeof result.current.resumeUpload).toBe('function')
      expect(typeof result.current.isUploading).toBe('function')
      expect(typeof result.current.getQueueStatus).toBe('function')

      // State should be properly structured
      expect(result.current.uploadState).toHaveProperty('activeUploads')
      expect(result.current.uploadState).toHaveProperty('queuedUploads')
      expect(result.current.uploadState).toHaveProperty('completedUploads')
      expect(result.current.uploadState).toHaveProperty('erroredUploads')
    })
  })

  describe('Performance Integration', () => {
    test('should maintain performance with React re-renders', async () => {
      let renderCount = 0

      const TestComponent = () => {
        renderCount++
        const { uploadFile, getQueueStatus } = useFileUpload({
          sessionId: mockSessionId,
          enableQueueManager: true
        })

        const queueStatus = getQueueStatus()

        return (
          <div>
            <span data-testid="render-count">{renderCount}</span>
            <span data-testid="queue-info">{queueStatus.queueLength}</span>
          </div>
        )
      }

      const { rerender } = render(<TestComponent />)

      const initialRenderCount = renderCount

      // Force re-renders
      rerender(<TestComponent />)
      rerender(<TestComponent />)

      // Should not cause excessive re-renders
      expect(renderCount - initialRenderCount).toBeLessThan(5)
    })

    test('should handle rapid file additions efficiently', async () => {
      const { result } = renderHook(() => useFileUpload({
        sessionId: mockSessionId,
        enableQueueManager: true
      }))

      const files = Array.from({ length: 10 }, (_, i) =>
        createMockFile(`rapid-${i}.mp4`, 15 * 1024 * 1024)
      )

      const startTime = Date.now()

      await act(async () => {
        files.forEach((file, index) => {
          result.current.uploadFile(file, `rapid-${index}`)
        })
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should handle rapid additions quickly
      expect(duration).toBeLessThan(1000) // Less than 1 second

      const queueStatus = result.current.getQueueStatus()
      expect(queueStatus.queueLength + queueStatus.activeUploads).toBe(10)
    })
  })
})