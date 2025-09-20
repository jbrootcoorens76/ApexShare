/**
 * API service layer for ApexShare frontend
 *
 * Provides a centralized interface for all API interactions with proper
 * error handling, authentication, and request/response formatting.
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'
import { appConfig } from '@/config/env'
import type {
  ApiResponse,
  PaginatedResponse,
  TrainingSession,
  FileInfo,
  PresignedUploadUrl,
  DownloadInfo,
  User,
  CreateSessionForm,
  SessionAccessForm,
  AnalyticsEvent,
  UsageMetrics,
} from '@/types'

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: any,
    public requestId?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * API client configuration
 */
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: appConfig.apiBaseUrl,
    timeout: 30000, // 30 seconds
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // Request interceptor for adding authentication and logging
  client.interceptors.request.use(
    (config) => {
      // Add request ID for tracking
      config.headers['X-Request-ID'] = generateRequestId()

      // Add authentication token if available
      const token = getAuthToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }

      // Log request in development
      if (appConfig.enableDetailedLogging) {
        console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          headers: config.headers,
          data: config.data,
        })
      }

      return config
    },
    (error) => {
      console.error('❌ Request interceptor error:', error)
      return Promise.reject(error)
    }
  )

  // Response interceptor for error handling and logging
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      // Log response in development
      if (appConfig.enableDetailedLogging) {
        console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
          status: response.status,
          data: response.data,
        })
      }

      return response
    },
    (error: AxiosError) => {
      const apiError = handleApiError(error)

      // Log error
      console.error(`❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
        status: apiError.status,
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      })

      return Promise.reject(apiError)
    }
  )

  return client
}

/**
 * Handle and format API errors
 */
const handleApiError = (error: AxiosError): ApiError => {
  const response = error.response
  const request = error.request

  if (response) {
    // Server responded with error status
    const data = response.data as any
    return new ApiError(
      response.status,
      data?.error?.code || `HTTP_${response.status}`,
      data?.error?.message || data?.message || `Request failed with status ${response.status}`,
      data?.error?.details || data?.details,
      data?.requestId || response.headers['x-request-id']
    )
  } else if (request) {
    // Request was made but no response received
    return new ApiError(
      0,
      'NETWORK_ERROR',
      'Network error - please check your connection',
      { originalError: error.message }
    )
  } else {
    // Something else happened
    return new ApiError(
      0,
      'UNKNOWN_ERROR',
      error.message || 'An unknown error occurred',
      { originalError: error.message }
    )
  }
}

/**
 * Generate a unique request ID
 */
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get authentication token from storage
 */
const getAuthToken = (): string | null => {
  return localStorage.getItem('apexshare_auth_token')
}

/**
 * Set authentication token in storage
 */
export const setAuthToken = (token: string): void => {
  localStorage.setItem('apexshare_auth_token', token)
}

/**
 * Remove authentication token from storage
 */
export const removeAuthToken = (): void => {
  localStorage.removeItem('apexshare_auth_token')
}

// Create the API client instance
const apiClient = createApiClient()

/**
 * API service functions
 */
export const apiService = {
  // Authentication
  auth: {
    login: async (email: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> => {
      const response = await apiClient.post('/auth/login', { email, password })
      return response.data
    },

    logout: async (): Promise<ApiResponse> => {
      const response = await apiClient.post('/auth/logout')
      removeAuthToken()
      return response.data
    },

    getCurrentUser: async (): Promise<ApiResponse<User>> => {
      const response = await apiClient.get('/auth/me')
      return response.data
    },
  },

  // Training Sessions
  sessions: {
    getAll: async (params?: {
      page?: number
      limit?: number
      search?: string
      status?: string
    }): Promise<PaginatedResponse<TrainingSession>> => {
      const response = await apiClient.get('/sessions', { params })
      return response.data
    },

    getById: async (sessionId: string): Promise<ApiResponse<TrainingSession>> => {
      const response = await apiClient.get(`/sessions/${sessionId}`)
      return response.data
    },

    create: async (sessionData: CreateSessionForm): Promise<ApiResponse<TrainingSession>> => {
      const response = await apiClient.post('/sessions', sessionData)
      return response.data
    },

    update: async (sessionId: string, sessionData: Partial<CreateSessionForm>): Promise<ApiResponse<TrainingSession>> => {
      const response = await apiClient.put(`/sessions/${sessionId}`, sessionData)
      return response.data
    },

    delete: async (sessionId: string): Promise<ApiResponse> => {
      const response = await apiClient.delete(`/sessions/${sessionId}`)
      return response.data
    },

    getByAccessCode: async (accessData: SessionAccessForm): Promise<ApiResponse<TrainingSession>> => {
      const response = await apiClient.post('/sessions/access', accessData)
      return response.data
    },
  },

  // File Management
  files: {
    getSessionFiles: async (sessionId: string): Promise<ApiResponse<FileInfo[]>> => {
      const response = await apiClient.get(`/sessions/${sessionId}/files`)
      return response.data
    },

    getUploadUrl: async (sessionId: string, fileName: string, fileSize: number, mimeType: string): Promise<ApiResponse<PresignedUploadUrl>> => {
      const response = await apiClient.post(`/sessions/${sessionId}/upload`, {
        fileName,
        fileSize,
        mimeType,
      })
      return response.data
    },

    completeUpload: async (sessionId: string, uploadId: string, parts: Array<{ PartNumber: number; ETag: string }>): Promise<ApiResponse<FileInfo>> => {
      const response = await apiClient.post(`/sessions/${sessionId}/upload/${uploadId}/complete`, {
        parts,
      })
      return response.data
    },

    cancelUpload: async (sessionId: string, uploadId: string): Promise<ApiResponse> => {
      const response = await apiClient.delete(`/sessions/${sessionId}/upload/${uploadId}`)
      return response.data
    },

    getDownloadUrl: async (sessionId: string, fileId: string): Promise<ApiResponse<DownloadInfo>> => {
      const response = await apiClient.get(`/sessions/${sessionId}/files/${fileId}/download`)
      return response.data
    },

    deleteFile: async (sessionId: string, fileId: string): Promise<ApiResponse> => {
      const response = await apiClient.delete(`/sessions/${sessionId}/files/${fileId}`)
      return response.data
    },
  },

  // Analytics and Metrics
  analytics: {
    trackEvent: async (event: AnalyticsEvent): Promise<ApiResponse> => {
      const response = await apiClient.post('/analytics/events', event)
      return response.data
    },

    getUsageMetrics: async (period: string = '30d'): Promise<ApiResponse<UsageMetrics>> => {
      const response = await apiClient.get('/analytics/usage', { params: { period } })
      return response.data
    },
  },

  // Health and Status
  health: {
    check: async (): Promise<ApiResponse<{ status: string; timestamp: string; version: string }>> => {
      const response = await apiClient.get('/health')
      return response.data
    },
  },
}

/**
 * Upload a file chunk to S3 using presigned URL
 */
export const uploadFileChunk = async (
  presignedUrl: string,
  chunk: Blob,
  partNumber: number,
  onProgress?: (progress: number) => void
): Promise<{ etag: string; partNumber: number }> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = (event.loaded / event.total) * 100
        onProgress(progress)
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag')
        if (etag) {
          resolve({ etag, partNumber })
        } else {
          reject(new Error('No ETag returned from S3'))
        }
      } else {
        reject(new Error(`Upload failed with status: ${xhr.status}`))
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed due to network error'))
    })

    xhr.open('PUT', presignedUrl)
    xhr.setRequestHeader('Content-Type', chunk.type || 'application/octet-stream')
    xhr.send(chunk)
  })
}

/**
 * Download a file with progress tracking
 */
export const downloadFileWithProgress = async (
  downloadUrl: string,
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = (event.loaded / event.total) * 100
        onProgress(progress)
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Create download link
        const blob = new Blob([xhr.response])
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        resolve()
      } else {
        reject(new Error(`Download failed with status: ${xhr.status}`))
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Download failed due to network error'))
    })

    xhr.open('GET', downloadUrl)
    xhr.responseType = 'blob'
    xhr.send()
  })
}

export default apiService