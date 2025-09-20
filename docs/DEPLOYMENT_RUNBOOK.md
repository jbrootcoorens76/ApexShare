# ApexShare Deployment Runbook

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Pre-Deployment Checklist](#pre-deployment-checklist)
5. [Deployment Procedures](#deployment-procedures)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Rollback Procedures](#rollback-procedures)
8. [Troubleshooting](#troubleshooting)
9. [Emergency Procedures](#emergency-procedures)
10. [Maintenance Windows](#maintenance-windows)

---

## Overview

This runbook provides step-by-step procedures for deploying and maintaining the ApexShare serverless video sharing platform. It covers normal deployments, emergency procedures, and rollback scenarios.

### Deployment Types

- **Regular Deployment**: Scheduled updates and feature releases
- **Hotfix Deployment**: Critical bug fixes requiring immediate deployment
- **Emergency Deployment**: Security patches or critical system fixes
- **Rollback**: Reverting to a previous stable version

### Environments

- **Development** (`dev`): Feature development and testing
- **Staging** (`staging`): Pre-production testing and validation
- **Production** (`prod`): Live system serving end users

---

## Prerequisites

### Required Tools

```bash
# Verify required tools are installed
node --version        # v18.0.0 or higher
npm --version         # v8.0.0 or higher
aws --version         # v2.0.0 or higher
npx cdk --version     # v2.137.0 or higher
git --version         # v2.0.0 or higher
```

### AWS Account Access

```bash
# Verify AWS credentials and permissions
aws sts get-caller-identity
aws iam list-attached-user-policies --user-name $(aws sts get-caller-identity --query UserName --output text)
```

Required permissions:
- CloudFormation: Full access
- S3: Full access
- Lambda: Full access
- API Gateway: Full access
- DynamoDB: Full access
- Route 53: Full access
- CloudFront: Full access
- SES: Full access
- IAM: Role creation and management
- KMS: Key creation and management

### Repository Access

```bash
# Clone and setup repository
git clone https://github.com/your-org/apexshare.git
cd apexshare
npm install
```

---

## Environment Setup

### Development Environment

```bash
# Setup development environment
export CDK_ENVIRONMENT=dev
export AWS_REGION=eu-west-1
export AWS_PROFILE=apexshare-dev

# Verify configuration
npm run validate:config
```

### Staging Environment

```bash
# Setup staging environment
export CDK_ENVIRONMENT=staging
export AWS_REGION=eu-west-1
export AWS_PROFILE=apexshare-staging

# Additional staging-specific variables
export HOSTED_ZONE_ID=Z1234567890ABC
export CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012
```

### Production Environment

```bash
# Setup production environment
export CDK_ENVIRONMENT=prod
export AWS_REGION=eu-west-1
export AWS_PROFILE=apexshare-prod

# Production-specific variables
export HOSTED_ZONE_ID=Z0987654321XYZ
export CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/87654321-4321-4321-4321-210987654321
```

---

## Pre-Deployment Checklist

### Code Quality Verification

```bash
# 1. Run all tests
npm run test:all

# 2. Security audit
npm audit --audit-level high

# 3. Code linting
npm run lint

# 4. Build verification
npm run build
npm run build:lambdas
```

### Infrastructure Validation

```bash
# 1. CDK synthesis check
export CDK_ENVIRONMENT=staging
npm run cdk:synth

# 2. Configuration validation
npm run validate:config

# 3. Dependency check
npm ls --depth=0
```

### Security Verification

```bash
# 1. Check for secrets in code
git secrets --scan --recursive

# 2. Dependency vulnerability scan
npm audit

# 3. Infrastructure security scan
npm run security:scan
```

### Communication

- [ ] Notify stakeholders of planned deployment
- [ ] Update status page if applicable
- [ ] Ensure on-call engineer is available
- [ ] Verify rollback plan is ready

---

## Deployment Procedures

### Standard Deployment Process

#### Step 1: Development Deployment

```bash
# 1. Switch to development environment
export CDK_ENVIRONMENT=dev

# 2. Deploy to development
npm run deploy:dev

# 3. Verify deployment
npm run test:dev:integration

# 4. Smoke test
curl -f https://dev-api.apexshare.be/api/v1/health
```

#### Step 2: Staging Deployment

```bash
# 1. Switch to staging environment
export CDK_ENVIRONMENT=staging

# 2. Run staging deployment
npm run deploy:staging

# 3. Run comprehensive tests
npm run test:staging:all

# 4. Performance test
npm run test:performance

# 5. Security test
npm run test:security
```

#### Step 3: Production Deployment

```bash
# 1. Final verification
npm run test:staging:smoke

# 2. Switch to production environment
export CDK_ENVIRONMENT=prod

# 3. Create deployment backup
./scripts/backup-production.sh

# 4. Deploy to production
npm run deploy:prod

# 5. Immediate verification
npm run test:prod:smoke
```

### Hotfix Deployment Process

For critical issues requiring immediate production deployment:

```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-issue-fix

# 2. Apply minimal fix
# ... make necessary changes ...

# 3. Test fix in isolation
npm run test:unit

# 4. Deploy directly to staging
export CDK_ENVIRONMENT=staging
npm run deploy:staging:force

# 5. Verify fix
npm run test:staging:smoke

# 6. Deploy to production
export CDK_ENVIRONMENT=prod
npm run deploy:prod:force

# 7. Monitor for 30 minutes
./scripts/monitor-deployment.sh --duration 30m
```

### Stack-Specific Deployment

Deploy individual stacks when only specific components changed:

```bash
# Deploy only API stack
./scripts/deploy.sh --environment prod --stack API

# Deploy only Frontend stack
./scripts/deploy.sh --environment prod --stack Frontend

# Deploy only Storage stack
./scripts/deploy.sh --environment prod --stack Storage
```

---

## Post-Deployment Verification

### Automated Verification

```bash
# 1. Health check all endpoints
./scripts/health-check.sh --environment prod

# 2. Integration test suite
npm run test:prod:integration

# 3. End-to-end workflow test
npm run test:e2e:critical
```

### Manual Verification

#### API Verification

```bash
# 1. Test health endpoint
curl -f https://api.apexshare.be/api/v1/health

# 2. Test upload endpoint
curl -X POST https://api.apexshare.be/api/v1/upload \
  -H "Content-Type: application/json" \
  -d @test-data/sample-upload.json

# 3. Test CORS
curl -X OPTIONS https://api.apexshare.be/api/v1/upload \
  -H "Origin: https://apexshare.be"
```

#### Frontend Verification

```bash
# 1. Test main page load
curl -f https://apexshare.be

# 2. Test CloudFront distribution
curl -I https://apexshare.be

# 3. Test static assets
curl -f https://apexshare.be/static/js/main.js
```

#### Email Service Verification

```bash
# 1. Check SES configuration
aws ses get-send-quota

# 2. Test email sending (staging only)
./scripts/test-email.sh --environment staging
```

### Monitoring Verification

```bash
# 1. Check CloudWatch alarms
aws cloudwatch describe-alarms \
  --alarm-names $(aws cloudwatch describe-alarms --query 'MetricAlarms[?starts_with(AlarmName, `ApexShare-prod`)].AlarmName' --output text)

# 2. Verify log streams
aws logs describe-log-streams \
  --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
  --order-by LastEventTime \
  --descending \
  --max-items 5

# 3. Check metrics
./scripts/check-metrics.sh --environment prod --duration 1h
```

---

## Rollback Procedures

### Automatic Rollback Triggers

The system automatically triggers rollback if:
- API error rate > 10% for 5 minutes
- Lambda error rate > 15% for 5 minutes
- Any critical alarm for 10+ minutes
- Health check failures for 3+ consecutive checks

### Manual Rollback Process

#### Quick Rollback (Lambda Functions Only)

```bash
# 1. Identify previous version
aws lambda list-versions-by-function \
  --function-name apexshare-upload-handler-prod \
  --query 'Versions[-2].Version'

# 2. Rollback Lambda functions
aws lambda update-alias \
  --function-name apexshare-upload-handler-prod \
  --name LIVE \
  --function-version <previous-version>

# 3. Verify rollback
curl -f https://api.apexshare.be/api/v1/health
```

#### Full Infrastructure Rollback

```bash
# 1. Identify last known good deployment
git log --oneline -10

# 2. Checkout previous version
git checkout <previous-commit-hash>

# 3. Deploy previous version
export CDK_ENVIRONMENT=prod
npm run deploy:prod:force

# 4. Verify rollback
npm run test:prod:smoke
```

#### Database Rollback (if needed)

```bash
# 1. Stop write operations
aws lambda update-function-configuration \
  --function-name apexshare-upload-handler-prod \
  --environment Variables='{MAINTENANCE_MODE=true}'

# 2. Restore from point-in-time
aws dynamodb restore-table-to-point-in-time \
  --source-table-name apexshare-uploads-prod \
  --target-table-name apexshare-uploads-prod-restored \
  --restore-date-time $(date -d '30 minutes ago' -u +%Y-%m-%dT%H:%M:%S)

# 3. Switch table names (requires careful coordination)
# ... detailed steps in separate procedure document ...
```

### Rollback Verification

```bash
# 1. Verify all services are healthy
./scripts/health-check.sh --environment prod

# 2. Test critical functionality
npm run test:prod:critical

# 3. Monitor error rates
./scripts/monitor-errors.sh --duration 15m

# 4. Check CloudWatch alarms
aws cloudwatch describe-alarms --state-value ALARM
```

---

## Troubleshooting

### Common Deployment Issues

#### CDK Bootstrap Issues

```bash
# Problem: CDK not bootstrapped
# Solution: Bootstrap CDK in target region
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/eu-west-1
```

#### IAM Permission Issues

```bash
# Problem: Insufficient permissions
# Solution: Verify IAM policies
aws iam simulate-principal-policy \
  --policy-source-arn $(aws sts get-caller-identity --query Arn --output text) \
  --action-names cloudformation:CreateStack \
  --resource-arns "*"
```

#### Lambda Function Issues

```bash
# Problem: Lambda function fails to deploy
# Solution: Check function size and dependencies
du -sh lambda/*/dist
npm ls --depth=0 --prefix lambda/upload-handler
```

#### S3 Bucket Issues

```bash
# Problem: S3 bucket already exists
# Solution: Check bucket ownership or use different name
aws s3api head-bucket --bucket apexshare-videos-prod
aws s3api get-bucket-location --bucket apexshare-videos-prod
```

### Monitoring and Diagnostics

#### Real-time Monitoring

```bash
# Monitor CloudWatch logs in real-time
aws logs tail /aws/lambda/apexshare-upload-handler-prod --follow

# Monitor API Gateway access logs
aws logs tail /aws/apigateway/apexshare-api-prod --follow

# Monitor CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name ApexShare-API-prod \
  --query 'StackEvents[0:10].{Time:Timestamp,Status:ResourceStatus,Reason:ResourceStatusReason}'
```

#### Performance Analysis

```bash
# Check Lambda performance metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=apexshare-upload-handler-prod \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# Check API Gateway latency
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --dimensions Name=ApiName,Value=apexshare-api-prod \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

---

## Emergency Procedures

### Security Incident Response

#### Immediate Actions

```bash
# 1. Block suspicious traffic via WAF
aws wafv2 update-ip-set \
  --scope REGIONAL \
  --id <ip-set-id> \
  --addresses <malicious-ip-addresses>

# 2. Enable detailed logging
aws lambda update-function-configuration \
  --function-name apexshare-upload-handler-prod \
  --environment Variables='{LOG_LEVEL=DEBUG}'

# 3. Rotate access keys if compromised
aws iam create-access-key --user-name apexshare-service-user
aws iam delete-access-key --user-name apexshare-service-user --access-key-id <old-key>
```

#### Investigation

```bash
# 1. Analyze CloudTrail logs
aws logs filter-log-events \
  --log-group-name CloudTrail/ApexShareAuditLog \
  --start-time $(date -d '2 hours ago' +%s000) \
  --filter-pattern "{ $.sourceIPAddress = \"<suspicious-ip>\" }"

# 2. Check for unauthorized API calls
aws logs filter-log-events \
  --log-group-name "/aws/apigateway/apexshare-api-prod" \
  --start-time $(date -d '2 hours ago' +%s000) \
  --filter-pattern "[timestamp, requestId, ip=\"<suspicious-ip>\"]"
```

### System Outage Response

#### Service Degradation

```bash
# 1. Enable maintenance mode
aws lambda update-function-configuration \
  --function-name apexshare-upload-handler-prod \
  --environment Variables='{MAINTENANCE_MODE=true}'

# 2. Scale up resources if needed
aws lambda put-provisioned-concurrency-config \
  --function-name apexshare-upload-handler-prod \
  --qualifier $LATEST \
  --provisioned-concurrency-count 10

# 3. Check AWS service health
curl -s https://status.aws.amazon.com/rss/ec2-eu-west-1.rss
```

#### Complete Outage

```bash
# 1. Assess scope of outage
./scripts/outage-assessment.sh

# 2. Communicate to stakeholders
# - Update status page
# - Send email notifications
# - Post on social media if applicable

# 3. Implement emergency fixes
# ... specific to the type of outage ...

# 4. Monitor recovery
./scripts/monitor-recovery.sh
```

---

## Maintenance Windows

### Scheduled Maintenance

#### Monthly Maintenance (Third Sunday, 2-4 AM UTC)

```bash
# 1. Pre-maintenance checklist
./scripts/pre-maintenance-check.sh

# 2. Enable maintenance mode
./scripts/enable-maintenance-mode.sh

# 3. Perform maintenance tasks
./scripts/monthly-maintenance.sh

# 4. Disable maintenance mode
./scripts/disable-maintenance-mode.sh

# 5. Post-maintenance verification
./scripts/post-maintenance-check.sh
```

Typical maintenance tasks:
- Lambda runtime updates
- Security patches
- Certificate renewals
- Performance optimizations
- Log cleanup
- Cost optimization review

#### Emergency Maintenance

```bash
# 1. Immediate notification
./scripts/emergency-notification.sh \
  --message "Emergency maintenance in progress" \
  --channels "email,slack,status-page"

# 2. Apply emergency fix
# ... specific to the emergency ...

# 3. Verify fix
./scripts/emergency-verification.sh

# 4. Restore normal operations
./scripts/restore-operations.sh
```

### Maintenance Procedures

#### Lambda Function Updates

```bash
# 1. Update runtime version
aws lambda update-function-configuration \
  --function-name apexshare-upload-handler-prod \
  --runtime nodejs20.x

# 2. Test updated function
aws lambda invoke \
  --function-name apexshare-upload-handler-prod \
  --payload '{"test": true}' \
  /tmp/response.json

# 3. Monitor for errors
aws logs filter-log-events \
  --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
  --start-time $(date -d '5 minutes ago' +%s000) \
  --filter-pattern "ERROR"
```

#### Certificate Renewal

```bash
# 1. Check certificate expiration
aws acm describe-certificate \
  --certificate-arn <certificate-arn> \
  --query 'Certificate.NotAfter'

# 2. Request new certificate (if not auto-renewing)
aws acm request-certificate \
  --domain-name apexshare.be \
  --subject-alternative-names "*.apexshare.be" \
  --validation-method DNS

# 3. Update CloudFront distribution
aws cloudfront update-distribution \
  --id <distribution-id> \
  --distribution-config file://updated-distribution-config.json
```

#### Database Maintenance

```bash
# 1. Backup current data
aws dynamodb create-backup \
  --table-name apexshare-uploads-prod \
  --backup-name "maintenance-backup-$(date +%Y%m%d)"

# 2. Update table configuration
aws dynamodb modify-table \
  --table-name apexshare-uploads-prod \
  --billing-mode-summary BillingMode=ON_DEMAND

# 3. Verify table health
aws dynamodb describe-table \
  --table-name apexshare-uploads-prod \
  --query 'Table.TableStatus'
```

---

## Deployment Scripts Reference

### Core Deployment Scripts

```bash
# Main deployment script
./scripts/deploy.sh --environment prod

# Destroy infrastructure
./scripts/destroy.sh --environment dev

# Run comprehensive tests
./scripts/run-tests.sh --all

# Monitor deployment
./scripts/monitor-deployment.sh --duration 30m
```

### Utility Scripts

```bash
# Backup production data
./scripts/backup-production.sh

# Check system health
./scripts/health-check.sh --environment prod

# Generate deployment report
./scripts/deployment-report.sh --environment prod

# Update documentation
./scripts/update-docs.sh
```

### Emergency Scripts

```bash
# Emergency rollback
./scripts/emergency-rollback.sh --to-version <version>

# Enable maintenance mode
./scripts/maintenance-mode.sh --enable

# Security incident response
./scripts/security-incident.sh --ip <malicious-ip>
```

---

## Best Practices

### Deployment Best Practices

1. **Always test in staging first**
2. **Use feature flags for risky changes**
3. **Deploy during low-traffic periods**
4. **Have a rollback plan ready**
5. **Monitor metrics after deployment**
6. **Document all changes**

### Security Best Practices

1. **Rotate credentials regularly**
2. **Use least-privilege access**
3. **Monitor for suspicious activity**
4. **Keep dependencies updated**
5. **Encrypt all data in transit and at rest**

### Operational Best Practices

1. **Automate repetitive tasks**
2. **Maintain comprehensive logs**
3. **Set up proper alerting**
4. **Document procedures thoroughly**
5. **Regular disaster recovery testing**

---

*ApexShare Deployment Runbook v1.0 - September 2025*

*This runbook should be updated after each deployment to reflect any procedural changes or lessons learned.*