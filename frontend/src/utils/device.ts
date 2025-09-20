/**
 * Device and browser detection utilities
 *
 * Provides information about the user's device, browser capabilities,
 * and feature support for optimal user experience.
 */

import type { DeviceInfo } from '@/types'

/**
 * Detect device type and capabilities
 */
export const getDeviceInfo = (): DeviceInfo => {
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform?.toLowerCase() || ''

  // Detect mobile devices
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) ||
    (platform.includes('mac') && navigator.maxTouchPoints > 1) // iPad detection

  // Detect tablets specifically
  const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent) ||
    (platform.includes('mac') && navigator.maxTouchPoints > 1)

  // Desktop is everything else
  const isDesktop = !isMobile && !isTablet

  // Browser detection
  let browser = 'unknown'
  let version = 'unknown'

  if (userAgent.includes('firefox')) {
    browser = 'firefox'
    version = userAgent.match(/firefox\/(\d+)/)?.[1] || 'unknown'
  } else if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
    browser = 'chrome'
    version = userAgent.match(/chrome\/(\d+)/)?.[1] || 'unknown'
  } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
    browser = 'safari'
    version = userAgent.match(/version\/(\d+)/)?.[1] || 'unknown'
  } else if (userAgent.includes('edg')) {
    browser = 'edge'
    version = userAgent.match(/edg\/(\d+)/)?.[1] || 'unknown'
  }

  // Platform detection
  let detectedPlatform = 'unknown'
  if (userAgent.includes('windows')) {
    detectedPlatform = 'windows'
  } else if (userAgent.includes('mac')) {
    detectedPlatform = 'macos'
  } else if (userAgent.includes('linux')) {
    detectedPlatform = 'linux'
  } else if (userAgent.includes('android')) {
    detectedPlatform = 'android'
  } else if (userAgent.includes('ios') || userAgent.includes('iphone') || userAgent.includes('ipad')) {
    detectedPlatform = 'ios'
  }

  // Feature detection
  const supportsDragDrop = 'draggable' in document.createElement('div') && 'ondrop' in window
  const supportsFileAPI = 'File' in window && 'FileReader' in window && 'FileList' in window && 'Blob' in window
  const supportsChunkedUpload = 'ArrayBuffer' in window && 'Uint8Array' in window

  return {
    isMobile,
    isTablet,
    isDesktop,
    platform: detectedPlatform,
    browser,
    version,
    supportsDragDrop,
    supportsFileAPI,
    supportsChunkedUpload,
  }
}

/**
 * Check if the device supports touch
 */
export const isTouchDevice = (): boolean => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

/**
 * Check if the device is in landscape mode
 */
export const isLandscape = (): boolean => {
  return window.innerWidth > window.innerHeight
}

/**
 * Check if the device is in portrait mode
 */
export const isPortrait = (): boolean => {
  return window.innerHeight > window.innerWidth
}

/**
 * Get viewport dimensions
 */
export const getViewportSize = () => {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

/**
 * Check if the browser supports a specific feature
 */
export const supportsFeature = (feature: string): boolean => {
  switch (feature) {
    case 'webrtc':
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    case 'websockets':
      return 'WebSocket' in window
    case 'serviceworker':
      return 'serviceWorker' in navigator
    case 'notifications':
      return 'Notification' in window
    case 'geolocation':
      return 'geolocation' in navigator
    case 'camera':
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    case 'fullscreen':
      return !!(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled)
    case 'clipboard':
      return !!(navigator.clipboard && navigator.clipboard.writeText)
    case 'share':
      return 'share' in navigator
    default:
      return false
  }
}

/**
 * Get network information if available
 */
export const getNetworkInfo = () => {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection

  if (!connection) {
    return null
  }

  return {
    effectiveType: connection.effectiveType || 'unknown',
    downlink: connection.downlink || 0,
    rtt: connection.rtt || 0,
    saveData: connection.saveData || false,
  }
}

/**
 * Check if the user is on a slow network
 */
export const isSlowNetwork = (): boolean => {
  const networkInfo = getNetworkInfo()
  if (!networkInfo) return false

  return networkInfo.effectiveType === 'slow-2g' ||
         networkInfo.effectiveType === '2g' ||
         networkInfo.saveData
}

/**
 * Get battery information if available
 */
export const getBatteryInfo = async () => {
  if ('getBattery' in navigator) {
    try {
      const battery = await (navigator as any).getBattery()
      return {
        level: battery.level,
        charging: battery.charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
      }
    } catch (error) {
      console.warn('Battery API not available:', error)
      return null
    }
  }
  return null
}

/**
 * Check if the device is on low battery
 */
export const isLowBattery = async (): Promise<boolean> => {
  const batteryInfo = await getBatteryInfo()
  return batteryInfo ? batteryInfo.level < 0.2 && !batteryInfo.charging : false
}

/**
 * Get optimal chunk size based on device capabilities
 */
export const getOptimalChunkSize = (): number => {
  const deviceInfo = getDeviceInfo()
  const networkInfo = getNetworkInfo()

  // Base chunk size
  let chunkSize = 10 * 1024 * 1024 // 10MB default

  // Adjust for mobile devices
  if (deviceInfo.isMobile) {
    chunkSize = 5 * 1024 * 1024 // 5MB for mobile
  }

  // Adjust for slow networks
  if (networkInfo?.effectiveType === 'slow-2g' || networkInfo?.effectiveType === '2g') {
    chunkSize = 1024 * 1024 // 1MB for very slow networks
  } else if (networkInfo?.effectiveType === '3g') {
    chunkSize = 2 * 1024 * 1024 // 2MB for 3G
  }

  // Adjust for data saver mode
  if (networkInfo?.saveData) {
    chunkSize = Math.min(chunkSize, 2 * 1024 * 1024) // Max 2MB with data saver
  }

  return chunkSize
}

/**
 * Check if the device has sufficient storage for uploads
 */
export const checkStorageQuota = async (): Promise<{ available: number; used: number; quota: number } | null> => {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate()
      return {
        available: (estimate.quota || 0) - (estimate.usage || 0),
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
      }
    } catch (error) {
      console.warn('Storage quota API not available:', error)
      return null
    }
  }
  return null
}

/**
 * Check if device has enough storage for a file
 */
export const hasEnoughStorage = async (fileSize: number): Promise<boolean> => {
  const storageInfo = await checkStorageQuota()
  if (!storageInfo) return true // Assume true if we can't check

  // Leave 100MB buffer
  const buffer = 100 * 1024 * 1024
  return storageInfo.available > (fileSize + buffer)
}

/**
 * Get recommended upload settings based on device
 */
export const getRecommendedUploadSettings = () => {
  const deviceInfo = getDeviceInfo()
  const networkInfo = getNetworkInfo()

  let maxConcurrentUploads = 3
  let chunkSize = getOptimalChunkSize()

  // Reduce concurrent uploads on mobile
  if (deviceInfo.isMobile) {
    maxConcurrentUploads = 2
  }

  // Further reduce on slow networks
  if (isSlowNetwork()) {
    maxConcurrentUploads = 1
  }

  return {
    maxConcurrentUploads,
    chunkSize,
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
  }
}