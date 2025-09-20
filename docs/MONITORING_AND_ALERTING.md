# ApexShare Production Monitoring and Alerting Setup

## Table of Contents

1. [Monitoring Overview](#monitoring-overview)
2. [CloudWatch Dashboards](#cloudwatch-dashboards)
3. [Alerting Configuration](#alerting-configuration)
4. [Log Management](#log-management)
5. [Performance Monitoring](#performance-monitoring)
6. [Security Monitoring](#security-monitoring)
7. [Cost Monitoring](#cost-monitoring)
8. [Incident Response](#incident-response)
9. [Monitoring Playbooks](#monitoring-playbooks)
10. [Maintenance and Updates](#maintenance-and-updates)

---

## Monitoring Overview

ApexShare production monitoring is built on AWS CloudWatch with comprehensive dashboards, alarms, and automated alerting. The monitoring system tracks performance, security, costs, and system health across all components.

### Monitoring Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │───▶│   CloudWatch    │───▶│   SNS Topics    │
│    Services     │    │   Metrics       │    │   & Alarms      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
┌─────────────────┐    ┌─────────────────┐           │
│   CloudWatch    │◀───│   Lambda        │◀──────────┘
│   Dashboards    │    │   Functions     │
└─────────────────┘    └─────────────────┘
                                │
                        ┌─────────────────┐
                        │   Email/Slack   │
                        │  Notifications  │
                        └─────────────────┘
```

### Key Monitoring Components

- **API Gateway**: Request metrics, latency, error rates
- **Lambda Functions**: Duration, errors, concurrency, memory usage
- **S3**: Object counts, request metrics, error rates
- **DynamoDB**: Read/write capacity, throttling, errors
- **CloudFront**: Cache hit ratio, origin response time
- **SES**: Email delivery, bounces, complaints
- **WAF**: Blocked requests, rule matches

---

## CloudWatch Dashboards

### Production Dashboard Configuration

#### Main Dashboard: "ApexShare-Production-Overview"

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApiGateway", "Count", "ApiName", "apexshare-api-prod"],
          ["AWS/ApiGateway", "Latency", "ApiName", "apexshare-api-prod"],
          ["AWS/ApiGateway", "4XXError", "ApiName", "apexshare-api-prod"],
          ["AWS/ApiGateway", "5XXError", "ApiName", "apexshare-api-prod"]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "eu-west-1",
        "title": "API Gateway Metrics"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Invocations", "FunctionName", "apexshare-upload-handler-prod"],
          ["AWS/Lambda", "Duration", "FunctionName", "apexshare-upload-handler-prod"],
          ["AWS/Lambda", "Errors", "FunctionName", "apexshare-upload-handler-prod"],
          ["AWS/Lambda", "Throttles", "FunctionName", "apexshare-upload-handler-prod"]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "eu-west-1",
        "title": "Upload Handler Metrics"
      }
    }
  ]
}
```

#### API Performance Dashboard

**Widget Configuration:**

1. **API Request Volume**
   - Metric: `AWS/ApiGateway Count`
   - Period: 5 minutes
   - Statistic: Sum
   - Split by: Method, Resource

2. **API Response Times**
   - Metric: `AWS/ApiGateway Latency`
   - Period: 5 minutes
   - Statistics: Average, P95, P99

3. **API Error Rates**
   - Metrics: `4XXError`, `5XXError`
   - Period: 5 minutes
   - Statistic: Sum
   - Alert thresholds visible

#### Lambda Performance Dashboard

**Upload Handler Metrics:**
```bash
# Create CloudWatch dashboard for Lambda metrics
aws cloudwatch put-dashboard \
  --dashboard-name "ApexShare-Lambda-Performance" \
  --dashboard-body '{
    "widgets": [
      {
        "type": "metric",
        "properties": {
          "metrics": [
            ["AWS/Lambda", "Duration", "FunctionName", "apexshare-upload-handler-prod"],
            ["AWS/Lambda", "Errors", "FunctionName", "apexshare-upload-handler-prod"],
            ["AWS/Lambda", "Throttles", "FunctionName", "apexshare-upload-handler-prod"],
            ["AWS/Lambda", "ConcurrentExecutions", "FunctionName", "apexshare-upload-handler-prod"]
          ],
          "period": 300,
          "stat": "Average",
          "region": "eu-west-1",
          "title": "Upload Handler Performance"
        }
      }
    ]
  }'
```

#### Storage and Database Dashboard

**S3 Metrics:**
- Bucket size and object count
- Request metrics (GET, PUT, DELETE)
- Error rates (4xx, 5xx)
- Data transfer metrics

**DynamoDB Metrics:**
- Read/write capacity utilization
- Throttled requests
- System errors
- Item count and table size

---

## Alerting Configuration

### Critical Alarms (P1 - Immediate Response)

#### API Gateway Critical Alarms

```bash
# High error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "ApexShare-API-5xx-Errors-Critical" \
  --alarm-description "API Gateway 5xx errors > 5 in 5 minutes" \
  --metric-name "5XXError" \
  --namespace "AWS/ApiGateway" \
  --statistic "Sum" \
  --period 300 \
  --threshold 5 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 1 \
  --alarm-actions "arn:aws:sns:eu-west-1:123456789012:apexshare-critical-alerts" \
  --dimensions Name=ApiName,Value=apexshare-api-prod

# High latency alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "ApexShare-API-Latency-Critical" \
  --alarm-description "API Gateway latency > 5000ms for 2 consecutive periods" \
  --metric-name "Latency" \
  --namespace "AWS/ApiGateway" \
  --statistic "Average" \
  --period 300 \
  --threshold 5000 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 2 \
  --alarm-actions "arn:aws:sns:eu-west-1:123456789012:apexshare-critical-alerts" \
  --dimensions Name=ApiName,Value=apexshare-api-prod
```

#### Lambda Critical Alarms

```bash
# Lambda error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "ApexShare-Lambda-Errors-Critical" \
  --alarm-description "Lambda errors > 3 in 5 minutes" \
  --metric-name "Errors" \
  --namespace "AWS/Lambda" \
  --statistic "Sum" \
  --period 300 \
  --threshold 3 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 1 \
  --alarm-actions "arn:aws:sns:eu-west-1:123456789012:apexshare-critical-alerts" \
  --dimensions Name=FunctionName,Value=apexshare-upload-handler-prod

# Lambda timeout alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "ApexShare-Lambda-Duration-Critical" \
  --alarm-description "Lambda duration > 25 seconds (approaching timeout)" \
  --metric-name "Duration" \
  --namespace "AWS/Lambda" \
  --statistic "Maximum" \
  --period 300 \
  --threshold 25000 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 1 \
  --alarm-actions "arn:aws:sns:eu-west-1:123456789012:apexshare-critical-alerts" \
  --dimensions Name=FunctionName,Value=apexshare-upload-handler-prod
```

### Warning Alarms (P2 - Investigation Required)

#### Performance Warning Alarms

```bash
# API latency warning
aws cloudwatch put-metric-alarm \
  --alarm-name "ApexShare-API-Latency-Warning" \
  --alarm-description "API Gateway latency > 2000ms average" \
  --metric-name "Latency" \
  --namespace "AWS/ApiGateway" \
  --statistic "Average" \
  --period 300 \
  --threshold 2000 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 2 \
  --alarm-actions "arn:aws:sns:eu-west-1:123456789012:apexshare-warning-alerts" \
  --dimensions Name=ApiName,Value=apexshare-api-prod

# DynamoDB throttling warning
aws cloudwatch put-metric-alarm \
  --alarm-name "ApexShare-DynamoDB-Throttles-Warning" \
  --alarm-description "DynamoDB throttled requests detected" \
  --metric-name "ThrottledRequests" \
  --namespace "AWS/DynamoDB" \
  --statistic "Sum" \
  --period 300 \
  --threshold 0 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 1 \
  --alarm-actions "arn:aws:sns:eu-west-1:123456789012:apexshare-warning-alerts" \
  --dimensions Name=TableName,Value=apexshare-uploads-prod
```

### Info Alarms (P3 - Informational)

```bash
# High volume notification
aws cloudwatch put-metric-alarm \
  --alarm-name "ApexShare-High-Volume-Info" \
  --alarm-description "API requests > 1000 in 5 minutes (high volume)" \
  --metric-name "Count" \
  --namespace "AWS/ApiGateway" \
  --statistic "Sum" \
  --period 300 \
  --threshold 1000 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 1 \
  --alarm-actions "arn:aws:sns:eu-west-1:123456789012:apexshare-info-alerts" \
  --dimensions Name=ApiName,Value=apexshare-api-prod
```

### SNS Topic Configuration

```bash
# Create SNS topics for different alert severities
aws sns create-topic --name apexshare-critical-alerts
aws sns create-topic --name apexshare-warning-alerts
aws sns create-topic --name apexshare-info-alerts

# Subscribe email endpoints
aws sns subscribe \
  --topic-arn arn:aws:sns:eu-west-1:123456789012:apexshare-critical-alerts \
  --protocol email \
  --notification-endpoint ops-critical@apexshare.be

aws sns subscribe \
  --topic-arn arn:aws:sns:eu-west-1:123456789012:apexshare-warning-alerts \
  --protocol email \
  --notification-endpoint ops-warning@apexshare.be
```

---

## Log Management

### Log Groups Configuration

```bash
# Set retention policies for all log groups
aws logs put-retention-policy \
  --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
  --retention-in-days 30

aws logs put-retention-policy \
  --log-group-name "/aws/lambda/apexshare-download-handler-prod" \
  --retention-in-days 30

aws logs put-retention-policy \
  --log-group-name "/aws/lambda/apexshare-email-sender-prod" \
  --retention-in-days 30

aws logs put-retention-policy \
  --log-group-name "/aws/apigateway/apexshare-api-prod" \
  --retention-in-days 14
```

### Log Insights Queries

#### API Error Analysis

```sql
-- Query for API errors in last hour
fields @timestamp, @message, sourceIP, userAgent
| filter @message like /ERROR/
| stats count() by sourceIP
| sort count desc
| limit 20
```

#### Lambda Performance Analysis

```sql
-- Query for slow Lambda executions
fields @timestamp, @duration, @message
| filter @type = "REPORT"
| filter @duration > 5000
| sort @timestamp desc
| limit 50
```

#### Upload Success Rate Analysis

```sql
-- Query for upload success/failure rates
fields @timestamp, @message
| filter @message like /UPLOAD_/
| stats count() by bin(5m)
| sort @timestamp desc
```

### Custom Metrics from Logs

```bash
# Create custom metric filter for upload success rate
aws logs put-metric-filter \
  --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
  --filter-name "UploadSuccessRate" \
  --filter-pattern "[timestamp, requestId, level=\"INFO\", message=\"UPLOAD_SUCCESS\"]" \
  --metric-transformations \
    metricName=UploadSuccess,metricNamespace=ApexShare/Custom,metricValue=1,defaultValue=0

# Create custom metric filter for upload failures
aws logs put-metric-filter \
  --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
  --filter-name "UploadFailureRate" \
  --filter-pattern "[timestamp, requestId, level=\"ERROR\", message=\"UPLOAD_FAILED\"]" \
  --metric-transformations \
    metricName=UploadFailure,metricNamespace=ApexShare/Custom,metricValue=1,defaultValue=0
```

---

## Performance Monitoring

### Key Performance Indicators (KPIs)

| KPI | Target | Warning Threshold | Critical Threshold |
|-----|--------|------------------|-------------------|
| API Response Time | <2s average | >2s | >5s |
| Upload Success Rate | >99% | <99% | <95% |
| Email Delivery Rate | >99% | <99% | <98% |
| System Availability | >99.9% | <99.9% | <99% |
| Lambda Cold Start Rate | <5% | >5% | >10% |

### Performance Monitoring Dashboards

#### Real-time Performance Widget

```json
{
  "type": "metric",
  "properties": {
    "metrics": [
      ["ApexShare/Custom", "UploadSuccess"],
      ["ApexShare/Custom", "UploadFailure"],
      ["AWS/ApiGateway", "Latency", "ApiName", "apexshare-api-prod", {"stat": "Average"}],
      ["AWS/Lambda", "Duration", "FunctionName", "apexshare-upload-handler-prod", {"stat": "Average"}]
    ],
    "period": 300,
    "stat": "Sum",
    "region": "eu-west-1",
    "title": "Real-time Performance Metrics",
    "yAxis": {
      "left": {
        "min": 0
      }
    }
  }
}
```

### Synthetic Monitoring

#### Health Check Lambda Function

```typescript
// Synthetic monitoring function (deploys separately)
export const handler = async (event: any) => {
  const healthChecks = [
    {
      name: 'API Health',
      url: 'https://api.apexshare.be/api/v1/health',
      timeout: 5000
    },
    {
      name: 'Frontend Health',
      url: 'https://apexshare.be',
      timeout: 10000
    }
  ];

  const results = await Promise.all(
    healthChecks.map(async (check) => {
      try {
        const start = Date.now();
        const response = await fetch(check.url, {
          timeout: check.timeout
        });
        const duration = Date.now() - start;

        return {
          name: check.name,
          success: response.ok,
          duration,
          status: response.status
        };
      } catch (error) {
        return {
          name: check.name,
          success: false,
          error: error.message
        };
      }
    })
  );

  // Send custom metrics to CloudWatch
  for (const result of results) {
    await cloudWatch.putMetricData({
      Namespace: 'ApexShare/Synthetic',
      MetricData: [
        {
          MetricName: `${result.name.replace(' ', '')}_Success`,
          Value: result.success ? 1 : 0,
          Unit: 'Count'
        },
        {
          MetricName: `${result.name.replace(' ', '')}_Duration`,
          Value: result.duration || 0,
          Unit: 'Milliseconds'
        }
      ]
    }).promise();
  }

  return results;
};
```

---

## Security Monitoring

### WAF Monitoring

```bash
# Create WAF blocked requests alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "ApexShare-WAF-Blocked-Requests" \
  --alarm-description "WAF blocked > 100 requests in 5 minutes" \
  --metric-name "BlockedRequests" \
  --namespace "AWS/WAFV2" \
  --statistic "Sum" \
  --period 300 \
  --threshold 100 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 1 \
  --alarm-actions "arn:aws:sns:eu-west-1:123456789012:apexshare-security-alerts" \
  --dimensions Name=WebACL,Value=apexshare-waf-prod,Name=Region,Value=eu-west-1
```

### Security Log Analysis

```sql
-- CloudTrail analysis for suspicious API activity
fields @timestamp, sourceIPAddress, userAgent, eventName, errorCode
| filter eventName like /^(AssumeRole|GetSessionToken|CreateUser)/
| filter sourceIPAddress not like /^(10\.|172\.|192\.168\.)/
| stats count() by sourceIPAddress, userAgent
| sort count desc
| limit 20
```

### Intrusion Detection

```bash
# Custom metric for failed authentication attempts
aws logs put-metric-filter \
  --log-group-name "/aws/apigateway/apexshare-api-prod" \
  --filter-name "FailedAuthAttempts" \
  --filter-pattern "[timestamp, requestId, ip, ..., status=4*, ...]" \
  --metric-transformations \
    metricName=FailedAuth,metricNamespace=ApexShare/Security,metricValue=1

# Alarm for multiple failed attempts from same IP
aws cloudwatch put-metric-alarm \
  --alarm-name "ApexShare-Multiple-Failed-Auth" \
  --alarm-description "Multiple failed auth attempts from same IP" \
  --metric-name "FailedAuth" \
  --namespace "ApexShare/Security" \
  --statistic "Sum" \
  --period 300 \
  --threshold 10 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 1 \
  --alarm-actions "arn:aws:sns:eu-west-1:123456789012:apexshare-security-alerts"
```

---

## Cost Monitoring

### Budget Configuration

```bash
# Create monthly budget with alerts
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "ApexShare-Production-Monthly",
    "BudgetLimit": {
      "Amount": "1000",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST",
    "CostFilters": {
      "TagKey": ["Project"],
      "TagValue": ["ApexShare"]
    }
  }' \
  --notifications-with-subscribers '[
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 70,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [
        {
          "SubscriptionType": "EMAIL",
          "Address": "billing@apexshare.be"
        }
      ]
    }
  ]'
```

### Cost Anomaly Detection

```bash
# Create cost anomaly detector
aws ce create-anomaly-detector \
  --anomaly-detector '{
    "DetectorName": "ApexShare-Cost-Anomaly",
    "MonitorType": "DIMENSIONAL",
    "DimensionKey": "SERVICE",
    "MatchOptions": ["EQUALS"],
    "MonitorSpecification": "{\\"Tags\\":{\\"TagKey\\":\\"Project\\",\\"Values\\":[\\"ApexShare\\"],\\"MatchOptions\\":[\\"EQUALS\\"]}}"
  }'
```

### Cost Monitoring Dashboard

```json
{
  "type": "metric",
  "properties": {
    "metrics": [
      ["AWS/Billing", "EstimatedCharges", "Currency", "USD"],
      ["AWS/S3", "BucketSizeBytes", "BucketName", "apexshare-videos-prod", "StorageType", "StandardStorage"],
      ["AWS/Lambda", "Duration", "FunctionName", "apexshare-upload-handler-prod"]
    ],
    "period": 86400,
    "stat": "Maximum",
    "region": "us-east-1",
    "title": "Daily Cost Tracking"
  }
}
```

---

## Incident Response

### Automated Incident Response

#### Lambda Function for Incident Response

```typescript
// Incident response automation
export const handler = async (event: any) => {
  const snsMessage = JSON.parse(event.Records[0].Sns.Message);
  const alarmName = snsMessage.AlarmName;
  const newState = snsMessage.NewStateValue;

  // Parse alarm severity from name
  const severity = alarmName.includes('Critical') ? 'P1' :
                  alarmName.includes('Warning') ? 'P2' : 'P3';

  if (severity === 'P1' && newState === 'ALARM') {
    // Create incident ticket
    await createIncidentTicket({
      title: `Critical Alert: ${alarmName}`,
      description: snsMessage.NewStateReason,
      severity: 'P1',
      assignee: 'on-call-engineer'
    });

    // Notify on-call engineer
    await notifyOnCall({
      message: `CRITICAL ALERT: ${alarmName}`,
      method: 'call' // Phone call for P1 incidents
    });

    // Check if auto-remediation is possible
    if (alarmName.includes('Lambda-Errors')) {
      await attemptLambdaRemediation();
    }
  }

  // Log incident for tracking
  await logIncident({
    timestamp: new Date().toISOString(),
    alarmName,
    severity,
    state: newState,
    reason: snsMessage.NewStateReason
  });
};
```

### Incident Escalation Matrix

| Severity | Response Time | Escalation | Notification Method |
|----------|--------------|------------|-------------------|
| P1 (Critical) | 15 minutes | Immediate to on-call | Phone call + SMS |
| P2 (High) | 1 hour | Team lead if no response | Email + Slack |
| P3 (Medium) | 4 hours | Manager if unresolved | Email |
| P4 (Low) | 24 hours | Weekly review | Email digest |

---

## Monitoring Playbooks

### High API Latency Playbook

**Symptoms:**
- API Gateway latency > 2000ms
- User complaints about slow response times
- CloudWatch alarm: "ApexShare-API-Latency-Warning"

**Investigation Steps:**

1. **Check Lambda Performance**
   ```bash
   # Check Lambda duration metrics
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Lambda \
     --metric-name Duration \
     --dimensions Name=FunctionName,Value=apexshare-upload-handler-prod \
     --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Average,Maximum
   ```

2. **Check DynamoDB Performance**
   ```bash
   # Check for DynamoDB throttling
   aws cloudwatch get-metric-statistics \
     --namespace AWS/DynamoDB \
     --metric-name ThrottledRequests \
     --dimensions Name=TableName,Value=apexshare-uploads-prod \
     --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Sum
   ```

3. **Check S3 Performance**
   ```bash
   # Check S3 request metrics
   aws cloudwatch get-metric-statistics \
     --namespace AWS/S3 \
     --metric-name AllRequests \
     --dimensions Name=BucketName,Value=apexshare-videos-prod \
     --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Sum
   ```

**Remediation Actions:**

1. **Scale Lambda Resources**
   ```bash
   # Increase Lambda memory if CPU-bound
   aws lambda update-function-configuration \
     --function-name apexshare-upload-handler-prod \
     --memory-size 1024
   ```

2. **Enable Provisioned Concurrency**
   ```bash
   # Reduce cold starts
   aws lambda put-provisioned-concurrency-config \
     --function-name apexshare-upload-handler-prod \
     --qualifier $LATEST \
     --provisioned-concurrency-count 5
   ```

### High Error Rate Playbook

**Symptoms:**
- API Gateway 5xx errors > 5 in 5 minutes
- Lambda error rate > 3 in 5 minutes
- CloudWatch alarm: "ApexShare-API-5xx-Errors-Critical"

**Investigation Steps:**

1. **Analyze Error Logs**
   ```bash
   # Get recent Lambda errors
   aws logs filter-log-events \
     --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
     --start-time $(date -d '1 hour ago' +%s000) \
     --filter-pattern "ERROR"
   ```

2. **Check External Dependencies**
   ```bash
   # Test S3 connectivity
   aws s3 ls s3://apexshare-videos-prod --recursive | head -5

   # Test DynamoDB connectivity
   aws dynamodb describe-table --table-name apexshare-uploads-prod
   ```

**Remediation Actions:**

1. **Rollback if Recent Deployment**
   ```bash
   # Quick rollback to previous version
   aws lambda update-alias \
     --function-name apexshare-upload-handler-prod \
     --name LIVE \
     --function-version $(aws lambda list-versions-by-function \
       --function-name apexshare-upload-handler-prod \
       --query 'Versions[-2].Version' --output text)
   ```

2. **Enable Maintenance Mode**
   ```bash
   # Temporarily disable problematic functionality
   aws lambda update-function-configuration \
     --function-name apexshare-upload-handler-prod \
     --environment Variables='{MAINTENANCE_MODE=true}'
   ```

---

## Maintenance and Updates

### Monthly Monitoring Review

**Tasks:**
1. Review alarm effectiveness and adjust thresholds
2. Analyze performance trends and capacity planning
3. Update monitoring dashboards with new metrics
4. Review cost trends and optimize monitoring costs
5. Test incident response procedures

**Monitoring Health Check Script:**

```bash
#!/bin/bash
# Monthly monitoring health check

echo "ApexShare Monitoring Health Check - $(date)"
echo "=============================================="

# Check all critical alarms are configured
echo "Checking critical alarms..."
CRITICAL_ALARMS=$(aws cloudwatch describe-alarms \
  --alarm-name-prefix "ApexShare" \
  --query 'MetricAlarms[?contains(AlarmName, `Critical`)].AlarmName' \
  --output text)

if [ -z "$CRITICAL_ALARMS" ]; then
  echo "❌ No critical alarms found!"
else
  echo "✅ Critical alarms configured: $CRITICAL_ALARMS"
fi

# Check SNS topic subscriptions
echo "Checking SNS subscriptions..."
for topic in apexshare-critical-alerts apexshare-warning-alerts; do
  SUBSCRIBERS=$(aws sns list-subscriptions-by-topic \
    --topic-arn "arn:aws:sns:eu-west-1:123456789012:$topic" \
    --query 'Subscriptions[].Endpoint' --output text)

  if [ -z "$SUBSCRIBERS" ]; then
    echo "❌ No subscribers for $topic"
  else
    echo "✅ $topic has subscribers: $SUBSCRIBERS"
  fi
done

# Check dashboard availability
echo "Checking dashboards..."
DASHBOARDS=$(aws cloudwatch list-dashboards \
  --dashboard-name-prefix "ApexShare" \
  --query 'DashboardEntries[].DashboardName' --output text)

if [ -z "$DASHBOARDS" ]; then
  echo "❌ No dashboards found!"
else
  echo "✅ Dashboards available: $DASHBOARDS"
fi

echo "=============================================="
echo "Monitoring health check complete"
```

### Monitoring Cost Optimization

```bash
# Review log retention policies
for log_group in $(aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/apexshare" \
  --query 'logGroups[].logGroupName' --output text); do

  RETENTION=$(aws logs describe-log-groups \
    --log-group-name "$log_group" \
    --query 'logGroups[0].retentionInDays' --output text)

  echo "$log_group: $RETENTION days retention"
done

# Optimize high-volume log groups
aws logs put-retention-policy \
  --log-group-name "/aws/lambda/apexshare-upload-handler-prod" \
  --retention-in-days 7  # Reduce for cost savings
```

---

*ApexShare Monitoring and Alerting Setup v1.0 - September 2025*

*This monitoring configuration should be reviewed monthly and updated based on system performance and operational needs.*