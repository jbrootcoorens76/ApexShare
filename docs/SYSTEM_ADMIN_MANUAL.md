# ApexShare System Administrator Manual

## Table of Contents

1. [System Overview](#system-overview)
2. [Infrastructure Architecture](#infrastructure-architecture)
3. [Daily Operations](#daily-operations)
4. [Monitoring and Alerting](#monitoring-and-alerting)
5. [Maintenance Procedures](#maintenance-procedures)
6. [Security Management](#security-management)
7. [Backup and Recovery](#backup-and-recovery)
8. [Performance Optimization](#performance-optimization)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Emergency Procedures](#emergency-procedures)
11. [Cost Management](#cost-management)
12. [Compliance and Auditing](#compliance-and-auditing)

---

## System Overview

### Platform Summary

ApexShare is a serverless video sharing platform built on AWS, designed for motorcycle training instructors to securely share training videos with students. The system handles video uploads, processing, secure storage, and time-limited access distribution.

### Key Components

- **Frontend**: React application served via CloudFront CDN
- **API**: REST API via AWS API Gateway and Lambda functions
- **Storage**: S3 buckets for video files and static assets
- **Database**: DynamoDB for metadata and access tracking
- **Email**: SES for automated notifications
- **Security**: WAF, KMS encryption, and IAM role-based access
- **Monitoring**: CloudWatch metrics, logs, and alarms

### Supported Environments

- **Production** (`prod`): https://apexshare.be
- **Staging** (`staging`): https://staging.apexshare.be
- **Development** (`dev`): https://dev.apexshare.be

---

## Infrastructure Architecture

### AWS Services Used

| Service | Purpose | Environment Scaling |
|---------|---------|-------------------|
| **API Gateway** | REST API endpoint | Rate limiting varies by env |
| **Lambda** | Serverless compute | Reserved concurrency by env |
| **S3** | Video and static file storage | Lifecycle policies enabled |
| **DynamoDB** | Metadata storage | On-demand billing |
| **SES** | Email notifications | Domain verified |
| **CloudFront** | CDN for fast delivery | Global edge locations |
| **Route 53** | DNS management | Multi-region setup |
| **WAF** | Web application firewall | Enabled in staging/prod |
| **KMS** | Encryption key management | Environment-specific keys |
| **CloudWatch** | Monitoring and logging | Retention varies by env |

### Lambda Functions

#### Upload Handler
- **Purpose**: Processes video upload requests and generates presigned URLs
- **Memory**: 256MB (dev), 512MB (prod)
- **Timeout**: 30 seconds
- **Concurrency**: 5 (dev), 20 (prod)
- **Triggers**: API Gateway POST /api/v1/upload

#### Download Handler
- **Purpose**: Validates access and generates download URLs
- **Memory**: 256MB (dev), 512MB (prod)
- **Timeout**: 30 seconds
- **Concurrency**: 10 (dev), 50 (prod)
- **Triggers**: API Gateway GET /api/v1/download/{fileId}

#### Email Sender
- **Purpose**: Sends notification emails when videos are ready
- **Memory**: 512MB (dev), 1024MB (prod)
- **Timeout**: 120 seconds
- **Concurrency**: 3 (dev), 10 (prod)
- **Triggers**: S3 object creation events

### Storage Architecture

#### S3 Buckets

**Videos Bucket** (`apexshare-videos-{env}`)
- Purpose: Stores uploaded video files
- Encryption: KMS with environment-specific keys
- Lifecycle: Delete after 7 days
- Versioning: Enabled in staging/prod
- Access Logging: Enabled in staging/prod

**Frontend Bucket** (`apexshare-frontend-{env}`)
- Purpose: Hosts React application static files
- Encryption: AES-256
- CloudFront: Origin for CDN distribution
- Versioning: Enabled

**Templates Bucket** (`apexshare-templates-{env}`)
- Purpose: Stores email templates
- Encryption: AES-256
- Access: Lambda functions only

#### DynamoDB Tables

**Uploads Table** (`apexshare-uploads-{env}`)
- Purpose: Stores video metadata and access information
- Partition Key: `fileId` (string)
- TTL: 7 days (automatic cleanup)
- Encryption: KMS with environment-specific keys
- Backup: Point-in-time recovery in staging/prod

### Network Security

#### WAF Rules (Staging/Production)
- SQL injection protection
- XSS protection
- Rate limiting (100 requests/5 minutes per IP)
- Geographic restrictions (configurable)
- Known bad inputs blocking

#### CORS Configuration
- Allowed origins: Environment-specific domains
- Allowed methods: GET, POST, OPTIONS
- Allowed headers: Content-Type, Authorization
- Max age: 86400 seconds

---

## Daily Operations

### Morning Checklist

1. **Check System Health**
   ```bash
   # Check CloudWatch dashboard
   aws cloudwatch get-dashboard --dashboard-name "ApexShare-prod"

   # Check for any alarms
   aws cloudwatch describe-alarms --state-value ALARM
   ```

2. **Review Overnight Activity**
   ```bash
   # Check upload volume from last 24 hours
   aws logs filter-log-events \
     --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
     --start-time $(date -d '24 hours ago' +%s000) \
     --filter-pattern "UPLOAD_SUCCESS"
   ```

3. **Verify Email Delivery**
   ```bash
   # Check SES sending statistics
   aws ses get-send-statistics

   # Check for bounces or complaints
   aws ses get-send-quota
   ```

4. **Storage Usage Review**
   ```bash
   # Check S3 bucket sizes
   aws s3 ls s3://apexshare-videos-prod --recursive --human-readable --summarize
   ```

### Weekly Tasks

1. **Performance Review**
   - Analyze Lambda execution duration and memory usage
   - Review API Gateway latency metrics
   - Check CloudFront cache hit ratios

2. **Security Audit**
   - Review WAF blocked requests
   - Check for unusual access patterns
   - Verify no expired SSL certificates

3. **Cost Analysis**
   - Review AWS Cost Explorer for trends
   - Check for any cost anomalies
   - Optimize resource allocation if needed

4. **Backup Verification**
   - Verify DynamoDB point-in-time recovery is functioning
   - Test restore procedures in development environment

### Monthly Tasks

1. **Security Updates**
   - Update Lambda runtime versions if available
   - Review and update IAM policies
   - Rotate access keys if used

2. **Capacity Planning**
   - Analyze growth trends
   - Adjust Lambda concurrency limits if needed
   - Review API Gateway throttling settings

3. **Documentation Updates**
   - Update operational procedures
   - Review and update monitoring playbooks
   - Update disaster recovery procedures

---

## Monitoring and Alerting

### CloudWatch Dashboards

#### Production Dashboard Widgets

1. **API Performance**
   - API Gateway requests per minute
   - API Gateway latency (P50, P95, P99)
   - API Gateway 4xx and 5xx errors

2. **Lambda Functions**
   - Invocation count and duration
   - Error rates and throttles
   - Memory utilization

3. **Storage**
   - S3 bucket object count and size
   - DynamoDB read/write capacity
   - DynamoDB throttled requests

4. **Email Service**
   - SES emails sent, bounced, and complained
   - Email delivery delays

### CloudWatch Alarms

#### Critical Alarms (Immediate Response Required)

```bash
# API Gateway 5xx errors > 5 in 5 minutes
AlarmName: "ApexShare-API-5xx-errors-prod"
MetricName: "5XXError"
Threshold: 5
Period: 300

# Lambda errors > 3 in 5 minutes
AlarmName: "ApexShare-Lambda-errors-prod"
MetricName: "Errors"
Threshold: 3
Period: 300

# DynamoDB throttled requests > 0
AlarmName: "ApexShare-DynamoDB-throttles-prod"
MetricName: "UserErrors"
Threshold: 0
Period: 300
```

#### Warning Alarms (Monitor and Investigate)

```bash
# API Gateway latency > 3000ms
AlarmName: "ApexShare-API-latency-prod"
MetricName: "Latency"
Threshold: 3000
Period: 300

# Lambda duration > 25 seconds (approaching timeout)
AlarmName: "ApexShare-Lambda-duration-prod"
MetricName: "Duration"
Threshold: 25000
Period: 300
```

### Log Analysis

#### Important Log Groups

```bash
# Lambda function logs
/aws/lambda/apexshare-upload-handler-prod
/aws/lambda/apexshare-download-handler-prod
/aws/lambda/apexshare-email-sender-prod

# API Gateway logs
/aws/apigateway/apexshare-api-prod

# CloudFront logs (if enabled)
/aws/cloudfront/distribution
```

#### Common Log Queries

```bash
# Find upload errors in last hour
aws logs filter-log-events \
  --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
  --start-time $(date -d '1 hour ago' +%s000) \
  --filter-pattern "ERROR"

# Find slow requests (>2 seconds)
aws logs filter-log-events \
  --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
  --start-time $(date -d '1 hour ago' +%s000) \
  --filter-pattern "[timestamp, requestId, duration > 2000]"
```

### Performance Metrics

#### Key Performance Indicators (KPIs)

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| API Response Time | <2s average | >3s |
| Upload Success Rate | >99% | <95% |
| Email Delivery Rate | >99% | <98% |
| System Availability | >99.9% | <99% |
| Lambda Error Rate | <0.1% | >1% |

---

## Maintenance Procedures

### Scheduled Maintenance

#### Monthly Lambda Updates

1. **Check for Runtime Updates**
   ```bash
   # List current Lambda functions
   aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `apexshare`)].{Name:FunctionName,Runtime:Runtime}'
   ```

2. **Update Function Configuration (if needed)**
   ```bash
   # Update runtime version
   aws lambda update-function-configuration \
     --function-name apexshare-upload-handler-prod \
     --runtime nodejs18.x
   ```

3. **Test After Updates**
   - Deploy to staging first
   - Run integration tests
   - Monitor error rates for 24 hours

#### Quarterly Security Reviews

1. **IAM Policy Audit**
   ```bash
   # List all ApexShare-related IAM roles
   aws iam list-roles --query 'Roles[?starts_with(RoleName, `ApexShare`)].RoleName'

   # Review policies for each role
   aws iam list-attached-role-policies --role-name ApexShare-Lambda-Role-prod
   ```

2. **Access Key Rotation**
   - Identify any long-term access keys
   - Rotate keys using AWS Secrets Manager
   - Update any hardcoded credentials

3. **Certificate Management**
   ```bash
   # Check SSL certificate expiration
   aws acm list-certificates --query 'CertificateSummaryList[?DomainName==`apexshare.be`]'
   ```

### Deployment Procedures

#### Production Deployment

1. **Pre-deployment Checklist**
   - [ ] Changes tested in staging environment
   - [ ] Integration tests passing
   - [ ] Security scan completed
   - [ ] Backup verification completed
   - [ ] Rollback plan prepared

2. **Deployment Steps**
   ```bash
   # 1. Build and test
   npm run build
   npm run test:all

   # 2. Deploy to staging first
   npm run deploy:staging

   # 3. Run staging tests
   npm run test:staging

   # 4. Deploy to production
   npm run deploy:prod
   ```

3. **Post-deployment Verification**
   - [ ] All alarms are in OK state
   - [ ] API endpoints responding correctly
   - [ ] Upload/download functionality working
   - [ ] Email notifications being sent
   - [ ] CloudFront distribution serving content

#### Rollback Procedures

1. **Automatic Rollback Triggers**
   - API error rate > 5% for 5 minutes
   - Lambda error rate > 10% for 5 minutes
   - Any critical alarm state for 10 minutes

2. **Manual Rollback Steps**
   ```bash
   # 1. Identify previous stable version
   aws cloudformation describe-stacks --stack-name ApexShare-API-prod \
     --query 'Stacks[0].Tags[?Key==`version`].Value'

   # 2. Rollback to previous version
   cdk deploy ApexShare-API-prod --version-tag previous-stable

   # 3. Verify rollback success
   curl -f https://api.apexshare.be/api/v1/health
   ```

---

## Security Management

### Access Control

#### IAM Roles and Policies

**Lambda Execution Role** (`ApexShare-Lambda-Role-{env}`)
- Permissions: S3 read/write, DynamoDB read/write, SES send, CloudWatch logs
- Trust policy: lambda.amazonaws.com
- Principle: Least privilege access

**API Gateway Role** (`ApexShare-APIGateway-Role-{env}`)
- Permissions: CloudWatch logs, Lambda invoke
- Trust policy: apigateway.amazonaws.com

#### Service-to-Service Authentication

- Lambda functions use IAM roles (no API keys)
- S3 presigned URLs for secure file uploads/downloads
- DynamoDB access via IAM roles only
- SES domain verification for email sending

### Data Encryption

#### Encryption at Rest
- **S3**: KMS encryption with environment-specific keys
- **DynamoDB**: KMS encryption with environment-specific keys
- **Lambda**: Environment variables encrypted with KMS
- **CloudWatch Logs**: Default encryption

#### Encryption in Transit
- **API**: HTTPS only (TLS 1.2+)
- **Frontend**: HTTPS only via CloudFront
- **S3**: HTTPS endpoints only
- **DynamoDB**: AWS SDK uses HTTPS

### Security Monitoring

#### WAF Monitoring

```bash
# Check blocked requests in last 24 hours
aws wafv2 get-sampled-requests \
  --web-acl-arn arn:aws:wafv2:region:account:regional/webacl/apexshare-waf-prod \
  --rule-metric-name SQLiRule \
  --scope REGIONAL \
  --time-window StartTime=$(date -d '24 hours ago' +%s),EndTime=$(date +%s) \
  --max-items 100
```

#### Security Incident Response

1. **Detection**
   - CloudWatch alarms for security events
   - AWS GuardDuty findings (if enabled)
   - Unusual access patterns in logs

2. **Immediate Response**
   - Block malicious IPs via WAF
   - Rotate compromised credentials
   - Enable detailed logging

3. **Investigation**
   - Analyze CloudTrail logs
   - Check access patterns
   - Review affected resources

4. **Recovery**
   - Apply security patches
   - Update WAF rules
   - Enhance monitoring

---

## Backup and Recovery

### Backup Strategy

#### Automated Backups

**DynamoDB**
- Point-in-time recovery enabled (staging/prod)
- Automatic backups retained for 35 days
- Manual snapshots for major releases

**S3**
- Cross-region replication for critical data (optional)
- Versioning enabled for important buckets
- Lifecycle policies for cost optimization

**Infrastructure**
- CDK code in Git repository
- CloudFormation templates automatically generated
- Environment configurations in code

#### Manual Backup Procedures

```bash
# Create DynamoDB backup
aws dynamodb create-backup \
  --table-name apexshare-uploads-prod \
  --backup-name "apexshare-uploads-manual-$(date +%Y%m%d)"

# Export environment variables
aws cloudformation describe-stacks \
  --stack-name ApexShare-API-prod \
  --query 'Stacks[0].Outputs' > backup/env-vars-prod-$(date +%Y%m%d).json
```

### Disaster Recovery

#### Recovery Time Objectives (RTO)

- **Critical Systems**: 1 hour
- **Full Service**: 4 hours
- **Historical Data**: 24 hours

#### Recovery Point Objectives (RPO)

- **DynamoDB**: 1 minute (point-in-time recovery)
- **S3 Data**: Real-time (immediate consistency)
- **Infrastructure**: Version control (Git commits)

#### Disaster Recovery Procedures

**Scenario 1: Single Lambda Function Failure**
1. Identify failed function
2. Check CloudWatch logs for errors
3. Redeploy function from last known good version
4. Monitor for 30 minutes

**Scenario 2: Regional AWS Outage**
1. Assess scope of outage
2. Prepare for multi-region deployment (if configured)
3. Update DNS to point to backup region
4. Monitor AWS Service Health Dashboard

**Scenario 3: Complete Data Loss**
1. Stop all write operations
2. Restore DynamoDB from point-in-time recovery
3. Restore S3 from cross-region replication or backup
4. Redeploy infrastructure from CDK code
5. Validate data integrity

---

## Performance Optimization

### Lambda Optimization

#### Memory and CPU Tuning

```bash
# Analyze Lambda memory usage
aws logs filter-log-events \
  --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
  --start-time $(date -d '7 days ago' +%s000) \
  --filter-pattern "[timestamp, requestId, \"Max Memory Used:\", memory]"
```

#### Cold Start Optimization

- Use provisioned concurrency for critical functions
- Minimize deployment package size
- Initialize connections outside handler function
- Use connection pooling for database connections

#### Code Optimization

```typescript
// Example: Optimize DynamoDB queries
const params = {
  TableName: 'apexshare-uploads-prod',
  IndexName: 'email-index', // Use GSI for non-key queries
  KeyConditionExpression: 'email = :email',
  ExpressionAttributeValues: {
    ':email': userEmail
  },
  ProjectionExpression: 'fileId, title, createdAt' // Only fetch needed attributes
};
```

### API Gateway Optimization

#### Caching Configuration

```bash
# Enable caching for GET requests
aws apigateway put-method \
  --rest-api-id abc123 \
  --resource-id xyz789 \
  --http-method GET \
  --caching-enabled true \
  --cache-ttl 300
```

#### Throttling Settings

```json
{
  "burstLimit": 500,
  "rateLimit": 100,
  "quotaLimit": 10000,
  "quotaPeriod": "DAY"
}
```

### S3 Performance

#### Transfer Acceleration

```bash
# Enable transfer acceleration
aws s3api put-bucket-accelerate-configuration \
  --bucket apexshare-videos-prod \
  --accelerate-configuration Status=Enabled
```

#### Multipart Upload for Large Files

```typescript
// Configure multipart upload thresholds
const uploadParams = {
  partSize: 64 * 1024 * 1024, // 64MB parts
  queueSize: 4, // 4 concurrent parts
  leavePartsOnError: false
};
```

---

## Troubleshooting Guide

### Common Issues

#### Issue: Upload Failures

**Symptoms:**
- Users report upload timeouts
- High 5xx error rates
- Lambda timeout errors

**Investigation:**
```bash
# Check recent upload errors
aws logs filter-log-events \
  --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
  --start-time $(date -d '1 hour ago' +%s000) \
  --filter-pattern "ERROR"

# Check API Gateway errors
aws logs filter-log-events \
  --log-group-name "/aws/apigateway/apexshare-api-prod" \
  --start-time $(date -d '1 hour ago' +%s000) \
  --filter-pattern "5XX"
```

**Common Causes and Solutions:**
1. **Lambda timeout**: Increase timeout or optimize code
2. **API Gateway timeout**: Check Lambda performance
3. **S3 permissions**: Verify IAM roles
4. **Network issues**: Check CloudFront and WAF rules

#### Issue: Email Delivery Problems

**Symptoms:**
- Students not receiving notification emails
- High bounce rates
- SES complaints

**Investigation:**
```bash
# Check SES sending statistics
aws ses get-send-statistics

# Check bounce and complaint rates
aws ses get-reputation
```

**Common Causes and Solutions:**
1. **Domain verification**: Verify SES domain setup
2. **DKIM records**: Check DNS configuration
3. **Reputation issues**: Monitor bounce rates
4. **Lambda errors**: Check email sender function logs

#### Issue: Performance Degradation

**Symptoms:**
- Slow API responses
- High Lambda duration
- User complaints about speed

**Investigation:**
```bash
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

**Common Causes and Solutions:**
1. **Cold starts**: Enable provisioned concurrency
2. **Database throttling**: Check DynamoDB capacity
3. **Memory issues**: Increase Lambda memory
4. **External dependencies**: Check third-party service status

---

## Emergency Procedures

### Incident Response Plan

#### Severity Levels

**Critical (P1)**
- Complete service outage
- Data loss or corruption
- Security breach
- Response time: Immediate

**High (P2)**
- Significant functionality impacted
- Performance severely degraded
- Response time: 1 hour

**Medium (P3)**
- Minor functionality issues
- Performance degradation
- Response time: 4 hours

**Low (P4)**
- Cosmetic issues
- Enhancement requests
- Response time: 24 hours

#### Emergency Contacts

```yaml
Primary On-Call: +1-XXX-XXX-XXXX
Secondary On-Call: +1-XXX-XXX-XXXX
AWS Support: Case via AWS Console
Security Team: security@company.com
```

#### Incident Response Steps

1. **Detection and Assessment** (0-5 minutes)
   - Confirm the incident
   - Determine severity level
   - Alert appropriate team members

2. **Initial Response** (5-15 minutes)
   - Implement immediate fixes if known
   - Create incident tracking ticket
   - Begin status page updates

3. **Investigation** (15+ minutes)
   - Gather logs and metrics
   - Identify root cause
   - Develop fix plan

4. **Resolution** (varies)
   - Implement fix
   - Verify resolution
   - Monitor for recurrence

5. **Post-Incident** (24-48 hours)
   - Conduct post-mortem
   - Document lessons learned
   - Implement preventive measures

### Emergency Runbooks

#### Complete Service Outage

1. **Check AWS Service Health**
   ```bash
   # Visit AWS Status page
   curl -s https://status.aws.amazon.com/
   ```

2. **Verify DNS Resolution**
   ```bash
   # Check domain resolution
   nslookup apexshare.be
   dig apexshare.be
   ```

3. **Check CloudFront Status**
   ```bash
   # Get distribution status
   aws cloudfront get-distribution --id E1234567890ABC
   ```

4. **API Gateway Health Check**
   ```bash
   # Test health endpoint
   curl -f https://api.apexshare.be/api/v1/health
   ```

#### Database Emergency Recovery

1. **Assess Data Loss Scope**
   ```bash
   # Check table status
   aws dynamodb describe-table --table-name apexshare-uploads-prod
   ```

2. **Point-in-Time Recovery**
   ```bash
   # Restore to specific time
   aws dynamodb restore-table-to-point-in-time \
     --source-table-name apexshare-uploads-prod \
     --target-table-name apexshare-uploads-prod-restored \
     --restore-date-time 2024-03-15T12:00:00
   ```

3. **Verify Data Integrity**
   ```bash
   # Count items in restored table
   aws dynamodb scan --table-name apexshare-uploads-prod-restored --select COUNT
   ```

---

## Cost Management

### Cost Monitoring

#### Daily Cost Tracking

```bash
# Get current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -d 'first day of this month' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

#### Budget Alerts

**Production Budget**: $1000/month
- Alert at 70% ($700)
- Alert at 85% ($850)
- Alert at 100% ($1000)

**Development Budget**: $50/month
- Alert at 80% ($40)
- Alert at 100% ($50)

### Cost Optimization

#### S3 Storage Optimization

```bash
# Analyze S3 storage classes
aws s3api list-objects-v2 \
  --bucket apexshare-videos-prod \
  --query 'Contents[?StorageClass!=`STANDARD`]'

# Set up lifecycle rules
aws s3api put-bucket-lifecycle-configuration \
  --bucket apexshare-videos-prod \
  --lifecycle-configuration file://lifecycle-config.json
```

#### Lambda Cost Optimization

- Right-size memory allocation based on usage patterns
- Use ARM-based processors (Graviton2) for cost savings
- Implement efficient code to reduce execution time

#### DynamoDB Cost Optimization

- Use on-demand billing for variable workloads
- Implement efficient query patterns
- Use DynamoDB Accelerator (DAX) for read-heavy workloads

### Resource Cleanup

#### Automated Cleanup

```bash
# Clean up old logs (older than 30 days)
aws logs describe-log-groups --query 'logGroups[?starts_with(logGroupName, `/aws/lambda/apexshare`)]' \
  | jq -r '.[].logGroupName' \
  | xargs -I {} aws logs put-retention-policy --log-group-name {} --retention-in-days 30
```

#### Manual Cleanup Tasks

- Remove old CloudFormation stacks
- Delete unused S3 buckets
- Clean up test resources in development

---

## Compliance and Auditing

### Security Compliance

#### Access Auditing

```bash
# Review CloudTrail logs for suspicious activity
aws logs filter-log-events \
  --log-group-name CloudTrail/ApexShareAuditLog \
  --start-time $(date -d '7 days ago' +%s000) \
  --filter-pattern "{ $.errorCode = \"*\" || $.errorMessage = \"*\" }"
```

#### Data Protection Compliance

- **GDPR**: 7-day automatic deletion policy
- **SOC 2**: AWS compliance covers infrastructure
- **Data Encryption**: All data encrypted at rest and in transit

### Audit Procedures

#### Monthly Security Audit

1. **Review IAM Permissions**
   - Check for overprivileged roles
   - Verify least-privilege access
   - Document any exceptions

2. **Certificate Management**
   - Check SSL certificate expiration
   - Verify certificate chains
   - Test certificate validation

3. **Access Log Review**
   - Analyze access patterns
   - Identify anomalous behavior
   - Review failed authentication attempts

#### Quarterly Compliance Review

1. **Data Retention Verification**
   - Confirm 7-day deletion is working
   - Check for any data retention violations
   - Document retention policy compliance

2. **Security Control Testing**
   - Test WAF rules effectiveness
   - Verify encryption implementation
   - Check access control enforcement

3. **Incident Response Testing**
   - Conduct tabletop exercises
   - Test backup and recovery procedures
   - Update emergency contacts

---

*ApexShare System Administrator Manual v1.0 - September 2025*

*This manual should be reviewed and updated quarterly. For the latest version and additional resources, contact the development team.*