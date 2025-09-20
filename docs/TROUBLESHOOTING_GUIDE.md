# ApexShare Troubleshooting Guide

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Common Issues](#common-issues)
3. [Upload Problems](#upload-problems)
4. [Download Issues](#download-issues)
5. [Email Delivery Problems](#email-delivery-problems)
6. [Performance Issues](#performance-issues)
7. [Infrastructure Problems](#infrastructure-problems)
8. [Security Issues](#security-issues)
9. [Monitoring and Alerts](#monitoring-and-alerts)
10. [Emergency Procedures](#emergency-procedures)

---

## Quick Diagnostics

### System Health Check

```bash
#!/bin/bash
# Quick system health check script

echo "ApexShare System Health Check"
echo "============================="

# 1. API Health
echo "1. Checking API health..."
API_HEALTH=$(curl -s -f https://api.apexshare.be/api/v1/health)
if [ $? -eq 0 ]; then
    echo "✅ API is responding"
    echo "   Status: $(echo $API_HEALTH | jq -r '.data.status')"
else
    echo "❌ API is not responding"
fi

# 2. Frontend Health
echo "2. Checking frontend..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://apexshare.be)
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ Frontend is accessible"
else
    echo "❌ Frontend returned status: $FRONTEND_STATUS"
fi

# 3. AWS Service Status
echo "3. Checking AWS services..."
aws cloudwatch describe-alarms \
    --alarm-names "ApexShare-API-5xx-Errors-Critical" \
    --query 'MetricAlarms[0].StateValue' \
    --output text 2>/dev/null | \
    (read state; [ "$state" = "OK" ] && echo "✅ No critical alarms" || echo "❌ Critical alarms active")

# 4. Database Health
echo "4. Checking database..."
DB_STATUS=$(aws dynamodb describe-table \
    --table-name apexshare-uploads-prod \
    --query 'Table.TableStatus' \
    --output text 2>/dev/null)
if [ "$DB_STATUS" = "ACTIVE" ]; then
    echo "✅ Database is active"
else
    echo "❌ Database status: $DB_STATUS"
fi

# 5. Storage Health
echo "5. Checking storage..."
BUCKET_EXISTS=$(aws s3 ls s3://apexshare-videos-prod 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Storage bucket accessible"
else
    echo "❌ Storage bucket not accessible"
fi

echo "============================="
echo "Health check complete"
```

### Component Status Check

```bash
# Check individual component status
function check_component_status() {
    local component=$1
    local resource_name=$2

    case $component in
        "lambda")
            aws lambda get-function --function-name "$resource_name" \
                --query 'Configuration.State' --output text 2>/dev/null
            ;;
        "api-gateway")
            aws apigateway get-rest-api --rest-api-id "$resource_name" \
                --query 'status' --output text 2>/dev/null
            ;;
        "s3")
            aws s3api head-bucket --bucket "$resource_name" 2>/dev/null && echo "Active"
            ;;
        "dynamodb")
            aws dynamodb describe-table --table-name "$resource_name" \
                --query 'Table.TableStatus' --output text 2>/dev/null
            ;;
    esac
}

# Usage examples
check_component_status lambda apexshare-upload-handler-prod
check_component_status dynamodb apexshare-uploads-prod
check_component_status s3 apexshare-videos-prod
```

---

## Common Issues

### Issue 1: "Internal Server Error" (500)

**Symptoms:**
- Users receive 500 error when trying to upload
- API returns "Internal Server Error"
- High Lambda error rates in CloudWatch

**Diagnosis:**
```bash
# Check recent Lambda errors
aws logs filter-log-events \
    --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
    --start-time $(date -d '1 hour ago' +%s000) \
    --filter-pattern "ERROR" \
    --max-items 10

# Check API Gateway errors
aws logs filter-log-events \
    --log-group-name "/aws/apigateway/apexshare-api-prod" \
    --start-time $(date -d '1 hour ago' +%s000) \
    --filter-pattern "5XX" \
    --max-items 10
```

**Common Causes and Solutions:**

1. **Lambda Function Timeout**
   ```bash
   # Check function timeout configuration
   aws lambda get-function-configuration \
       --function-name apexshare-upload-handler-prod \
       --query 'Timeout'

   # Increase timeout if needed (max 15 minutes)
   aws lambda update-function-configuration \
       --function-name apexshare-upload-handler-prod \
       --timeout 60
   ```

2. **Memory Exhaustion**
   ```bash
   # Check memory usage in logs
   aws logs filter-log-events \
       --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
       --start-time $(date -d '1 hour ago' +%s000) \
       --filter-pattern "[timestamp, requestId, \"Max Memory Used:\", memory]"

   # Increase memory if consistently high
   aws lambda update-function-configuration \
       --function-name apexshare-upload-handler-prod \
       --memory-size 1024
   ```

3. **Environment Variable Issues**
   ```bash
   # Check environment variables
   aws lambda get-function-configuration \
       --function-name apexshare-upload-handler-prod \
       --query 'Environment.Variables'

   # Update if needed
   aws lambda update-function-configuration \
       --function-name apexshare-upload-handler-prod \
       --environment Variables='{BUCKET_NAME=apexshare-videos-prod,TABLE_NAME=apexshare-uploads-prod}'
   ```

### Issue 2: "Service Unavailable" (503)

**Symptoms:**
- Intermittent 503 errors
- API Gateway throttling messages
- Users unable to access system during peak times

**Diagnosis:**
```bash
# Check API Gateway throttling
aws cloudwatch get-metric-statistics \
    --namespace AWS/ApiGateway \
    --metric-name ThrottleCount \
    --dimensions Name=ApiName,Value=apexshare-api-prod \
    --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Sum

# Check Lambda throttling
aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Throttles \
    --dimensions Name=FunctionName,Value=apexshare-upload-handler-prod \
    --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Sum
```

**Solutions:**

1. **Increase API Gateway Limits**
   ```bash
   # Update throttling settings
   aws apigateway update-stage \
       --rest-api-id $(aws apigateway get-rest-apis --query 'items[?name==`apexshare-api-prod`].id' --output text) \
       --stage-name prod \
       --patch-ops op=replace,path=/throttle/rateLimit,value=200 \
       op=replace,path=/throttle/burstLimit,value=1000
   ```

2. **Increase Lambda Concurrency**
   ```bash
   # Set reserved concurrency
   aws lambda put-reserved-concurrency-config \
       --function-name apexshare-upload-handler-prod \
       --reserved-concurrency-amount 50

   # Or use provisioned concurrency for predictable performance
   aws lambda put-provisioned-concurrency-config \
       --function-name apexshare-upload-handler-prod \
       --qualifier $LATEST \
       --provisioned-concurrency-count 10
   ```

### Issue 3: CORS Errors in Browser

**Symptoms:**
- Browser console shows CORS errors
- Frontend cannot make API requests
- Preflight requests failing

**Diagnosis:**
```bash
# Test CORS preflight
curl -X OPTIONS https://api.apexshare.be/api/v1/upload \
    -H "Origin: https://apexshare.be" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type" \
    -v
```

**Solutions:**

1. **Verify CORS Configuration**
   ```bash
   # Check API Gateway CORS settings
   aws apigateway get-method \
       --rest-api-id $(aws apigateway get-rest-apis --query 'items[?name==`apexshare-api-prod`].id' --output text) \
       --resource-id $(aws apigateway get-resources --rest-api-id $(aws apigateway get-rest-apis --query 'items[?name==`apexshare-api-prod`].id' --output text) --query 'items[?pathPart==`upload`].id' --output text) \
       --http-method OPTIONS
   ```

2. **Update CORS Headers in Lambda**
   ```typescript
   // Ensure Lambda returns proper CORS headers
   const response = {
       statusCode: 200,
       headers: {
           'Access-Control-Allow-Origin': 'https://apexshare.be',
           'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
           'Access-Control-Allow-Headers': 'Content-Type, Authorization',
           'Access-Control-Max-Age': '86400'
       },
       body: JSON.stringify(data)
   };
   ```

---

## Upload Problems

### Large File Upload Failures

**Symptoms:**
- Upload progress stops at certain percentage
- Browser shows network errors
- Large files (>1GB) consistently fail

**Diagnosis:**
```bash
# Check for Lambda timeout errors during upload processing
aws logs filter-log-events \
    --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
    --start-time $(date -d '2 hours ago' +%s000) \
    --filter-pattern "[timestamp, requestId, \"Task timed out\"]"

# Check S3 upload success/failure rates
aws logs filter-log-events \
    --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
    --start-time $(date -d '2 hours ago' +%s000) \
    --filter-pattern "[timestamp, requestId, level, message=\"UPLOAD_URL_GENERATED\"]"
```

**Solutions:**

1. **Extend Presigned URL Expiration**
   ```typescript
   // In upload handler Lambda
   const uploadUrl = await s3.createPresignedPost({
       Bucket: bucketName,
       Key: fileKey,
       Expires: 3600, // Increase to 1 hour for large files
       Conditions: [
           ['content-length-range', 0, 5368709120] // 5GB max
       ]
   });
   ```

2. **Implement Multipart Upload**
   ```typescript
   // For files > 100MB, use multipart upload
   if (fileSize > 100 * 1024 * 1024) {
       const multipartUpload = await s3.createMultipartUpload({
           Bucket: bucketName,
           Key: fileKey,
           ContentType: fileType
       }).promise();

       // Return multipart upload ID for client-side handling
       return {
           uploadType: 'multipart',
           uploadId: multipartUpload.UploadId,
           bucket: bucketName,
           key: fileKey
       };
   }
   ```

### Upload Permission Errors

**Symptoms:**
- "Access Denied" errors during upload
- S3 returns 403 Forbidden
- Presigned URL generation fails

**Diagnosis:**
```bash
# Check Lambda execution role permissions
aws iam get-role-policy \
    --role-name $(aws lambda get-function --function-name apexshare-upload-handler-prod --query 'Configuration.Role' --output text | cut -d'/' -f2) \
    --policy-name S3AccessPolicy

# Check S3 bucket policy
aws s3api get-bucket-policy --bucket apexshare-videos-prod
```

**Solutions:**

1. **Update IAM Role Permissions**
   ```json
   {
       "Version": "2012-10-17",
       "Statement": [
           {
               "Effect": "Allow",
               "Action": [
                   "s3:PutObject",
                   "s3:PutObjectAcl",
                   "s3:GetObject",
                   "s3:DeleteObject"
               ],
               "Resource": "arn:aws:s3:::apexshare-videos-prod/*"
           }
       ]
   }
   ```

2. **Verify S3 Bucket CORS**
   ```bash
   # Check S3 CORS configuration
   aws s3api get-bucket-cors --bucket apexshare-videos-prod

   # Update if needed
   aws s3api put-bucket-cors \
       --bucket apexshare-videos-prod \
       --cors-configuration file://s3-cors-config.json
   ```

---

## Download Issues

### File Not Found Errors

**Symptoms:**
- Users receive "File not found" when clicking download links
- Valid file IDs return 404 errors
- Recently uploaded files not accessible

**Diagnosis:**
```bash
# Check if file exists in S3
FILE_ID="your-file-id-here"
aws s3 ls s3://apexshare-videos-prod/videos/$FILE_ID

# Check DynamoDB record
aws dynamodb get-item \
    --table-name apexshare-uploads-prod \
    --key '{"fileId":{"S":"'$FILE_ID'"}}'

# Check file processing status
aws logs filter-log-events \
    --log-group-name "/aws/lambda/apexshare-email-sender-prod" \
    --start-time $(date -d '2 hours ago' +%s000) \
    --filter-pattern "[timestamp, requestId, level, message=\"FILE_PROCESSED\", fileId=\"$FILE_ID\"]"
```

**Solutions:**

1. **Check File Processing Status**
   ```bash
   # If file is still processing, wait for completion
   aws logs tail /aws/lambda/apexshare-email-sender-prod --follow
   ```

2. **Verify TTL Configuration**
   ```bash
   # Check if files are expiring too early
   aws dynamodb describe-table \
       --table-name apexshare-uploads-prod \
       --query 'Table.TimeToLiveSpecification'

   # Update TTL if needed (7 days = 604800 seconds)
   aws dynamodb put-time-to-live \
       --table-name apexshare-uploads-prod \
       --time-to-live-specification 'AttributeName=ttl,Enabled=true'
   ```

### Slow Download Speeds

**Symptoms:**
- Downloads are significantly slower than expected
- CloudFront cache misses
- High latency from certain regions

**Diagnosis:**
```bash
# Check CloudFront cache hit ratio
aws cloudwatch get-metric-statistics \
    --namespace AWS/CloudFront \
    --metric-name CacheHitRate \
    --dimensions Name=DistributionId,Value=$(aws cloudfront list-distributions --query 'DistributionList.Items[0].Id' --output text) \
    --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Average

# Check origin response time
aws cloudwatch get-metric-statistics \
    --namespace AWS/CloudFront \
    --metric-name OriginLatency \
    --dimensions Name=DistributionId,Value=$(aws cloudfront list-distributions --query 'DistributionList.Items[0].Id' --output text) \
    --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Average
```

**Solutions:**

1. **Optimize CloudFront Cache Settings**
   ```bash
   # Update cache behavior for video files
   aws cloudfront update-distribution \
       --id $(aws cloudfront list-distributions --query 'DistributionList.Items[0].Id' --output text) \
       --distribution-config file://updated-distribution-config.json
   ```

2. **Enable S3 Transfer Acceleration**
   ```bash
   # Enable transfer acceleration for faster uploads/downloads
   aws s3api put-bucket-accelerate-configuration \
       --bucket apexshare-videos-prod \
       --accelerate-configuration Status=Enabled
   ```

---

## Email Delivery Problems

### Students Not Receiving Emails

**Symptoms:**
- Students report not receiving notification emails
- Email delivery metrics show failures
- High bounce or complaint rates

**Diagnosis:**
```bash
# Check SES sending statistics
aws ses get-send-statistics

# Check SES reputation
aws ses get-reputation

# Check recent email sending activity
aws logs filter-log-events \
    --log-group-name "/aws/lambda/apexshare-email-sender-prod" \
    --start-time $(date -d '2 hours ago' +%s000) \
    --filter-pattern "[timestamp, requestId, level, message=\"EMAIL_SENT\"]"

# Check for email sending errors
aws logs filter-log-events \
    --log-group-name "/aws/lambda/apexshare-email-sender-prod" \
    --start-time $(date -d '2 hours ago' +%s000) \
    --filter-pattern "ERROR"
```

**Solutions:**

1. **Verify SES Domain Configuration**
   ```bash
   # Check domain verification status
   aws ses get-identity-verification-attributes \
       --identities apexshare.be

   # Check DKIM verification
   aws ses get-identity-dkim-attributes \
       --identities apexshare.be
   ```

2. **Check DNS Records**
   ```bash
   # Verify DKIM records
   dig TXT _amazonses.apexshare.be

   # Verify domain verification record
   dig TXT apexshare.be
   ```

3. **Review Email Template**
   ```typescript
   // Ensure email template is not triggering spam filters
   const emailTemplate = {
       subject: 'Your training video from {{trainerName}} is ready',
       bodyText: `Hello,\n\nYour motorcycle training video is ready to download...`,
       bodyHtml: `<html><body>Hello,<br><br>Your motorcycle training video is ready...</body></html>`
   };
   ```

### Email Bounce Handling

**Symptoms:**
- High bounce rates in SES console
- Emails to valid addresses bouncing
- Reputation warnings from AWS

**Diagnosis:**
```bash
# Check bounce and complaint rates
aws ses get-send-quota

# List bounced emails
aws ses list-bounced-recipient \
    --bounce-type Permanent
```

**Solutions:**

1. **Set Up Bounce Processing**
   ```bash
   # Create SNS topic for bounce notifications
   aws sns create-topic --name apexshare-email-bounces

   # Configure SES to publish bounce notifications
   aws ses put-identity-notification-attributes \
       --identity apexshare.be \
       --notification-type Bounce \
       --sns-topic arn:aws:sns:eu-west-1:123456789012:apexshare-email-bounces
   ```

2. **Implement Email Validation**
   ```typescript
   // Add email validation before sending
   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
   if (!emailRegex.test(studentEmail)) {
       throw new Error('Invalid email address format');
   }

   // Check against known bad domains
   const blockedDomains = ['example.com', 'test.com'];
   const domain = studentEmail.split('@')[1];
   if (blockedDomains.includes(domain)) {
       throw new Error('Email domain not allowed');
   }
   ```

---

## Performance Issues

### High Latency

**Symptoms:**
- API responses taking > 3 seconds
- Users complaining about slow performance
- CloudWatch alarms for latency

**Diagnosis:**
```bash
# Analyze response time breakdown
aws logs insights start-query \
    --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
    --start-time $(date -d '1 hour ago' +%s) \
    --end-time $(date +%s) \
    --query-string 'fields @timestamp, @duration
                    | filter @type = "REPORT"
                    | stats avg(@duration), max(@duration), min(@duration) by bin(5m)'

# Check for cold starts
aws logs filter-log-events \
    --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
    --start-time $(date -d '1 hour ago' +%s000) \
    --filter-pattern "[timestamp, requestId, \"INIT_START\"]"
```

**Solutions:**

1. **Reduce Cold Starts**
   ```bash
   # Enable provisioned concurrency
   aws lambda put-provisioned-concurrency-config \
       --function-name apexshare-upload-handler-prod \
       --qualifier $LATEST \
       --provisioned-concurrency-count 5
   ```

2. **Optimize Lambda Performance**
   ```typescript
   // Initialize connections outside handler
   const s3 = new AWS.S3();
   const dynamodb = new AWS.DynamoDB.DocumentClient();

   export const handler = async (event) => {
       // Handler code here - connections already initialized
   };
   ```

3. **Database Query Optimization**
   ```typescript
   // Use consistent reads only when necessary
   const params = {
       TableName: 'apexshare-uploads-prod',
       Key: { fileId },
       ConsistentRead: false // Use eventually consistent reads
   };

   // Use projection expressions to limit data transfer
   const params = {
       TableName: 'apexshare-uploads-prod',
       Key: { fileId },
       ProjectionExpression: 'fileId, #status, createdAt',
       ExpressionAttributeNames: {
           '#status': 'status'
       }
   };
   ```

### Memory Issues

**Symptoms:**
- Lambda functions running out of memory
- Intermittent failures with large files
- Memory usage alerts

**Diagnosis:**
```bash
# Check memory usage patterns
aws logs filter-log-events \
    --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
    --start-time $(date -d '1 hour ago' +%s000) \
    --filter-pattern "[timestamp, requestId, \"Max Memory Used:\", memory]" | \
    jq -r '.events[].message' | \
    grep "Max Memory Used" | \
    sort -k5 -n
```

**Solutions:**

1. **Right-size Memory Allocation**
   ```bash
   # Increase memory based on usage patterns
   aws lambda update-function-configuration \
       --function-name apexshare-upload-handler-prod \
       --memory-size 1024

   # For the email sender (processes larger templates)
   aws lambda update-function-configuration \
       --function-name apexshare-email-sender-prod \
       --memory-size 512
   ```

2. **Optimize Memory Usage in Code**
   ```typescript
   // Stream large data instead of loading into memory
   const stream = s3.getObject({ Bucket, Key }).createReadStream();

   // Process data in chunks
   const chunkSize = 1024 * 1024; // 1MB chunks
   for (let i = 0; i < data.length; i += chunkSize) {
       const chunk = data.slice(i, i + chunkSize);
       await processChunk(chunk);
   }
   ```

---

## Infrastructure Problems

### CloudFormation Stack Issues

**Symptoms:**
- Deployment failures
- Stack in UPDATE_ROLLBACK_FAILED state
- Resource creation timeouts

**Diagnosis:**
```bash
# Check stack events
aws cloudformation describe-stack-events \
    --stack-name ApexShare-API-prod \
    --query 'StackEvents[0:10].{Time:Timestamp,Status:ResourceStatus,Reason:ResourceStatusReason,Resource:LogicalResourceId}'

# Check stack status
aws cloudformation describe-stacks \
    --stack-name ApexShare-API-prod \
    --query 'Stacks[0].StackStatus'
```

**Solutions:**

1. **Continue Update Rollback**
   ```bash
   # If stack is in UPDATE_ROLLBACK_FAILED state
   aws cloudformation continue-update-rollback \
       --stack-name ApexShare-API-prod \
       --resources-to-skip LogicalResourceId1,LogicalResourceId2
   ```

2. **Cancel Update and Retry**
   ```bash
   # Cancel stuck update
   aws cloudformation cancel-update-stack \
       --stack-name ApexShare-API-prod

   # Wait for cancellation to complete, then retry
   aws cloudformation wait stack-update-rollback-complete \
       --stack-name ApexShare-API-prod
   ```

### Resource Limit Issues

**Symptoms:**
- "LimitExceeded" errors during deployment
- Cannot create new resources
- Service quota errors

**Diagnosis:**
```bash
# Check service quotas
aws service-quotas list-service-quotas \
    --service-code lambda \
    --query 'Quotas[?QuotaName==`Concurrent executions`]'

aws service-quotas list-service-quotas \
    --service-code apigateway \
    --query 'Quotas[?QuotaName==`Regional APIs per account`]'
```

**Solutions:**

1. **Request Quota Increase**
   ```bash
   # Request Lambda concurrency increase
   aws service-quotas request-service-quota-increase \
       --service-code lambda \
       --quota-code L-B99A9384 \
       --desired-value 10000
   ```

2. **Clean Up Unused Resources**
   ```bash
   # List unused Lambda functions
   aws lambda list-functions \
       --query 'Functions[?LastModified<`2024-01-01`].FunctionName'

   # Delete old versions
   aws lambda list-versions-by-function \
       --function-name old-function-name \
       --query 'Versions[?Version!=`$LATEST`].Version' \
       --output text | \
       xargs -I {} aws lambda delete-function --function-name old-function-name --qualifier {}
   ```

---

## Security Issues

### Suspicious Activity Detection

**Symptoms:**
- Unusual traffic patterns
- Multiple failed requests from same IP
- WAF blocking excessive requests

**Diagnosis:**
```bash
# Check WAF blocked requests
aws wafv2 get-sampled-requests \
    --web-acl-arn $(aws wafv2 list-web-acls --scope REGIONAL --query 'WebACLs[?Name==`apexshare-waf-prod`].ARN' --output text) \
    --rule-metric-name AWSManagedRulesCommonRuleSet \
    --scope REGIONAL \
    --time-window StartTime=$(date -d '1 hour ago' +%s),EndTime=$(date +%s) \
    --max-items 100

# Analyze access patterns
aws logs filter-log-events \
    --log-group-name "/aws/apigateway/apexshare-api-prod" \
    --start-time $(date -d '1 hour ago' +%s000) \
    --filter-pattern "[timestamp, requestId, ip, ..., status=4*, ...]" | \
    jq -r '.events[].message' | \
    cut -d' ' -f3 | sort | uniq -c | sort -nr
```

**Solutions:**

1. **Block Malicious IPs**
   ```bash
   # Add IP to WAF block list
   aws wafv2 update-ip-set \
       --scope REGIONAL \
       --id $(aws wafv2 list-ip-sets --scope REGIONAL --query 'IPSets[?Name==`blocked-ips`].Id' --output text) \
       --addresses "192.0.2.44/32","198.51.100.0/24"
   ```

2. **Increase Rate Limiting**
   ```bash
   # Update WAF rate limiting rule
   aws wafv2 update-rule-group \
       --scope REGIONAL \
       --id rate-limit-rule-group-id \
       --rules file://updated-rate-limit-rules.json
   ```

### Data Breach Response

**Symptoms:**
- Unauthorized access to S3 buckets
- Unusual API activity
- Security alerts from AWS

**Immediate Actions:**

1. **Revoke Access**
   ```bash
   # Rotate all access keys immediately
   aws iam list-access-keys --user-name service-user \
       --query 'AccessKeyMetadata[].AccessKeyId' --output text | \
       xargs -I {} aws iam update-access-key --user-name service-user --access-key-id {} --status Inactive

   # Update Lambda environment variables with new credentials
   aws lambda update-function-configuration \
       --function-name apexshare-upload-handler-prod \
       --environment Variables='{AWS_ACCESS_KEY_ID=new-key,AWS_SECRET_ACCESS_KEY=new-secret}'
   ```

2. **Enable Detailed Logging**
   ```bash
   # Enable CloudTrail data events for S3
   aws cloudtrail create-trail \
       --name apexshare-security-audit \
       --s3-bucket-name apexshare-audit-logs \
       --include-global-service-events \
       --is-multi-region-trail \
       --enable-log-file-validation
   ```

---

## Monitoring and Alerts

### False Positive Alerts

**Symptoms:**
- Alerts triggering during normal operation
- High noise-to-signal ratio
- Important alerts getting ignored

**Solutions:**

1. **Adjust Alert Thresholds**
   ```bash
   # Update alarm threshold based on historical data
   aws cloudwatch put-metric-alarm \
       --alarm-name "ApexShare-API-Latency-Warning" \
       --threshold 3000 \
       --comparison-operator "GreaterThanThreshold" \
       --evaluation-periods 3
   ```

2. **Add Composite Alarms**
   ```bash
   # Create composite alarm that requires multiple conditions
   aws cloudwatch put-composite-alarm \
       --alarm-name "ApexShare-System-Degraded" \
       --alarm-description "Multiple performance indicators showing degradation" \
       --alarm-rule "(ALARM('ApexShare-API-Latency-Warning') AND ALARM('ApexShare-Lambda-Errors-Warning'))" \
       --actions-enabled \
       --alarm-actions "arn:aws:sns:eu-west-1:123456789012:apexshare-critical-alerts"
   ```

### Missing Alerts

**Symptoms:**
- Issues discovered manually instead of through alerts
- No notification of system problems
- Alert fatigue leading to disabled notifications

**Solutions:**

1. **Implement Health Check Monitoring**
   ```bash
   # Create synthetic monitoring
   aws events put-rule \
       --name apexshare-health-check \
       --schedule-expression "rate(5 minutes)" \
       --state ENABLED

   aws events put-targets \
       --rule apexshare-health-check \
       --targets Id=1,Arn=arn:aws:lambda:eu-west-1:123456789012:function:apexshare-health-check
   ```

2. **Set Up Anomaly Detection**
   ```bash
   # Enable CloudWatch anomaly detection
   aws cloudwatch put-anomaly-detector \
       --namespace AWS/ApiGateway \
       --metric-name Count \
       --dimensions Name=ApiName,Value=apexshare-api-prod \
       --stat Average
   ```

---

## Emergency Procedures

### Complete System Outage

**Immediate Actions (0-5 minutes):**

1. **Assess Scope**
   ```bash
   # Quick health check
   curl -f https://api.apexshare.be/api/v1/health || echo "API DOWN"
   curl -f https://apexshare.be || echo "FRONTEND DOWN"

   # Check AWS Service Health
   curl -s https://status.aws.amazon.com/rss/ec2-eu-west-1.rss | grep -i "Service is operating normally" || echo "AWS ISSUES"
   ```

2. **Enable Maintenance Mode**
   ```bash
   # Update Lambda to return maintenance message
   aws lambda update-function-configuration \
       --function-name apexshare-upload-handler-prod \
       --environment Variables='{MAINTENANCE_MODE=true,MAINTENANCE_MESSAGE=System maintenance in progress. Please try again in 30 minutes.}'
   ```

3. **Notify Stakeholders**
   ```bash
   # Send immediate notification
   aws sns publish \
       --topic-arn arn:aws:sns:eu-west-1:123456789012:apexshare-emergency \
       --message "CRITICAL: ApexShare system outage detected. Investigation in progress." \
       --subject "ApexShare Emergency - System Outage"
   ```

**Investigation Phase (5-30 minutes):**

1. **Check Recent Deployments**
   ```bash
   # Check CloudFormation events
   aws cloudformation describe-stack-events \
       --stack-name ApexShare-API-prod \
       --query 'StackEvents[0:5].{Time:Timestamp,Status:ResourceStatus,Resource:LogicalResourceId}'

   # Check recent Lambda deployments
   aws lambda list-versions-by-function \
       --function-name apexshare-upload-handler-prod \
       --query 'Versions[-3:].{Version:Version,LastModified:LastModified}'
   ```

2. **Check Infrastructure Health**
   ```bash
   # Check all critical resources
   aws dynamodb describe-table --table-name apexshare-uploads-prod --query 'Table.TableStatus'
   aws s3api head-bucket --bucket apexshare-videos-prod 2>/dev/null && echo "S3 OK" || echo "S3 FAIL"
   aws apigateway get-rest-apis --query 'items[?name==`apexshare-api-prod`].id' --output text
   ```

**Recovery Actions:**

1. **Quick Rollback (if recent deployment)**
   ```bash
   # Rollback Lambda functions
   PREVIOUS_VERSION=$(aws lambda list-versions-by-function \
       --function-name apexshare-upload-handler-prod \
       --query 'Versions[-2].Version' --output text)

   aws lambda update-alias \
       --function-name apexshare-upload-handler-prod \
       --name LIVE \
       --function-version $PREVIOUS_VERSION
   ```

2. **Infrastructure Recovery**
   ```bash
   # If CloudFormation stack issues
   aws cloudformation cancel-update-stack --stack-name ApexShare-API-prod

   # Redeploy from known good state
   git checkout last-known-good-commit
   npm run deploy:prod:force
   ```

### Data Loss Emergency

**Immediate Actions:**

1. **Stop All Write Operations**
   ```bash
   # Disable upload functionality
   aws lambda update-function-configuration \
       --function-name apexshare-upload-handler-prod \
       --environment Variables='{MAINTENANCE_MODE=true,DISABLE_WRITES=true}'
   ```

2. **Assess Data Loss Scope**
   ```bash
   # Check DynamoDB item count
   aws dynamodb scan --table-name apexshare-uploads-prod --select COUNT --output text

   # Check S3 object count
   aws s3 ls s3://apexshare-videos-prod --recursive | wc -l

   # Compare with expected counts from monitoring
   ```

3. **Initiate Point-in-Time Recovery**
   ```bash
   # DynamoDB point-in-time recovery
   aws dynamodb restore-table-to-point-in-time \
       --source-table-name apexshare-uploads-prod \
       --target-table-name apexshare-uploads-prod-recovery \
       --restore-date-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S)
   ```

4. **Verify Recovery**
   ```bash
   # Wait for recovery completion
   aws dynamodb wait table-exists --table-name apexshare-uploads-prod-recovery

   # Verify data integrity
   ORIGINAL_COUNT=$(aws dynamodb scan --table-name apexshare-uploads-prod --select COUNT --query 'Count' --output text)
   RECOVERED_COUNT=$(aws dynamodb scan --table-name apexshare-uploads-prod-recovery --select COUNT --query 'Count' --output text)

   echo "Original: $ORIGINAL_COUNT, Recovered: $RECOVERED_COUNT"
   ```

---

*ApexShare Troubleshooting Guide v1.0 - September 2025*

*This guide should be updated regularly based on new issues encountered and solutions developed.*