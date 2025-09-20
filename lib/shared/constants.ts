/**
 * Shared Constants for ApexShare Infrastructure
 *
 * Centralized configuration values used across all stacks and constructs
 */

// AWS Regions
export const AWS_REGIONS = {
  PRIMARY: 'eu-west-1', // Ireland (closest to Belgium)
  SECONDARY: 'eu-central-1', // Frankfurt (backup)
  CLOUDFRONT: 'us-east-1', // Required for CloudFront certificates
} as const;

// File Upload Constraints
export const UPLOAD_CONSTRAINTS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024 * 1024, // 5GB
  MIN_FILE_SIZE: 1024, // 1KB
  ALLOWED_MIME_TYPES: [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
  ],
  ALLOWED_EXTENSIONS: ['.mp4', '.mov', '.avi', '.mkv'],
  PRESIGNED_URL_EXPIRY: 3600, // 1 hour in seconds
  DOWNLOAD_URL_EXPIRY: 24 * 3600, // 24 hours in seconds
} as const;

// API Configuration
export const API_CONFIG = {
  VERSION: 'v1',
  PATHS: {
    UPLOAD_INITIATE: '/api/v1/uploads/initiate',
    UPLOAD_RECENT: '/api/v1/uploads/recent',
    DOWNLOAD: '/api/v1/downloads/{fileId}',
    HEALTH: '/api/v1/health',
  },
  CORS: {
    MAX_AGE: 3000,
    EXPOSE_HEADERS: ['ETag', 'x-amz-version-id'],
    ALLOWED_HEADERS: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
  },
} as const;

// DynamoDB Configuration
export const DYNAMODB_CONFIG = {
  UPLOAD_TABLE: {
    PARTITION_KEY: 'PK',
    SORT_KEY: 'SK',
    GSI1: {
      NAME: 'GSI1',
      PARTITION_KEY: 'GSI1PK',
      SORT_KEY: 'GSI1SK',
    },
    GSI2: {
      NAME: 'GSI2',
      PARTITION_KEY: 'GSI2PK',
      SORT_KEY: 'GSI2SK',
    },
    TTL_ATTRIBUTE: 'ttl',
  },
  KEY_PATTERNS: {
    UPLOAD: 'UPLOAD#{fileId}',
    METADATA: 'METADATA#{uploadDate}',
    STUDENT: 'STUDENT#{studentEmail}',
    DATE: 'DATE#{date}',
    DATE_UPLOAD: 'UPLOAD#{uploadDate}#{fileId}',
  },
} as const;

// S3 Configuration
export const S3_CONFIG = {
  PATHS: {
    VIDEOS: 'videos/',
    TEMP_UPLOADS: 'temp-uploads/',
    ACCESS_LOGS: 'access-logs/',
    EMAIL_TEMPLATES: 'email-templates/',
  },
  LIFECYCLE: {
    TRANSITION_TO_IA_DAYS: 30,
    TRANSITION_TO_GLACIER_DAYS: 90,
    TEMP_CLEANUP_DAYS: 1,
  },
  CORS: {
    MAX_AGE: 3000,
  },
} as const;

// Lambda Configuration
export const LAMBDA_CONFIG = {
  RUNTIME: 'nodejs20.x',
  ARCHITECTURE: 'arm64', // Better price/performance
  BUNDLING: {
    EXTERNAL_MODULES: ['@aws-sdk/*'],
    MINIFY: true,
    SOURCE_MAP: true,
    TARGET: 'es2022',
  },
  ENVIRONMENT_VARIABLES: {
    NODE_OPTIONS: '--enable-source-maps',
    AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
  },
} as const;

// CloudFront Configuration
export const CLOUDFRONT_CONFIG = {
  CACHE_BEHAVIORS: {
    DEFAULT: {
      VIEWER_PROTOCOL_POLICY: 'redirect-to-https',
      CACHE_POLICY: 'CachingOptimized',
      COMPRESS: true,
    },
    API: {
      VIEWER_PROTOCOL_POLICY: 'https-only',
      CACHE_POLICY: 'CachingDisabled',
      ORIGIN_REQUEST_POLICY: 'CORS-S3Origin',
    },
  },
  SECURITY_HEADERS: {
    STRICT_TRANSPORT_SECURITY: 'max-age=31536000; includeSubDomains; preload',
    CONTENT_TYPE_OPTIONS: 'nosniff',
    FRAME_OPTIONS: 'DENY',
    XSS_PROTECTION: '1; mode=block',
    REFERRER_POLICY: 'strict-origin-when-cross-origin',
    CONTENT_SECURITY_POLICY: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://*.apexshare.be",
      "frame-ancestors 'none'",
    ].join('; '),
    PERMISSIONS_POLICY: 'geolocation=(), microphone=(), camera=()',
  },
} as const;

// Monitoring and Alerting
export const MONITORING_CONFIG = {
  ALARMS: {
    LAMBDA_ERROR_THRESHOLD: 5,
    LAMBDA_DURATION_THRESHOLD: 15000, // 15 seconds
    API_LATENCY_THRESHOLD: 5000, // 5 seconds
    API_ERROR_THRESHOLD: 5,
    DYNAMODB_THROTTLE_THRESHOLD: 0,
    S3_ERROR_THRESHOLD: 5,
  },
  METRICS: {
    NAMESPACE: 'ApexShare',
    CUSTOM_METRICS: {
      UPLOAD_SUCCESS: 'UploadSuccess',
      DOWNLOAD_SUCCESS: 'DownloadSuccess',
      EMAIL_SENT: 'EmailSent',
      SECURITY_EVENT: 'SecurityEvent',
    },
  },
  LOG_RETENTION_DAYS: {
    LAMBDA: 14,
    API_GATEWAY: 30,
    CLOUDFRONT: 90,
  },
} as const;

// Security Configuration
export const SECURITY_CONFIG = {
  WAF: {
    RATE_LIMIT: 2000, // requests per 5-minute window per IP
    BLOCKED_COUNTRIES: ['CN', 'RU', 'KP', 'IR'],
    MANAGED_RULES: [
      'AWSManagedRulesCommonRuleSet',
      'AWSManagedRulesKnownBadInputsRuleSet',
      'AWSManagedRulesSQLiRuleSet',
      'AWSManagedRulesLinuxRuleSet',
    ],
  },
  IAM: {
    SESSION_DURATION: 3600, // 1 hour
    MFA_REQUIRED: true,
  },
  ENCRYPTION: {
    KMS_KEY_ROTATION: true,
    S3_ENCRYPTION: 'AES256', // or 'aws:kms' for customer managed keys
  },
} as const;

// DNS Configuration
export const DNS_CONFIG = {
  DOMAIN: 'apexshare.be',
  SUBDOMAINS: {
    API: 'api',
    CDN: 'cdn',
    WWW: 'www',
    STATIC: 'static',
    MAIL: 'mail',
  },
  TTL: {
    DEFAULT: 300, // 5 minutes
    SHORT: 60, // 1 minute
    LONG: 3600, // 1 hour
    EXTENDED: 86400, // 24 hours
  },
  HEALTH_CHECKS: {
    ENABLED: true,
    INTERVAL: 30, // seconds
    FAILURE_THRESHOLD: 3,
    REGIONS: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'],
  },
  SECURITY: {
    CAA_ENABLED: true,
    DMARC_POLICY: 'quarantine',
    SPF_INCLUDE: 'amazonses.com',
  },
} as const;

// Email Configuration
export const EMAIL_CONFIG = {
  FROM_ADDRESS: 'noreply@apexshare.be',
  BOUNCE_HANDLING: true,
  COMPLAINT_HANDLING: true,
  TEMPLATES: {
    UPLOAD_NOTIFICATION: 'upload-notification',
    DOWNLOAD_EXPIRY: 'download-expiry',
  },
  SES_CONFIGURATION_SET: 'apexshare-emails',
  DKIM_ENABLED: true,
  FEEDBACK_FORWARDING: false,
} as const;

// Cost Optimization
export const COST_CONFIG = {
  BUDGET_ALERTS: {
    THRESHOLDS: [50, 80, 100], // Percentage thresholds
    NOTIFICATION_EMAIL: 'admin@apexshare.be',
  },
  RESERVED_CONCURRENCY: {
    MINIMUM: 1,
    MAXIMUM: 100,
  },
  AUTO_SCALING: {
    LAMBDA_PROVISIONED_CONCURRENCY: false, // Cost optimization
    DYNAMODB_AUTO_SCALING: true,
  },
} as const;

// Network Configuration
export const NETWORK_CONFIG = {
  VPC: {
    CIDR: '10.0.0.0/16',
    MAX_AZS: 2,
    SUBNETS: {
      PUBLIC_CIDR_MASK: 24,
      PRIVATE_CIDR_MASK: 24,
      ISOLATED_CIDR_MASK: 24,
    },
  },
  ENDPOINTS: {
    S3: true,
    DYNAMODB: true,
    SES: true,
    LAMBDA: true,
    LOGS: true,
  },
} as const;

// Data Retention and Compliance
export const COMPLIANCE_CONFIG = {
  DATA_RETENTION: {
    PERSONAL_DATA_DAYS: 90, // GDPR compliance
    OPERATIONAL_DATA_DAYS: 365,
    AUDIT_DATA_DAYS: 2555, // 7 years
  },
  BACKUP: {
    POINT_IN_TIME_RECOVERY: true,
    BACKUP_RETENTION_DAYS: 35,
    CROSS_REGION_BACKUP: false, // Cost optimization
  },
  GDPR: {
    DATA_EXPORT_ENABLED: true,
    DATA_DELETION_ENABLED: true,
    CONSENT_TRACKING: false, // Not needed for our use case
  },
} as const;

// Performance Configuration
export const PERFORMANCE_CONFIG = {
  TARGETS: {
    API_LATENCY_P95: 2000, // 2 seconds
    API_LATENCY_P99: 5000, // 5 seconds
    UPLOAD_INITIATION_TIME: 2000, // 2 seconds
    DOWNLOAD_GENERATION_TIME: 1000, // 1 second
  },
  CACHING: {
    CLOUDFRONT_DEFAULT_TTL: 86400, // 1 day
    CLOUDFRONT_MAX_TTL: 31536000, // 1 year
    API_GATEWAY_TTL: 300, // 5 minutes
  },
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_MULTIPART_UPLOAD: false, // For future large file support
  ENABLE_VIDEO_TRANSCODING: false, // For future video processing
  ENABLE_REAL_TIME_NOTIFICATIONS: false, // For future WebSocket support
  ENABLE_ANALYTICS: true,
  ENABLE_DETAILED_MONITORING: true,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  UPLOAD: {
    FILE_TOO_LARGE: 'File size exceeds the maximum limit of 5GB',
    INVALID_FILE_TYPE: 'Invalid file type. Only video files are allowed',
    MISSING_REQUIRED_FIELDS: 'Missing required fields: studentEmail, fileName',
    UPLOAD_FAILED: 'Upload failed. Please try again',
  },
  DOWNLOAD: {
    FILE_NOT_FOUND: 'Video not found or expired',
    LINK_EXPIRED: 'Download link has expired',
    ACCESS_DENIED: 'Access denied',
  },
  GENERAL: {
    INTERNAL_ERROR: 'Internal server error',
    RATE_LIMITED: 'Too many requests. Please try again later',
    MAINTENANCE: 'Service temporarily unavailable for maintenance',
  },
} as const;