/**
 * Upload Debugging Utilities
 *
 * Comprehensive debugging tools to identify browser-specific upload issues,
 * track request differences, and monitor upload progress failures.
 */

export interface BrowserInfo {
  name: string
  version: string
  platform: string
  userAgent: string
  isMobile: boolean
  isSafari: boolean
  isChrome: boolean
  isFirefox: boolean
  isEdge: boolean
  supportsFileAPI: boolean
  supportsFormData: boolean
  supportsXHR2: boolean
  supportsWebWorkers: boolean
  maxConcurrentConnections: number
}

export interface UploadDebugInfo {
  requestId: string
  timestamp: number
  browserInfo: BrowserInfo
  sessionId: string
  fileName: string
  fileSize: number
  fileType: string
  requestHeaders: Record<string, string>
  requestPayload: any
  responseStatus?: number
  responseHeaders?: Record<string, string>
  responseBody?: any
  errorDetails?: any
  networkTiming?: PerformanceResourceTiming
  uploadProgress?: UploadProgressInfo[]
}

export interface UploadProgressInfo {
  timestamp: number
  loaded: number
  total: number
  percentage: number
  speed: number
  eta: number
  phase: 'session_creation' | 'upload_url_request' | 's3_upload' | 'upload_complete'
}

export interface NetworkDiagnostics {
  connectionType: string
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
}

/**
 * Detect browser information and capabilities
 */
export const getBrowserInfo = (): BrowserInfo => {
  const ua = navigator.userAgent
  const platform = navigator.platform

  // Browser detection
  const isChrome = /Chrome/.test(ua) && !/Edge/.test(ua)
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua)
  const isFirefox = /Firefox/.test(ua)
  const isEdge = /Edge/.test(ua) || /Edg/.test(ua)

  // Mobile detection
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)

  // Version extraction
  let version = 'unknown'
  if (isChrome) {
    const match = ua.match(/Chrome\/(\d+)/)
    version = match ? match[1] : 'unknown'
  } else if (isSafari) {
    const match = ua.match(/Safari\/(\d+)/)
    version = match ? match[1] : 'unknown'
  } else if (isFirefox) {
    const match = ua.match(/Firefox\/(\d+)/)
    version = match ? match[1] : 'unknown'
  }

  // Feature detection
  const supportsFileAPI = typeof File !== 'undefined' && typeof FileReader !== 'undefined'
  const supportsFormData = typeof FormData !== 'undefined'
  const supportsXHR2 = typeof XMLHttpRequest !== 'undefined' && 'upload' in new XMLHttpRequest()
  const supportsWebWorkers = typeof Worker !== 'undefined'

  // Connection limits vary by browser
  let maxConcurrentConnections = 6 // Default HTTP/1.1 limit
  if (isChrome) maxConcurrentConnections = 6
  else if (isSafari) maxConcurrentConnections = 6
  else if (isFirefox) maxConcurrentConnections = 6

  return {
    name: isChrome ? 'Chrome' : isSafari ? 'Safari' : isFirefox ? 'Firefox' : isEdge ? 'Edge' : 'Unknown',
    version,
    platform,
    userAgent: ua,
    isMobile,
    isSafari,
    isChrome,
    isFirefox,
    isEdge,
    supportsFileAPI,
    supportsFormData,
    supportsXHR2,
    supportsWebWorkers,
    maxConcurrentConnections,
  }
}

/**
 * Get network diagnostics information
 */
export const getNetworkDiagnostics = (): NetworkDiagnostics => {
  const connection = (navigator as any).connection ||
                    (navigator as any).mozConnection ||
                    (navigator as any).webkitConnection

  return {
    connectionType: connection?.type || 'unknown',
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink,
    rtt: connection?.rtt,
    saveData: connection?.saveData,
  }
}

/**
 * Intercept and log XMLHttpRequest for debugging
 */
export const createDebugXHR = (debugInfo: Partial<UploadDebugInfo>): XMLHttpRequest => {
  const xhr = new XMLHttpRequest()
  const originalOpen = xhr.open
  const originalSend = xhr.send
  const originalSetRequestHeader = xhr.setRequestHeader

  const headers: Record<string, string> = {}
  let requestBody: any = null

  // Intercept setRequestHeader
  xhr.setRequestHeader = function(name: string, value: string) {
    headers[name] = value
    return originalSetRequestHeader.call(this, name, value)
  }

  // Intercept open
  xhr.open = function(method: string, url: string, async?: boolean, user?: string, password?: string) {
    console.log(`🔍 XHR Open: ${method} ${url}`, {
      browserInfo: getBrowserInfo(),
      networkInfo: getNetworkDiagnostics(),
      debugInfo,
    })
    return originalOpen.call(this, method, url, async ?? true, user, password)
  }

  // Intercept send
  xhr.send = function(body?: any) {
    requestBody = body

    console.log(`🚀 XHR Send: ${this.responseURL || 'unknown'}`, {
      headers,
      bodyType: body ? body.constructor.name : 'null',
      bodySize: body instanceof Blob ? body.size : body instanceof ArrayBuffer ? body.byteLength : body?.length || 0,
      requestPayload: body instanceof FormData ? 'FormData (cannot inspect)' :
                     body instanceof Blob ? `Blob (${body.size} bytes, ${body.type})` :
                     body instanceof File ? `File (${body.name}, ${body.size} bytes, ${body.type})` :
                     body,
    })

    return originalSend.call(this, body)
  }

  // Add response listeners
  xhr.addEventListener('loadstart', () => {
    console.log(`📡 XHR Load Start: ${xhr.responseURL}`)
  })

  xhr.addEventListener('progress', (event) => {
    if (event.lengthComputable) {
      console.log(`📊 XHR Progress: ${Math.round((event.loaded / event.total) * 100)}%`, {
        loaded: event.loaded,
        total: event.total,
      })
    }
  })

  xhr.addEventListener('load', () => {
    console.log(`✅ XHR Load Complete: ${xhr.status} ${xhr.statusText}`, {
      status: xhr.status,
      statusText: xhr.statusText,
      responseHeaders: extractResponseHeaders(xhr),
      responseBody: xhr.responseText ? safeParseJSON(xhr.responseText) : null,
    })
  })

  xhr.addEventListener('error', () => {
    console.error(`❌ XHR Error: ${xhr.responseURL}`, {
      status: xhr.status,
      statusText: xhr.statusText,
      readyState: xhr.readyState,
    })
  })

  xhr.addEventListener('timeout', () => {
    console.error(`⏰ XHR Timeout: ${xhr.responseURL}`)
  })

  xhr.addEventListener('abort', () => {
    console.warn(`🛑 XHR Aborted: ${xhr.responseURL}`)
  })

  return xhr
}

/**
 * Extract response headers from XHR
 */
const extractResponseHeaders = (xhr: XMLHttpRequest): Record<string, string> => {
  const headers: Record<string, string> = {}
  const headerString = xhr.getAllResponseHeaders()

  if (headerString) {
    headerString.split('\r\n').forEach(line => {
      const parts = line.split(': ')
      if (parts.length === 2) {
        headers[parts[0].toLowerCase()] = parts[1]
      }
    })
  }

  return headers
}

/**
 * Safely parse JSON without throwing errors
 */
const safeParseJSON = (text: string): any => {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Create a comprehensive upload monitor
 */
export class UploadMonitor {
  private debugInfo: UploadDebugInfo
  private progressHistory: UploadProgressInfo[] = []
  private startTime: number = 0
  private lastProgressTime: number = 0
  private stuckThreshold = 30000 // 30 seconds without progress

  constructor(sessionId: string, fileName: string, fileSize: number, fileType: string) {
    this.debugInfo = {
      requestId: this.generateRequestId(),
      timestamp: Date.now(),
      browserInfo: getBrowserInfo(),
      sessionId,
      fileName,
      fileSize,
      fileType,
      requestHeaders: {},
      requestPayload: null,
      uploadProgress: [],
    }

    console.log('🔧 Upload Monitor Initialized', this.debugInfo)
  }

  private generateRequestId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Track upload phase progress
   */
  trackProgress(loaded: number, total: number, phase: UploadProgressInfo['phase']): void {
    const now = Date.now()
    const percentage = (loaded / total) * 100
    const timeDiff = now - this.lastProgressTime
    const speed = timeDiff > 0 ? (loaded / (now - this.startTime)) * 1000 : 0
    const eta = speed > 0 ? (total - loaded) / speed : 0

    const progressInfo: UploadProgressInfo = {
      timestamp: now,
      loaded,
      total,
      percentage,
      speed,
      eta,
      phase,
    }

    this.progressHistory.push(progressInfo)
    this.debugInfo.uploadProgress?.push(progressInfo)
    this.lastProgressTime = now

    // Check for stuck upload
    if (this.isUploadStuck()) {
      console.warn('⚠️ Upload appears to be stuck!', {
        phase,
        percentage,
        lastProgress: this.getLastSignificantProgress(),
        stuckDuration: now - this.getLastProgressTime(),
      })
    }

    console.log(`📈 Upload Progress [${phase}]: ${percentage.toFixed(1)}%`, progressInfo)
  }

  /**
   * Start monitoring upload
   */
  startMonitoring(): void {
    this.startTime = Date.now()
    this.lastProgressTime = this.startTime
  }

  /**
   * Log request details
   */
  logRequest(url: string, method: string, headers: Record<string, string>, payload?: any): void {
    this.debugInfo.requestHeaders = headers
    this.debugInfo.requestPayload = payload

    console.log(`🔍 Request Details [${this.debugInfo.requestId}]`, {
      url,
      method,
      headers,
      payload: payload instanceof FormData ? 'FormData (cannot inspect)' : payload,
      browserSpecific: this.getBrowserSpecificHeaders(headers),
    })
  }

  /**
   * Log response details
   */
  logResponse(status: number, headers: Record<string, string>, body?: any): void {
    this.debugInfo.responseStatus = status
    this.debugInfo.responseHeaders = headers
    this.debugInfo.responseBody = body

    console.log(`📥 Response Details [${this.debugInfo.requestId}]`, {
      status,
      headers,
      body,
      browserCompatibility: this.checkBrowserCompatibility(status, headers),
    })
  }

  /**
   * Log error details
   */
  logError(error: any, context?: string): void {
    this.debugInfo.errorDetails = {
      message: error.message,
      stack: error.stack,
      context,
      browserInfo: this.debugInfo.browserInfo,
      networkInfo: getNetworkDiagnostics(),
    }

    console.error(`❌ Upload Error [${this.debugInfo.requestId}]`, this.debugInfo.errorDetails)
  }

  /**
   * Check if upload is stuck
   */
  private isUploadStuck(): boolean {
    const now = Date.now()
    const lastSignificantProgress = this.getLastSignificantProgress()

    if (!lastSignificantProgress) return false

    return (now - lastSignificantProgress.timestamp) > this.stuckThreshold
  }

  /**
   * Get last significant progress (>1% change)
   */
  private getLastSignificantProgress(): UploadProgressInfo | null {
    for (let i = this.progressHistory.length - 1; i >= 0; i--) {
      const current = this.progressHistory[i]
      const previous = i > 0 ? this.progressHistory[i - 1] : null

      if (!previous || Math.abs(current.percentage - previous.percentage) > 1) {
        return current
      }
    }

    return null
  }

  /**
   * Get last progress timestamp
   */
  private getLastProgressTime(): number {
    const lastProgress = this.progressHistory[this.progressHistory.length - 1]
    return lastProgress ? lastProgress.timestamp : this.startTime
  }

  /**
   * Identify browser-specific headers
   */
  private getBrowserSpecificHeaders(headers: Record<string, string>): Record<string, any> {
    const browserSpecific: Record<string, any> = {}

    // Check for browser-specific header variations
    if (this.debugInfo.browserInfo.isChrome) {
      browserSpecific.chromeSpecific = {
        hasSecFetchDest: 'sec-fetch-dest' in headers,
        hasSecFetchMode: 'sec-fetch-mode' in headers,
        hasSecFetchSite: 'sec-fetch-site' in headers,
      }
    }

    if (this.debugInfo.browserInfo.isSafari) {
      browserSpecific.safariSpecific = {
        hasOrigin: 'origin' in headers,
        userAgentDetails: headers['user-agent'],
      }
    }

    return browserSpecific
  }

  /**
   * Check browser compatibility issues
   */
  private checkBrowserCompatibility(status: number, headers: Record<string, string>): Record<string, any> {
    const compatibility: Record<string, any> = {}

    // Check for CORS issues
    if (status === 0 || status === 400) {
      compatibility.possibleCORSIssue = true
      compatibility.corsHeaders = {
        accessControlAllowOrigin: headers['access-control-allow-origin'],
        accessControlAllowMethods: headers['access-control-allow-methods'],
        accessControlAllowHeaders: headers['access-control-allow-headers'],
      }
    }

    // Check for Safari-specific issues
    if (this.debugInfo.browserInfo.isSafari && status >= 400) {
      compatibility.safariIssues = {
        mayBePrivateBrowsing: this.checkPrivateBrowsing(),
        mayHaveContentBlocking: true,
        recommendTouchEventWorkaround: this.debugInfo.browserInfo.isMobile,
      }
    }

    // Check for Chrome-specific issues
    if (this.debugInfo.browserInfo.isChrome && status === 400) {
      compatibility.chromeIssues = {
        mayBeExtensionBlocking: true,
        mayHaveSecurityPolicy: true,
        mayNeedSecFetchHeaders: true,
      }
    }

    return compatibility
  }

  /**
   * Check for private browsing mode (Safari)
   */
  private checkPrivateBrowsing(): boolean {
    try {
      localStorage.setItem('test', 'test')
      localStorage.removeItem('test')
      return false
    } catch {
      return true
    }
  }

  /**
   * Generate comprehensive debug report
   */
  generateReport(): UploadDebugInfo {
    return {
      ...this.debugInfo,
      uploadProgress: this.progressHistory,
    }
  }

  /**
   * Export debug data for analysis
   */
  exportDebugData(): string {
    const report = this.generateReport()
    return JSON.stringify(report, null, 2)
  }
}