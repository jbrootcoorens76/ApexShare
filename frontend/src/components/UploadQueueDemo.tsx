/**
 * Upload Queue Manager Demo Component
 *
 * Demonstrates the capabilities and performance improvements of the Global Upload Queue Manager.
 * This component shows real-time metrics, queue status, and performance optimizations.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { uploadQueueManager } from '@/services/uploadQueueManager'
import { useFileUpload } from '@/hooks/useFileUpload'
import type { UploadProgress } from '@/types'

interface DemoFile {
  id: string
  file: File
  status: 'queued' | 'uploading' | 'completed' | 'error' | 'paused'
  progress?: UploadProgress
}

interface QueueMetrics {
  queueLength: number
  activeUploads: number
  completedUploads: number
  performanceMetrics: {
    totalUploads: number
    successfulUploads: number
    failedUploads: number
    averageSpeed: number
    totalBytesUploaded: number
  }
  networkMetrics: {
    effectiveType: string
    speed: number
    rtt: number
  }
  config: {
    maxConcurrentFiles: number
    maxConcurrentChunks: number
    priorityMode: string
    adaptiveOptimization: boolean
  }
}

const UploadQueueDemo: React.FC = () => {
  const [files, setFiles] = useState<DemoFile[]>([])
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null)
  const [isUsingQueueManager, setIsUsingQueueManager] = useState(true)
  const [sessionId] = useState('demo-session-123')

  // Initialize file upload hook
  const {
    uploadFile,
    cancelUpload,
    pauseUpload,
    resumeUpload,
    pauseAllUploads,
    resumeAllUploads,
    getQueueStatus,
    updateQueueConfig
  } = useFileUpload({
    sessionId,
    enableQueueManager: isUsingQueueManager,
    onProgress: handleUploadProgress,
    onComplete: handleUploadComplete,
    onError: handleUploadError,
  })

  // Event handlers
  function handleUploadProgress(fileId: string, progress: UploadProgress) {
    setFiles(prev => prev.map(file =>
      file.id === fileId
        ? { ...file, status: 'uploading', progress }
        : file
    ))
  }

  function handleUploadComplete(fileId: string, fileInfo: any) {
    setFiles(prev => prev.map(file =>
      file.id === fileId
        ? { ...file, status: 'completed', progress: { ...file.progress!, progress: 100 } }
        : file
    ))
  }

  function handleUploadError(fileId: string, error: string) {
    setFiles(prev => prev.map(file =>
      file.id === fileId
        ? { ...file, status: 'error' }
        : file
    ))
    console.error(`Upload error for ${fileId}:`, error)
  }

  // Update metrics periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (isUsingQueueManager) {
        const status = getQueueStatus()
        setMetrics(status as QueueMetrics)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isUsingQueueManager, getQueueStatus])

  // Generate test files
  const generateTestFiles = useCallback(() => {
    const testFiles = [
      { name: 'small-video-1.mp4', size: 5 * 1024 * 1024 },     // 5MB
      { name: 'small-video-2.mp4', size: 3 * 1024 * 1024 },     // 3MB
      { name: 'medium-video-1.mp4', size: 25 * 1024 * 1024 },   // 25MB
      { name: 'medium-video-2.mp4', size: 40 * 1024 * 1024 },   // 40MB
      { name: 'large-video-1.mp4', size: 100 * 1024 * 1024 },   // 100MB
      { name: 'large-video-2.mp4', size: 150 * 1024 * 1024 },   // 150MB
      { name: 'huge-video.mp4', size: 500 * 1024 * 1024 },      // 500MB
      { name: 'tiny-clip-1.mp4', size: 1024 * 1024 },           // 1MB
      { name: 'tiny-clip-2.mp4', size: 2 * 1024 * 1024 },       // 2MB
      { name: 'tiny-clip-3.mp4', size: 1.5 * 1024 * 1024 },     // 1.5MB
    ]

    const newFiles = testFiles.map(({ name, size }) => {
      const file = new File(['mock content'], name, { type: 'video/mp4' })
      Object.defineProperty(file, 'size', { value: size, writable: false })

      return {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        status: 'queued' as const,
      }
    })

    setFiles(newFiles)
  }, [])

  // Queue all files for upload
  const queueAllFiles = useCallback(async () => {
    for (const demoFile of files) {
      if (demoFile.status === 'queued') {
        await uploadFile(demoFile.file, demoFile.id)
      }
    }
  }, [files, uploadFile])

  // Configuration controls
  const updateConfiguration = useCallback((config: Partial<any>) => {
    if (isUsingQueueManager) {
      updateQueueConfig(config)
    }
  }, [isUsingQueueManager, updateQueueConfig])

  // Network simulation
  const simulateNetwork = useCallback((networkType: string) => {
    if (isUsingQueueManager) {
      const networkSettings = {
        'wifi': { maxConcurrentFiles: 5, maxConcurrentChunks: 8 },
        '4g': { maxConcurrentFiles: 3, maxConcurrentChunks: 4 },
        '3g': { maxConcurrentFiles: 2, maxConcurrentChunks: 2 },
        '2g': { maxConcurrentFiles: 1, maxConcurrentChunks: 1 },
      }

      const settings = networkSettings[networkType as keyof typeof networkSettings]
      if (settings) {
        updateConfiguration(settings)
      }
    }
  }, [isUsingQueueManager, updateConfiguration])

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // Format speed
  const formatSpeed = (bytesPerSecond: number): string => {
    return formatFileSize(bytesPerSecond) + '/s'
  }

  return (
    <div className="upload-queue-demo">
      <div className="demo-header">
        <h2>🚀 Upload Queue Manager Demo</h2>
        <div className="demo-controls">
          <label>
            <input
              type="checkbox"
              checked={isUsingQueueManager}
              onChange={(e) => setIsUsingQueueManager(e.target.checked)}
            />
            Use Queue Manager (vs Legacy)
          </label>
        </div>
      </div>

      {/* Control Panel */}
      <div className="control-panel">
        <div className="control-section">
          <h3>File Management</h3>
          <button onClick={generateTestFiles} className="btn btn-primary">
            Generate Test Files
          </button>
          <button onClick={queueAllFiles} className="btn btn-success">
            Queue All Files
          </button>
          <button onClick={() => setFiles([])} className="btn btn-warning">
            Clear All
          </button>
        </div>

        <div className="control-section">
          <h3>Upload Control</h3>
          <button onClick={pauseAllUploads} className="btn btn-warning">
            Pause All
          </button>
          <button onClick={resumeAllUploads} className="btn btn-success">
            Resume All
          </button>
          <button
            onClick={() => files.forEach(f => cancelUpload(f.id))}
            className="btn btn-danger"
          >
            Cancel All
          </button>
        </div>

        <div className="control-section">
          <h3>Network Simulation</h3>
          <button onClick={() => simulateNetwork('wifi')} className="btn btn-primary">
            WiFi
          </button>
          <button onClick={() => simulateNetwork('4g')} className="btn btn-primary">
            4G
          </button>
          <button onClick={() => simulateNetwork('3g')} className="btn btn-warning">
            3G
          </button>
          <button onClick={() => simulateNetwork('2g')} className="btn btn-danger">
            2G
          </button>
        </div>
      </div>

      {/* Metrics Dashboard */}
      {metrics && (
        <div className="metrics-dashboard">
          <h3>📊 Performance Metrics</h3>

          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-value">{metrics.queueLength}</div>
              <div className="metric-label">Queued</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{metrics.activeUploads}</div>
              <div className="metric-label">Active</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{metrics.completedUploads}</div>
              <div className="metric-label">Completed</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">
                {formatSpeed(metrics.performanceMetrics.averageSpeed)}
              </div>
              <div className="metric-label">Avg Speed</div>
            </div>
          </div>

          <div className="config-display">
            <h4>Current Configuration</h4>
            <div className="config-grid">
              <div>Max Files: {metrics.config.maxConcurrentFiles}</div>
              <div>Max Chunks: {metrics.config.maxConcurrentChunks}</div>
              <div>Priority: {metrics.config.priorityMode}</div>
              <div>Adaptive: {metrics.config.adaptiveOptimization ? 'ON' : 'OFF'}</div>
            </div>
          </div>

          <div className="network-display">
            <h4>Network Status</h4>
            <div className="network-info">
              <div>Type: {metrics.networkMetrics.effectiveType}</div>
              <div>Speed: {formatSpeed(metrics.networkMetrics.speed)}</div>
              <div>RTT: {metrics.networkMetrics.rtt}ms</div>
            </div>
          </div>
        </div>
      )}

      {/* File List */}
      <div className="file-list">
        <h3>📁 Upload Queue ({files.length} files)</h3>

        {files.length === 0 ? (
          <div className="empty-state">
            <p>No files in queue. Click "Generate Test Files" to start.</p>
          </div>
        ) : (
          <div className="file-items">
            {files.map((file) => (
              <div key={file.id} className={`file-item status-${file.status}`}>
                <div className="file-info">
                  <div className="file-name">{file.file.name}</div>
                  <div className="file-size">{formatFileSize(file.file.size)}</div>
                  {file.progress && (
                    <div className="file-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${file.progress.progress}%` }}
                        />
                      </div>
                      <div className="progress-info">
                        <span>{Math.round(file.progress.progress)}%</span>
                        {file.progress.speed > 0 && (
                          <span>{formatSpeed(file.progress.speed)}</span>
                        )}
                        {file.progress.eta > 0 && (
                          <span>ETA: {Math.round(file.progress.eta)}s</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="file-actions">
                  <span className={`status-badge status-${file.status}`}>
                    {file.status}
                  </span>

                  {file.status === 'uploading' && (
                    <button
                      onClick={() => pauseUpload(file.id)}
                      className="btn btn-sm btn-warning"
                    >
                      Pause
                    </button>
                  )}

                  {file.status === 'paused' && (
                    <button
                      onClick={() => resumeUpload(file.id)}
                      className="btn btn-sm btn-success"
                    >
                      Resume
                    </button>
                  )}

                  <button
                    onClick={() => cancelUpload(file.id)}
                    className="btn btn-sm btn-danger"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance Comparison */}
      <div className="performance-comparison">
        <h3>⚡ Performance Benefits</h3>

        <div className="benefits-grid">
          <div className="benefit-card">
            <h4>🎯 Smart Prioritization</h4>
            <p>Smallest files complete first for better user experience</p>
          </div>

          <div className="benefit-card">
            <h4>🌐 Network Awareness</h4>
            <p>Automatic adaptation to connection speed and type</p>
          </div>

          <div className="benefit-card">
            <h4>🔄 Adaptive Concurrency</h4>
            <p>Dynamic adjustment based on real-time performance</p>
          </div>

          <div className="benefit-card">
            <h4>📈 Performance Monitoring</h4>
            <p>Real-time metrics and optimization feedback</p>
          </div>

          <div className="benefit-card">
            <h4>🔧 Error Recovery</h4>
            <p>Intelligent retry with exponential backoff</p>
          </div>

          <div className="benefit-card">
            <h4>⚡ Bandwidth Optimization</h4>
            <p>Efficient use of available network capacity</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UploadQueueDemo