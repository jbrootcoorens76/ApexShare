/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_AWS_REGION: string
  readonly VITE_ENVIRONMENT: string
  readonly VITE_DOMAIN: string
  readonly VITE_ENABLE_ANALYTICS: string
  readonly VITE_ENABLE_DETAILED_LOGGING: string
  readonly VITE_MAX_FILE_SIZE: string
  readonly VITE_CHUNK_SIZE: string
  readonly VITE_MAX_CONCURRENT_UPLOADS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}