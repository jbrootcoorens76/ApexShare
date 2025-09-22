# ApexShare Deployment Guide

This guide provides comprehensive instructions for deploying the ApexShare serverless video sharing infrastructure using AWS CDK.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Environment Configuration](#environment-configuration)
4. [Deployment Process](#deployment-process)
5. [Post-Deployment Configuration](#post-deployment-configuration)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)
7. [Troubleshooting](#troubleshooting)
8. [Cost Management](#cost-management)

## Prerequisites

### Required Tools

- **Node.js** (version 18 or higher)
- **npm** (comes with Node.js)
- **AWS CLI** (version 2.0 or higher)
- **AWS CDK** (version 2.137.0 or higher)
- **Git** (for version control)

### AWS Account Requirements

- AWS account with administrative access
- AWS CLI configured with appropriate credentials
- Domain name registered and ready for configuration (apexshare.be)
- Verified email address for notifications

### Installation Commands

```bash
# Install Node.js (if not already installed)
# Visit https://nodejs.org/ for installation instructions

# Install AWS CLI
# Visit https://aws.amazon.com/cli/ for installation instructions

# Install AWS CDK globally
npm install -g aws-cdk

# Verify installations
node --version        # Should be 18+
npm --version         # Should be 8+
aws --version         # Should be 2.0+
cdk --version         # Should be 2.137.0+
```

## Initial Setup

### 1. Clone and Prepare Repository

```bash
# Clone the repository
git clone <repository-url>
cd ApexShare

# Install dependencies
npm install

# Build the project
npm run build

# Build Lambda functions
npm run build:lambdas
```

### 2. Configure AWS Credentials

```bash
# Configure AWS CLI (if not already done)
aws configure

# Or use environment variables
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=eu-west-1
```

### 3. Validate Configuration

```bash
# Test AWS connectivity
aws sts get-caller-identity

# Validate project configuration
npm run validate:config

# Check CDK configuration
npm run cdk:list
```

## Environment Configuration

### Available Environments

| Environment | Purpose | Features |
|-------------|---------|----------|
| **dev** | Development | Cost-optimized, limited monitoring, temporary resources |
| **staging** | Testing | Production-like, full monitoring, persistent resources |
| **prod** | Production | Full security, monitoring, backup, compliance |

### Environment-Specific Settings

The configuration is managed in `lib/shared/config.ts`:

- **Domain**: apexshare.be (all environments)
- **Region**: eu-west-1 (primary), eu-central-1 (backup)
- **Account**: Configured per environment
- **Resource sizing**: Optimized per environment
- **Monitoring**: Enabled based on environment needs

## Deployment Process

### Development Environment

```bash
# Deploy to development (recommended for first deployment)
npm run deploy:dev

# Or with manual script
./scripts/deploy.sh --environment dev

# Dry run to see what will be deployed
npm run deploy:dev:dry-run
```

### Staging Environment

```bash
# Deploy to staging
npm run deploy:staging

# Force deployment without prompts
npm run deploy:staging:force
```

### Production Environment

```bash
# Deploy to production (with confirmation prompts)
npm run deploy:prod

# Dry run first (recommended)
npm run deploy:prod:dry-run

# Then deploy
npm run deploy:prod
```

### Deployment Order

The CDK app automatically deploys stacks in the correct order:

1. **Security Stack** - KMS keys, IAM roles, WAF
2. **DNS Stack** - Route 53, SSL certificates
3. **Storage Stack** - S3 buckets, DynamoDB tables
4. **API Stack** - Lambda functions, API Gateway
5. **Frontend Stack** - CloudFront, static hosting
6. **Email Stack** - SES configuration
7. **Monitoring Stack** - CloudWatch, alarms

### Stack-Specific Deployment

```bash
# Deploy only specific stack
./scripts/deploy.sh --environment dev --stack Storage
./scripts/deploy.sh --environment prod --stack Security
```

## Post-Deployment Configuration

### 1. DNS Configuration

After deployment, update your domain registrar with the Route 53 name servers:

```bash
# Get name servers from deployment output
aws cloudformation describe-stacks \
  --stack-name ApexShare-DNS-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`NameServers`].OutputValue' \
  --output text
```

**Manual Steps:**
1. Log into your domain registrar (where you registered apexshare.be)
2. Update the name servers to use the Route 53 values
3. Wait 24-48 hours for DNS propagation

### 2. SES Domain Verification

```bash
# Check SES domain verification status
aws ses get-identity-verification-attributes --identities apexshare.be
```

**Manual Steps:**
1. Check AWS SES Console for verification records
2. Add DKIM records to Route 53 (usually automatic)
3. Verify domain identity status

### 3. SSL Certificate Validation

Certificates are validated automatically via DNS, but you can check status:

```bash
# Check certificate status
aws acm list-certificates --query 'CertificateSummaryList[?DomainName==`apexshare.be`]'
```

### 4. CloudFront Distribution

```bash
# Get CloudFront distribution domain
aws cloudformation describe-stacks \
  --stack-name ApexShare-Frontend-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
  --output text
```

### 5. Test Infrastructure

```bash
# Test API endpoints
curl https://api.apexshare.be/api/v1/health

# Test frontend
curl https://apexshare.be

# Test upload functionality (requires valid request)
# See API documentation for request format
```

## Monitoring and Maintenance

### CloudWatch Dashboard

Access your monitoring dashboard:

```bash
# Get dashboard URL
aws cloudformation describe-stacks \
  --stack-name ApexShare-Monitoring-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`DashboardUrl`].OutputValue' \
  --output text
```

### Log Analysis

```bash
# View Lambda logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/apexshare"

# View API Gateway logs
aws logs describe-log-groups --log-group-name-prefix "/aws/apigateway"

# Use Log Insights for advanced queries
aws logs start-query \
  --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/'
```

### Alarm Management

```bash
# List CloudWatch alarms
aws cloudwatch describe-alarms --alarm-name-prefix "ApexShare"

# Check alarm history
aws cloudwatch describe-alarm-history --alarm-name "ApexShare-API-5xx-errors-prod"
```

## Troubleshooting

### Common Deployment Issues

#### 1. Bootstrap Issues

```bash
# Re-bootstrap CDK
cdk bootstrap aws://ACCOUNT-ID/eu-west-1

# Check bootstrap stack
aws cloudformation describe-stacks --stack-name CDKToolkit
```

#### 2. Permission Issues

```bash
# Check current AWS identity
aws sts get-caller-identity

# Verify IAM permissions
aws iam list-attached-user-policies --user-name your-username
```

#### 3. Resource Conflicts

```bash
# Check existing resources
aws s3 ls | grep apexshare
aws dynamodb list-tables | grep apexshare

# Clean up orphaned resources if needed
./scripts/destroy.sh --environment dev --dry-run
```

#### 4. Certificate Issues

```bash
# Check certificate validation
aws acm describe-certificate --certificate-arn arn:aws:acm:...

# Check DNS records
dig TXT _acme-challenge.apexshare.be
```

### Stack Drift Detection

```bash
# Detect configuration drift
cdk diff --app ./bin/apexshare.ts

# Check CloudFormation drift
aws cloudformation detect-stack-drift --stack-name ApexShare-Storage-prod
aws cloudformation describe-stack-drift-detection-status --stack-drift-detection-id <id>
```

### Log Troubleshooting

```bash
# View recent errors across all Lambda functions
aws logs filter-log-events \
  --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s000)

# Check API Gateway errors
aws logs filter-log-events \
  --log-group-name "/aws/apigateway/apexshare-api-prod" \
  --filter-pattern "[timestamp, request_id, error_type=\"ERROR\"]"
```

## Cost Management

### Monitor Costs

```bash
# Get cost and usage (requires Cost Explorer API access)
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE

# Check current month costs
npm run cost:estimate
```

### Cost Optimization

1. **S3 Storage Classes**: Automatically configured via lifecycle policies
2. **Lambda Memory**: Optimized per function based on usage patterns
3. **DynamoDB**: On-demand billing for cost efficiency
4. **CloudFront**: Optimized cache behaviors
5. **Resource Cleanup**: Automatic TTL on temporary data

### Budget Alerts

Production environment includes automatic budget alerts:

- Monthly budget: $100
- Daily budget: $5
- Alert thresholds: 50%, 80%, 100%

## Resource Cleanup

### Development/Staging Cleanup

```bash
# Remove development environment
npm run destroy:dev

# Remove staging environment
npm run destroy:staging
```

### Production Cleanup (with data preservation)

```bash
# Remove compute resources but preserve data
npm run destroy:prod

# Complete removal (⚠️ DATA LOSS!)
npm run destroy:prod:complete
```

### Manual Cleanup

```bash
# List all ApexShare resources
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=ApexShare

# Clean up specific resource types
aws s3 ls | grep apexshare
aws dynamodb list-tables | grep apexshare
aws lambda list-functions | grep apexshare
```

## Security Considerations

### Access Control

- All IAM roles follow least-privilege principle
- Cross-stack references prevent unauthorized access
- WAF rules protect against common attacks
- KMS encryption for all data at rest

### Monitoring

- CloudTrail logs all API calls
- Config rules monitor compliance
- CloudWatch alarms on security events
- SNS notifications for critical alerts

### Data Protection

- All S3 buckets block public access
- DynamoDB encryption at rest
- SES domain authentication (DKIM, SPF, DMARC)
- HTTPS-only communications

## Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**: Review CloudWatch dashboards and alarms
2. **Monthly**: Check AWS billing and cost optimization opportunities
3. **Quarterly**: Update dependencies and security patches
4. **Annually**: Review security configurations and conduct audits

### Backup Strategy

- S3: Cross-region replication for critical data (configurable)
- DynamoDB: Point-in-time recovery enabled
- CloudTrail: Long-term audit log retention
- Configuration: Infrastructure as Code in Git

### Update Process

```bash
# Update CDK and dependencies
npm update

# Test changes in development
npm run deploy:dev:dry-run
npm run deploy:dev

# Deploy to staging for testing
npm run deploy:staging

# Deploy to production with approval
npm run deploy:prod
```

For additional support or questions, refer to the AWS documentation or contact the development team.