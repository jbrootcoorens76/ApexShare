#!/usr/bin/env node
/**
 * ApexShare CDK Application Entry Point
 *
 * This file orchestrates the deployment of all ApexShare infrastructure stacks
 * across different environments (dev, staging, prod) with proper dependency management
 * and cross-stack references.
 */

import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/stacks/storage-stack';
import { SecurityStack } from '../lib/stacks/security-stack';
import { DnsStack } from '../lib/stacks/dns-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { EmailStack } from '../lib/stacks/email-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';
import { getEnvironmentConfig, validateEnvironmentConfig } from '../lib/shared/config';
import { CrossStackRefs } from '../lib/shared/types';

// Get environment from CDK context or environment variable
const environmentName = (process.env.CDK_ENVIRONMENT || 'dev') as 'dev' | 'staging' | 'prod';

// Validate environment configuration
const config = getEnvironmentConfig(environmentName);
const validation = validateEnvironmentConfig(config);

if (!validation.valid) {
  console.error('❌ Environment configuration validation failed:');
  validation.errors.forEach(error => console.error(`  - ${error}`));
  process.exit(1);
}

if (validation.warnings.length > 0) {
  console.warn('⚠️  Environment configuration warnings:');
  validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
}

console.log(`🚀 Deploying ApexShare infrastructure for environment: ${environmentName}`);
console.log(`📍 Region: ${config.aws.region}`);
console.log(`🏗️  Account: ${config.aws.account}`);

// Initialize CDK App
const app = new cdk.App();

// Common stack properties
const stackProps = {
  config,
  env: {
    account: config.aws.account,
    region: config.aws.region,
  },
  terminationProtection: config.env === 'prod',
  description: `ApexShare ${config.env} - Serverless video sharing infrastructure`,
};

// Cross-stack references object to pass between stacks
const crossStackRefs: CrossStackRefs = {};

/**
 * Deploy stacks in the correct order with proper dependencies
 */

// 1. Security Stack (KMS keys, IAM roles, WAF)
console.log('📦 Creating Security Stack...');
const securityStack = new SecurityStack(app, `ApexShare-Security-${config.env}`, stackProps);
crossStackRefs.securityStack = {
  webAcl: securityStack.outputs.webAcl,
  lambdaRole: securityStack.outputs.lambdaExecutionRole,
  apiGatewayRole: securityStack.outputs.apiGatewayRole,
  kmsKeys: securityStack.outputs.kmsKeys,
};

// 2. DNS Stack (Route 53, Certificates)
console.log('📦 Creating DNS Stack...');
const dnsStack = new DnsStack(app, `ApexShare-DNS-${config.env}`, stackProps);
crossStackRefs.dnsStack = {
  hostedZone: dnsStack.outputs.hostedZone,
  certificate: dnsStack.outputs.certificate,
  wildcardCertificate: dnsStack.outputs.wildcardCertificate,
  usEast1Certificate: dnsStack.outputs.usEast1Certificate,
  hostedZoneId: dnsStack.outputs.hostedZoneId,
  nameServers: dnsStack.outputs.nameServers,
};

// 3. Storage Stack (S3, DynamoDB)
console.log('📦 Creating Storage Stack...');
const storageStack = new StorageStack(app, `ApexShare-Storage-${config.env}`, {
  ...stackProps,
  crossStackRefs,
});
crossStackRefs.storageStack = {
  videosBucket: storageStack.videosBucket,
  frontendBucket: storageStack.frontendBucket,
  templatesBucket: storageStack.templatesBucket,
  uploadsTable: storageStack.uploadsTable,
  kmsKeys: {
    s3: storageStack.s3EncryptionKey,
    dynamodb: storageStack.dynamoEncryptionKey,
  },
};

// 4. API Stack (Lambda, API Gateway)
console.log('📦 Creating API Stack...');
const apiStack = new ApiStack(app, `ApexShare-API-${config.env}`, {
  ...stackProps,
  crossStackRefs,
});

// Add API stack references for frontend
crossStackRefs.apiStack = {
  restApi: apiStack.api,
};

// 5. Frontend Stack (CloudFront, Static S3)
console.log('📦 Creating Frontend Stack...');
const frontendStack = new FrontendStack(app, `ApexShare-Frontend-${config.env}`, {
  ...stackProps,
  crossStackRefs,
});

// 6. Email Stack (SES)
console.log('📦 Creating Email Stack...');
const emailStack = new EmailStack(app, `ApexShare-Email-${config.env}`, stackProps);

// 7. Monitoring Stack (CloudWatch, Alarms)
console.log('📦 Creating Monitoring Stack...');
const monitoringStack = new MonitoringStack(app, `ApexShare-Monitoring-${config.env}`, {
  ...stackProps,
  crossStackRefs,
});

/**
 * Set up stack dependencies to ensure proper deployment order
 */

// Storage stack depends on Security stack for KMS keys and IAM roles
storageStack.addDependency(securityStack);

// API stack depends on Storage and Security stacks
apiStack.addDependency(storageStack);
apiStack.addDependency(securityStack);

// Frontend stack depends on DNS, API, and Security stacks
frontendStack.addDependency(dnsStack);
frontendStack.addDependency(apiStack);
frontendStack.addDependency(securityStack);

// Email stack depends on DNS stack for domain verification
emailStack.addDependency(dnsStack);

// Monitoring stack depends on all other stacks for complete visibility
monitoringStack.addDependency(securityStack);
monitoringStack.addDependency(storageStack);
monitoringStack.addDependency(apiStack);
monitoringStack.addDependency(frontendStack);
monitoringStack.addDependency(emailStack);

/**
 * Add global tags to all resources
 */
cdk.Tags.of(app).add('Project', 'ApexShare');
cdk.Tags.of(app).add('Environment', config.env);
cdk.Tags.of(app).add('ManagedBy', 'CDK');
cdk.Tags.of(app).add('Repository', 'https://github.com/apexshare/infrastructure');
cdk.Tags.of(app).add('CostCenter', 'Engineering');
cdk.Tags.of(app).add('Owner', 'Platform Team');

// Add environment-specific tags
if (config.env === 'prod') {
  cdk.Tags.of(app).add('Backup', 'Required');
  cdk.Tags.of(app).add('Monitoring', 'Critical');
} else {
  cdk.Tags.of(app).add('Backup', 'Optional');
  cdk.Tags.of(app).add('Monitoring', 'Standard');
}

/**
 * Environment-specific configurations and warnings
 */
if (config.env === 'prod') {
  console.log('🔒 Production environment detected - enabling additional protections');

  // Add termination protection to critical stacks in production
  storageStack.terminationProtection = true;
  dnsStack.terminationProtection = true;
  securityStack.terminationProtection = true;

  console.log('⚠️  Production deployment checklist:');
  console.log('   1. Ensure domain ownership is verified');
  console.log('   2. Configure DNS name servers with domain registrar');
  console.log('   3. Set up monitoring alerts and notifications');
  console.log('   4. Verify backup configurations');
  console.log('   5. Review security settings and access controls');
}

if (config.env === 'dev') {
  console.log('🧪 Development environment - using cost-optimized settings');
  console.log('⚠️  Development environment notes:');
  console.log('   - Resources will be removed when stack is destroyed');
  console.log('   - Some monitoring features may be disabled');
  console.log('   - SSL certificates may be self-signed');
}

/**
 * Output deployment information
 */
console.log('\n📋 Deployment Summary:');
console.log(`   Environment: ${config.env}`);
console.log(`   Region: ${config.aws.region}`);
console.log(`   Domain: ${config.domain}`);
console.log(`   Account: ${config.aws.account}`);
console.log('\n🏗️  Stacks to be deployed:');
console.log('   1. Security Stack (KMS, IAM, WAF)');
console.log('   2. DNS Stack (Route 53, ACM)');
console.log('   3. Storage Stack (S3, DynamoDB)');
console.log('   4. API Stack (Lambda, API Gateway)');
console.log('   5. Frontend Stack (CloudFront, S3)');
console.log('   6. Email Stack (SES)');
console.log('   7. Monitoring Stack (CloudWatch, Alarms)');

console.log('\n🚀 Ready to deploy! Run:');
console.log(`   npm run deploy:${config.env}`);
console.log('\n💡 Useful commands:');
console.log('   npm run diff     - Compare deployed stack with current state');
console.log('   npm run synth    - Generate CloudFormation templates');
console.log('   npm run destroy  - Remove all resources (use with caution!)');

/**
 * Synthesis validation
 */
try {
  // Validate that all stacks can be synthesized
  app.synth();
  console.log('\n✅ All stacks synthesized successfully');
} catch (error) {
  console.error('\n❌ Stack synthesis failed:', error);
  process.exit(1);
}

/**
 * Post-deployment instructions
 */
console.log('\n📖 Post-deployment instructions:');
console.log('1. Update DNS name servers with your domain registrar');
console.log('2. Verify SES domain identity and DKIM records');
console.log('3. Test upload and download functionality');
console.log('4. Configure monitoring alert recipients');
console.log('5. Set up backup schedules if required');

if (config.env === 'prod') {
  console.log('\n🔐 Production security checklist:');
  console.log('- Review all IAM policies and roles');
  console.log('- Verify WAF rules are active and logging');
  console.log('- Confirm all data is encrypted at rest and in transit');
  console.log('- Test disaster recovery procedures');
  console.log('- Schedule security audits and penetration testing');
}

export { app };