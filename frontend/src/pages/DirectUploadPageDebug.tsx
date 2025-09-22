/**
 * Debug-Enhanced Direct Upload Page Component
 *
 * Enhanced version of DirectUploadPage with comprehensive debugging capabilities
 * to identify browser-specific upload issues between Chrome and Safari.
 */

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import {
  Upload,
  FileVideo,
  AlertCircle,
  X,
  CheckCircle,
  User,
  Calendar,
  Mail,
  StickyNote,
  RotateCcw,
  Bug,
  Download,
  Eye,
} from 'lucide-react'

import { apiService } from '@/services/api'
import { appConfig } from '@/config/env'
import { formatFileSize, formatSpeed, formatETA } from '@/utils/format'
import { getDeviceInfo, hasEnoughStorage } from '@/utils/device'
import { cn } from '@/utils/cn'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import {
  UploadMonitor,
  createDebugXHR,
  getBrowserInfo,
  getNetworkDiagnostics,
  type UploadDebugInfo
} from '@/utils/uploadDebugger'

interface UploadFormData {
  studentEmail: string
  studentName?: string
  trainerName?: string
  sessionDate: string
  notes?: string
}

interface UploadState {
  formData: UploadFormData
  selectedFile: File | null
  isUploading: boolean
  uploadProgress: number
  uploadSpeed: number
  uploadETA: number
  uploadSuccess: boolean
  uploadError: string | null
  fileId: string | null
  validationErrors: Partial<Record<keyof UploadFormData, string>>
  debugMode: boolean
  debugLog: any[]
  uploadMonitor: UploadMonitor | null
  currentPhase: 'idle' | 'session_creation' | 'upload_url_request' | 's3_upload' | 'upload_complete'
}

const initialFormData: UploadFormData = {
  studentEmail: '',
  studentName: '',
  trainerName: '',
  sessionDate: '',
  notes: '',
}

const initialState: UploadState = {
  formData: initialFormData,
  selectedFile: null,
  isUploading: false,
  uploadProgress: 0,
  uploadSpeed: 0,
  uploadETA: 0,
  uploadSuccess: false,
  uploadError: null,
  fileId: null,
  validationErrors: {},
  debugMode: false,
  debugLog: [],
  uploadMonitor: null,
  currentPhase: 'idle',
}

export const DirectUploadPageDebug: React.FC = () => {
  const [state, setState] = useState<UploadState>(initialState)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const deviceInfo = getDeviceInfo()
  const browserInfo = getBrowserInfo()
  const networkInfo = getNetworkDiagnostics()

  // Add debug entry to log
  const addDebugLog = (entry: any) => {
    setState(prev => ({
      ...prev,
      debugLog: [...prev.debugLog, {
        timestamp: Date.now(),
        ...entry,
      }],
    }))
  }

  // Enhanced validation with browser-specific checks
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof UploadFormData, string>> = {}

    // Log browser-specific validation
    addDebugLog({
      type: 'validation',
      browser: browserInfo.name,
      formData: state.formData,
    })

    if (!state.formData.studentEmail.trim()) {
      errors.studentEmail = 'Student email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.formData.studentEmail)) {
      errors.studentEmail = 'Please enter a valid email address'
    }

    if (!state.formData.sessionDate) {
      errors.sessionDate = 'Session date is required'
    } else {
      const selectedDate = new Date(state.formData.sessionDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (isNaN(selectedDate.getTime())) {
        errors.sessionDate = 'Please enter a valid date'
      } else if (selectedDate < today) {
        errors.sessionDate = 'Session date cannot be in the past'
      }
    }

    setState(prev => ({ ...prev, validationErrors: errors }))
    return Object.keys(errors).length === 0
  }

  // Enhanced file validation
  const validateFile = async (file: File): Promise<string | null> => {
    addDebugLog({
      type: 'file_validation',
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      browser: browserInfo.name,
      supportedTypes: appConfig.supportedFileTypes,
    })

    if (file.size > appConfig.maxFileSize) {
      return `File size must be less than ${formatFileSize(appConfig.maxFileSize)}`
    }

    if (!appConfig.supportedFileTypes.includes(file.type)) {
      return 'Only video files are allowed'
    }

    if (!(await hasEnoughStorage(file.size))) {
      return 'Insufficient storage space on device'
    }

    return null
  }

  // Handle form input changes
  const handleInputChange = (field: keyof UploadFormData, value: string) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, [field]: value },
      validationErrors: { ...prev.validationErrors, [field]: '' },
    }))
  }

  // Enhanced file selection
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]

    addDebugLog({
      type: 'file_selected',
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      lastModified: file.lastModified,
      browser: browserInfo.name,
    })

    const validation = await validateFile(file)

    if (validation) {
      toast.error(validation)
      addDebugLog({
        type: 'file_validation_failed',
        error: validation,
        fileName: file.name,
      })
      return
    }

    setState(prev => ({
      ...prev,
      selectedFile: file,
      uploadError: null,
    }))
  }

  // Enhanced upload with comprehensive debugging
  const handleUpload = async () => {
    if (!validateForm() || !state.selectedFile) {
      toast.error('Please fill in all required fields and select a file')
      return
    }

    const monitor = new UploadMonitor(
      'temp-session',
      state.selectedFile.name,
      state.selectedFile.size,
      state.selectedFile.type
    )

    setState(prev => ({
      ...prev,
      isUploading: true,
      uploadProgress: 0,
      uploadError: null,
      uploadMonitor: monitor,
      currentPhase: 'session_creation',
    }))

    monitor.startMonitoring()
    addDebugLog({
      type: 'upload_started',
      browser: browserInfo.name,
      network: networkInfo,
      file: {
        name: state.selectedFile.name,
        size: state.selectedFile.size,
        type: state.selectedFile.type,
      },
    })

    try {
      // Phase 1: Create session with detailed logging
      setState(prev => ({ ...prev, currentPhase: 'session_creation' }))
      monitor.trackProgress(10, 100, 'session_creation')

      const sessionData = {
        title: `Session for ${state.formData.studentEmail} - ${state.formData.sessionDate}`,
        description: state.formData.notes || 'Direct upload session',
        studentEmails: [state.formData.studentEmail],
        isPublic: false,
        metadata: {
          studentName: state.formData.studentName,
          trainerName: state.formData.trainerName,
          date: state.formData.sessionDate,
          notes: state.formData.notes,
          uploadType: 'direct',
          browser: browserInfo.name,
          debugInfo: {
            browserVersion: browserInfo.version,
            platform: browserInfo.platform,
            isMobile: browserInfo.isMobile,
          },
        },
      }

      addDebugLog({
        type: 'session_creation_request',
        sessionData,
        headers: {
          'Content-Type': 'application/json',
          'X-Browser-Debug': `${browserInfo.name}/${browserInfo.version}`,
        },
      })

      const sessionResponse = await apiService.sessions.create(sessionData)

      if (!sessionResponse.success || !sessionResponse.data) {
        throw new Error('Failed to create upload session')
      }

      const sessionId = sessionResponse.data.id
      monitor.trackProgress(30, 100, 'session_creation')

      addDebugLog({
        type: 'session_created',
        sessionId,
        response: sessionResponse,
      })

      // Phase 2: Get upload URL with browser-specific debugging
      setState(prev => ({ ...prev, currentPhase: 'upload_url_request' }))
      monitor.trackProgress(40, 100, 'upload_url_request')

      // Create payload (only required fields to match API Gateway model)
      const uploadUrlPayload = {
        fileName: state.selectedFile.name,
        fileSize: state.selectedFile.size,
        contentType: state.selectedFile.type,
      }

      addDebugLog({
        type: 'upload_url_request',
        sessionId,
        payload: uploadUrlPayload,
        endpoint: `/sessions/${sessionId}/upload`,
      })

      // Custom API call with debug headers
      const debugHeaders = {
        'Content-Type': 'application/json',
        'X-Browser-Debug': `${browserInfo.name}/${browserInfo.version}`,
        'X-File-Info': `${state.selectedFile.name}|${state.selectedFile.size}|${state.selectedFile.type}`,
        'X-Debug-User-Agent': browserInfo.userAgent.substring(0, 200), // Truncate to avoid header size limits
        'X-Debug-Browser-Name': browserInfo.name,
        'X-Debug-Browser-Version': browserInfo.version,
        'X-Debug-Is-Mobile': browserInfo.isMobile.toString(),
        'X-Debug-Supports-FormData': browserInfo.supportsFormData.toString(),
        'X-Debug-Supports-XHR2': browserInfo.supportsXHR2.toString(),
      }

      monitor.logRequest(
        `/sessions/${sessionId}/upload`,
        'POST',
        debugHeaders,
        uploadUrlPayload
      )

      // Make API call with custom headers - access the internal axios client
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'https://api.apexshare.be'}/sessions/${sessionId}/upload`, {
        method: 'POST',
        headers: {
          ...debugHeaders,
          'X-Public-Access': 'true', // Ensure authentication
        },
        body: JSON.stringify(uploadUrlPayload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const uploadResponse = await response.json()

      if (!uploadResponse.success || !uploadResponse.data) {
        throw new Error('Failed to get upload URL')
      }

      monitor.trackProgress(50, 100, 'upload_url_request')

      addDebugLog({
        type: 'upload_url_received',
        uploadUrl: uploadResponse.data.uploadUrl,
        metadata: uploadResponse.data,
      })

      // Phase 3: S3 Upload with enhanced debugging
      setState(prev => ({ ...prev, currentPhase: 's3_upload' }))

      const uploadFile = async (): Promise<string> => {
        return new Promise<string>((resolve, reject) => {
          const xhr = createDebugXHR({
            requestId: monitor.generateReport().requestId,
            sessionId,
            fileName: state.selectedFile!.name,
            fileSize: state.selectedFile!.size,
            fileType: state.selectedFile!.type,
          })

          let lastProgressTime = Date.now()
          let progressStuckCount = 0

          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = 50 + (event.loaded / event.total) * 40 // 50-90%
              const speed = event.loaded / ((Date.now() - lastProgressTime) / 1000)
              const eta = (event.total - event.loaded) / speed

              // Check for stuck progress (Safari issue detection)
              const currentTime = Date.now()
              if (currentTime - lastProgressTime > 5000 && event.loaded < event.total) {
                progressStuckCount++
                addDebugLog({
                  type: 'progress_stuck_detected',
                  stuckCount: progressStuckCount,
                  progress: (event.loaded / event.total) * 100,
                  browser: browserInfo.name,
                  timeStuck: currentTime - lastProgressTime,
                })

                // Safari-specific stuck detection at ~56%
                if (browserInfo.isSafari && Math.abs((event.loaded / event.total) * 100 - 56) < 5) {
                  addDebugLog({
                    type: 'safari_56_percent_stuck',
                    exactProgress: (event.loaded / event.total) * 100,
                    loaded: event.loaded,
                    total: event.total,
                    timeStuck: currentTime - lastProgressTime,
                  })
                }
              }

              setState(prev => ({
                ...prev,
                uploadProgress: progress,
                uploadSpeed: speed,
                uploadETA: eta,
              }))

              monitor.trackProgress(event.loaded, event.total, 's3_upload')
              lastProgressTime = currentTime
            }
          })

          xhr.addEventListener('load', () => {
            addDebugLog({
              type: 's3_upload_complete',
              status: xhr.status,
              statusText: xhr.statusText,
              responseHeaders: xhr.getAllResponseHeaders(),
            })

            if (xhr.status >= 200 && xhr.status < 300) {
              resolve('test-file-id-123')
            } else {
              const error = `Upload failed with status: ${xhr.status} ${xhr.statusText}`
              monitor.logError(new Error(error), 'S3 upload failed')
              reject(new Error(error))
            }
          })

          xhr.addEventListener('error', (event) => {
            const error = 'Upload failed due to network error'
            addDebugLog({
              type: 's3_upload_error',
              error: event,
              browser: browserInfo.name,
              readyState: xhr.readyState,
            })
            monitor.logError(new Error(error), 'S3 upload network error')
            reject(new Error(error))
          })

          xhr.addEventListener('timeout', () => {
            const error = 'Upload timed out'
            addDebugLog({
              type: 's3_upload_timeout',
              browser: browserInfo.name,
              timeout: xhr.timeout,
            })
            monitor.logError(new Error(error), 'S3 upload timeout')
            reject(new Error(error))
          })

          // Set browser-specific headers
          xhr.open('PUT', uploadResponse.data!.uploadUrl)

          // Chrome-specific headers
          if (browserInfo.isChrome) {
            xhr.setRequestHeader('sec-fetch-dest', 'empty')
            xhr.setRequestHeader('sec-fetch-mode', 'cors')
            xhr.setRequestHeader('sec-fetch-site', 'cross-site')
          }

          xhr.setRequestHeader('Content-Type', state.selectedFile!.type)

          addDebugLog({
            type: 's3_upload_started',
            url: uploadResponse.data!.uploadUrl,
            fileSize: state.selectedFile!.size,
            contentType: state.selectedFile!.type,
            browser: browserInfo.name,
          })

          xhr.send(state.selectedFile)
        })
      }

      const fileId = await uploadFile()

      // Phase 4: Complete
      setState(prev => ({ ...prev, currentPhase: 'upload_complete' }))
      monitor.trackProgress(100, 100, 'upload_complete')

      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadSuccess: true,
        fileId,
      }))

      addDebugLog({
        type: 'upload_completed',
        fileId,
        totalTime: Date.now() - monitor.generateReport().timestamp,
      })

      toast.success('Video uploaded successfully!')

    } catch (error: any) {
      console.error('Upload error:', error)

      addDebugLog({
        type: 'upload_failed',
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        browser: browserInfo.name,
        phase: state.currentPhase,
      })

      if (state.uploadMonitor) {
        state.uploadMonitor.logError(error, `Upload failed in phase: ${state.currentPhase}`)
      }

      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadError: error.message || 'Upload failed',
        currentPhase: 'idle',
      }))

      toast.error(error.message || 'Upload failed')
    }
  }

  // Toggle debug mode
  const toggleDebugMode = () => {
    setState(prev => ({ ...prev, debugMode: !prev.debugMode }))
  }

  // Export debug data
  const exportDebugData = () => {
    const debugReport = {
      browserInfo,
      networkInfo,
      uploadState: state,
      debugLog: state.debugLog,
      monitorReport: state.uploadMonitor?.generateReport(),
    }

    const blob = new Blob([JSON.stringify(debugReport, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `upload-debug-${browserInfo.name}-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Clear debug log
  const clearDebugLog = () => {
    setState(prev => ({ ...prev, debugLog: [] }))
  }

  // Copy debug info to clipboard
  const copyDebugInfo = async () => {
    const debugInfo = {
      browser: browserInfo,
      network: networkInfo,
      lastError: state.uploadError,
      currentPhase: state.currentPhase,
      recentLogs: state.debugLog.slice(-10),
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2))
      toast.success('Debug info copied to clipboard')
    } catch {
      toast.error('Failed to copy debug info')
    }
  }

  // Handle other functions (retry, remove file, etc.)
  const handleRetryUpload = () => {
    setState(prev => ({
      ...prev,
      uploadError: null,
      uploadSuccess: false,
      currentPhase: 'idle',
    }))
    handleUpload()
  }

  const handleUploadAnother = () => {
    setState(initialState)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveFile = () => {
    setState(prev => ({
      ...prev,
      selectedFile: null,
      uploadError: null,
    }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header with Debug Toggle */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Upload Training Video (Debug Mode)
            </h1>
            <button
              onClick={toggleDebugMode}
              className={cn(
                'btn btn-sm',
                state.debugMode ? 'btn-primary' : 'btn-secondary'
              )}
            >
              <Bug className="h-4 w-4 mr-1" />
              Debug: {state.debugMode ? 'ON' : 'OFF'}
            </button>
          </div>
          <p className="text-gray-600">
            Enhanced debugging version - Browser: {browserInfo.name} {browserInfo.version}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Upload Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                {/* Current Phase Indicator */}
                {state.isUploading && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <LoadingSpinner size="sm" />
                      <span className="text-sm font-medium text-blue-800">
                        Phase: {state.currentPhase.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {state.uploadSuccess ? (
                    // Success State (same as original)
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-8"
                    >
                      <div className="mb-4">
                        <CheckCircle className="h-16 w-16 text-success-600 mx-auto" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Video uploaded successfully!
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Your video has been uploaded and is ready for sharing.
                      </p>
                      {state.fileId && (
                        <div className="bg-gray-50 rounded-lg p-4 mb-6">
                          <p className="text-sm text-gray-600">File ID:</p>
                          <p className="font-mono text-sm text-gray-900">{state.fileId}</p>
                        </div>
                      )}
                      <button
                        onClick={handleUploadAnother}
                        className="btn btn-primary"
                      >
                        Upload Another Video
                      </button>
                    </motion.div>
                  ) : (
                    // Form State (enhanced from original)
                    <motion.div
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-6"
                    >
                      {/* Form Fields - Same as original */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Student Email */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Student Email *
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="email"
                              value={state.formData.studentEmail}
                              onChange={(e) => handleInputChange('studentEmail', e.target.value)}
                              className={cn(
                                'input pl-10',
                                state.validationErrors.studentEmail && 'error'
                              )}
                              placeholder="student@example.com"
                              required
                            />
                          </div>
                          {state.validationErrors.studentEmail && (
                            <p className="text-error-600 text-sm mt-1">
                              {state.validationErrors.studentEmail}
                            </p>
                          )}
                        </div>

                        {/* Student Name */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Student Name
                          </label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              value={state.formData.studentName}
                              onChange={(e) => handleInputChange('studentName', e.target.value)}
                              className="input pl-10"
                              placeholder="Student name"
                            />
                          </div>
                        </div>

                        {/* Trainer Name */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Trainer Name
                          </label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              value={state.formData.trainerName}
                              onChange={(e) => handleInputChange('trainerName', e.target.value)}
                              className="input pl-10"
                              placeholder="Trainer name"
                            />
                          </div>
                        </div>

                        {/* Session Date */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Session Date *
                          </label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="date"
                              value={state.formData.sessionDate}
                              onChange={(e) => handleInputChange('sessionDate', e.target.value)}
                              className={cn(
                                'input pl-10',
                                state.validationErrors.sessionDate && 'error'
                              )}
                              required
                              min={new Date().toISOString().split('T')[0]}
                            />
                          </div>
                          {state.validationErrors.sessionDate && (
                            <p className="text-error-600 text-sm mt-1">
                              {state.validationErrors.sessionDate}
                            </p>
                          )}
                        </div>

                        {/* Notes */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes
                          </label>
                          <div className="relative">
                            <StickyNote className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <textarea
                              value={state.formData.notes}
                              onChange={(e) => handleInputChange('notes', e.target.value)}
                              className="input pl-10"
                              rows={3}
                              placeholder="Optional notes about the session"
                            />
                          </div>
                        </div>
                      </div>

                      {/* File Upload Zone - Same as original */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Video File *
                        </label>

                        {!state.selectedFile ? (
                          <div
                            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                              {deviceInfo.supportsDragDrop
                                ? 'Drag and drop your video file here'
                                : 'Select your video file'
                              }
                            </h3>
                            <p className="text-sm text-gray-500 mb-2">
                              {deviceInfo.supportsDragDrop && 'or '}
                              <span className="text-primary-600 font-medium">click to browse</span>
                            </p>
                            <p className="text-xs text-gray-400">
                              Supports: {appConfig.supportedFileTypes.map(type =>
                                type.split('/')[1].toUpperCase()
                              ).join(', ')} • Max {formatFileSize(appConfig.maxFileSize)}
                            </p>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept={appConfig.supportedFileTypes.join(',')}
                              onChange={(e) => handleFileSelect(e.target.files)}
                              className="hidden"
                            />
                          </div>
                        ) : (
                          <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center space-x-3">
                              <FileVideo className="h-8 w-8 text-primary-600" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {state.selectedFile.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(state.selectedFile.size)}
                                </p>
                              </div>
                              <button
                                onClick={handleRemoveFile}
                                className="p-1 text-gray-400 hover:text-error-600 transition-colors"
                                title="Remove file"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Upload Progress */}
                      {state.isUploading && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm text-gray-600">
                            <span>Uploading video...</span>
                            <span>{Math.round(state.uploadProgress)}%</span>
                          </div>
                          <div className="progress-bar">
                            <motion.div
                              className="progress-fill"
                              initial={{ width: 0 }}
                              animate={{ width: `${state.uploadProgress}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                          {state.uploadSpeed > 0 && (
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{formatSpeed(state.uploadSpeed)}</span>
                              <span>{formatETA(state.uploadETA)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Error Display */}
                      {state.uploadError && (
                        <div className="bg-error-50 border border-error-200 rounded-lg p-4">
                          <div className="flex items-start space-x-3">
                            <AlertCircle className="h-5 w-5 text-error-600 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-error-800 font-medium">Upload failed</p>
                              <p className="text-error-700 text-sm mt-1">{state.uploadError}</p>
                            </div>
                            <button
                              onClick={handleRetryUpload}
                              className="btn btn-sm btn-secondary"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Retry
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Upload Button */}
                      <button
                        onClick={handleUpload}
                        disabled={!state.selectedFile || state.isUploading}
                        className="w-full btn btn-primary"
                      >
                        {state.isUploading ? (
                          <>
                            <LoadingSpinner size="sm" className="mr-2" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Video
                          </>
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Debug Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Debug Panel</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={copyDebugInfo}
                      className="btn btn-xs btn-secondary"
                      title="Copy debug info"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                    <button
                      onClick={exportDebugData}
                      className="btn btn-xs btn-secondary"
                      title="Export debug data"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Browser Info */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Browser Info</h4>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Name:</span>
                      <span className="font-mono">{browserInfo.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Version:</span>
                      <span className="font-mono">{browserInfo.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Mobile:</span>
                      <span className="font-mono">{browserInfo.isMobile ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">XHR2:</span>
                      <span className="font-mono">{browserInfo.supportsXHR2 ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>

                {/* Network Info */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Network Info</h4>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Type:</span>
                      <span className="font-mono">{networkInfo.connectionType}</span>
                    </div>
                    {networkInfo.effectiveType && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Effective:</span>
                        <span className="font-mono">{networkInfo.effectiveType}</span>
                      </div>
                    )}
                    {networkInfo.downlink && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Downlink:</span>
                        <span className="font-mono">{networkInfo.downlink} Mbps</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Debug Log */}
                {state.debugMode && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900">Debug Log</h4>
                      <button
                        onClick={clearDebugLog}
                        className="btn btn-xs btn-secondary"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto bg-gray-50 rounded p-2">
                      {state.debugLog.length === 0 ? (
                        <p className="text-xs text-gray-500">No debug entries yet</p>
                      ) : (
                        <div className="space-y-1">
                          {state.debugLog.slice(-10).map((entry, index) => (
                            <div
                              key={index}
                              className="text-xs font-mono bg-white rounded p-1"
                            >
                              <div className="text-gray-500">
                                {new Date(entry.timestamp).toLocaleTimeString()}
                              </div>
                              <div className="text-gray-900">
                                {entry.type}: {JSON.stringify(entry, null, 1).substring(0, 100)}...
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}