/**
 * Shared TypeScript Types and Interfaces for ApexShare Infrastructure
 *
 * Common type definitions used across stacks, constructs, and Lambda functions
 */

import { StackProps } from 'aws-cdk-lib';
import { EnvironmentConfig } from './config';

// CDK Stack Props with Environment Configuration
export interface ApexShareStackProps extends StackProps {
  config: EnvironmentConfig;
  crossStackRefs?: CrossStackRefs;
}

// Upload Request Interface
export interface UploadRequest {
  studentEmail: string;
  studentName?: string;
  trainerName?: string;
  sessionDate: string;
  notes?: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

// Upload Response Interface
export interface UploadResponse {
  success: boolean;
  data?: {
    fileId: string;
    uploadUrl: string;
    fields: Record<string, string>;
    expiresAt: string;
  };
  error?: string;
}

// Download Response Interface
export interface DownloadResponse {
  success: boolean;
  data?: {
    downloadUrl: string;
    videoInfo: VideoInfo;
  };
  error?: string;
}

// Video Information Interface
export interface VideoInfo {
  fileName: string;
  fileSize: number;
  sessionDate: string;
  trainerName?: string;
  notes?: string;
  expiresAt: string;
}

// DynamoDB Upload Record Interface
export interface UploadRecord {
  PK: string; // UPLOAD#{fileId}
  SK: string; // METADATA#{uploadDate}
  GSI1PK: string; // STUDENT#{studentEmail}
  GSI1SK: string; // DATE#{uploadDate}
  GSI2PK: string; // DATE#{YYYY-MM}
  GSI2SK: string; // UPLOAD#{uploadDate}#{fileId}

  // Core upload data
  fileId: string;
  studentEmail: string;
  studentName?: string;
  trainerName?: string;
  sessionDate: string;
  notes?: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  contentType: string;

  // S3 information
  s3Key: string;
  s3Bucket: string;

  // Status and timestamps
  uploadDate: string;
  emailSentAt?: string;
  status: 'pending' | 'completed' | 'failed';
  downloadCount: number;
  lastDownloadAt?: string;

  // TTL for automatic cleanup
  ttl: number;
}

// Security Event Interface
export interface SecurityEvent {
  timestamp: string;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  source: string;
  details: Record<string, any>;
  requestId?: string;
  sourceIp?: string;
  userAgent?: string;
}

export type SecurityEventType =
  | 'SuspiciousUserAgent'
  | 'InjectionAttempt'
  | 'RateLimitExceeded'
  | 'UnauthorizedAccess'
  | 'DataExfiltration'
  | 'PreAuthentication'
  | 'PostAuthentication'
  | 'FailedUpload'
  | 'FailedDownload';

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// API Gateway Event Extensions
export interface ApiGatewayEventExtended {
  requestContext: {
    requestId: string;
    identity: {
      sourceIp: string;
      userAgent?: string;
    };
    httpMethod: string;
    path: string;
  };
  headers: Record<string, string>;
  body?: string;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
}

// Lambda Function Configuration
export interface LambdaConfig {
  functionName: string;
  description: string;
  memorySize: number;
  timeout: number;
  reservedConcurrency?: number;
  environment: Record<string, string>;
  deadLetterQueueEnabled: boolean;
}

// S3 Event Information
export interface S3EventInfo {
  bucketName: string;
  objectKey: string;
  eventName: string;
  objectSize?: number;
  eTag?: string;
  sequencer?: string;
}

// CloudWatch Alarm Configuration
export interface AlarmConfig {
  alarmName: string;
  alarmDescription: string;
  metricName: string;
  namespace: string;
  threshold: number;
  comparisonOperator: string;
  evaluationPeriods: number;
  period: number;
  statistic: string;
  treatMissingData: string;
  dimensions?: Record<string, string>;
}

// Custom Metric Data
export interface CustomMetric {
  metricName: string;
  namespace: string;
  value: number;
  unit: string;
  dimensions?: Array<{
    name: string;
    value: string;
  }>;
  timestamp?: Date;
}

// Email Template Data
export interface EmailTemplateData {
  studentName: string;
  trainerName?: string;
  sessionDate: string;
  notes?: string;
  downloadUrl: string;
  expirationDate: string;
  fileName: string;
}

// Cost Optimization Metrics
export interface CostMetrics {
  service: string;
  metric: string;
  value: number;
  unit: string;
  timestamp: string;
  dimensions: Record<string, string>;
}

// GDPR Data Subject Request
export interface GdprRequest {
  type: 'export' | 'delete';
  email: string;
  requestId: string;
  timestamp: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

// Infrastructure Resources Interface
export interface InfrastructureResources {
  storage: {
    videosBucket: string;
    frontendBucket: string;
    uploadsTable: string;
  };
  api: {
    restApiId: string;
    uploadHandlerArn: string;
    downloadHandlerArn: string;
    emailSenderArn: string;
  };
  frontend: {
    distributionId: string;
    distributionDomainName: string;
  };
  dns: {
    hostedZoneId: string;
    certificateArn: string;
    wildcardCertificateArn: string;
    cloudFrontCertificateArn: string;
    nameServers: string[];
  };
  security: {
    webAclArn?: string;
    kmsKeyIds: Record<string, string>;
  };
  monitoring: {
    dashboardUrl: string;
    logGroups: string[];
  };
}

// WAF Rule Configuration
export interface WafRuleConfig {
  name: string;
  priority: number;
  action: 'ALLOW' | 'BLOCK' | 'COUNT';
  statement: any; // WAF v2 statement structure
  visibilityConfig: {
    sampledRequestsEnabled: boolean;
    cloudWatchMetricsEnabled: boolean;
    metricName: string;
  };
}

// VPC Configuration
export interface VpcConfig {
  cidr: string;
  maxAzs: number;
  enableDnsHostnames: boolean;
  enableDnsSupport: boolean;
  natGateways: number;
  subnetConfiguration: Array<{
    name: string;
    subnetType: string;
    cidrMask: number;
  }>;
}

// Cross-Stack References with proper typing
export interface CrossStackRefs {
  storageStack?: {
    videosBucket: any;
    frontendBucket: any;
    templatesBucket: any;
    uploadsTable: any;
    kmsKeys: {
      s3: any;
      dynamodb: any;
    };
  };
  securityStack?: {
    webAcl: any;
    lambdaRole: any;
    apiGatewayRole: any;
    kmsKeys: {
      s3: any;
      dynamodb: any;
      logs: any;
      ses: any;
      lambda: any;
      general: any;
    };
  };
  dnsStack?: {
    hostedZone: any;
    certificate: any;
    wildcardCertificate: any;
    usEast1Certificate: any;
    hostedZoneId: string;
    nameServers: string[];
  };
  apiStack?: {
    restApi: any;
  };
  vpcStack?: {
    vpc: any;
    securityGroups: Record<string, any>;
  };
}

// Health Check Response
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  version: string;
  timestamp: string;
  checks: Array<{
    name: string;
    status: 'pass' | 'fail';
    duration?: number;
    output?: string;
  }>;
}

// Pagination Interface
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Recent Uploads Response
export interface RecentUploadsResponse {
  success: boolean;
  data?: PaginatedResponse<{
    fileId: string;
    fileName: string;
    studentEmail: string;
    studentName?: string;
    sessionDate: string;
    uploadDate: string;
    fileSize: number;
    emailSent: boolean;
    downloadCount: number;
  }>;
  error?: string;
}

// Environment Validation Result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Deployment Configuration
export interface DeploymentConfig {
  environment: string;
  region: string;
  account: string;
  certificateArn?: string;
  hostedZoneId?: string;
  enableMonitoring: boolean;
  enableWaf: boolean;
  enableVpc: boolean;
}

// Lambda Layer Configuration
export interface LayerConfig {
  layerName: string;
  description: string;
  compatibleRuntimes: string[];
  code: any; // CDK Code asset
}

// Resource Tags Interface
export interface ResourceTags {
  Project: string;
  Environment: string;
  ManagedBy: string;
  CostCenter: string;
  Owner?: string;
  Purpose?: string;
}

// API Documentation Interface
export interface ApiDocumentation {
  title: string;
  description: string;
  version: string;
  endpoints: Array<{
    path: string;
    method: string;
    description: string;
    parameters?: any;
    responses?: any;
  }>;
}

// Monitoring Dashboard Configuration
export interface DashboardConfig {
  dashboardName: string;
  widgets: Array<{
    type: 'metric' | 'log' | 'alarm';
    title: string;
    configuration: any;
  }>;
}

// Backup Configuration
export interface BackupConfig {
  enabled: boolean;
  schedule: string; // Cron expression
  retentionDays: number;
  crossRegion: boolean;
  encryptionEnabled: boolean;
}

// Feature Flag Configuration
export interface FeatureFlags {
  enableMultipartUpload: boolean;
  enableVideoTranscoding: boolean;
  enableRealTimeNotifications: boolean;
  enableAnalytics: boolean;
  enableDetailedMonitoring: boolean;
}

// SES Configuration
export interface SesConfig {
  fromAddress: string;
  configurationSet: string;
  bounceHandling: boolean;
  complaintHandling: boolean;
  templates: Record<string, string>;
}