/**
 * File Upload Zone Component
 *
 * Advanced drag-and-drop file upload component with chunked uploads,
 * progress tracking, and comprehensive error handling. Optimized for
 * large video files with mobile-friendly fallbacks.
 */

import React, { useCallback, useState, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload,
  FileVideo,
  AlertCircle,
  X,
  PlayCircle,
  Pause,
  RotateCcw,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'

import { appConfig } from '@/config/env'
import { getDeviceInfo, getOptimalChunkSize, hasEnoughStorage } from '@/utils/device'
import { formatFileSize, formatProgress, formatSpeed, formatETA } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { UploadProgress } from '@/types'

import { useFileUpload } from '@/hooks/useFileUpload'

interface FileUploadZoneProps {
  sessionId?: string
  onUploadStart?: (file: File) => void
  onUploadProgress?: (progress: UploadProgress) => void
  onUploadComplete?: (fileId: string, fileInfo: any) => void
  onUploadError?: (error: string, file: File) => void
  className?: string
  disabled?: boolean
  maxFiles?: number
  acceptedFileTypes?: string[]
}

interface FileWithProgress extends File {
  id: string
  progress: UploadProgress
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  sessionId,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  className,
  disabled = false,
  maxFiles = 10,
  acceptedFileTypes = appConfig.supportedFileTypes,
}) => {
  const [files, setFiles] = useState<FileWithProgress[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const deviceInfo = getDeviceInfo()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { uploadFile, cancelUpload } = useFileUpload({
    sessionId,
    onProgress: (fileId, progress) => {
      setFiles(prev => prev.map(file =>
        file.id === fileId ? { ...file, progress } : file
      ))
      onUploadProgress?.(progress)
    },
    onComplete: (fileId, fileInfo) => {
      setFiles(prev => prev.filter(file => file.id !== fileId))
      onUploadComplete?.(fileId, fileInfo)
      toast.success(`File uploaded successfully: ${fileInfo.fileName}`)
    },
    onError: (fileId, error) => {
      const file = files.find(f => f.id === fileId)
      if (file) {
        onUploadError?.(error, file)
        toast.error(`Upload failed: ${error}`)
      }
    },
  })

  // Validate file before upload
  const validateFile = async (file: File): Promise<string | null> => {
    // Check file size
    if (file.size > appConfig.maxFileSize) {
      return `File too large. Maximum size is ${formatFileSize(appConfig.maxFileSize)}`
    }

    // Check file type
    if (!acceptedFileTypes.includes(file.type)) {
      return `File type not supported. Accepted types: ${acceptedFileTypes.join(', ')}`
    }

    // Check storage quota
    if (!(await hasEnoughStorage(file.size))) {
      return 'Insufficient storage space on device'
    }

    return null
  }

  // Handle file selection
  const handleFiles = useCallback(async (selectedFiles: File[]) => {
    if (disabled) return

    // Check total file count
    if (files.length + selectedFiles.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`)
      return
    }

    for (const file of selectedFiles) {
      const validation = await validateFile(file)
      if (validation) {
        toast.error(validation)
        continue
      }

      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const fileWithProgress: FileWithProgress = {
        ...file,
        id: fileId,
        progress: {
          fileId,
          fileName: file.name,
          progress: 0,
          speed: 0,
          eta: 0,
          status: 'pending',
          uploadedBytes: 0,
          totalBytes: file.size,
          startTime: Date.now(),
        },
      }

      setFiles(prev => [...prev, fileWithProgress])
      onUploadStart?.(file)

      // Start upload
      uploadFile(file, fileId)
    }
  }, [disabled, files.length, maxFiles, uploadFile, onUploadStart])

  // Dropzone configuration
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    onDrop: handleFiles,
    accept: acceptedFileTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxFiles,
    disabled,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    onDropAccepted: () => setIsDragging(false),
    onDropRejected: () => setIsDragging(false),
  })

  // Handle manual file selection
  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  // Cancel upload
  const handleCancelUpload = (fileId: string) => {
    cancelUpload(fileId)
    setFiles(prev => prev.filter(file => file.id !== fileId))
  }

  // Retry upload
  const handleRetryUpload = (file: FileWithProgress) => {
    setFiles(prev => prev.map(f =>
      f.id === file.id
        ? { ...f, progress: { ...f.progress, status: 'pending', progress: 0 } }
        : f
    ))
    uploadFile(file, file.id)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200',
          'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          isDragActive && 'drag-active',
          isDragAccept && 'drag-accept',
          isDragReject && 'drag-reject',
          disabled && 'opacity-50 cursor-not-allowed',
          !isDragActive && 'border-gray-300'
        )}
      >
        <input {...getInputProps()} ref={fileInputRef} />

        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: isDragActive ? 1.05 : 1 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {/* Upload icon */}
          <div className="flex justify-center">
            <div className={cn(
              'p-4 rounded-full transition-colors',
              isDragActive ? 'bg-primary-100' : 'bg-gray-100'
            )}>
              <Upload className={cn(
                'h-12 w-12',
                isDragActive ? 'text-primary-600' : 'text-gray-400'
              )} />
            </div>
          </div>

          {/* Upload text */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-900">
              {isDragActive
                ? isDragAccept
                  ? 'Drop files here'
                  : 'Invalid file type'
                : deviceInfo.supportsDragDrop
                  ? 'Drag and drop files here'
                  : 'Select files to upload'
              }
            </h3>

            <p className="text-sm text-gray-500">
              {deviceInfo.supportsDragDrop && 'or '}
              <button
                type="button"
                className="text-primary-600 hover:text-primary-500 font-medium"
                onClick={handleFileSelect}
                disabled={disabled}
              >
                browse files
              </button>
            </p>

            <p className="text-xs text-gray-400">
              Supports: {acceptedFileTypes.map(type =>
                type.split('/')[1].toUpperCase()
              ).join(', ')} • Max {formatFileSize(appConfig.maxFileSize)} per file
            </p>
          </div>
        </motion.div>
      </div>

      {/* Upload Progress */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <h4 className="text-sm font-medium text-gray-900">
              Uploading {files.length} file{files.length > 1 ? 's' : ''}
            </h4>

            {files.map((file) => (
              <UploadProgressCard
                key={file.id}
                file={file}
                onCancel={handleCancelUpload}
                onRetry={handleRetryUpload}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Individual file upload progress card
 */
interface UploadProgressCardProps {
  file: FileWithProgress
  onCancel: (fileId: string) => void
  onRetry: (file: FileWithProgress) => void
}

const UploadProgressCard: React.FC<UploadProgressCardProps> = ({
  file,
  onCancel,
  onRetry,
}) => {
  const { progress } = file
  const isCompleted = progress.status === 'completed'
  const isError = progress.status === 'error'
  const isPaused = progress.status === 'paused'
  const isUploading = progress.status === 'uploading'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
    >
      <div className="flex items-start space-x-3">
        {/* File icon */}
        <div className="flex-shrink-0">
          <FileVideo className="h-8 w-8 text-primary-600" />
        </div>

        {/* File info and progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-gray-900 truncate">
              {file.name}
            </h5>
            <div className="flex items-center space-x-2">
              {/* Action buttons */}
              {isError && (
                <button
                  onClick={() => onRetry(file)}
                  className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                  title="Retry upload"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}

              {!isCompleted && (
                <button
                  onClick={() => onCancel(file.id)}
                  className="p-1 text-gray-400 hover:text-error-600 transition-colors"
                  title="Cancel upload"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-1">
            {formatFileSize(file.size)}
          </p>

          {/* Progress bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>
                {isError
                  ? 'Upload failed'
                  : isCompleted
                    ? 'Upload complete'
                    : isPaused
                      ? 'Upload paused'
                      : `${formatProgress(progress.uploadedBytes, progress.totalBytes)}`
                }
              </span>
              {isUploading && (
                <span>
                  {formatSpeed(progress.speed)} • {formatETA(progress.eta)}
                </span>
              )}
            </div>

            <div className="progress-bar">
              <motion.div
                className={cn(
                  'progress-fill',
                  isError && 'bg-error-600',
                  isCompleted && 'bg-success-600',
                  isPaused && 'bg-warning-600'
                )}
                initial={{ width: 0 }}
                animate={{ width: `${progress.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Error message */}
          {isError && progress.error && (
            <div className="mt-2 flex items-center space-x-1 text-error-600">
              <AlertCircle className="h-3 w-3" />
              <span className="text-xs">{progress.error}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}