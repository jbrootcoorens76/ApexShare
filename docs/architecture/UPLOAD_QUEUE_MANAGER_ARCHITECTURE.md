# Upload Queue Manager Architecture

**System:** ApexShare Global Upload Queue Manager
**Version:** 1.0
**Date:** September 23, 2025
**Status:** Production Ready

## Overview

The Global Upload Queue Manager is a sophisticated singleton-based system that centralizes and optimizes all file upload operations within the ApexShare application. It provides intelligent queue management, adaptive performance optimization, and network-aware processing for optimal upload performance across varying network conditions.

## Architectural Principles

### Core Design Patterns

#### 1. Singleton Pattern
- **Purpose:** Ensures global coordination across the entire application
- **Implementation:** Thread-safe singleton with lazy initialization
- **Benefits:** Consistent state management and resource optimization
- **Lifecycle:** Persists throughout application lifetime

#### 2. Event-Driven Architecture
- **Purpose:** Decoupled communication between components
- **Implementation:** EventEmitter with strongly-typed events
- **Benefits:** Flexible integration and real-time updates
- **Scalability:** Supports multiple listeners and event types

#### 3. Adaptive Optimization
- **Purpose:** Dynamic performance tuning based on real-time metrics
- **Implementation:** Continuous monitoring with algorithmic adjustment
- **Benefits:** Optimal performance across all network conditions
- **Intelligence:** Machine learning-inspired adaptive algorithms

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                 Application Layer                           │
├─────────────────────────────────────────────────────────────┤
│  React Components │ Upload Hook │ Progress Displays │ UI   │
├─────────────────────────────────────────────────────────────┤
│               Global Upload Queue Manager                   │
│  ┌─────────────┬──────────────┬─────────────┬─────────────┐ │
│  │   Queue     │   Active     │  Network    │ Performance │ │
│  │ Management  │   Uploads    │ Monitoring  │ Optimization│ │
│  └─────────────┴──────────────┴─────────────┴─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│               Network & Browser APIs                        │
│  ┌─────────────┬──────────────┬─────────────┬─────────────┐ │
│  │ Network     │ Performance  │   Online/   │    Device   │ │
│  │Information  │    API       │  Offline    │ Detection   │ │
│  │    API      │              │   Events    │             │ │
│  └─────────────┴──────────────┴─────────────┴─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      AWS Services                           │
│  ┌─────────────┬──────────────┬─────────────┬─────────────┐ │
│  │     S3      │ API Gateway  │   Lambda    │ CloudWatch  │ │
│  │  Multipart  │   Upload     │  Functions  │ Monitoring  │ │
│  │   Upload    │   Endpoint   │             │             │ │
│  └─────────────┴──────────────┴─────────────┴─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Core Components Detail

#### Upload Queue Manager (`uploadQueueManager.ts`)

**Primary Responsibilities:**
- Global upload coordination and state management
- Intelligent queue prioritization and processing
- Network condition monitoring and adaptation
- Performance optimization through adaptive algorithms
- Event emission for UI integration

**Key Subsystems:**

1. **Queue Management System**
   - Priority-based queue with configurable sorting
   - FIFO, smallest-first, and largest-first processing modes
   - Dynamic queue reordering based on performance metrics
   - Thread-safe queue operations

2. **Active Upload Coordinator**
   - Concurrent upload management with adaptive limits
   - Chunked upload processing with intelligent sizing
   - Progress tracking and status management
   - Error handling and retry logic

3. **Network Monitoring Engine**
   - Real-time network condition detection
   - Connection type adaptation (2G, 3G, 4G)
   - Bandwidth measurement and optimization
   - Online/offline state management

4. **Performance Optimization Engine**
   - Continuous performance metric collection
   - Adaptive concurrency adjustment
   - Memory usage optimization
   - Speed measurement and analysis

## Data Flow Architecture

### Upload Lifecycle Flow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   File      │───▶│   Queue      │───▶│   Active    │───▶│   Complete   │
│ Selection   │    │ Management   │    │   Upload    │    │   Processing │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│Priority     │    │Queue         │    │Chunked      │    │S3 Multipart  │
│Calculation  │    │Optimization  │    │Processing   │    │Completion    │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
```

### Event Flow Diagram

```
┌──────────────────┐     Events     ┌─────────────────┐
│ Upload Queue     │◄──────────────►│ React Hook      │
│ Manager          │                │ (useFileUpload) │
└──────────────────┘                └─────────────────┘
         │                                    │
         │ Network/Performance Events         │ UI Updates
         ▼                                    ▼
┌──────────────────┐                ┌─────────────────┐
│ Browser APIs     │                │ React           │
│ - Network Info   │                │ Components      │
│ - Performance    │                │ - Progress Bars │
│ - Online/Offline │                │ - Status Display│
└──────────────────┘                └─────────────────┘
```

## Component Interfaces

### Core Data Structures

#### QueuedFile Interface
```typescript
interface QueuedFile {
  fileId: string          // Unique identifier
  file: File             // Browser File object
  sessionId: string      // Upload session identifier
  priority: number       // Queue priority (lower = higher priority)
  createdAt: number      // Timestamp for queue ordering
  retryCount: number     // Current retry attempt count
  onProgress?: (fileId: string, progress: UploadProgress) => void
  onComplete?: (fileId: string, fileInfo: any) => void
  onError?: (fileId: string, error: string) => void
}
```

#### ActiveUpload Interface
```typescript
interface ActiveUpload {
  fileId: string              // File identifier
  file: File                 // File being uploaded
  sessionId: string          // Session context
  uploadId: string           // S3 multipart upload ID
  totalChunks: number        // Total number of chunks
  completedChunks: ChunkUploadResult[]  // Completed chunk results
  currentChunk: number       // Current chunk being processed
  abortController: AbortController      // Upload cancellation control
  startTime: number          // Upload start timestamp
  lastProgressTime: number   // Last progress update time
  uploadedBytes: number      // Total bytes uploaded
  status: 'initializing' | 'uploading' | 'paused' | 'completing' | 'completed' | 'error'
  error?: string            // Error message if failed
  pausedAt?: number         // Pause timestamp
  resumeCount: number       // Resume attempt count
  chunkSize: number         // Adaptive chunk size
}
```

#### Performance Metrics Interface
```typescript
interface PerformanceMetrics {
  totalUploads: number        // Total upload attempts
  successfulUploads: number   // Successful completions
  failedUploads: number      // Failed attempts
  averageSpeed: number       // Average upload speed (bytes/sec)
  totalBytesUploaded: number // Cumulative bytes uploaded
  activeConcurrency: number  // Current active uploads
  optimalConcurrency: number // Calculated optimal concurrency
}
```

#### Network Metrics Interface
```typescript
interface NetworkMetrics {
  speed: number         // Connection speed (bytes/sec)
  rtt: number          // Round trip time (ms)
  effectiveType: string // Connection type (2g, 3g, 4g)
  lastMeasured: number // Last measurement timestamp
  samples: number[]    // Historical speed samples
}
```

## Event System Architecture

### Event Types and Flow

#### Core Events
```typescript
interface QueueEvents {
  'upload-queued': (fileId: string, queuedFile: QueuedFile) => void
  'upload-started': (fileId: string, upload: ActiveUpload) => void
  'upload-progress': (fileId: string, progress: UploadProgress) => void
  'upload-completed': (fileId: string, fileInfo: any) => void
  'upload-error': (fileId: string, error: string) => void
  'upload-paused': (fileId: string) => void
  'upload-resumed': (fileId: string) => void
  'upload-cancelled': (fileId: string) => void
  'queue-empty': () => void
  'performance-update': (metrics: PerformanceMetrics) => void
  'network-change': (metrics: NetworkMetrics) => void
}
```

#### Event Propagation Flow
1. **Queue Manager** emits events based on upload state changes
2. **React Hook** subscribes to events and updates component state
3. **React Components** receive state updates and re-render
4. **UI Components** display real-time progress and status

## State Management

### State Synchronization

#### Queue State
- **Pending Queue:** Files awaiting upload initiation
- **Active Uploads:** Currently processing uploads with real-time status
- **Completed Set:** Successfully completed uploads
- **Failed Set:** Uploads that exceeded retry limits

#### Performance State
- **Network Metrics:** Real-time connection quality data
- **Performance Metrics:** Upload success rates and speed measurements
- **Configuration State:** Adaptive settings based on performance

#### UI State Synchronization
- **React Hook State:** Mirrors queue manager state for UI consumption
- **Component State:** Individual component state derived from hook
- **Global State:** Shared state across all components via context

## Network Adaptation Strategy

### Connection Type Optimization

#### 2G Networks (slow-2g, 2g)
```
Concurrency: 1 file, 1 chunk
Chunk Size: 1MB maximum
Priority: smallest-first
Retry Delay: Extended backoff
```

#### 3G Networks
```
Concurrency: 2 files, 2 chunks
Chunk Size: 5MB maximum
Priority: balanced approach
Retry Delay: Standard backoff
```

#### 4G Networks and Above
```
Concurrency: 3+ files, 4+ chunks
Chunk Size: Full optimization
Priority: flexible approach
Retry Delay: Minimal backoff
```

### Adaptive Algorithms

#### Performance-Based Adjustment
```typescript
// Concurrency adjustment based on success rate
if (successRate < 0.8) {
  // Reduce concurrency for stability
  concurrency = Math.max(1, concurrency - 1)
} else if (successRate > 0.95) {
  // Increase concurrency for performance
  concurrency = Math.min(maxConcurrency, concurrency + 1)
}
```

#### Speed-Based Optimization
```typescript
// Chunk size adjustment based on measured speed
if (measuredSpeed < expectedSpeed * 0.7) {
  // Reduce chunk size for reliability
  chunkSize = Math.max(minChunkSize, chunkSize * 0.8)
} else if (measuredSpeed > expectedSpeed * 1.2) {
  // Increase chunk size for efficiency
  chunkSize = Math.min(maxChunkSize, chunkSize * 1.2)
}
```

## Memory Management

### Efficient Resource Usage

#### Chunk Processing
- **Streaming Processing:** Chunks processed individually to minimize memory footprint
- **Garbage Collection:** Immediate cleanup after chunk completion
- **Buffer Management:** Intelligent buffering based on available memory

#### Memory Monitoring
```typescript
// Browser memory monitoring (when available)
if (performance.memory) {
  const memoryUsage = performance.memory.usedJSHeapSize
  if (memoryUsage > memoryThreshold) {
    // Reduce concurrency or chunk size
    adaptMemoryUsage()
  }
}
```

#### Resource Cleanup
- **AbortController:** Proper cancellation of network requests
- **Event Listeners:** Cleanup on component unmount
- **Timer Management:** Clear intervals and timeouts
- **File References:** Release file object references

## Error Handling Strategy

### Retry Logic Architecture

#### Exponential Backoff
```typescript
const retryDelay = baseDelay * Math.pow(2, retryCount - 1)
// Example: 1s, 2s, 4s, 8s delays
```

#### Intelligent Retry Conditions
- **Network Errors:** Automatic retry with backoff
- **Server Errors (5xx):** Retry with extended delay
- **Client Errors (4xx):** Limited retry with validation
- **Timeout Errors:** Retry with reduced chunk size

#### Error Recovery Strategies
1. **Temporary Failures:** Automatic retry with exponential backoff
2. **Network Changes:** Pause and resume based on connectivity
3. **Server Issues:** Queue and retry during maintenance windows
4. **Client Issues:** Validation and user feedback

## Performance Optimization

### Adaptive Concurrency Control

#### Dynamic Adjustment Factors
- **Network Performance:** Connection speed and stability
- **Device Capabilities:** Mobile vs desktop optimization
- **Memory Availability:** Prevent memory pressure
- **Success Rate:** Reliability-based adjustment

#### Optimization Algorithms
```typescript
// Network-aware concurrency calculation
let optimalConcurrency = baseConcurrency
if (isSlowNetwork()) {
  optimalConcurrency = Math.max(1, optimalConcurrency / 2)
}
if (lowMemoryDevice()) {
  optimalConcurrency = Math.max(1, optimalConcurrency - 1)
}
```

### Bandwidth Optimization

#### Intelligent Chunk Sizing
- **Network Speed:** Larger chunks for fast connections
- **Reliability:** Smaller chunks for unstable connections
- **Memory Constraints:** Size based on available memory
- **Device Type:** Mobile-optimized sizes

#### Priority Processing
- **Smallest-First:** Quick wins for user satisfaction
- **Largest-First:** Efficient bandwidth utilization
- **FIFO:** Fair processing order
- **Custom Priority:** User-defined importance

## Integration Architecture

### React Hook Integration

#### useFileUpload Hook Design
```typescript
// Hook provides unified interface to queue manager
const {
  uploadFile,        // Queue file for upload
  cancelUpload,      // Cancel specific upload
  pauseUpload,       // Pause upload
  resumeUpload,      // Resume upload
  getUploadProgress, // Get real-time progress
  isUploading,       // Check upload status
  getQueueStatus     // Get global queue metrics
} = useFileUpload(options)
```

#### State Management Integration
- **React State:** Component-level state for UI rendering
- **Queue State:** Global state managed by queue manager
- **Event Synchronization:** Real-time updates via event system
- **Lifecycle Management:** Proper cleanup and initialization

### API Integration

#### AWS S3 Multipart Upload
```
1. Request presigned URLs from Lambda
2. Initialize multipart upload
3. Upload chunks with adaptive sizing
4. Complete multipart upload
5. Handle errors and retry as needed
```

#### Error Handling Integration
- **API Errors:** Proper error parsing and user feedback
- **Network Failures:** Automatic retry with backoff
- **Authentication:** Token refresh and retry
- **Rate Limiting:** Respect API limits with queuing

## Monitoring and Observability

### Performance Metrics Collection

#### Real-Time Metrics
- **Upload Speed:** Bytes per second measurement
- **Success Rate:** Completion vs failure ratio
- **Queue Length:** Pending uploads count
- **Active Concurrency:** Current parallel uploads
- **Memory Usage:** Browser memory consumption

#### Historical Analytics
- **Performance Trends:** Speed and success rate over time
- **Network Adaptation:** Effectiveness of optimization
- **Error Patterns:** Common failure modes and recovery
- **User Experience:** Upload completion times and satisfaction

### Debugging and Diagnostics

#### Logging Strategy
```typescript
// Configurable logging levels
if (appConfig.enableDetailedLogging) {
  console.log('📤 Upload queued:', fileInfo)
  console.log('🚀 Upload started:', uploadDetails)
  console.log('📊 Performance update:', metrics)
}
```

#### Error Tracking
- **Error Classification:** Categorization by type and severity
- **Stack Traces:** Detailed error information for debugging
- **User Context:** Upload details and environment information
- **Recovery Actions:** Automated and manual recovery steps

## Security Considerations

### Data Protection

#### File Handling Security
- **Client-Side Validation:** File type and size validation
- **Memory Protection:** Prevent memory exhaustion attacks
- **Upload Limits:** Configurable size and rate limits
- **Abort Mechanisms:** User-controlled upload cancellation

#### Network Security
- **HTTPS Enforcement:** Secure transport for all uploads
- **Presigned URLs:** Time-limited and scoped access
- **Token Management:** Secure credential handling
- **CORS Configuration:** Proper cross-origin request handling

## Scalability Architecture

### Horizontal Scaling

#### Multi-Instance Coordination
- **Singleton Pattern:** Per-tab instance coordination
- **Cross-Tab Communication:** Shared upload coordination
- **Resource Sharing:** Bandwidth allocation across tabs
- **State Synchronization:** Consistent state across instances

#### Load Distribution
- **Queue Balancing:** Even distribution of upload load
- **Resource Allocation:** Fair bandwidth and memory usage
- **Performance Isolation:** Prevent interference between uploads
- **Graceful Degradation:** Maintain functionality under load

### Future Extensibility

#### Pluggable Architecture
- **Upload Providers:** Support for multiple cloud providers
- **Processing Plugins:** Extensible file processing pipeline
- **Analytics Integration:** Pluggable metrics collection
- **UI Components:** Modular progress and status displays

#### Configuration Management
- **Runtime Configuration:** Dynamic setting adjustment
- **Environment Profiles:** Development, staging, production configs
- **Feature Flags:** Controlled feature rollout
- **Performance Tuning:** Environment-specific optimizations

## Documentation and Maintenance

### Code Organization

#### File Structure
```
src/services/uploadQueueManager.ts    # Core queue manager
src/hooks/useFileUpload.ts           # React integration hook
src/types/upload.ts                  # Type definitions
src/utils/device.ts                  # Device and network utilities
src/config/upload.ts                 # Configuration management
```

#### Testing Organization
```
src/tests/uploadQueueManager.test.ts           # Unit tests
src/tests/uploadQueueManager.integration.test.ts # Integration tests
src/tests/uploadQueueManager.performance.test.ts # Performance tests
src/tests/uploadQueueManager.functional.test.ts  # Functional tests
```

### Maintenance Considerations

#### Code Quality
- **TypeScript:** Strong typing for reliability
- **ESLint/Prettier:** Code style consistency
- **Unit Tests:** Comprehensive test coverage
- **Documentation:** Inline and external documentation

#### Performance Monitoring
- **Continuous Benchmarking:** Regular performance validation
- **Regression Testing:** Prevent performance degradation
- **Memory Leak Detection:** Ongoing memory usage monitoring
- **User Experience Metrics:** Real-world performance tracking

---

**Document Version:** 1.0
**Last Updated:** September 23, 2025
**Next Review:** Post-Production Analysis
**Related Documents:**
- UPLOAD_OPTIMIZATION_PROJECT_REPORT.md
- UPLOAD_PERFORMANCE_DEVELOPER_GUIDE.md
- UPLOAD_PERFORMANCE_TESTING_GUIDE.md