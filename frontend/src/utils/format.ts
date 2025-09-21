/**
 * Formatting utilities for ApexShare frontend
 *
 * Provides consistent formatting for file sizes, dates, durations,
 * and other common data types throughout the application.
 */

/**
 * Format file size in human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0 || !isFinite(bytes) || isNaN(bytes)) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  if (i >= sizes.length) return '0 B'

  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(1))
  if (!isFinite(size) || isNaN(size)) return '0 B'

  return `${size} ${sizes[i]}`
}

/**
 * Format transfer speed in human-readable format
 */
export const formatSpeed = (bytesPerSecond: number): string => {
  if (!bytesPerSecond || bytesPerSecond === 0 || !isFinite(bytesPerSecond) || isNaN(bytesPerSecond)) return '0 B/s'

  const k = 1024
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))

  if (i >= sizes.length) return '0 B/s'

  const speed = parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1))
  if (!isFinite(speed) || isNaN(speed)) return '0 B/s'

  return `${speed} ${sizes[i]}`
}

/**
 * Format duration in human-readable format
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  } else {
    const hours = Math.floor(seconds / 3600)
    const remainingMinutes = Math.floor((seconds % 3600) / 60)
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }
}

/**
 * Format ETA (estimated time of arrival) for uploads/downloads
 */
export const formatETA = (seconds: number): string => {
  if (!isFinite(seconds) || seconds <= 0) {
    return 'calculating...'
  }

  if (seconds < 60) {
    return `${Math.round(seconds)} sec remaining`
  } else if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60)
    return `${minutes} min remaining`
  } else {
    const hours = Math.ceil(seconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} remaining`
  }
}

/**
 * Format date in relative time (e.g., "2 hours ago", "3 days ago")
 */
export const formatRelativeTime = (date: string | Date): string => {
  const now = new Date()
  const past = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000)
    return `${months} month${months > 1 ? 's' : ''} ago`
  } else {
    const years = Math.floor(diffInSeconds / 31536000)
    return `${years} year${years > 1 ? 's' : ''} ago`
  }
}

/**
 * Format date in a human-readable format
 */
export const formatDate = (date: string | Date): string => {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format date and time in a human-readable format
 */
export const formatDateTime = (date: string | Date): string => {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format percentage with specified decimal places
 */
export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format number with thousands separator
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString()
}

/**
 * Truncate text to specified length with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Format file name for display (truncate if too long)
 */
export const formatFileName = (fileName: string, maxLength: number = 30): string => {
  if (fileName.length <= maxLength) return fileName

  const extension = fileName.split('.').pop() || ''
  const nameWithoutExtension = fileName.substring(0, fileName.lastIndexOf('.'))
  const maxNameLength = maxLength - extension.length - 4 // Account for '...' and '.'

  if (maxNameLength <= 0) return truncateText(fileName, maxLength)

  return `${nameWithoutExtension.substring(0, maxNameLength)}...${extension}`
}

/**
 * Format email address for display (hide part of the email for privacy)
 */
export const formatEmailForDisplay = (email: string, showFull: boolean = false): string => {
  if (showFull) return email

  const [localPart, domain] = email.split('@')
  if (!domain) return email

  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`
  }

  const visibleStart = localPart.substring(0, 2)
  const visibleEnd = localPart.length > 4 ? localPart.substring(localPart.length - 1) : ''
  return `${visibleStart}***${visibleEnd}@${domain}`
}

/**
 * Format video duration from seconds to MM:SS or HH:MM:SS
 */
export const formatVideoDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

/**
 * Format resolution string (e.g., "1920x1080" to "1080p")
 */
export const formatResolution = (resolution: string): string => {
  const [width, height] = resolution.split('x').map(Number)

  if (!height) return resolution

  // Common resolution mappings
  const resolutionMap: Record<number, string> = {
    240: '240p',
    360: '360p',
    480: '480p',
    720: '720p (HD)',
    1080: '1080p (Full HD)',
    1440: '1440p (2K)',
    2160: '4K',
    4320: '8K',
  }

  return resolutionMap[height] || `${height}p`
}

/**
 * Format codec name for display
 */
export const formatCodec = (codec: string): string => {
  const codecMap: Record<string, string> = {
    'h264': 'H.264',
    'h265': 'H.265',
    'hevc': 'HEVC',
    'vp8': 'VP8',
    'vp9': 'VP9',
    'av1': 'AV1',
    'aac': 'AAC',
    'mp3': 'MP3',
    'opus': 'Opus',
  }

  return codecMap[codec.toLowerCase()] || codec.toUpperCase()
}

/**
 * Format session status for display
 */
export const formatSessionStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    'draft': 'Draft',
    'active': 'Active',
    'completed': 'Completed',
    'archived': 'Archived',
  }

  return statusMap[status] || status
}

/**
 * Format file type for display
 */
export const formatFileType = (mimeType: string): string => {
  const typeMap: Record<string, string> = {
    'video/mp4': 'MP4 Video',
    'video/quicktime': 'QuickTime Video',
    'video/x-msvideo': 'AVI Video',
    'video/webm': 'WebM Video',
    'video/x-ms-wmv': 'WMV Video',
    'application/zip': 'ZIP Archive',
    'application/x-zip-compressed': 'ZIP Archive',
    'application/pdf': 'PDF Document',
    'image/jpeg': 'JPEG Image',
    'image/png': 'PNG Image',
  }

  return typeMap[mimeType] || mimeType
}

/**
 * Generate initials from a name
 */
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}

/**
 * Format progress as a percentage string
 */
export const formatProgress = (current: number, total: number): string => {
  if (!total || total === 0 || !isFinite(total) || isNaN(total)) return '0%'
  if (!current || current === 0 || !isFinite(current) || isNaN(current)) return '0%'

  const percentage = Math.min((current / total) * 100, 100)
  if (!isFinite(percentage) || isNaN(percentage)) return '0%'

  return `${Math.round(percentage)}%`
}

/**
 * Format upload/download progress with details
 */
export const formatTransferProgress = (current: number, total: number, speed: number): string => {
  const percentage = formatProgress(current, total)
  const currentFormatted = formatFileSize(current)
  const totalFormatted = formatFileSize(total)
  const speedFormatted = formatSpeed(speed)

  return `${percentage} • ${currentFormatted} of ${totalFormatted} • ${speedFormatted}`
}