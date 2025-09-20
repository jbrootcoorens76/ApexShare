/**
 * Environment configuration for ApexShare frontend
 *
 * This configuration is populated at build time based on the deployment environment.
 * The build pipeline will inject the appropriate values based on the target environment.
 */

export interface AppConfig {
  apiBaseUrl: string
  awsRegion: string
  environment: 'development' | 'staging' | 'production'
  domain: string
  enableAnalytics: boolean
  enableDetailedLogging: boolean
  maxFileSize: number
  supportedFileTypes: string[]
  chunkSize: number
  maxConcurrentUploads: number
}

// Default configuration that will be overridden by environment-specific values
const defaultConfig: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.apexshare.be',
  awsRegion: import.meta.env.VITE_AWS_REGION || 'eu-west-1',
  environment: (import.meta.env.VITE_ENVIRONMENT as AppConfig['environment']) || 'development',
  domain: import.meta.env.VITE_DOMAIN || 'apexshare.be',
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  enableDetailedLogging: import.meta.env.VITE_ENABLE_DETAILED_LOGGING === 'true',
  maxFileSize: parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '5368709120'), // 5GB default
  supportedFileTypes: [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/x-ms-wmv',
    'application/zip',
    'application/x-zip-compressed'
  ],
  chunkSize: parseInt(import.meta.env.VITE_CHUNK_SIZE || '10485760'), // 10MB chunks
  maxConcurrentUploads: parseInt(import.meta.env.VITE_MAX_CONCURRENT_UPLOADS || '3'),
}

// Environment-specific overrides
const environmentConfigs: Record<string, Partial<AppConfig>> = {
  development: {
    apiBaseUrl: 'http://localhost:3001/api',
    enableDetailedLogging: true,
    enableAnalytics: false,
  },
  staging: {
    apiBaseUrl: 'https://api-staging.apexshare.be',
    enableDetailedLogging: true,
    enableAnalytics: false,
  },
  production: {
    apiBaseUrl: 'https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1',
    enableDetailedLogging: false,
    enableAnalytics: true,
  },
}

// Merge default config with environment-specific overrides
const environment = import.meta.env.VITE_ENVIRONMENT || 'development'
const envConfig = environmentConfigs[environment] || {}

export const appConfig: AppConfig = {
  ...defaultConfig,
  ...envConfig,
}

// Helper functions
export const isDevelopment = () => appConfig.environment === 'development'
export const isProduction = () => appConfig.environment === 'production'
export const isStaging = () => appConfig.environment === 'staging'

// Validation
if (!appConfig.apiBaseUrl) {
  throw new Error('API Base URL is required')
}

if (!appConfig.awsRegion) {
  throw new Error('AWS Region is required')
}

// Log configuration in development
if (isDevelopment()) {
  console.log('App Configuration:', appConfig)
}