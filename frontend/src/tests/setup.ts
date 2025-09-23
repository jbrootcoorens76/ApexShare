/**
 * Test Setup Configuration
 *
 * Global test setup for Upload Queue Manager testing suite.
 */

import '@testing-library/jest-dom'

// Mock global objects that might not be available in test environment
global.File = class MockFile extends Blob {
  name: string
  lastModified: number

  constructor(fileBits: BlobPart[], fileName: string, options?: FilePropertyBag) {
    super(fileBits, options)
    this.name = fileName
    this.lastModified = options?.lastModified || Date.now()
  }
}

global.FileList = class MockFileList extends Array<File> {
  item(index: number): File | null {
    return this[index] || null
  }
}

// Mock performance API for memory measurements
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB
      totalJSHeapSize: 100 * 1024 * 1024, // 100MB
      jsHeapSizeLimit: 2 * 1024 * 1024 * 1024 // 2GB
    }
  } as any
}

// Mock navigator for network detection
if (typeof navigator === 'undefined') {
  global.navigator = {
    connection: {
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    },
    onLine: true
  } as any
}

// Mock window for online/offline events
if (typeof window === 'undefined') {
  global.window = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  } as any
}

// Mock document for visibility changes
if (typeof document === 'undefined') {
  global.document = {
    hidden: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  } as any
}

// Console formatting for better test output
const originalConsoleLog = console.log
console.log = (...args) => {
  if (process.env.NODE_ENV === 'test') {
    // Format test output with timestamps
    const timestamp = new Date().toISOString().substr(11, 8)
    originalConsoleLog(`[${timestamp}]`, ...args)
  } else {
    originalConsoleLog(...args)
  }
}

// Global test utilities
export const testUtils = {
  createMockFile: (name: string, size: number, type: string = 'video/mp4'): File => {
    const file = new File(['mock content'], name, { type })
    Object.defineProperty(file, 'size', { value: size, writable: false })
    return file
  },

  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  waitForCondition: async (
    condition: () => boolean,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> => {
    const startTime = Date.now()
    while (!condition() && (Date.now() - startTime) < timeout) {
      await testUtils.sleep(interval)
    }
    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`)
    }
  }
}

// Increase test timeout for performance tests
jest.setTimeout(60000)

// Clean up between tests
afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})