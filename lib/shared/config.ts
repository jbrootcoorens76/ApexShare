/**
 * Environment Configuration Management for ApexShare
 *
 * Defines environment-specific configurations for dev, staging, and production
 * environments with appropriate resource sizing, security settings, and
 * operational parameters.
 */

export interface EnvironmentConfig {
  env: 'dev' | 'staging' | 'prod';
  domain: string;
  certificateArn?: string;
  hostedZoneId?: string;
  retentionDays: number;
  emailRetentionDays: number;
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  corsOrigins: string[];
  aws: {
    region: string;
    account: string;
  };
  monitoring: {
    alarms: boolean;
    detailedMetrics: boolean;
    dashboards: boolean;
  };
  lambda: {
    reservedConcurrency: {
      uploadHandler: number;
      emailSender: number;
      downloadHandler: number;
    };
    memorySize: {
      uploadHandler: number;
      emailSender: number;
      downloadHandler: number;
    };
    timeout: {
      uploadHandler: number;
      emailSender: number;
      downloadHandler: number;
    };
  };
  api: {
    throttling: {
      rateLimit: number;
      burstLimit: number;
    };
    caching: {
      enabled: boolean;
      ttl: number;
    };
  };
  s3: {
    versioning: boolean;
    lifecycleRules: boolean;
    intelligentTiering: boolean;
    accessLogging: boolean;
  };
  dynamodb: {
    pointInTimeRecovery: boolean;
    backupRetention: number;
    deletionProtection: boolean;
  };
  security: {
    wafEnabled: boolean;
    vpcEnabled: boolean;
    encryptionAtRest: boolean;
    encryptionInTransit: boolean;
  };
  costs: {
    budgetLimit: number; // Monthly budget in USD
    alertThreshold: number; // Percentage threshold for alerts
  };
}

const environments: Record<string, EnvironmentConfig> = {
  dev: {
    env: 'dev',
    domain: 'dev.apexshare.be',
    retentionDays: 7,
    emailRetentionDays: 7,
    logLevel: 'DEBUG',
    corsOrigins: ['https://dev.apexshare.be', 'http://localhost:3000', 'http://localhost:5173'],
    aws: {
      region: 'eu-west-1',
      account: process.env.CDK_DEFAULT_ACCOUNT || '',
    },
    monitoring: {
      alarms: false,
      detailedMetrics: true,
      dashboards: true,
    },
    lambda: {
      reservedConcurrency: {
        uploadHandler: 5,
        emailSender: 3,
        downloadHandler: 10,
      },
      memorySize: {
        uploadHandler: 256,
        emailSender: 512,
        downloadHandler: 256,
      },
      timeout: {
        uploadHandler: 30,
        emailSender: 120,
        downloadHandler: 30,
      },
    },
    api: {
      throttling: {
        rateLimit: 50,
        burstLimit: 100,
      },
      caching: {
        enabled: false,
        ttl: 300,
      },
    },
    s3: {
      versioning: false,
      lifecycleRules: true,
      intelligentTiering: false,
      accessLogging: false,
    },
    dynamodb: {
      pointInTimeRecovery: false,
      backupRetention: 7,
      deletionProtection: false,
    },
    security: {
      wafEnabled: false,
      vpcEnabled: false,
      encryptionAtRest: true,
      encryptionInTransit: true,
    },
    costs: {
      budgetLimit: 50,
      alertThreshold: 80,
    },
  },
  staging: {
    env: 'staging',
    domain: 'staging.apexshare.be',
    retentionDays: 14,
    emailRetentionDays: 14,
    logLevel: 'INFO',
    corsOrigins: ['https://staging.apexshare.be'],
    aws: {
      region: 'eu-west-1',
      account: process.env.CDK_DEFAULT_ACCOUNT || '',
    },
    monitoring: {
      alarms: true,
      detailedMetrics: true,
      dashboards: true,
    },
    lambda: {
      reservedConcurrency: {
        uploadHandler: 10,
        emailSender: 5,
        downloadHandler: 20,
      },
      memorySize: {
        uploadHandler: 256,
        emailSender: 512,
        downloadHandler: 256,
      },
      timeout: {
        uploadHandler: 30,
        emailSender: 120,
        downloadHandler: 30,
      },
    },
    api: {
      throttling: {
        rateLimit: 100,
        burstLimit: 300,
      },
      caching: {
        enabled: true,
        ttl: 300,
      },
    },
    s3: {
      versioning: true,
      lifecycleRules: true,
      intelligentTiering: true,
      accessLogging: true,
    },
    dynamodb: {
      pointInTimeRecovery: true,
      backupRetention: 14,
      deletionProtection: false,
    },
    security: {
      wafEnabled: true,
      vpcEnabled: false,
      encryptionAtRest: true,
      encryptionInTransit: true,
    },
    costs: {
      budgetLimit: 200,
      alertThreshold: 75,
    },
  },
  prod: {
    env: 'prod',
    domain: 'apexshare.be',
    // These will be set via CDK context or environment variables
    certificateArn: undefined,
    hostedZoneId: undefined,
    retentionDays: 90,
    emailRetentionDays: 30,
    logLevel: 'WARN',
    corsOrigins: ['https://apexshare.be'],
    aws: {
      region: 'eu-west-1',
      account: process.env.CDK_DEFAULT_ACCOUNT || '',
    },
    monitoring: {
      alarms: true,
      detailedMetrics: false,
      dashboards: true,
    },
    lambda: {
      reservedConcurrency: {
        uploadHandler: 20,
        emailSender: 10,
        downloadHandler: 50,
      },
      memorySize: {
        uploadHandler: 512,
        emailSender: 1024,
        downloadHandler: 512,
      },
      timeout: {
        uploadHandler: 30,
        emailSender: 120,
        downloadHandler: 30,
      },
    },
    api: {
      throttling: {
        rateLimit: 100,
        burstLimit: 500,
      },
      caching: {
        enabled: true,
        ttl: 300,
      },
    },
    s3: {
      versioning: true,
      lifecycleRules: true,
      intelligentTiering: true,
      accessLogging: true,
    },
    dynamodb: {
      pointInTimeRecovery: true,
      backupRetention: 30,
      deletionProtection: true,
    },
    security: {
      wafEnabled: true,
      vpcEnabled: true,
      encryptionAtRest: true,
      encryptionInTransit: true,
    },
    costs: {
      budgetLimit: 1000,
      alertThreshold: 70,
    },
  },
};

/**
 * Get configuration for a specific environment
 *
 * @param env Environment name (dev, staging, prod)
 * @returns Environment configuration object
 * @throws Error if environment configuration is not found
 */
export const getConfig = (env: string): EnvironmentConfig => {
  const config = environments[env];
  if (!config) {
    throw new Error(`Environment configuration not found for: ${env}`);
  }

  // Override with CDK context or environment variables if available
  return {
    ...config,
    certificateArn: process.env.CERTIFICATE_ARN || config.certificateArn,
    hostedZoneId: process.env.HOSTED_ZONE_ID || config.hostedZoneId,
    aws: {
      ...config.aws,
      account: process.env.CDK_DEFAULT_ACCOUNT || config.aws.account,
      region: process.env.CDK_DEFAULT_REGION || config.aws.region,
    },
  };
};

/**
 * Get all available environment names
 *
 * @returns Array of environment names
 */
export const getEnvironmentNames = (): string[] => {
  return Object.keys(environments);
};

/**
 * Validate environment configuration
 *
 * @param config Environment configuration to validate
 * @throws Error if configuration is invalid
 */
export const validateConfig = (config: EnvironmentConfig): void => {
  if (!config.domain) {
    throw new Error('Domain is required in environment configuration');
  }

  if (config.env === 'prod' && !config.certificateArn) {
    console.warn('Production environment should have certificateArn configured');
  }

  if (config.env === 'prod' && !config.hostedZoneId) {
    console.warn('Production environment should have hostedZoneId configured');
  }

  if (config.lambda.reservedConcurrency.uploadHandler < 1) {
    throw new Error('Upload handler reserved concurrency must be at least 1');
  }

  if (config.api.throttling.rateLimit < 1) {
    throw new Error('API throttling rate limit must be at least 1');
  }

  if (config.retentionDays < 1) {
    throw new Error('Retention days must be at least 1');
  }
};

/**
 * Get resource naming configuration
 *
 * @param config Environment configuration
 * @returns Object with resource naming functions
 */
export const getResourceNames = (config: EnvironmentConfig) => {
  const { env } = config;

  return {
    // S3 Buckets
    videosBucket: `apexshare-videos-${env}`,
    frontendBucket: `apexshare-frontend-${env}`,
    accessLogsBucket: `apexshare-access-logs-${env}`,
    templatesBucket: `apexshare-templates-${env}`,

    // DynamoDB Tables
    uploadsTable: `apexshare-uploads-${env}`,

    // Lambda Functions
    uploadHandler: `apexshare-upload-handler-${env}`,
    downloadHandler: `apexshare-download-handler-${env}`,
    emailSender: `apexshare-email-sender-${env}`,

    // API Gateway
    restApi: `apexshare-api-${env}`,

    // CloudFront
    distribution: `apexshare-distribution-${env}`,

    // Route 53
    hostedZone: config.domain,

    // KMS Keys
    s3Key: `apexshare-s3-key-${env}`,
    dynamoKey: `apexshare-dynamo-key-${env}`,
    lambdaKey: `apexshare-lambda-key-${env}`,

    // CloudWatch
    logGroup: `/aws/apexshare/${env}`,
    dashboard: `ApexShare-${env}`,

    // WAF
    webAcl: `apexshare-waf-${env}`,

    // VPC (if enabled)
    vpc: `apexshare-vpc-${env}`,

    // Tags
    getTags: () => ({
      Project: 'ApexShare',
      Environment: env,
      ManagedBy: 'CDK',
      CostCenter: 'ApexShare',
    }),
  };
};

/**
 * Get stack names for the environment
 *
 * @param env Environment name
 * @returns Object with stack names
 */
export const getStackNames = (env: string) => ({
  storage: `ApexShare-Storage-${env}`,
  api: `ApexShare-API-${env}`,
  frontend: `ApexShare-Frontend-${env}`,
  email: `ApexShare-Email-${env}`,
  dns: `ApexShare-DNS-${env}`,
  security: `ApexShare-Security-${env}`,
  monitoring: `ApexShare-Monitoring-${env}`,
  costOptimization: `ApexShare-CostOptimization-${env}`,
});

/**
 * Get environment configuration (alias for getConfig for backward compatibility)
 *
 * @param env Environment name (dev, staging, prod)
 * @returns Environment configuration object
 */
export const getEnvironmentConfig = getConfig;

/**
 * Validate environment configuration with detailed validation result
 *
 * @param config Environment configuration to validate
 * @returns Validation result with detailed errors and warnings
 */
export const validateEnvironmentConfig = (config: EnvironmentConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    validateConfig(config);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  // Additional validation with warnings instead of errors
  if (config.env === 'prod' && !config.certificateArn) {
    warnings.push('Production environment should have certificateArn configured');
  }

  if (config.env === 'prod' && !config.hostedZoneId) {
    warnings.push('Production environment should have hostedZoneId configured');
  }

  if (config.costs.budgetLimit < 100 && config.env === 'prod') {
    warnings.push('Production environment budget limit seems low');
  }

  if (!config.monitoring.alarms && config.env === 'prod') {
    warnings.push('Production environment should have monitoring alarms enabled');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};