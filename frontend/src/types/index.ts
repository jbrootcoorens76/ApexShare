/**
 * Core types for ApexShare frontend application
 */

// User types
export interface User {
  id: string
  email: string
  name: string
  role: 'trainer' | 'student'
  avatar?: string
  createdAt: string
  lastLoginAt?: string
}

// Session types
export interface TrainingSession {
  id: string
  title: string
  description?: string
  trainerId: string
  trainerName: string
  createdAt: string
  updatedAt: string
  status: 'draft' | 'active' | 'completed' | 'archived'
  studentEmails: string[]
  fileCount: number
  totalSize: number
  expiresAt?: string
  accessCode?: string
  isPublic: boolean
  metadata?: {
    location?: string
    date?: string
    notes?: string
  }
}

// File types
export interface FileInfo {
  id: string
  sessionId: string
  originalName: string
  fileName: string
  fileSize: number
  mimeType: string
  uploadedAt: string
  uploadedBy: string
  downloadCount: number
  lastDownloadAt?: string
  metadata?: {
    duration?: number
    resolution?: string
    codec?: string
    thumbnail?: string
  }
  status: 'uploading' | 'processing' | 'ready' | 'error'
  error?: string
}

// Upload types
export interface UploadProgress {
  fileId: string
  fileName: string
  progress: number
  speed: number
  eta: number
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error' | 'cancelled'
  error?: string
  uploadedBytes: number
  totalBytes: number
  startTime: number
  chunkIndex?: number
  totalChunks?: number
}

export interface PresignedUploadUrl {
  uploadId: string
  uploadUrl: string
  fileKey: string
  chunkSize: number
  maxChunks: number
  expiresAt: string
}

export interface ChunkUploadResult {
  chunkIndex: number
  etag: string
  success: boolean
  error?: string
}

// Download types
export interface DownloadInfo {
  fileId: string
  fileName: string
  downloadUrl: string
  expiresAt: string
  fileSize: number
  mimeType: string
}

export interface DownloadProgress {
  fileId: string
  fileName: string
  progress: number
  downloadedBytes: number
  totalBytes: number
  speed: number
  eta: number
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error'
  error?: string
}

// API types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  requestId?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Error types
export interface AppError {
  code: string
  message: string
  details?: any
  timestamp: string
  requestId?: string
}

// UI State types
export interface LoadingState {
  isLoading: boolean
  error?: string | null
  lastUpdated?: string
}

export interface NotificationState {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  actions?: Array<{
    label: string
    action: () => void
    style?: 'primary' | 'secondary'
  }>
  createdAt: string
}

// Form types
export interface CreateSessionForm {
  title: string
  description?: string
  studentEmails: string[]
  expiresAt?: string
  isPublic: boolean
  metadata?: {
    location?: string
    date?: string
    notes?: string
  }
}

export interface SessionAccessForm {
  sessionId?: string
  accessCode?: string
  email?: string
}

// Analytics types
export interface AnalyticsEvent {
  event: string
  properties?: Record<string, any>
  userId?: string
  sessionId?: string
  timestamp: string
}

export interface UsageMetrics {
  totalSessions: number
  totalFiles: number
  totalStorageUsed: number
  totalDownloads: number
  activeUsers: number
  period: string
}

// Device and browser detection
export interface DeviceInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  platform: string
  browser: string
  version: string
  supportsDragDrop: boolean
  supportsFileAPI: boolean
  supportsChunkedUpload: boolean
}

// Utility types
export type RequestStatus = 'idle' | 'loading' | 'success' | 'error'

export type SortOrder = 'asc' | 'desc'

export interface SortConfig<T = string> {
  field: T
  order: SortOrder
}

export interface FilterConfig {
  search?: string
  status?: string[]
  dateRange?: {
    start: string
    end: string
  }
  fileTypes?: string[]
}

// React Query types
export interface QueryConfig {
  enabled?: boolean
  staleTime?: number
  cacheTime?: number
  refetchOnWindowFocus?: boolean
  retry?: boolean | number
}

// Theme types (for future dark mode support)
export interface ThemeConfig {
  mode: 'light' | 'dark' | 'system'
  primaryColor: string
  accentColor: string
}

// Environment-specific types
export type Environment = 'development' | 'staging' | 'production'

// Route types
export interface RouteConfig {
  path: string
  element: React.ComponentType
  protected?: boolean
  roles?: User['role'][]
  title?: string
  description?: string
}