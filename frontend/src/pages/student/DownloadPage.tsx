/**
 * Download Page Component
 *
 * Secure file download interface for students with progress tracking,
 * preview capabilities, and mobile optimization.
 */

import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Download,
  Eye,
  FileVideo,
  PlayCircle,
  Pause,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { useQuery } from 'react-query'

import { apiService, downloadFileWithProgress } from '@/services/api'
import { formatFileSize, formatRelativeTime, formatProgress, formatSpeed, formatETA } from '@/utils/format'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { cn } from '@/utils/cn'
import type { FileInfo, DownloadProgress } from '@/types'

interface DownloadState {
  downloads: Map<string, DownloadProgress>
}

export const DownloadPage: React.FC = () => {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [downloadState, setDownloadState] = useState<DownloadState>({
    downloads: new Map(),
  })

  // Fetch session data
  const { data: sessionData, isLoading: sessionLoading } = useQuery(
    ['session', sessionId],
    () => sessionId ? apiService.sessions.getById(sessionId) : null,
    {
      enabled: !!sessionId,
    }
  )

  // Fetch session files
  const { data: filesData, isLoading: filesLoading } = useQuery(
    ['session-files', sessionId],
    () => sessionId ? apiService.files.getSessionFiles(sessionId) : null,
    {
      enabled: !!sessionId,
    }
  )

  const session = sessionData?.data
  const files = filesData?.data || []

  // Update download progress
  const updateDownloadProgress = (fileId: string, progress: Partial<DownloadProgress>) => {
    setDownloadState(prev => {
      const newMap = new Map(prev.downloads)
      const existing = newMap.get(fileId)
      if (existing) {
        newMap.set(fileId, { ...existing, ...progress })
      }
      return { ...prev, downloads: newMap }
    })
  }

  // Start file download
  const handleDownload = async (file: FileInfo) => {
    if (!sessionId) return

    try {
      // Check if already downloading
      if (downloadState.downloads.has(file.id)) {
        toast.error('File is already being downloaded')
        return
      }

      // Get download URL
      const response = await apiService.files.getDownloadUrl(sessionId, file.id)
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get download URL')
      }

      const { downloadUrl, fileName, fileSize } = response.data

      // Initialize download progress
      const initialProgress: DownloadProgress = {
        fileId: file.id,
        fileName,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: fileSize,
        speed: 0,
        eta: 0,
        status: 'pending',
      }

      setDownloadState(prev => ({
        ...prev,
        downloads: new Map(prev.downloads.set(file.id, initialProgress)),
      }))

      // Start download with progress tracking
      await downloadFileWithProgress(
        downloadUrl,
        fileName,
        (progress) => {
          const downloadedBytes = (progress / 100) * fileSize
          const speed = downloadedBytes / ((Date.now() - Date.now()) / 1000) // Simplified speed calculation
          const eta = speed > 0 ? (fileSize - downloadedBytes) / speed : 0

          updateDownloadProgress(file.id, {
            progress,
            downloadedBytes,
            speed,
            eta,
            status: progress === 100 ? 'completed' : 'downloading',
          })
        }
      )

      // Download completed
      updateDownloadProgress(file.id, { status: 'completed' })
      toast.success(`Download completed: ${fileName}`)

      // Remove from downloads after a delay
      setTimeout(() => {
        setDownloadState(prev => {
          const newMap = new Map(prev.downloads)
          newMap.delete(file.id)
          return { ...prev, downloads: newMap }
        })
      }, 3000)

    } catch (error: any) {
      updateDownloadProgress(file.id, {
        status: 'error',
        error: error.message || 'Download failed',
      })
      toast.error(error.message || 'Download failed')
    }
  }

  // Cancel download
  const handleCancelDownload = (fileId: string) => {
    setDownloadState(prev => {
      const newMap = new Map(prev.downloads)
      newMap.delete(fileId)
      return { ...prev, downloads: newMap }
    })
    toast('Download cancelled')
  }

  if (sessionLoading || filesLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingSpinner size="lg" message="Loading session..." />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-error-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Not Found</h2>
          <p className="text-gray-600 mb-6">
            The training session you're looking for doesn't exist or you don't have access to it.
          </p>
          <button
            onClick={() => navigate('/student')}
            className="btn btn-primary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={() => navigate('/student')}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{session.title}</h1>
            <p className="text-gray-600">
              {session.description || 'Training session materials'}
            </p>
          </div>
        </div>

        {/* Session Info */}
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center text-primary-700">
              <FileVideo className="h-4 w-4 mr-1" />
              {files.length} {files.length === 1 ? 'file' : 'files'}
            </span>
            <span className="flex items-center text-primary-700">
              <Download className="h-4 w-4 mr-1" />
              {formatFileSize(session.totalSize)}
            </span>
            <span className="text-primary-600">
              Trainer: {session.trainerName}
            </span>
            <span className="text-primary-600">
              Updated {formatRelativeTime(session.updatedAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Active Downloads */}
      <AnimatePresence>
        {downloadState.downloads.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8"
          >
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Active Downloads</h3>
              </div>
              <div className="card-body space-y-4">
                {Array.from(downloadState.downloads.values()).map((download) => (
                  <DownloadProgressCard
                    key={download.fileId}
                    download={download}
                    onCancel={handleCancelDownload}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Files List */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Available Files</h2>
        </div>
        <div className="card-body">
          {files.length > 0 ? (
            <div className="space-y-4">
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  isDownloading={downloadState.downloads.has(file.id)}
                  onDownload={() => handleDownload(file)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileVideo className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No files available</h3>
              <p className="text-gray-500">
                This session doesn't have any files available for download yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Individual file card component
 */
interface FileCardProps {
  file: FileInfo
  isDownloading: boolean
  onDownload: () => void
}

const FileCard: React.FC<FileCardProps> = ({ file, isDownloading, onDownload }) => {
  const isVideo = file.mimeType.startsWith('video/')

  return (
    <div className="border border-gray-200 rounded-lg p-6 hover:border-primary-300 hover:bg-primary-50 transition-all">
      <div className="flex items-start space-x-4">
        {/* File icon/thumbnail */}
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
            {isVideo ? (
              <PlayCircle className="h-8 w-8 text-primary-600" />
            ) : (
              <FileVideo className="h-8 w-8 text-primary-600" />
            )}
          </div>
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium text-gray-900 truncate mb-1">
            {file.originalName}
          </h3>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-3">
            <span>{formatFileSize(file.fileSize)}</span>
            <span>Uploaded {formatRelativeTime(file.uploadedAt)}</span>
            {file.downloadCount > 0 && (
              <span>{file.downloadCount} downloads</span>
            )}
          </div>

          {/* File metadata */}
          {file.metadata && (
            <div className="flex flex-wrap gap-4 text-xs text-gray-400">
              {file.metadata.duration && (
                <span>Duration: {Math.round(file.metadata.duration)}s</span>
              )}
              {file.metadata.resolution && (
                <span>Resolution: {file.metadata.resolution}</span>
              )}
              {file.metadata.codec && (
                <span>Codec: {file.metadata.codec}</span>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex-shrink-0 flex items-center space-x-2">
          {isVideo && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => toast('Video preview coming soon')}
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </button>
          )}

          <button
            onClick={onDownload}
            disabled={isDownloading || file.status !== 'ready'}
            className="btn btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <>
                <LoadingSpinner size="sm" className="mr-1" />
                Downloading
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-1" />
                Download
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Download progress card component
 */
interface DownloadProgressCardProps {
  download: DownloadProgress
  onCancel: (fileId: string) => void
}

const DownloadProgressCard: React.FC<DownloadProgressCardProps> = ({
  download,
  onCancel,
}) => {
  const isCompleted = download.status === 'completed'
  const isError = download.status === 'error'

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-gray-900 truncate">{download.fileName}</h4>
        <div className="flex items-center space-x-2">
          {isCompleted && <CheckCircle className="h-5 w-5 text-success-600" />}
          {isError && <AlertCircle className="h-5 w-5 text-error-600" />}
          {!isCompleted && !isError && (
            <button
              onClick={() => onCancel(download.fileId)}
              className="text-gray-400 hover:text-error-600 transition-colors"
            >
              <Pause className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>
            {isError
              ? 'Download failed'
              : isCompleted
                ? 'Download complete'
                : formatProgress(download.downloadedBytes, download.totalBytes)
            }
          </span>
          {download.status === 'downloading' && (
            <span>
              {formatSpeed(download.speed)} • {formatETA(download.eta)}
            </span>
          )}
        </div>

        <div className="progress-bar">
          <div
            className={cn(
              'progress-fill transition-all duration-300',
              isError && 'bg-error-600',
              isCompleted && 'bg-success-600'
            )}
            style={{ width: `${download.progress}%` }}
          />
        </div>
      </div>

      {isError && download.error && (
        <p className="text-sm text-error-600">{download.error}</p>
      )}
    </div>
  )
}