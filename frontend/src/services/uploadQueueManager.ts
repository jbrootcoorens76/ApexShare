/**
 * Global Upload Queue Manager
 *
 * A sophisticated upload management system that optimizes performance across the entire application.
 * Features:
 * - Global centralized queue for all file uploads
 * - Intelligent bandwidth allocation and network speed detection
 * - Adaptive concurrency based on performance metrics
 * - Priority handling (smallest-first mode for quick completions)
 * - Advanced retry logic with exponential backoff
 * - Performance monitoring and real-time optimization
 * - Event-driven progress updates
 * - Network-aware optimizations for various connection types
 */

import { EventEmitter } from 'events'
import { apiService, uploadFileChunk } from '@/services/api'
import { getOptimalChunkSize, getNetworkInfo, getDeviceInfo, isSlowNetwork } from '@/utils/device'
import { appConfig } from '@/config/env'
import type { UploadProgress, ChunkUploadResult } from '@/types'

// Enhanced types for queue management
export interface QueuedFile {
  fileId: string
  file: File
  sessionId: string
  priority: number // Lower number = higher priority
  createdAt: number
  retryCount: number
  onProgress?: (fileId: string, progress: UploadProgress) => void
  onComplete?: (fileId: string, fileInfo: any) => void
  onError?: (fileId: string, error: string) => void
}

export interface ActiveUpload {
  fileId: string
  file: File
  sessionId: string
  uploadId: string
  totalChunks: number
  completedChunks: ChunkUploadResult[]
  currentChunk: number
  abortController: AbortController
  startTime: number
  lastProgressTime: number
  uploadedBytes: number
  status: 'initializing' | 'uploading' | 'paused' | 'completing' | 'completed' | 'error'
  error?: string
  pausedAt?: number
  resumeCount: number
  chunkSize: number
}

export interface NetworkMetrics {
  speed: number // bytes per second
  rtt: number // round trip time
  effectiveType: string
  lastMeasured: number
  samples: number[]
}

export interface PerformanceMetrics {
  totalUploads: number
  successfulUploads: number
  failedUploads: number
  averageSpeed: number
  totalBytesUploaded: number
  activeConcurrency: number
  optimalConcurrency: number
}

export interface QueueConfig {
  maxConcurrentFiles: number
  maxConcurrentChunks: number
  retryAttempts: number
  retryDelay: number
  priorityMode: 'fifo' | 'smallest-first' | 'largest-first'
  adaptiveOptimization: boolean
  networkOptimization: boolean
}

// Events emitted by the queue manager
export interface QueueEvents {
  'upload-queued': (fileId: string, queuedFile: QueuedFile) => void
  'upload-started': (fileId: string, upload: ActiveUpload) => void
  'upload-progress': (fileId: string, progress: UploadProgress) => void
  'upload-completed': (fileId: string, fileInfo: any) => void
  'upload-error': (fileId: string, error: string) => void
  'upload-paused': (fileId: string) => void
  'upload-resumed': (fileId: string) => void
  'upload-cancelled': (fileId: string) => void
  'queue-empty': () => void
  'performance-update': (metrics: PerformanceMetrics) => void
  'network-change': (metrics: NetworkMetrics) => void
}

/**
 * Global Upload Queue Manager Class
 * Singleton pattern for global access across the application
 */
class UploadQueueManager extends EventEmitter {
  private static instance: UploadQueueManager

  // Core queue state
  private queue: QueuedFile[] = []
  private activeUploads: Map<string, ActiveUpload> = new Map()
  private completedUploads: Set<string> = new Set()

  // Configuration and metrics
  private config: QueueConfig = {
    maxConcurrentFiles: 3,
    maxConcurrentChunks: 4,
    retryAttempts: 3,
    retryDelay: 1000,
    priorityMode: 'smallest-first',
    adaptiveOptimization: true,
    networkOptimization: true,
  }

  private networkMetrics: NetworkMetrics = {
    speed: 0,
    rtt: 0,
    effectiveType: 'unknown',
    lastMeasured: 0,
    samples: [],
  }

  private performanceMetrics: PerformanceMetrics = {
    totalUploads: 0,
    successfulUploads: 0,
    failedUploads: 0,
    averageSpeed: 0,
    totalBytesUploaded: 0,
    activeConcurrency: 0,
    optimalConcurrency: 3,
  }

  // Performance monitoring
  private speedMeasurements: number[] = []
  private lastOptimizationCheck = 0
  private optimizationInterval = 10000 // 10 seconds

  // Network monitoring
  private networkCheckInterval?: NodeJS.Timeout
  private performanceCheckInterval?: NodeJS.Timeout

  private constructor() {
    super()
    this.initializeNetworkMonitoring()
    this.initializePerformanceMonitoring()
    this.detectInitialCapabilities()
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): UploadQueueManager {
    if (!UploadQueueManager.instance) {
      UploadQueueManager.instance = new UploadQueueManager()
    }
    return UploadQueueManager.instance
  }

  /**
   * Initialize network monitoring
   */
  private initializeNetworkMonitoring(): void {
    // Initial network detection
    this.updateNetworkMetrics()

    // Monitor network changes
    this.networkCheckInterval = setInterval(() => {
      this.updateNetworkMetrics()
    }, 5000)

    // Listen for network events (browser only)
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection
      connection.addEventListener('change', () => {
        this.updateNetworkMetrics()
        this.adaptToNetworkChange()
      })
    }

    // Listen for online/offline events (browser only)
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('🌐 Network: Back online - resuming uploads')
        this.resumeAllUploads()
      })

      window.addEventListener('offline', () => {
        console.log('🌐 Network: Gone offline - pausing uploads')
        this.pauseAllUploads()
      })
    }
  }

  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    this.performanceCheckInterval = setInterval(() => {
      this.analyzePerformance()
      this.optimizeConfiguration()
    }, this.optimizationInterval)
  }

  /**
   * Detect initial device and network capabilities
   */
  private detectInitialCapabilities(): void {
    const deviceInfo = getDeviceInfo()
    const networkInfo = getNetworkInfo()

    // Adjust initial configuration based on device
    if (deviceInfo.isMobile) {
      this.config.maxConcurrentFiles = 2
      this.config.maxConcurrentChunks = 2
    }

    // Adjust based on network
    if (isSlowNetwork()) {
      this.config.maxConcurrentFiles = 1
      this.config.maxConcurrentChunks = 1
      this.config.priorityMode = 'smallest-first'
    }

    console.log('🚀 Upload Queue Manager initialized with config:', this.config)
  }

  /**
   * Update network metrics
   */
  private updateNetworkMetrics(): void {
    const networkInfo = getNetworkInfo()
    if (networkInfo) {
      this.networkMetrics = {
        speed: networkInfo.downlink * 1024 * 1024, // Convert Mbps to bytes/sec
        rtt: networkInfo.rtt,
        effectiveType: networkInfo.effectiveType,
        lastMeasured: Date.now(),
        samples: this.networkMetrics.samples.slice(-10), // Keep last 10 samples
      }

      this.emit('network-change', this.networkMetrics)
    }
  }

  /**
   * Adapt configuration to network changes
   */
  private adaptToNetworkChange(): void {
    if (!this.config.networkOptimization) return

    const { effectiveType } = this.networkMetrics

    switch (effectiveType) {
      case 'slow-2g':
      case '2g':
        this.config.maxConcurrentFiles = 1
        this.config.maxConcurrentChunks = 1
        this.config.priorityMode = 'smallest-first'
        break
      case '3g':
        this.config.maxConcurrentFiles = 2
        this.config.maxConcurrentChunks = 2
        break
      case '4g':
        this.config.maxConcurrentFiles = 3
        this.config.maxConcurrentChunks = 4
        break
      default:
        // Keep current configuration for unknown networks
        break
    }

    console.log(`🌐 Network changed to ${effectiveType}, adjusted config:`, this.config)
  }

  /**
   * Add file to upload queue
   */
  public queueUpload(
    fileId: string,
    file: File,
    sessionId: string,
    options: {
      onProgress?: (fileId: string, progress: UploadProgress) => void
      onComplete?: (fileId: string, fileInfo: any) => void
      onError?: (fileId: string, error: string) => void
      priority?: number
    } = {}
  ): void {
    // Calculate priority based on file size if not provided
    let priority = options.priority ?? this.calculatePriority(file)

    const queuedFile: QueuedFile = {
      fileId,
      file,
      sessionId,
      priority,
      createdAt: Date.now(),
      retryCount: 0,
      onProgress: options.onProgress,
      onComplete: options.onComplete,
      onError: options.onError,
    }

    // Add to queue with priority sorting
    this.queue.push(queuedFile)
    this.sortQueue()

    this.emit('upload-queued', fileId, queuedFile)

    console.log(`📤 Queued upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB) - Priority: ${priority}`)

    // Process queue
    this.processQueue()
  }

  /**
   * Calculate file priority based on size and configuration
   */
  private calculatePriority(file: File): number {
    switch (this.config.priorityMode) {
      case 'smallest-first':
        return file.size // Smaller files get lower numbers (higher priority)
      case 'largest-first':
        return -file.size // Larger files get lower numbers (higher priority)
      default: // 'fifo'
        return Date.now() // FIFO order
    }
  }

  /**
   * Sort queue based on priority
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Process the upload queue
   */
  private async processQueue(): Promise<void> {
    // Check if we can start more uploads
    while (this.activeUploads.size < this.config.maxConcurrentFiles && this.queue.length > 0) {
      const queuedFile = this.queue.shift()
      if (queuedFile) {
        await this.startUpload(queuedFile)
      }
    }

    // Emit queue empty event if everything is done
    if (this.queue.length === 0 && this.activeUploads.size === 0) {
      this.emit('queue-empty')
    }
  }

  /**
   * Start uploading a file
   */
  private async startUpload(queuedFile: QueuedFile): Promise<void> {
    const { fileId, file, sessionId } = queuedFile

    try {
      // Get presigned upload URLs from API
      const response = await apiService.files.getUploadUrl(
        sessionId,
        file.name,
        file.size,
        file.type
      )

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get upload URL')
      }

      // Handle multipart upload
      if ('uploadId' in response.data && 'chunkSize' in response.data) {
        const { uploadId, uploadUrl, chunkSize } = response.data
        await this.handleMultipartUpload(queuedFile, uploadId, uploadUrl, chunkSize)
      } else {
        // Handle single upload (fallback)
        const { uploadUrl, fields } = response.data as any
        await this.handleSingleUpload(queuedFile, uploadUrl, fields)
      }
    } catch (error: any) {
      await this.handleUploadError(queuedFile, error.message || 'Upload failed')
    }
  }

  /**
   * Handle multipart upload with advanced chunking
   */
  private async handleMultipartUpload(
    queuedFile: QueuedFile,
    uploadId: string,
    uploadUrl: string,
    apiChunkSize: number
  ): Promise<void> {
    const { fileId, file, sessionId } = queuedFile

    // Use adaptive chunk size based on network conditions
    const optimalChunkSize = this.getAdaptiveChunkSize(apiChunkSize)
    const totalChunks = Math.ceil(file.size / optimalChunkSize)
    const abortController = new AbortController()

    const upload: ActiveUpload = {
      fileId,
      file,
      sessionId,
      uploadId,
      totalChunks,
      completedChunks: [],
      currentChunk: 0,
      abortController,
      startTime: Date.now(),
      lastProgressTime: Date.now(),
      uploadedBytes: 0,
      status: 'initializing',
      resumeCount: 0,
      chunkSize: optimalChunkSize,
    }

    this.activeUploads.set(fileId, upload)
    this.emit('upload-started', fileId, upload)

    upload.status = 'uploading'

    try {
      // Upload chunks with adaptive concurrency
      await this.uploadChunksWithConcurrency(upload, uploadUrl)

      // Complete multipart upload
      upload.status = 'completing'

      const parts = upload.completedChunks.map(r => ({
        PartNumber: r.chunkIndex + 1,
        ETag: r.etag,
      }))

      const completeResponse = await apiService.files.completeUpload(
        sessionId,
        uploadId,
        parts
      )

      if (!completeResponse.success) {
        throw new Error(completeResponse.error || 'Failed to complete upload')
      }

      // Success
      upload.status = 'completed'
      this.completedUploads.add(fileId)
      this.activeUploads.delete(fileId)

      this.performanceMetrics.successfulUploads++
      this.performanceMetrics.totalBytesUploaded += file.size

      queuedFile.onComplete?.(fileId, completeResponse.data)
      this.emit('upload-completed', fileId, completeResponse.data)

      console.log(`✅ Upload completed: ${file.name}`)

    } catch (error: any) {
      upload.status = 'error'
      upload.error = error.message
      await this.handleUploadError(queuedFile, error.message)
    }

    // Continue processing queue
    this.processQueue()
  }

  /**
   * Upload chunks with adaptive concurrency
   */
  private async uploadChunksWithConcurrency(upload: ActiveUpload, uploadUrl: string): Promise<void> {
    const { file, totalChunks, chunkSize } = upload
    const maxConcurrentChunks = this.getAdaptiveConcurrency()

    // Track active chunk uploads
    const activeChunkUploads: Promise<ChunkUploadResult>[] = []
    let nextChunkIndex = 0

    const uploadNextChunk = async (): Promise<ChunkUploadResult | null> => {
      if (nextChunkIndex >= totalChunks) return null

      const chunkIndex = nextChunkIndex++
      const start = chunkIndex * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      const chunk = file.slice(start, end)

      const startTime = Date.now()

      try {
        const result = await uploadFileChunk(
          uploadUrl,
          chunk,
          chunkIndex + 1, // S3 part numbers start at 1
          (progress) => {
            this.updateUploadProgress(upload, chunkIndex, progress)
          }
        )

        // Measure upload speed for this chunk
        const duration = Date.now() - startTime
        const speed = chunk.size / (duration / 1000)
        this.recordSpeedMeasurement(speed)

        upload.completedChunks.push({
          chunkIndex,
          etag: result.etag,
          success: true,
        })

        upload.currentChunk = chunkIndex + 1
        upload.uploadedBytes += chunk.size

        return {
          chunkIndex,
          etag: result.etag,
          success: true,
        }
      } catch (error: any) {
        return {
          chunkIndex,
          etag: '',
          success: false,
          error: error.message || 'Chunk upload failed',
        }
      }
    }

    // Start initial chunk uploads
    for (let i = 0; i < Math.min(maxConcurrentChunks, totalChunks); i++) {
      activeChunkUploads.push(uploadNextChunk().then(r => r!))
    }

    // Process chunks with rolling concurrency
    while (activeChunkUploads.length > 0) {
      const result = await Promise.race(activeChunkUploads)

      // Remove completed upload from active list
      const index = activeChunkUploads.findIndex(async (p) => {
        const resolved = await p
        return resolved?.chunkIndex === result.chunkIndex
      })

      if (index !== -1) {
        activeChunkUploads.splice(index, 1)
      }

      // Check for errors
      if (!result.success) {
        throw new Error(result.error || 'Chunk upload failed')
      }

      // Start next chunk if available
      if (nextChunkIndex < totalChunks) {
        const nextChunk = uploadNextChunk()
        if (nextChunk) {
          activeChunkUploads.push(nextChunk.then(r => r!))
        }
      }
    }
  }

  /**
   * Get adaptive chunk size based on network conditions
   */
  private getAdaptiveChunkSize(baseChunkSize: number): number {
    const networkInfo = getNetworkInfo()
    let chunkSize = baseChunkSize

    if (networkInfo) {
      switch (networkInfo.effectiveType) {
        case 'slow-2g':
          chunkSize = Math.min(chunkSize, 1024 * 1024) // 1MB max
          break
        case '2g':
          chunkSize = Math.min(chunkSize, 2 * 1024 * 1024) // 2MB max
          break
        case '3g':
          chunkSize = Math.min(chunkSize, 5 * 1024 * 1024) // 5MB max
          break
        default:
          // Use base chunk size for 4G and unknown
          break
      }
    }

    return chunkSize
  }

  /**
   * Get adaptive concurrency based on performance
   */
  private getAdaptiveConcurrency(): number {
    if (!this.config.adaptiveOptimization) {
      return this.config.maxConcurrentChunks
    }

    // Start with configured value
    let concurrency = this.config.maxConcurrentChunks

    // Reduce concurrency on slow networks
    if (isSlowNetwork()) {
      concurrency = Math.max(1, Math.floor(concurrency / 2))
    }

    // Adjust based on current performance
    if (this.speedMeasurements.length > 5) {
      const avgSpeed = this.speedMeasurements.slice(-5).reduce((a, b) => a + b, 0) / 5
      const expectedSpeed = this.networkMetrics.speed

      if (avgSpeed < expectedSpeed * 0.7) {
        // Performance is below 70% of expected, reduce concurrency
        concurrency = Math.max(1, Math.floor(concurrency * 0.8))
      } else if (avgSpeed > expectedSpeed * 1.2) {
        // Performance is above 120% of expected, increase concurrency
        concurrency = Math.min(this.config.maxConcurrentChunks * 2, concurrency + 1)
      }
    }

    return concurrency
  }

  /**
   * Record speed measurement for performance analysis
   */
  private recordSpeedMeasurement(speed: number): void {
    this.speedMeasurements.push(speed)

    // Keep only recent measurements
    if (this.speedMeasurements.length > 20) {
      this.speedMeasurements = this.speedMeasurements.slice(-20)
    }
  }

  /**
   * Update upload progress
   */
  private updateUploadProgress(upload: ActiveUpload, chunkIndex: number, chunkProgress: number): void {
    const now = Date.now()
    const totalBytes = upload.file.size

    // Calculate uploaded bytes including current chunk progress
    const completedBytes = upload.completedChunks.length * upload.chunkSize
    const currentChunkBytes = Math.min(upload.chunkSize, totalBytes - (chunkIndex * upload.chunkSize))
    const currentChunkUploadedBytes = currentChunkBytes * (chunkProgress / 100)
    const uploadedBytes = completedBytes + currentChunkUploadedBytes

    // Calculate speed and ETA
    const timeElapsed = (now - upload.startTime) / 1000
    const speed = timeElapsed > 0 ? uploadedBytes / timeElapsed : 0
    const remainingBytes = totalBytes - uploadedBytes
    const eta = speed > 0 ? remainingBytes / speed : 0

    // Calculate overall progress
    const progress = totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0

    const progressData: UploadProgress = {
      fileId: upload.fileId,
      fileName: upload.file.name,
      progress: Math.min(progress, 100),
      speed,
      eta,
      status: upload.status as any,
      uploadedBytes,
      totalBytes,
      startTime: upload.startTime,
      chunkIndex,
      totalChunks: upload.totalChunks,
    }

    // Update upload object
    upload.uploadedBytes = uploadedBytes
    upload.lastProgressTime = now

    // Emit progress event
    const queuedFile = this.findQueuedFile(upload.fileId)
    queuedFile?.onProgress?.(upload.fileId, progressData)
    this.emit('upload-progress', upload.fileId, progressData)
  }

  /**
   * Handle single file upload (fallback)
   */
  private async handleSingleUpload(
    queuedFile: QueuedFile,
    uploadUrl: string,
    fields: Record<string, string>
  ): Promise<void> {
    const { fileId, file } = queuedFile

    const formData = new FormData()

    // Add fields first
    Object.entries(fields).forEach(([key, value]) => {
      formData.append(key, value)
    })

    // Add file last
    formData.append('file', file)

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const startTime = Date.now()

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100
          const timeElapsed = (Date.now() - startTime) / 1000
          const speed = timeElapsed > 0 ? event.loaded / timeElapsed : 0
          const eta = speed > 0 ? (event.total - event.loaded) / speed : 0

          const progressData: UploadProgress = {
            fileId,
            fileName: file.name,
            progress,
            speed,
            eta,
            status: 'uploading',
            uploadedBytes: event.loaded,
            totalBytes: event.total,
            startTime,
          }

          queuedFile.onProgress?.(fileId, progressData)
          this.emit('upload-progress', fileId, progressData)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          this.performanceMetrics.successfulUploads++
          this.performanceMetrics.totalBytesUploaded += file.size

          const fileInfo = { fileName: file.name, fileSize: file.size }
          queuedFile.onComplete?.(fileId, fileInfo)
          this.emit('upload-completed', fileId, fileInfo)
          resolve()
        } else {
          reject(new Error(`Upload failed with status: ${xhr.status}`))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed due to network error'))
      })

      xhr.open('POST', uploadUrl)
      xhr.send(formData)
    })
  }

  /**
   * Handle upload errors with retry logic
   */
  private async handleUploadError(queuedFile: QueuedFile, error: string): Promise<void> {
    const { fileId } = queuedFile

    this.performanceMetrics.failedUploads++

    // Check if we should retry
    if (queuedFile.retryCount < this.config.retryAttempts) {
      queuedFile.retryCount++

      // Exponential backoff
      const delay = this.config.retryDelay * Math.pow(2, queuedFile.retryCount - 1)

      console.log(`🔄 Retrying upload ${fileId} (attempt ${queuedFile.retryCount}/${this.config.retryAttempts}) in ${delay}ms`)

      setTimeout(() => {
        // Re-queue with higher priority
        queuedFile.priority = -Date.now() // Highest priority
        this.queue.unshift(queuedFile)
        this.processQueue()
      }, delay)
    } else {
      // Max retries exceeded
      this.activeUploads.delete(fileId)
      queuedFile.onError?.(fileId, error)
      this.emit('upload-error', fileId, error)

      console.error(`❌ Upload failed permanently: ${fileId} - ${error}`)

      // Continue processing queue
      this.processQueue()
    }
  }

  /**
   * Pause upload
   */
  public pauseUpload(fileId: string): void {
    const upload = this.activeUploads.get(fileId)
    if (upload && upload.status === 'uploading') {
      upload.abortController.abort()
      upload.status = 'paused'
      upload.pausedAt = Date.now()

      this.emit('upload-paused', fileId)
      console.log(`⏸️ Paused upload: ${fileId}`)
    }
  }

  /**
   * Resume upload
   */
  public resumeUpload(fileId: string): void {
    const upload = this.activeUploads.get(fileId)
    if (upload && upload.status === 'paused') {
      upload.abortController = new AbortController()
      upload.status = 'uploading'
      upload.resumeCount++

      this.emit('upload-resumed', fileId)
      console.log(`▶️ Resumed upload: ${fileId}`)

      // Continue upload from where it left off
      // This would require additional implementation to handle partial chunk uploads
    }
  }

  /**
   * Cancel upload
   */
  public cancelUpload(fileId: string): void {
    // Remove from queue if not started
    const queueIndex = this.queue.findIndex(q => q.fileId === fileId)
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1)
    }

    // Cancel active upload
    const upload = this.activeUploads.get(fileId)
    if (upload) {
      upload.abortController.abort()

      // Cancel multipart upload on server
      apiService.files.cancelUpload(upload.sessionId, upload.uploadId).catch(console.error)

      this.activeUploads.delete(fileId)
    }

    this.emit('upload-cancelled', fileId)
    console.log(`❌ Cancelled upload: ${fileId}`)

    // Continue processing queue
    this.processQueue()
  }

  /**
   * Pause all uploads
   */
  public pauseAllUploads(): void {
    this.activeUploads.forEach((upload) => {
      if (upload.status === 'uploading') {
        this.pauseUpload(upload.fileId)
      }
    })
  }

  /**
   * Resume all uploads
   */
  public resumeAllUploads(): void {
    this.activeUploads.forEach((upload) => {
      if (upload.status === 'paused') {
        this.resumeUpload(upload.fileId)
      }
    })
  }

  /**
   * Get upload progress
   */
  public getUploadProgress(fileId: string): UploadProgress | null {
    const upload = this.activeUploads.get(fileId)
    if (!upload) return null

    const totalBytes = upload.file.size
    const timeElapsed = (Date.now() - upload.startTime) / 1000
    const speed = timeElapsed > 0 ? upload.uploadedBytes / timeElapsed : 0
    const remainingBytes = totalBytes - upload.uploadedBytes
    const eta = speed > 0 ? remainingBytes / speed : 0
    const progress = totalBytes > 0 ? (upload.uploadedBytes / totalBytes) * 100 : 0

    return {
      fileId: upload.fileId,
      fileName: upload.file.name,
      progress: Math.min(progress, 100),
      speed,
      eta,
      status: upload.status as any,
      uploadedBytes: upload.uploadedBytes,
      totalBytes,
      startTime: upload.startTime,
      chunkIndex: upload.currentChunk,
      totalChunks: upload.totalChunks,
    }
  }

  /**
   * Check if file is uploading
   */
  public isUploading(fileId: string): boolean {
    return this.activeUploads.has(fileId)
  }

  /**
   * Get queue status
   */
  public getQueueStatus() {
    return {
      queueLength: this.queue.length,
      activeUploads: this.activeUploads.size,
      completedUploads: this.completedUploads.size,
      config: { ...this.config },
      networkMetrics: { ...this.networkMetrics },
      performanceMetrics: { ...this.performanceMetrics },
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log('🔧 Updated queue configuration:', this.config)
  }

  /**
   * Analyze performance and optimize
   */
  private analyzePerformance(): void {
    const now = Date.now()

    // Update performance metrics
    if (this.speedMeasurements.length > 0) {
      this.performanceMetrics.averageSpeed =
        this.speedMeasurements.reduce((a, b) => a + b, 0) / this.speedMeasurements.length
    }

    this.performanceMetrics.activeConcurrency = this.activeUploads.size

    this.emit('performance-update', this.performanceMetrics)
  }

  /**
   * Optimize configuration based on performance
   */
  private optimizeConfiguration(): void {
    if (!this.config.adaptiveOptimization) return

    const now = Date.now()
    if (now - this.lastOptimizationCheck < this.optimizationInterval) return

    this.lastOptimizationCheck = now

    // Analyze success rate
    const totalUploads = this.performanceMetrics.successfulUploads + this.performanceMetrics.failedUploads
    const successRate = totalUploads > 0 ? this.performanceMetrics.successfulUploads / totalUploads : 1

    // Adjust concurrency based on success rate
    if (successRate < 0.8 && this.config.maxConcurrentFiles > 1) {
      // Low success rate, reduce concurrency
      this.config.maxConcurrentFiles = Math.max(1, this.config.maxConcurrentFiles - 1)
      this.config.maxConcurrentChunks = Math.max(1, this.config.maxConcurrentChunks - 1)

      console.log(`📉 Reduced concurrency due to low success rate (${(successRate * 100).toFixed(1)}%)`)
    } else if (successRate > 0.95 && this.config.maxConcurrentFiles < 5) {
      // High success rate, try increasing concurrency
      this.config.maxConcurrentFiles++
      this.config.maxConcurrentChunks++

      console.log(`📈 Increased concurrency due to high success rate (${(successRate * 100).toFixed(1)}%)`)
    }

    this.performanceMetrics.optimalConcurrency = this.config.maxConcurrentFiles
  }

  /**
   * Find queued file by ID
   */
  private findQueuedFile(fileId: string): QueuedFile | undefined {
    return this.queue.find(q => q.fileId === fileId)
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    // Cancel all active uploads
    this.activeUploads.forEach((upload) => {
      upload.abortController.abort()
    })

    // Clear intervals
    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval)
    }
    if (this.performanceCheckInterval) {
      clearInterval(this.performanceCheckInterval)
    }

    // Clear state
    this.queue = []
    this.activeUploads.clear()
    this.completedUploads.clear()

    // Remove all listeners
    this.removeAllListeners()

    console.log('🗑️ Upload Queue Manager destroyed')
  }
}

// Export singleton instance
export const uploadQueueManager = UploadQueueManager.getInstance()

// Export the singleton instance and types
export type {
  QueuedFile as QueuedFileType,
  ActiveUpload as ActiveUploadType,
  NetworkMetrics as NetworkMetricsType,
  PerformanceMetrics as PerformanceMetricsType,
  QueueConfig as QueueConfigType,
  QueueEvents as QueueEventsType
}

export default uploadQueueManager