# Product Requirements Document: ApexShare - Serverless Motorcycle Training Video Sharing System

**Version:** 1.0  
**Date:** September 19, 2025  
**Document Owner:** [Your Name]  
**Status:** Draft

## Executive Summary

A fully serverless AWS solution called **ApexShare** that allows motorcycle trainers to upload GoPro footage via a simple web interface and automatically emails students with secure download links. Built entirely on AWS managed services for maximum cost efficiency and zero server maintenance.

## Problem Statement

**Current Challenge:**  
Trainers need a simple, maintenance-free system to upload GoPro footage and automatically notify students with download links, with minimal ongoing costs and zero server management.

**Serverless Benefits:**
- Pay only for actual usage (no idle server costs)
- Automatic scaling from 1 to 1000+ concurrent users
- Zero server maintenance or updates required
- Built-in reliability and backup through AWS managed services

## Serverless Architecture Overview

### AWS Services Used
- **Frontend:** S3 Static Website + CloudFront CDN
- **API:** API Gateway + Lambda functions
- **Storage:** S3 bucket for video files
- **Database:** DynamoDB for tracking uploads and metadata
- **Email:** SES (Simple Email Service)
- **Authentication:** AWS Cognito (optional, for trainer login)
- **File Processing:** Lambda with increased timeout and memory

### System Flow
1. **Upload Trigger:** Trainer submits form → API Gateway → Lambda function
2. **File Processing:** Lambda generates presigned S3 upload URL and returns to frontend
3. **Direct Upload:** Frontend uploads large video files directly to S3 (bypassing Lambda size limits)
4. **Post-Upload:** S3 event triggers Lambda function to send email notification
5. **Download:** Student clicks link → API Gateway → Lambda → generates presigned download URL

## Functional Requirements

### Trainer Interface (Static Website)
- **Simple Upload Form:**
  - Student email address (required, validated)
  - Student name (optional)
  - Session date (editable date picker, defaults to today)
  - Training notes (optional)
  - File upload with drag-and-drop

- **Upload Process:**
  - Client-side file validation (format, size)
  - Progress bar for upload to S3
  - Real-time upload status
  - Success confirmation with email delivery status

- **Dashboard Features:**
  - Recent uploads list
  - Storage usage overview
  - Email delivery status
  - Simple analytics (uploads per day/week)

### Automated Email System
- **Trigger:** S3 object creation event → Lambda → SES email
- **Email Template:** Professional HTML template with:
  - Student name personalization
  - Session details and trainer notes
  - Secure download link (presigned URL)
  - Expiration date (7-30 days configurable)
  - Contact information

### Student Download Experience
- **Download Page:**
  - Clean interface hosted on CloudFront
  - Video metadata display
  - One-click download button
  - Optional video preview/streaming
  - Mobile-optimized design

## Serverless Technical Architecture

### Lambda Functions

#### 1. Upload Initiation Function
```
Trigger: API Gateway POST /initiate-upload
Purpose: Generate presigned S3 upload URL
Runtime: Node.js 20.x or Python 3.12
Memory: 256MB
Timeout: 30 seconds
```

#### 2. Post-Upload Processing Function
```
Trigger: S3 Object Created Event
Purpose: Send email notification to student
Runtime: Node.js 20.x or Python 3.12
Memory: 512MB
Timeout: 2 minutes
Environment Variables:
  - SES_FROM_EMAIL
  - DOWNLOAD_BASE_URL
```

#### 3. Download Link Generation Function
```
Trigger: API Gateway GET /download/{fileId}
Purpose: Generate presigned download URL
Runtime: Node.js 20.x or Python 3.12
Memory: 256MB
Timeout: 30 seconds
```

### S3 Bucket Configuration
```
Bucket Structure:
videos/
  └── YYYY-MM-DD/
      └── {unique-id}-{original-filename}

Lifecycle Policy:
- Delete objects after 30 days (configurable)
- Transition to IA after 7 days (optional cost optimization)

Event Configuration:
- Object Created → Trigger Post-Upload Lambda
```

### DynamoDB Table Schema
```
Table: training-video-uploads
Partition Key: fileId (String)
Sort Key: uploadDate (String)

Attributes:
- studentEmail (String)
- studentName (String, optional)
- trainerName (String, optional)
- sessionDate (String)
- notes (String, optional)
- fileSize (Number)
- originalFileName (String)
- downloadCount (Number)
- emailSentAt (String)
- expiresAt (Number) - TTL for auto-cleanup
```

### API Gateway Endpoints
```
POST /api/initiate-upload
- Body: { studentEmail, studentName, sessionDate, notes, fileName, fileSize }
- Response: { uploadUrl, fileId, fields }

GET /api/download/{fileId}
- Response: { downloadUrl, videoInfo }

GET /api/recent-uploads
- Response: { uploads: [...] }
```

## Frontend Implementation (Static Website)

### Technology Stack
- **Framework:** Vanilla JavaScript or React (static build)
- **Hosting:** S3 Static Website + CloudFront
- **Upload:** Direct to S3 using presigned URLs
- **Styling:** Tailwind CSS or similar lightweight CSS

### Key Features
- **Direct S3 Upload:** Bypass Lambda size limits for large video files
- **Progress Tracking:** Real-time upload progress with AWS SDK
- **Date Picker:** Easy session date selection (defaults to today, but editable)
- **Error Handling:** Network interruption recovery and retry logic
- **Mobile Responsive:** Touch-friendly interface for tablets/phones

## Serverless Benefits & Cost Optimization

### Cost Structure (Pay-per-Use)
- **Lambda Invocations:** ~$0.0000002 per request
- **API Gateway:** ~$0.0000035 per request  
- **S3 Storage:** ~$0.023 per GB/month
- **S3 Requests:** ~$0.0004 per 1000 requests
- **SES Email:** ~$0.10 per 1000 emails
- **DynamoDB:** ~$0.25 per million reads/writes
- **CloudFront:** ~$0.085 per GB transfer

### Estimated Monthly Costs (50 uploads/month, 2GB avg file size)
```
S3 Storage (100GB): $2.30
Lambda Invocations: $0.01
API Gateway: $0.02
SES Emails: $0.01
DynamoDB: $0.01
CloudFront: $1.00
Total: ~$3.35/month
```

### Scaling Economics
- **100 uploads/month:** ~$6/month
- **500 uploads/month:** ~$25/month
- **1000 uploads/month:** ~$50/month

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
- Set up S3 buckets with proper permissions and lifecycle policies
- Create Lambda functions for upload initiation and email sending
- Configure API Gateway endpoints
- Set up DynamoDB table with TTL
- Configure SES for email sending

### Phase 2: Frontend Development (Week 2)
- Build static website with upload interface
- Implement direct S3 upload with progress tracking
- Create download page for students
- Add basic dashboard for trainers
- Test end-to-end workflow

### Phase 3: Polish & Testing (Week 3)
- Add error handling and retry logic
- Implement email template customization
- Add basic analytics and reporting
- Security testing and optimization
- Mobile responsiveness testing

### Phase 4: Deployment & Launch (Week 4)
- Deploy via AWS CloudFormation or CDK
- Set up custom domain with Route 53
- Configure SSL certificates via Certificate Manager
- Train staff and launch with pilot group
- Monitor and optimize based on usage

## Infrastructure as Code

### Deployment Options
- **AWS CDK:** Recommended for complex logic and type safety
- **CloudFormation:** YAML/JSON templates for infrastructure
- **Serverless Framework:** Simplified serverless deployment
- **AWS SAM:** Serverless Application Model for AWS-native apps

### Sample CDK Structure
```
├── lib/
│   ├── storage-stack.ts      # S3, DynamoDB
│   ├── api-stack.ts          # API Gateway, Lambda
│   ├── frontend-stack.ts     # S3 Static Site, CloudFront
│   └── email-stack.ts        # SES configuration
├── lambda/
│   ├── upload-handler/
│   ├── email-sender/
│   └── download-handler/
└── frontend/
    ├── src/
    └── dist/
```

## Security Considerations

### S3 Security
- Private bucket with presigned URLs only
- CORS configuration for direct uploads
- Bucket policies restricting access
- Server-side encryption enabled

### Lambda Security
- IAM roles with minimal required permissions
- Environment variables for sensitive data
- VPC configuration if needed
- Input validation and sanitization

### API Security
- Rate limiting via API Gateway
- Request validation
- CORS headers properly configured
- Optional API key authentication for admin functions

## Monitoring & Observability

### CloudWatch Metrics
- Lambda function duration and errors
- API Gateway request count and latency
- S3 upload success/failure rates
- SES email delivery metrics

### Alerts
- Lambda function errors
- High S3 storage costs
- Email delivery failures
- Unusual traffic patterns

### Logging
- Structured logging in Lambda functions
- API access logs
- S3 access logs for security auditing

## Success Metrics

### Performance Targets
- **Upload Initiation:** < 2 seconds response time
- **Email Delivery:** < 5 minutes after upload completion
- **Download Generation:** < 1 second response time
- **System Uptime:** 99.9% availability (AWS managed services SLA)

### Cost Efficiency
- **Target:** < $0.50 per video upload processed
- **Scaling:** Linear cost growth with usage
- **No Fixed Costs:** Pay only for actual usage

## Risk Mitigation

### Technical Risks
- **Large File Uploads:** Use multipart upload with retry logic
- **Lambda Timeouts:** Optimize code and increase memory allocation
- **Email Delivery:** Implement bounce/complaint handling with SES

### Operational Risks
- **AWS Service Limits:** Monitor and request increases proactively
- **Cost Overruns:** Set up billing alerts and budgets
- **Security:** Regular security reviews and AWS Security Hub monitoring

## Next Steps

1. **AWS Account Setup & IAM Configuration** (Week 1)
2. **Infrastructure Deployment via CDK/CloudFormation** (Week 1-2)  
3. **Frontend Development & Integration** (Week 2-3)
4. **End-to-End Testing** (Week 3)
5. **Production Deployment & Staff Training** (Week 4)

---

**Serverless Advantage:** Zero server maintenance, automatic scaling, and costs that scale directly with usage - perfect for a motorcycle training business that may have seasonal variations in activity.