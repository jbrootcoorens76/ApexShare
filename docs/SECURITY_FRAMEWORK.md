# ApexShare - Comprehensive Security Framework
**Version:** 1.0
**Date:** September 19, 2025
**Security Owner:** AWS Security Specialist
**Status:** Implementation Ready

## Executive Summary

This document provides a comprehensive security framework for the ApexShare motorcycle training video sharing system. It implements defense-in-depth security with multiple layers of protection, following AWS Well-Architected security pillar best practices, zero trust principles, and the principle of least privilege.

## Security Architecture Overview

### Core Security Principles Applied
1. **Zero Trust Architecture**: Verify every request and trust nothing by default
2. **Principle of Least Privilege**: Grant only minimum required permissions
3. **Defense in Depth**: Multiple security layers at every tier
4. **Encryption Everywhere**: Data encrypted at rest and in transit
5. **Comprehensive Auditing**: Log and monitor all security events
6. **Automated Security**: Security controls built into infrastructure

### Security Threat Model

#### Data Classification
- **Highly Sensitive**: Student email addresses, trainer information
- **Sensitive**: Training video content, session metadata
- **Internal**: System logs, operational metrics
- **Public**: Static website content (before authentication)

#### Attack Vectors Addressed
- Unauthorized data access (S3 bucket enumeration, API access)
- Data in transit interception (TLS/SSL attacks)
- Injection attacks (SQL, NoSQL, Code injection)
- DDoS and rate limiting attacks
- Privilege escalation (IAM role assumption)
- Data exfiltration (S3 object enumeration)
- Man-in-the-middle attacks
- Cross-site scripting (XSS) and CSRF attacks

## 1. IAM Security Framework

### 1.1 Lambda Function IAM Roles

#### Upload Handler Role
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogsAccess",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": [
        "arn:aws:logs:*:*:log-group:/aws/lambda/apexshare-upload-handler-*:*"
      ]
    },
    {
      "Sid": "S3PresignedURLGeneration",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": [
        "arn:aws:s3:::apexshare-videos-${env}/videos/*",
        "arn:aws:s3:::apexshare-videos-${env}/temp-uploads/*"
      ],
      "Condition": {
        "StringEquals": {
          "s3:x-amz-content-sha256": "UNSIGNED-PAYLOAD"
        },
        "NumericLessThan": {
          "s3:content-length": "5368709120"
        }
      }
    },
    {
      "Sid": "DynamoDBMetadataWrite",
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/apexshare-uploads-${env}"
      ],
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": [
            "PK",
            "SK",
            "GSI1PK",
            "GSI1SK",
            "GSI2PK",
            "GSI2SK",
            "fileId",
            "studentEmail",
            "studentName",
            "trainerName",
            "sessionDate",
            "notes",
            "fileName",
            "originalFileName",
            "fileSize",
            "contentType",
            "s3Key",
            "s3Bucket",
            "uploadDate",
            "status",
            "downloadCount",
            "ttl"
          ]
        }
      }
    },
    {
      "Sid": "KMSDecryptForEnvironmentVariables",
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": [
        "arn:aws:kms:*:*:key/${lambda-env-key-id}"
      ],
      "Condition": {
        "StringEquals": {
          "kms:ViaService": [
            "lambda.*.amazonaws.com"
          ]
        }
      }
    }
  ]
}
```

#### Email Sender Role
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogsAccess",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": [
        "arn:aws:logs:*:*:log-group:/aws/lambda/apexshare-email-sender-*:*"
      ]
    },
    {
      "Sid": "SESEmailSending",
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": [
        "arn:aws:ses:*:*:identity/noreply@apexshare.be",
        "arn:aws:ses:*:*:identity/apexshare.be"
      ],
      "Condition": {
        "StringEquals": {
          "ses:FromAddress": "noreply@apexshare.be"
        },
        "ForAllValues:StringLike": {
          "ses:Recipients": [
            "*@*"
          ]
        }
      }
    },
    {
      "Sid": "DynamoDBMetadataReadWrite",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/apexshare-uploads-${env}",
        "arn:aws:dynamodb:*:*:table/apexshare-uploads-${env}/index/*"
      ],
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": [
            "PK",
            "SK",
            "fileId",
            "studentEmail",
            "studentName",
            "trainerName",
            "sessionDate",
            "notes",
            "fileName",
            "originalFileName",
            "emailSentAt",
            "status"
          ]
        }
      }
    },
    {
      "Sid": "S3EmailTemplateAccess",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:s3:::apexshare-templates-${env}/email-templates/*"
      ]
    },
    {
      "Sid": "KMSDecryptForEnvironmentVariables",
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": [
        "arn:aws:kms:*:*:key/${lambda-env-key-id}"
      ],
      "Condition": {
        "StringEquals": {
          "kms:ViaService": [
            "lambda.*.amazonaws.com"
          ]
        }
      }
    }
  ]
}
```

#### Download Handler Role
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogsAccess",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": [
        "arn:aws:logs:*:*:log-group:/aws/lambda/apexshare-download-handler-*:*"
      ]
    },
    {
      "Sid": "S3PresignedDownloadGeneration",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:s3:::apexshare-videos-${env}/videos/*"
      ],
      "Condition": {
        "DateLessThan": {
          "aws:TokenIssueTime": "${aws:CurrentTime}"
        }
      }
    },
    {
      "Sid": "DynamoDBMetadataReadWrite",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/apexshare-uploads-${env}",
        "arn:aws:dynamodb:*:*:table/apexshare-uploads-${env}/index/*"
      ],
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": [
            "PK",
            "SK",
            "fileId",
            "s3Key",
            "s3Bucket",
            "originalFileName",
            "fileSize",
            "sessionDate",
            "trainerName",
            "notes",
            "ttl",
            "downloadCount",
            "lastDownloadAt",
            "uploadDate"
          ]
        }
      }
    },
    {
      "Sid": "KMSDecryptForEnvironmentVariables",
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": [
        "arn:aws:kms:*:*:key/${lambda-env-key-id}"
      ],
      "Condition": {
        "StringEquals": {
          "kms:ViaService": [
            "lambda.*.amazonaws.com"
          ]
        }
      }
    }
  ]
}
```

### 1.2 Cross-Service Access Policies

#### API Gateway Execution Role
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LambdaInvokePermissions",
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": [
        "arn:aws:lambda:*:*:function:apexshare-upload-handler-${env}",
        "arn:aws:lambda:*:*:function:apexshare-download-handler-${env}"
      ]
    },
    {
      "Sid": "CloudWatchLogsForAPIGateway",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:PutLogEvents",
        "logs:GetLogEvents",
        "logs:FilterLogEvents"
      ],
      "Resource": [
        "arn:aws:logs:*:*:log-group:API-Gateway-Execution-Logs*"
      ]
    }
  ]
}
```

#### CloudFront Origin Access Control Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontAccess",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": [
        "arn:aws:s3:::apexshare-videos-${env}/*",
        "arn:aws:s3:::apexshare-frontend-${env}/*"
      ],
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::${account-id}:distribution/${distribution-id}"
        }
      }
    }
  ]
}
```

### 1.3 Permission Boundaries for Enhanced Security

#### Lambda Function Permission Boundary
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowedServices",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:PutObjectAcl",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "ses:SendEmail",
        "ses:SendRawEmail",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "kms:Decrypt"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DenyDangerousActions",
      "Effect": "Deny",
      "Action": [
        "iam:*",
        "kms:CreateKey",
        "kms:DeleteKey",
        "s3:DeleteBucket",
        "dynamodb:DeleteTable",
        "lambda:CreateFunction",
        "lambda:DeleteFunction"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DenyUnencryptedActions",
      "Effect": "Deny",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": [
            "AES256",
            "aws:kms"
          ]
        }
      }
    }
  ]
}
```

## 2. S3 Security Configuration

### 2.1 Video Storage Bucket Security

#### Bucket Policy for Videos
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureConnections",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::apexshare-videos-${env}",
        "arn:aws:s3:::apexshare-videos-${env}/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    },
    {
      "Sid": "DenyDirectPublicAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion"
      ],
      "Resource": [
        "arn:aws:s3:::apexshare-videos-${env}/*"
      ],
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalServiceName": [
            "cloudfront.amazonaws.com"
          ]
        },
        "Null": {
          "aws:PrincipalTag/ApexShareRole": "true"
        }
      }
    },
    {
      "Sid": "DenyUnencryptedObjectUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": [
        "arn:aws:s3:::apexshare-videos-${env}/*"
      ],
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": [
            "AES256",
            "aws:kms"
          ]
        }
      }
    },
    {
      "Sid": "AllowPresignedUploads",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::${account-id}:role/ApexShareUploadHandlerRole-${env}"
      },
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": [
        "arn:aws:s3:::apexshare-videos-${env}/videos/*",
        "arn:aws:s3:::apexshare-videos-${env}/temp-uploads/*"
      ],
      "Condition": {
        "StringEquals": {
          "s3:x-amz-content-sha256": "UNSIGNED-PAYLOAD"
        },
        "NumericLessThan": {
          "s3:content-length": "5368709120"
        },
        "StringLike": {
          "s3:x-amz-meta-file-id": "*"
        }
      }
    },
    {
      "Sid": "AllowPresignedDownloads",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::${account-id}:role/ApexShareDownloadHandlerRole-${env}"
      },
      "Action": [
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:s3:::apexshare-videos-${env}/videos/*"
      ],
      "Condition": {
        "DateLessThan": {
          "aws:TokenIssueTime": "${aws:CurrentTime}"
        }
      }
    }
  ]
}
```

#### CORS Configuration for Direct Upload
```json
[
  {
    "AllowedHeaders": [
      "Authorization",
      "Content-Type",
      "Content-Length",
      "Content-MD5",
      "x-amz-date",
      "x-amz-content-sha256",
      "x-amz-meta-*"
    ],
    "AllowedMethods": [
      "PUT",
      "POST"
    ],
    "AllowedOrigins": [
      "https://apexshare.be",
      "https://staging.apexshare.be",
      "https://dev.apexshare.be"
    ],
    "ExposeHeaders": [
      "ETag",
      "x-amz-version-id"
    ],
    "MaxAgeSeconds": 3000
  },
  {
    "AllowedHeaders": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedOrigins": [
      "https://apexshare.be",
      "https://staging.apexshare.be",
      "https://dev.apexshare.be"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

### 2.2 S3 Encryption Configuration

#### Server-Side Encryption Configuration
```yaml
# CDK Configuration
encryption: s3.BucketEncryption.KMS_MANAGED
encryptionKey:
  keyPolicy:
    Version: '2012-10-17'
    Statement:
      - Sid: EnableIAMUserPermissions
        Effect: Allow
        Principal:
          AWS: !Sub 'arn:aws:iam::${AWS::AccountId}:root'
        Action: 'kms:*'
        Resource: '*'
      - Sid: AllowLambdaDecryption
        Effect: Allow
        Principal:
          AWS:
            - !GetAtt UploadHandlerRole.Arn
            - !GetAtt DownloadHandlerRole.Arn
            - !GetAtt EmailSenderRole.Arn
        Action:
          - 'kms:Decrypt'
          - 'kms:DescribeKey'
        Resource: '*'
      - Sid: AllowS3Service
        Effect: Allow
        Principal:
          Service: s3.amazonaws.com
        Action:
          - 'kms:Decrypt'
          - 'kms:DescribeKey'
          - 'kms:Encrypt'
          - 'kms:GenerateDataKey'
        Resource: '*'
        Condition:
          StringEquals:
            'kms:ViaService': !Sub 's3.${AWS::Region}.amazonaws.com'
```

### 2.3 S3 Access Logging Configuration

#### Access Logging Bucket Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3ServerAccessLogsPolicy",
      "Effect": "Allow",
      "Principal": {
        "Service": "logging.s3.amazonaws.com"
      },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::apexshare-access-logs-${env}/*",
      "Condition": {
        "ArnEquals": {
          "aws:SourceArn": [
            "arn:aws:s3:::apexshare-videos-${env}",
            "arn:aws:s3:::apexshare-frontend-${env}"
          ]
        },
        "StringEquals": {
          "aws:SourceAccount": "${account-id}"
        }
      }
    },
    {
      "Sid": "S3ServerAccessLogsDelivery",
      "Effect": "Allow",
      "Principal": {
        "Service": "logging.s3.amazonaws.com"
      },
      "Action": "s3:GetBucketAcl",
      "Resource": "arn:aws:s3:::apexshare-access-logs-${env}",
      "Condition": {
        "ArnEquals": {
          "aws:SourceArn": [
            "arn:aws:s3:::apexshare-videos-${env}",
            "arn:aws:s3:::apexshare-frontend-${env}"
          ]
        },
        "StringEquals": {
          "aws:SourceAccount": "${account-id}"
        }
      }
    }
  ]
}
```

## 3. API Gateway Security

### 3.1 Request Validation and Sanitization

#### Request Validator Configuration
```json
{
  "validateRequestBody": true,
  "validateRequestParameters": true,
  "requestValidatorName": "ApexShareRequestValidator",
  "requestModels": {
    "application/json": "UploadRequestModel"
  }
}
```

#### Upload Request Model Schema
```json
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "title": "Upload Request Schema",
  "type": "object",
  "properties": {
    "studentEmail": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
      "maxLength": 255
    },
    "studentName": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9\\s\\-\\.]{1,100}$",
      "maxLength": 100
    },
    "trainerName": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9\\s\\-\\.]{1,100}$",
      "maxLength": 100
    },
    "sessionDate": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "notes": {
      "type": "string",
      "maxLength": 1000
    },
    "fileName": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9\\s\\-\\._]{1,255}\\.(mp4|mov|avi|mkv)$",
      "maxLength": 255
    },
    "fileSize": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5368709120
    },
    "contentType": {
      "type": "string",
      "enum": ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"]
    }
  },
  "required": ["studentEmail", "fileName", "fileSize", "contentType"],
  "additionalProperties": false
}
```

### 3.2 Rate Limiting and Throttling

#### API Gateway Throttling Configuration
```typescript
// CDK Configuration
const api = new apigateway.RestApi(this, 'ApexShareApi', {
  // ... other config
  deployOptions: {
    throttlingRateLimit: 100,    // requests per second
    throttlingBurstLimit: 500,   // burst capacity
    // Per-method throttling
    methodOptions: {
      '/api/v1/uploads/initiate/POST': {
        throttlingRateLimit: 10,
        throttlingBurstLimit: 50
      },
      '/api/v1/downloads/{fileId}/GET': {
        throttlingRateLimit: 50,
        throttlingBurstLimit: 200
      }
    }
  }
});

// Usage Plans for different user tiers
const usagePlan = api.addUsagePlan('ApexShareUsagePlan', {
  name: 'ApexShare Standard Plan',
  throttle: {
    rateLimit: 100,
    burstLimit: 500
  },
  quota: {
    limit: 10000,
    period: apigateway.Period.DAY
  }
});
```

### 3.3 WAF Integration for Advanced Protection

#### WAF Web ACL Configuration
```json
{
  "Name": "ApexShareWAF",
  "Scope": "CLOUDFRONT",
  "DefaultAction": {
    "Allow": {}
  },
  "Rules": [
    {
      "Name": "AWSManagedRulesCommonRuleSet",
      "Priority": 1,
      "OverrideAction": {
        "None": {}
      },
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesCommonRuleSet"
        }
      },
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "CommonRuleSetMetric"
      }
    },
    {
      "Name": "AWSManagedRulesKnownBadInputsRuleSet",
      "Priority": 2,
      "OverrideAction": {
        "None": {}
      },
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesKnownBadInputsRuleSet"
        }
      },
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "KnownBadInputsMetric"
      }
    },
    {
      "Name": "RateLimitRule",
      "Priority": 3,
      "Action": {
        "Block": {}
      },
      "Statement": {
        "RateBasedStatement": {
          "Limit": 2000,
          "AggregateKeyType": "IP"
        }
      },
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "RateLimitMetric"
      }
    },
    {
      "Name": "GeographicRestrictionRule",
      "Priority": 4,
      "Action": {
        "Block": {}
      },
      "Statement": {
        "GeoMatchStatement": {
          "CountryCodes": ["CN", "RU", "KP", "IR"]
        }
      },
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "GeoBlockMetric"
      }
    },
    {
      "Name": "SQLiProtection",
      "Priority": 5,
      "OverrideAction": {
        "None": {}
      },
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesSQLiRuleSet"
        }
      },
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "SQLiProtectionMetric"
      }
    }
  ],
  "VisibilityConfig": {
    "SampledRequestsEnabled": true,
    "CloudWatchMetricsEnabled": true,
    "MetricName": "ApexShareWAFMetric"
  }
}
```

### 3.4 API Gateway Resource Policies

#### API Gateway Resource Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowOnlyHTTPS",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "execute-api:Invoke",
      "Resource": "arn:aws:execute-api:*:*:*",
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    },
    {
      "Sid": "AllowFromApprovedDomains",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "execute-api:Invoke",
      "Resource": "arn:aws:execute-api:*:*:*",
      "Condition": {
        "StringEquals": {
          "aws:Referer": [
            "https://apexshare.be/*",
            "https://staging.apexshare.be/*",
            "https://dev.apexshare.be/*"
          ]
        }
      }
    },
    {
      "Sid": "DenyFromUnknownUserAgents",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "execute-api:Invoke",
      "Resource": "arn:aws:execute-api:*:*:*",
      "Condition": {
        "StringLike": {
          "aws:RequestedRegion": "*",
          "aws:UserAgent": [
            "*bot*",
            "*crawler*",
            "*spider*",
            "*scraper*"
          ]
        }
      }
    }
  ]
}
```

## 4. Lambda Function Security

### 4.1 Runtime Security Configuration

#### Lambda Function Security Configuration
```typescript
// CDK Configuration for Enhanced Security
const uploadHandler = new nodejs.NodejsFunction(this, 'UploadHandler', {
  // ... basic config
  environment: {
    // Encrypted environment variables
    S3_BUCKET_NAME: props.videosBucket.bucketName,
    DYNAMODB_TABLE: props.uploadsTable.tableName,
    LOG_LEVEL: config.logLevel,
    NODE_OPTIONS: '--enable-source-maps',
    // Security headers
    SECURITY_HEADERS: JSON.stringify({
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    })
  },
  // Runtime security
  reservedConcurrencyLimit: config.lambda.reservedConcurrency.uploadHandler,
  deadLetterQueue: dlq,
  retryAttempts: 2,
  maxEventAge: cdk.Duration.hours(1),
  // Function-level permissions
  initialPolicy: [
    new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      actions: ['*'],
      resources: ['*'],
      conditions: {
        'StringNotEquals': {
          'aws:PrincipalTag/Environment': config.env
        }
      }
    })
  ],
  // VPC configuration for sensitive operations
  vpc: config.env === 'prod' ? vpc : undefined,
  vpcSubnets: config.env === 'prod' ? {
    subnetType: ec2.SubnetType.PRIVATE_ISOLATED
  } : undefined,
  securityGroups: config.env === 'prod' ? [lambdaSecurityGroup] : undefined
});

// Add permission boundary
uploadHandler.role?.attachInlinePolicy(new iam.Policy(this, 'PermissionBoundary', {
  statements: [lambdaPermissionBoundary]
}));
```

### 4.2 Environment Variable Encryption

#### KMS Key for Lambda Environment Variables
```typescript
const lambdaEnvKey = new kms.Key(this, 'LambdaEnvironmentKey', {
  description: 'KMS key for Lambda environment variable encryption',
  keyPolicy: new iam.PolicyDocument({
    statements: [
      new iam.PolicyStatement({
        sid: 'EnableIAMUserPermissions',
        effect: iam.Effect.ALLOW,
        principals: [new iam.AccountRootPrincipal()],
        actions: ['kms:*'],
        resources: ['*']
      }),
      new iam.PolicyStatement({
        sid: 'AllowLambdaDecryption',
        effect: iam.Effect.ALLOW,
        principals: [
          uploadHandler.role!,
          downloadHandler.role!,
          emailSender.role!
        ],
        actions: [
          'kms:Decrypt',
          'kms:DescribeKey'
        ],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'kms:ViaService': [`lambda.${this.region}.amazonaws.com`]
          }
        }
      })
    ]
  })
});

// Apply encryption to environment variables
uploadHandler.addEnvironment('ENCRYPTED_CONFIG',
  JSON.stringify(sensitiveConfig),
  {
    kmsKey: lambdaEnvKey
  }
);
```

### 4.3 VPC Configuration for Production

#### Lambda VPC Security Group
```typescript
const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
  vpc: vpc,
  description: 'Security group for ApexShare Lambda functions',
  allowAllOutbound: false
});

// Allow HTTPS outbound to AWS services
lambdaSecurityGroup.addEgressRule(
  ec2.Peer.anyIpv4(),
  ec2.Port.tcp(443),
  'HTTPS to AWS services'
);

// Allow DNS resolution
lambdaSecurityGroup.addEgressRule(
  ec2.Peer.anyIpv4(),
  ec2.Port.tcp(53),
  'DNS resolution'
);

lambdaSecurityGroup.addEgressRule(
  ec2.Peer.anyIpv4(),
  ec2.Port.udp(53),
  'DNS resolution'
);

// VPC Endpoints for AWS services
const s3Endpoint = vpc.addGatewayEndpoint('S3Endpoint', {
  service: ec2.GatewayVpcEndpointAwsService.S3,
  subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }]
});

const dynamoEndpoint = vpc.addGatewayEndpoint('DynamoEndpoint', {
  service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
  subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }]
});

const sesEndpoint = vpc.addInterfaceEndpoint('SESEndpoint', {
  service: ec2.InterfaceVpcEndpointAwsService.SES,
  subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
  securityGroups: [lambdaSecurityGroup]
});
```

## 5. DynamoDB Security

### 5.1 Encryption Configuration

#### DynamoDB Table Security Configuration
```typescript
const uploadsTable = new dynamodb.Table(this, 'UploadsTable', {
  // ... basic config
  encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
  encryptionKey: new kms.Key(this, 'DynamoDBKey', {
    description: 'KMS key for DynamoDB encryption',
    keyPolicy: new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          sid: 'EnableIAMUserPermissions',
          effect: iam.Effect.ALLOW,
          principals: [new iam.AccountRootPrincipal()],
          actions: ['kms:*'],
          resources: ['*']
        }),
        new iam.PolicyStatement({
          sid: 'AllowDynamoDBService',
          effect: iam.Effect.ALLOW,
          principals: [new iam.ServicePrincipal('dynamodb.amazonaws.com')],
          actions: [
            'kms:Decrypt',
            'kms:DescribeKey',
            'kms:Encrypt',
            'kms:GenerateDataKey',
            'kms:ReEncrypt*'
          ],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'kms:ViaService': [`dynamodb.${this.region}.amazonaws.com`]
            }
          }
        }),
        new iam.PolicyStatement({
          sid: 'AllowLambdaAccess',
          effect: iam.Effect.ALLOW,
          principals: [
            uploadHandler.role!,
            downloadHandler.role!,
            emailSender.role!
          ],
          actions: [
            'kms:Decrypt',
            'kms:DescribeKey'
          ],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'kms:ViaService': [`dynamodb.${this.region}.amazonaws.com`]
            }
          }
        })
      ]
    })
  }),
  pointInTimeRecovery: true,
  deletionProtection: config.env === 'prod',
  // Stream encryption
  stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
  kinesisStream: config.monitoring.detailedMetrics ? kinesisStream : undefined
});
```

### 5.2 Fine-Grained Access Control

#### DynamoDB Resource-Based Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyUnencryptedAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/apexshare-uploads-${env}",
        "arn:aws:dynamodb:*:*:table/apexshare-uploads-${env}/index/*"
      ],
      "Condition": {
        "Bool": {
          "dynamodb:EncryptedTable": "false"
        }
      }
    },
    {
      "Sid": "AllowLambdaAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": [
          "arn:aws:iam::${account-id}:role/ApexShareUploadHandlerRole-${env}",
          "arn:aws:iam::${account-id}:role/ApexShareDownloadHandlerRole-${env}",
          "arn:aws:iam::${account-id}:role/ApexShareEmailSenderRole-${env}"
        ]
      },
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/apexshare-uploads-${env}",
        "arn:aws:dynamodb:*:*:table/apexshare-uploads-${env}/index/*"
      ],
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": [
            "PK",
            "SK",
            "GSI1PK",
            "GSI1SK",
            "GSI2PK",
            "GSI2SK",
            "fileId",
            "studentEmail",
            "studentName",
            "trainerName",
            "sessionDate",
            "notes",
            "fileName",
            "originalFileName",
            "fileSize",
            "contentType",
            "s3Key",
            "s3Bucket",
            "uploadDate",
            "emailSentAt",
            "status",
            "downloadCount",
            "lastDownloadAt",
            "ttl"
          ]
        },
        "StringEquals": {
          "aws:PrincipalTag/Environment": "${env}"
        }
      }
    }
  ]
}
```

## 6. CloudWatch Security & Monitoring

### 6.1 Security Event Monitoring

#### CloudWatch Alarms for Security Events
```typescript
// Failed authentication attempts
const failedAuthAlarm = new cloudwatch.Alarm(this, 'FailedAuthAttempts', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/ApiGateway',
    metricName: '4XXError',
    dimensionsMap: {
      ApiName: api.restApiName
    },
    statistic: 'Sum',
    period: cdk.Duration.minutes(5)
  }),
  threshold: 50,
  evaluationPeriods: 2,
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  alarmDescription: 'High number of 4XX errors indicating potential attack'
});

// Lambda errors that might indicate security issues
const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaSecurityErrors', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/Lambda',
    metricName: 'Errors',
    dimensionsMap: {
      FunctionName: uploadHandler.functionName
    },
    statistic: 'Sum',
    period: cdk.Duration.minutes(5)
  }),
  threshold: 10,
  evaluationPeriods: 2,
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  alarmDescription: 'High error rate in Lambda functions'
});

// DynamoDB throttling (potential DoS)
const dynamoThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoThrottling', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/DynamoDB',
    metricName: 'ThrottledRequests',
    dimensionsMap: {
      TableName: uploadsTable.tableName
    },
    statistic: 'Sum',
    period: cdk.Duration.minutes(5)
  }),
  threshold: 0,
  evaluationPeriods: 1,
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  alarmDescription: 'DynamoDB requests being throttled'
});

// Unusual data transfer patterns
const dataTransferAlarm = new cloudwatch.Alarm(this, 'UnusualDataTransfer', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/S3',
    metricName: 'BytesDownloaded',
    dimensionsMap: {
      BucketName: videosBucket.bucketName
    },
    statistic: 'Sum',
    period: cdk.Duration.hours(1)
  }),
  threshold: 50 * 1024 * 1024 * 1024, // 50GB per hour
  evaluationPeriods: 1,
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  alarmDescription: 'Unusual data transfer volume from S3'
});
```

### 6.2 Custom Security Metrics

#### Lambda Function Security Metrics
```typescript
// Custom metrics for security monitoring
export const logSecurityEvent = (eventType: string, severity: string, details: any) => {
  const metricData = {
    MetricData: [
      {
        MetricName: 'SecurityEvent',
        Dimensions: [
          {
            Name: 'EventType',
            Value: eventType
          },
          {
            Name: 'Severity',
            Value: severity
          },
          {
            Name: 'Environment',
            Value: process.env.ENVIRONMENT || 'unknown'
          }
        ],
        Value: 1,
        Unit: 'Count',
        Timestamp: new Date()
      }
    ],
    Namespace: 'ApexShare/Security'
  };

  // Log to CloudWatch Logs with structured format
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    eventType,
    severity,
    details,
    source: 'ApexShare-Security',
    environment: process.env.ENVIRONMENT
  }));

  // Send custom metric
  const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });
  return cloudwatch.send(new PutMetricDataCommand(metricData));
};

// Usage in Lambda functions
export const validateRequest = (event: APIGatewayProxyEvent) => {
  const sourceIP = event.requestContext.identity.sourceIp;
  const userAgent = event.headers['User-Agent'] || '';

  // Check for suspicious patterns
  if (userAgent.toLowerCase().includes('bot') ||
      userAgent.toLowerCase().includes('crawler')) {
    logSecurityEvent('SuspiciousUserAgent', 'MEDIUM', {
      userAgent,
      sourceIP,
      requestId: event.requestContext.requestId
    });
    return false;
  }

  // Check for SQL injection patterns
  const body = JSON.parse(event.body || '{}');
  const suspiciousPatterns = [
    /union.*select/i,
    /select.*from/i,
    /insert.*into/i,
    /delete.*from/i,
    /drop.*table/i,
    /<script.*>/i,
    /javascript:/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(JSON.stringify(body))) {
      logSecurityEvent('InjectionAttempt', 'HIGH', {
        pattern: pattern.source,
        sourceIP,
        body: JSON.stringify(body).substring(0, 500),
        requestId: event.requestContext.requestId
      });
      return false;
    }
  }

  return true;
};
```

### 6.3 CloudTrail Configuration

#### CloudTrail Security Configuration
```typescript
const securityTrail = new cloudtrail.Trail(this, 'ApexShareSecurityTrail', {
  trailName: `apexshare-security-trail-${config.env}`,
  bucket: auditBucket,
  s3KeyPrefix: 'cloudtrail-logs/',
  includeGlobalServiceEvents: true,
  isMultiRegionTrail: true,
  enableFileValidation: true,
  kmsKey: auditKey,
  // Event selectors for security-relevant events
  eventRules: [
    {
      readWriteType: cloudtrail.ReadWriteType.ALL,
      includeManagementEvents: true,
      dataResources: [
        {
          type: 'AWS::S3::Object',
          values: [
            `${videosBucket.bucketArn}/*`,
            `${frontendBucket.bucketArn}/*`
          ]
        },
        {
          type: 'AWS::DynamoDB::Table',
          values: [uploadsTable.tableArn]
        }
      ]
    }
  ],
  // Advanced event selectors for detailed monitoring
  advancedEventSelectors: [
    {
      name: 'SecurityCriticalEvents',
      fieldSelectors: [
        {
          field: 'eventCategory',
          equals: ['Data']
        },
        {
          field: 'eventName',
          startsWith: ['GetObject', 'PutObject', 'DeleteObject']
        }
      ]
    }
  ]
});

// CloudWatch Logs integration for real-time analysis
const logGroup = new logs.LogGroup(this, 'CloudTrailLogGroup', {
  logGroupName: `/aws/cloudtrail/apexshare-${config.env}`,
  retention: logs.RetentionDays.ONE_YEAR,
  encryptionKey: auditKey
});

securityTrail.addCloudWatchLogsGroup(logGroup);
```

## 7. Network Security

### 7.1 CloudFront Security Configuration

#### CloudFront Distribution Security Settings
```typescript
const distribution = new cloudfront.Distribution(this, 'ApexShareDistribution', {
  defaultBehavior: {
    origin: new origins.S3Origin(frontendBucket, {
      originAccessIdentity: oai
    }),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
    cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
    compress: true,
    // Security headers
    responseHeadersPolicy: new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.seconds(31536000),
          includeSubdomains: true,
          override: true
        },
        contentTypeOptions: {
          override: true
        },
        frameOptions: {
          frameOption: cloudfront.FrameOptions.DENY,
          override: true
        },
        xssProtection: {
          protection: true,
          modeBlock: true,
          override: true
        },
        referrerPolicy: {
          referrerPolicy: cloudfront.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true
        }
      },
      customHeadersBehavior: {
        customHeaders: [
          {
            header: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.apexshare.be; frame-ancestors 'none';",
            override: true
          },
          {
            header: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
            override: true
          }
        ]
      }
    })
  },
  additionalBehaviors: {
    '/api/*': {
      origin: new origins.RestApiOrigin(api),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN
    }
  },
  // WAF Association
  webAclId: webAcl.attrArn,
  // SSL/TLS Configuration
  certificate: certificate,
  minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
  // Geo restriction
  geoRestriction: cloudfront.GeoRestriction.allowlist('BE', 'NL', 'FR', 'DE', 'LU'),
  // Logging
  enableLogging: true,
  logBucket: accessLogsBucket,
  logFilePrefix: 'cloudfront-access-logs/',
  logIncludesCookies: false
});
```

### 7.2 Security Groups and NACLs

#### VPC Security Configuration
```typescript
// Network ACL for additional security layer
const privateNetworkAcl = new ec2.NetworkAcl(this, 'PrivateNetworkAcl', {
  vpc: vpc,
  networkAclName: 'apexshare-private-nacl'
});

// Deny all traffic by default, then allow specific patterns
privateNetworkAcl.addEntry('DenyAllInbound', {
  ruleNumber: 32767,
  protocol: ec2.AclProtocol.ALL,
  traffic: ec2.AclTraffic.allTraffic(),
  direction: ec2.TrafficDirection.INGRESS,
  ruleAction: ec2.Action.DENY
});

// Allow HTTPS outbound to AWS services
privateNetworkAcl.addEntry('AllowHTTPSOutbound', {
  ruleNumber: 100,
  protocol: ec2.AclProtocol.TCP,
  traffic: ec2.AclTraffic.tcpPort(443),
  direction: ec2.TrafficDirection.EGRESS,
  ruleAction: ec2.Action.ALLOW,
  cidr: ec2.AclCidr.anyIpv4()
});

// Allow DNS
privateNetworkAcl.addEntry('AllowDNSOutbound', {
  ruleNumber: 110,
  protocol: ec2.AclProtocol.UDP,
  traffic: ec2.AclTraffic.udpPort(53),
  direction: ec2.TrafficDirection.EGRESS,
  ruleAction: ec2.Action.ALLOW,
  cidr: ec2.AclCidr.anyIpv4()
});

// Associate with private subnets
vpc.privateSubnets.forEach((subnet, index) => {
  new ec2.SubnetNetworkAclAssociation(this, `PrivateNaclAssoc${index}`, {
    subnet: subnet,
    networkAcl: privateNetworkAcl
  });
});
```

## 8. Authentication & Authorization Security

### 8.1 Cognito User Pool Security Configuration

#### Cognito User Pool Security Settings
```typescript
const userPool = new cognito.UserPool(this, 'ApexShareUserPool', {
  userPoolName: `apexshare-users-${config.env}`,
  // Sign-in configuration
  signInCaseSensitive: false,
  signInAliases: {
    email: true,
    username: false
  },
  // Password policy
  passwordPolicy: {
    minLength: 12,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: true,
    tempPasswordValidity: cdk.Duration.days(1)
  },
  // Account security
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
  autoVerify: {
    email: true
  },
  // MFA configuration
  mfa: cognito.Mfa.OPTIONAL,
  mfaSecondFactor: {
    sms: false,
    otp: true
  },
  // Advanced security
  advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
  // Device tracking
  deviceTracking: {
    challengeRequiredOnNewDevice: true,
    deviceOnlyRememberedOnUserPrompt: true
  },
  // Lambda triggers for additional security
  lambdaTriggers: {
    preSignUp: preSignUpTrigger,
    preAuthentication: preAuthTrigger,
    postAuthentication: postAuthTrigger,
    preTokenGeneration: preTokenTrigger
  }
});

// User Pool Client with security settings
const userPoolClient = userPool.addClient('ApexShareClient', {
  userPoolClientName: `apexshare-client-${config.env}`,
  authFlows: {
    userSrp: true,
    adminUserPassword: false,
    custom: false,
    userPassword: false
  },
  // Session management
  accessTokenValidity: cdk.Duration.hours(1),
  idTokenValidity: cdk.Duration.hours(1),
  refreshTokenValidity: cdk.Duration.days(30),
  // Security
  preventUserExistenceErrors: true,
  enableTokenRevocation: true,
  // OAuth settings if needed
  oAuth: {
    flows: {
      authorizationCodeGrant: true,
      implicitCodeGrant: false
    },
    scopes: [
      cognito.OAuthScope.EMAIL,
      cognito.OAuthScope.OPENID,
      cognito.OAuthScope.PROFILE
    ],
    callbackUrls: [`https://${config.domain}/callback`],
    logoutUrls: [`https://${config.domain}/logout`]
  }
});
```

### 8.2 Cognito Lambda Triggers for Security

#### Pre-Authentication Trigger
```typescript
const preAuthTrigger = new nodejs.NodejsFunction(this, 'PreAuthTrigger', {
  entry: 'lambda/cognito-triggers/pre-auth.ts',
  handler: 'handler',
  runtime: lambda.Runtime.NODEJS_20_X,
  timeout: cdk.Duration.seconds(30),
  environment: {
    ALLOWED_DOMAINS: 'apexshare.be,training.apexshare.be'
  }
});

// Pre-Authentication Lambda Code
export const handler = async (event: PreAuthenticationTriggerEvent) => {
  try {
    const { request, userPoolId, triggerSource } = event;

    // Rate limiting check
    const loginAttempts = await getRecentLoginAttempts(request.userAttributes.email);
    if (loginAttempts > 5) {
      throw new Error('Too many login attempts. Please try again later.');
    }

    // Check for suspicious activity
    const clientMetadata = request.clientMetadata || {};
    const userAgent = clientMetadata.userAgent || '';
    const sourceIp = clientMetadata.sourceIp || '';

    // Log security event
    await logSecurityEvent('PreAuthentication', 'INFO', {
      email: request.userAttributes.email,
      sourceIp,
      userAgent,
      triggerSource
    });

    // Verify domain whitelist for admin users
    if (request.userAttributes['custom:role'] === 'admin') {
      const emailDomain = request.userAttributes.email.split('@')[1];
      const allowedDomains = process.env.ALLOWED_DOMAINS?.split(',') || [];

      if (!allowedDomains.includes(emailDomain)) {
        throw new Error('Admin access not allowed from this domain.');
      }
    }

    return event;
  } catch (error) {
    console.error('Pre-authentication error:', error);
    throw error;
  }
};
```

### 8.3 API Gateway Authorizers

#### Custom JWT Authorizer
```typescript
const jwtAuthorizer = new apigateway.RequestAuthorizer(this, 'JWTAuthorizer', {
  handler: authorizerFunction,
  identitySources: [apigateway.IdentitySource.header('Authorization')],
  authorizerName: 'ApexShareJWTAuthorizer',
  resultsCacheTtl: cdk.Duration.minutes(5)
});

// Authorizer Lambda Function
export const authorizerHandler = async (event: APIGatewayRequestAuthorizerEvent) => {
  try {
    const token = event.headers?.Authorization?.replace('Bearer ', '') || '';

    if (!token) {
      throw new Error('No token provided');
    }

    // Verify JWT token with Cognito
    const cognitoJwtVerifier = CognitoJwtVerifier.create({
      userPoolId: process.env.USER_POOL_ID!,
      clientId: process.env.USER_POOL_CLIENT_ID!,
      tokenUse: 'access'
    });

    const payload = await cognitoJwtVerifier.verify(token);

    // Additional security checks
    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < currentTime) {
      throw new Error('Token has expired');
    }

    // Check token issuer
    const expectedIssuer = `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}`;
    if (payload.iss !== expectedIssuer) {
      throw new Error('Invalid token issuer');
    }

    // Generate policy
    const policy = generatePolicy(payload.sub, 'Allow', event.methodArn, {
      userId: payload.sub,
      email: payload.email,
      role: payload['custom:role'] || 'user'
    });

    return policy;
  } catch (error) {
    console.error('Authorization error:', error);
    throw new Error('Unauthorized');
  }
};

const generatePolicy = (
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context: Record<string, any> = {}
) => {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    },
    context
  };
};
```

## 9. Security Compliance & Audit

### 9.1 GDPR Compliance Configuration

#### Data Protection Settings
```typescript
// Data retention configuration
const dataRetentionPolicy = {
  personalData: {
    retention: cdk.Duration.days(90), // Student emails, names
    deletionMethod: 'SECURE_DELETE',
    encryptionRequired: true
  },
  operationalData: {
    retention: cdk.Duration.days(365), // Logs, metrics
    deletionMethod: 'STANDARD_DELETE',
    encryptionRequired: true
  },
  auditData: {
    retention: cdk.Duration.days(2555), // 7 years for audit logs
    deletionMethod: 'SECURE_DELETE',
    encryptionRequired: true
  }
};

// GDPR compliance Lambda for data subject requests
const gdprHandler = new nodejs.NodejsFunction(this, 'GDPRHandler', {
  entry: 'lambda/gdpr-handler/index.ts',
  environment: {
    DYNAMODB_TABLE: uploadsTable.tableName,
    S3_BUCKET: videosBucket.bucketName,
    AUDIT_BUCKET: auditBucket.bucketName
  }
});

// GDPR API endpoints
const gdprApi = api.root.addResource('gdpr');
gdprApi.addResource('export').addMethod('POST',
  new apigateway.LambdaIntegration(gdprHandler)
);
gdprApi.addResource('delete').addMethod('DELETE',
  new apigateway.LambdaIntegration(gdprHandler)
);
```

### 9.2 Security Compliance Checklist

#### Automated Compliance Validation
```typescript
// AWS Config Rules for security compliance
const s3EncryptionRule = new config.ManagedRule(this, 'S3BucketSSLRequestsOnly', {
  identifier: config.ManagedRuleIdentifiers.S3_BUCKET_SSL_REQUESTS_ONLY,
  inputParameters: {
    bucketNames: [
      videosBucket.bucketName,
      frontendBucket.bucketName
    ].join(',')
  }
});

const lambdaVPCRule = new config.ManagedRule(this, 'LambdaInsideVPC', {
  identifier: config.ManagedRuleIdentifiers.LAMBDA_INSIDE_VPC,
  inputParameters: {
    subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId).join(',')
  }
});

const dynamoEncryptionRule = new config.ManagedRule(this, 'DynamoDBEncrypted', {
  identifier: config.ManagedRuleIdentifiers.DYNAMODB_TABLE_ENCRYPTED_KMS
});

// Custom Config Rule for API Gateway security
const apiGatewaySecurityRule = new config.CustomRule(this, 'APIGatewaySecurityRule', {
  lambda: apiGatewayComplianceFunction,
  configurationChanges: true,
  periodic: true,
  maximumExecutionFrequency: config.MaximumExecutionFrequency.TWENTY_FOUR_HOURS
});
```

### 9.3 Incident Response Procedures

#### Security Incident Response Lambda
```typescript
const incidentResponseHandler = new nodejs.NodejsFunction(this, 'IncidentResponseHandler', {
  entry: 'lambda/incident-response/index.ts',
  timeout: cdk.Duration.minutes(15),
  environment: {
    SNS_TOPIC_ARN: securityAlertsTopic.topicArn,
    SLACK_WEBHOOK_URL: config.slackWebhookUrl
  }
});

// CloudWatch Events for automated incident response
new events.Rule(this, 'SecurityIncidentRule', {
  eventPattern: {
    source: ['aws.guardduty', 'aws.securityhub'],
    detailType: ['GuardDuty Finding', 'Security Hub Findings - Imported']
  },
  targets: [new targets.LambdaFunction(incidentResponseHandler)]
});

// Incident Response Handler
export const incidentHandler = async (event: CloudWatchEvent) => {
  try {
    const { source, detail } = event;
    let severity = 'MEDIUM';
    let actions: string[] = [];

    if (source === 'aws.guardduty') {
      const finding = detail;
      severity = finding.severity >= 7.0 ? 'HIGH' :
                finding.severity >= 4.0 ? 'MEDIUM' : 'LOW';

      // Automated response based on finding type
      switch (finding.type) {
        case 'UnauthorizedAPICall':
          actions.push('BLOCK_IP', 'INVALIDATE_TOKENS');
          break;
        case 'MaliciousIPCaller':
          actions.push('BLOCK_IP', 'UPDATE_WAF_RULES');
          break;
        case 'DataExfiltration':
          actions.push('ALERT_ADMIN', 'REVIEW_ACCESS_LOGS');
          break;
      }
    }

    // Execute automated responses
    for (const action of actions) {
      await executeIncidentResponse(action, detail);
    }

    // Send notifications
    await sendSecurityAlert(severity, detail);

    return { statusCode: 200, body: 'Incident processed' };
  } catch (error) {
    console.error('Incident response error:', error);
    throw error;
  }
};
```

## 10. Security Validation and Testing

### 10.1 Security Testing Framework

#### Automated Security Tests
```typescript
// Security test suite
describe('ApexShare Security Tests', () => {
  test('S3 bucket blocks public access', async () => {
    const s3 = new S3Client({ region: 'us-east-1' });

    try {
      await s3.send(new GetObjectCommand({
        Bucket: 'apexshare-videos-prod',
        Key: 'test-object'
      }));
      fail('Should not be able to access S3 objects without authentication');
    } catch (error) {
      expect(error.name).toBe('AccessDenied');
    }
  });

  test('API Gateway requires authentication for protected endpoints', async () => {
    const response = await fetch('https://api.apexshare.be/api/v1/uploads/recent');
    expect(response.status).toBe(401);
  });

  test('Lambda functions have proper IAM permissions', async () => {
    const iam = new IAMClient({ region: 'us-east-1' });
    const rolePolicy = await iam.send(new GetRolePolicyCommand({
      RoleName: 'ApexShareUploadHandlerRole-prod',
      PolicyName: 'LambdaExecutionPolicy'
    }));

    const policy = JSON.parse(decodeURIComponent(rolePolicy.PolicyDocument));

    // Verify principle of least privilege
    const s3Actions = policy.Statement
      .filter(stmt => stmt.Action.some(action => action.startsWith('s3:')))
      .flatMap(stmt => stmt.Action);

    expect(s3Actions).not.toContain('s3:*');
    expect(s3Actions).not.toContain('s3:DeleteBucket');
  });

  test('DynamoDB data is encrypted', async () => {
    const dynamodb = new DynamoDBClient({ region: 'us-east-1' });
    const tableInfo = await dynamodb.send(new DescribeTableCommand({
      TableName: 'apexshare-uploads-prod'
    }));

    expect(tableInfo.Table?.SSEDescription?.Status).toBe('ENABLED');
    expect(tableInfo.Table?.SSEDescription?.SSEType).toBe('KMS');
  });
});
```

### 10.2 Penetration Testing Guidelines

#### Security Assessment Checklist
```markdown
## ApexShare Security Assessment Checklist

### Authentication & Authorization
- [ ] JWT token validation works correctly
- [ ] Token expiration is enforced
- [ ] Refresh token rotation implemented
- [ ] MFA is functional and secure
- [ ] Password policy meets requirements
- [ ] Account lockout mechanisms work

### API Security
- [ ] Input validation prevents injection attacks
- [ ] Rate limiting prevents abuse
- [ ] CORS configuration is restrictive
- [ ] Error messages don't leak sensitive info
- [ ] Request size limits are enforced
- [ ] File upload restrictions work correctly

### Data Protection
- [ ] All data encrypted at rest
- [ ] TLS 1.2+ enforced for all connections
- [ ] S3 bucket policies prevent public access
- [ ] Presigned URLs have appropriate expiration
- [ ] Data retention policies are enforced
- [ ] Backup encryption is enabled

### Infrastructure Security
- [ ] Lambda functions run in VPC (production)
- [ ] Security groups are restrictive
- [ ] IAM roles follow least privilege
- [ ] CloudTrail logging is comprehensive
- [ ] VPC endpoints are properly secured
- [ ] Network ACLs provide additional protection

### Monitoring & Incident Response
- [ ] Security events are logged and monitored
- [ ] Alerting works for critical events
- [ ] Incident response procedures are documented
- [ ] Automated responses are tested
- [ ] Log retention meets compliance requirements
- [ ] Audit trails are tamper-evident
```

## Implementation Summary

This comprehensive security framework provides:

1. **Multi-layered IAM Security**: Least privilege roles, permission boundaries, and fine-grained access controls
2. **Data Protection**: Encryption at rest and in transit, secure key management, and data retention policies
3. **Network Security**: VPC isolation, security groups, WAF protection, and secure communication channels
4. **API Security**: Request validation, rate limiting, authentication, and authorization controls
5. **Monitoring & Compliance**: Comprehensive logging, real-time alerting, and compliance automation
6. **Incident Response**: Automated threat detection and response capabilities

### Key Security Controls Implemented:
- Zero trust architecture with verification at every layer
- Defense in depth with multiple security controls
- Principle of least privilege for all access permissions
- Comprehensive encryption for all data states
- Real-time monitoring and automated incident response
- GDPR compliance and data protection controls

### Next Steps:
1. Deploy security configurations using CDK
2. Configure monitoring and alerting
3. Test all security controls
4. Conduct security assessment
5. Document incident response procedures
6. Train operations team on security procedures

This security framework ensures that ApexShare meets enterprise-grade security standards while maintaining usability and performance.