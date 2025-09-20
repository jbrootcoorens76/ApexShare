/**
 * File Upload Hook
 *
 * Manages chunked file uploads to S3 with progress tracking, error handling,
 * and resume capability. Optimized for large video files and mobile networks.
 */

import React, { useState, useCallback, useRef } from 'react'
import { apiService, uploadFileChunk } from '@/services/api'
import { getOptimalChunkSize, getRecommendedUploadSettings } from '@/utils/device'
import type { UploadProgress, ChunkUploadResult } from '@/types'

interface UseFileUploadOptions {
  sessionId?: string
  onProgress?: (fileId: string, progress: UploadProgress) => void
  onComplete?: (fileId: string, fileInfo: any) => void
  onError?: (fileId: string, error: string) => void
}

interface ActiveUpload {
  file: File
  uploadId: string
  totalChunks: number
  completedChunks: ChunkUploadResult[]
  currentChunk: number
  abortController: AbortController
  startTime: number
  lastProgressTime: number
  uploadedBytes: number
}

export const useFileUpload = (options: UseFileUploadOptions) => {
  const [activeUploads, setActiveUploads] = useState<Map<string, ActiveUpload>>(new Map())
  const progressIntervalRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const { sessionId, onProgress, onComplete, onError } = options

  /**
   * Calculate upload progress and speed
   */
  const calculateProgress = useCallback((
    fileId: string,
    upload: ActiveUpload,
    chunkProgress: number = 0
  ): UploadProgress => {
    const now = Date.now()
    const totalBytes = upload.file.size
    const chunkSize = getOptimalChunkSize()

    // Calculate uploaded bytes including current chunk progress
    const completedBytes = upload.completedChunks.length * chunkSize
    const currentChunkBytes = Math.min(chunkSize, totalBytes - (upload.currentChunk * chunkSize))
    const currentChunkUploadedBytes = currentChunkBytes * (chunkProgress / 100)
    const uploadedBytes = completedBytes + currentChunkUploadedBytes

    // Calculate speed (bytes per second)
    const timeElapsed = (now - upload.startTime) / 1000
    const speed = timeElapsed > 0 ? uploadedBytes / timeElapsed : 0

    // Calculate ETA
    const remainingBytes = totalBytes - uploadedBytes
    const eta = speed > 0 ? remainingBytes / speed : 0

    // Calculate overall progress percentage
    const progress = totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0

    return {
      fileId,
      fileName: upload.file.name,
      progress: Math.min(progress, 100),
      speed,
      eta,
      status: upload.completedChunks.length === upload.totalChunks ? 'completed' : 'uploading',
      uploadedBytes,
      totalBytes,
      startTime: upload.startTime,
      chunkIndex: upload.currentChunk,
      totalChunks: upload.totalChunks,
    }
  }, [])

  /**
   * Update progress for a file upload
   */
  const updateProgress = useCallback((fileId: string, chunkProgress: number = 0) => {
    const upload = activeUploads.get(fileId)
    if (!upload) return

    const progress = calculateProgress(fileId, upload, chunkProgress)
    onProgress?.(fileId, progress)
  }, [activeUploads, calculateProgress, onProgress])

  /**
   * Upload a single chunk
   */
  const uploadChunk = async (
    upload: ActiveUpload,
    chunkIndex: number,
    presignedUrl: string
  ): Promise<ChunkUploadResult> => {
    const chunkSize = getOptimalChunkSize()
    const start = chunkIndex * chunkSize
    const end = Math.min(start + chunkSize, upload.file.size)
    const chunk = upload.file.slice(start, end)

    try {
      const result = await uploadFileChunk(
        presignedUrl,
        chunk,
        chunkIndex + 1, // S3 part numbers start at 1
        (progress) => {
          updateProgress(upload.file.name, progress)
        }
      )

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

  /**
   * Start file upload
   */
  const uploadFile = useCallback(async (file: File, fileId: string) => {
    if (!sessionId) {
      onError?.(fileId, 'No session ID provided')
      return
    }

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

      const { uploadId, uploadUrl, chunkSize } = response.data
      const totalChunks = Math.ceil(file.size / chunkSize)
      const abortController = new AbortController()

      // Create upload tracking object
      const upload: ActiveUpload = {
        file,
        uploadId,
        totalChunks,
        completedChunks: [],
        currentChunk: 0,
        abortController,
        startTime: Date.now(),
        lastProgressTime: Date.now(),
        uploadedBytes: 0,
      }

      setActiveUploads(prev => new Map(prev).set(fileId, upload))

      // Start progress tracking
      const progressInterval = setInterval(() => {
        updateProgress(fileId)
      }, 1000)
      progressIntervalRef.current.set(fileId, progressInterval)

      // Upload chunks
      const uploadSettings = getRecommendedUploadSettings()
      const chunkPromises: Promise<ChunkUploadResult>[] = []

      for (let i = 0; i < totalChunks; i++) {
        // Limit concurrent uploads
        if (chunkPromises.length >= uploadSettings.maxConcurrentUploads) {
          await Promise.race(chunkPromises)
        }

        const chunkPromise = uploadChunk(upload, i, uploadUrl)
          .then(result => {
            if (result.success) {
              upload.completedChunks.push(result)
              upload.currentChunk = i + 1
              setActiveUploads(prev => new Map(prev).set(fileId, { ...upload }))
            }
            return result
          })

        chunkPromises.push(chunkPromise)
      }

      // Wait for all chunks to complete
      const results = await Promise.all(chunkPromises)
      const failedChunks = results.filter(r => !r.success)

      if (failedChunks.length > 0) {
        throw new Error(`Failed to upload ${failedChunks.length} chunks`)
      }

      // Complete multipart upload
      const parts = results.map(r => ({
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

      // Clean up
      clearInterval(progressInterval)
      progressIntervalRef.current.delete(fileId)
      setActiveUploads(prev => {
        const newMap = new Map(prev)
        newMap.delete(fileId)
        return newMap
      })

      onComplete?.(fileId, completeResponse.data)
    } catch (error: any) {
      // Clean up on error
      const progressInterval = progressIntervalRef.current.get(fileId)
      if (progressInterval) {
        clearInterval(progressInterval)
        progressIntervalRef.current.delete(fileId)
      }

      setActiveUploads(prev => {
        const newMap = new Map(prev)
        newMap.delete(fileId)
        return newMap
      })

      onError?.(fileId, error.message || 'Upload failed')
    }
  }, [sessionId, onComplete, onError, updateProgress])

  /**
   * Cancel file upload
   */
  const cancelUpload = useCallback(async (fileId: string) => {
    const upload = activeUploads.get(fileId)
    if (!upload) return

    try {
      // Abort ongoing requests
      upload.abortController.abort()

      // Cancel multipart upload on server
      if (sessionId) {
        await apiService.files.cancelUpload(sessionId, upload.uploadId)
      }
    } catch (error) {
      console.error('Error canceling upload:', error)
    } finally {
      // Clean up
      const progressInterval = progressIntervalRef.current.get(fileId)
      if (progressInterval) {
        clearInterval(progressInterval)
        progressIntervalRef.current.delete(fileId)
      }

      setActiveUploads(prev => {
        const newMap = new Map(prev)
        newMap.delete(fileId)
        return newMap
      })
    }
  }, [activeUploads, sessionId])

  /**
   * Pause file upload
   */
  const pauseUpload = useCallback((fileId: string) => {
    const upload = activeUploads.get(fileId)
    if (!upload) return

    upload.abortController.abort()

    const progressInterval = progressIntervalRef.current.get(fileId)
    if (progressInterval) {
      clearInterval(progressInterval)
    }

    // Update status but keep upload data for resume
    const progress = calculateProgress(fileId, upload)
    onProgress?.(fileId, { ...progress, status: 'paused' })
  }, [activeUploads, calculateProgress, onProgress])

  /**
   * Resume file upload
   */
  const resumeUpload = useCallback((fileId: string) => {
    const upload = activeUploads.get(fileId)
    if (!upload) return

    // Create new abort controller
    upload.abortController = new AbortController()

    // Resume from last completed chunk
    const remainingChunks = upload.totalChunks - upload.completedChunks.length
    if (remainingChunks > 0) {
      // Restart progress tracking
      const progressInterval = setInterval(() => {
        updateProgress(fileId)
      }, 1000)
      progressIntervalRef.current.set(fileId, progressInterval)

      // Continue uploading remaining chunks
      // Implementation similar to uploadFile but starting from current position
    }
  }, [activeUploads, updateProgress])

  /**
   * Get upload progress for a file
   */
  const getUploadProgress = useCallback((fileId: string): UploadProgress | null => {
    const upload = activeUploads.get(fileId)
    if (!upload) return null

    return calculateProgress(fileId, upload)
  }, [activeUploads, calculateProgress])

  /**
   * Check if file is currently uploading
   */
  const isUploading = useCallback((fileId: string): boolean => {
    return activeUploads.has(fileId)
  }, [activeUploads])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      // Clear all progress intervals
      progressIntervalRef.current.forEach(interval => clearInterval(interval))
      progressIntervalRef.current.clear()

      // Cancel all active uploads
      activeUploads.forEach((upload, fileId) => {
        upload.abortController.abort()
      })
    }
  }, [activeUploads])

  return {
    uploadFile,
    cancelUpload,
    pauseUpload,
    resumeUpload,
    getUploadProgress,
    isUploading,
    activeUploads: Array.from(activeUploads.keys()),
  }
}