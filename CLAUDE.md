# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ApexShare is a serverless AWS solution for motorcycle trainers to upload GoPro footage and automatically email students with secure download links. The system is built entirely on AWS managed services with zero server maintenance.

## Architecture

### Core AWS Services
- **Frontend**: S3 Static Website + CloudFront CDN
- **API**: API Gateway + Lambda functions
- **Storage**: S3 bucket for video files
- **Database**: DynamoDB for tracking uploads and metadata
- **Email**: SES (Simple Email Service)
- **Authentication**: AWS Cognito (optional)

### Planned Directory Structure
```
├── lib/                     # Infrastructure stacks (CDK/CloudFormation)
│   ├── storage-stack.ts     # S3, DynamoDB
│   ├── api-stack.ts         # API Gateway, Lambda
│   ├── frontend-stack.ts    # S3 Static Site, CloudFront
│   └── email-stack.ts       # SES configuration
├── lambda/                  # Lambda function code
│   ├── upload-handler/      # Generate presigned S3 upload URLs
│   ├── email-sender/        # Send notification emails via SES
│   └── download-handler/    # Generate presigned download URLs
└── frontend/                # Static website
    ├── src/                 # Source files
    └── dist/                # Built files for S3 deployment
```

## Key Implementation Details

### Lambda Functions
- **Runtime**: Node.js 20.x or Python 3.12
- **Upload Handler**: 256MB memory, 30s timeout
- **Email Sender**: 512MB memory, 2min timeout
- **Download Handler**: 256MB memory, 30s timeout

### S3 Configuration
- Direct upload from frontend using presigned URLs
- Lifecycle policy: delete after 30 days
- Event triggers for post-upload processing
- Server-side encryption enabled

### DynamoDB Schema
- Partition Key: fileId (String)
- Sort Key: uploadDate (String)
- TTL enabled for automatic cleanup

### API Endpoints
- `POST /api/initiate-upload` - Generate upload URL
- `GET /api/download/{fileId}` - Generate download URL
- `GET /api/recent-uploads` - List recent uploads

## Development Commands

When implementing this project, common commands will likely include:

### Infrastructure Deployment
```bash
# If using AWS CDK
npm run cdk deploy

# If using Serverless Framework
serverless deploy

# If using AWS SAM
sam build && sam deploy
```

### Frontend Development
```bash
# Build frontend for S3 deployment
npm run build

# Deploy to S3
aws s3 sync dist/ s3://bucket-name --delete
```

### Lambda Development
```bash
# Test Lambda functions locally
sam local start-api

# Run unit tests
npm test
```

## Security Requirements

- All S3 buckets must be private with presigned URLs only
- Lambda functions require minimal IAM permissions
- API Gateway should include rate limiting
- Input validation required on all endpoints
- Environment variables for sensitive configuration

## Cost Optimization

- Implement S3 lifecycle policies (transition to IA after 7 days)
- Set DynamoDB TTL for automatic record cleanup
- Use CloudWatch billing alerts
- Monitor and optimize Lambda memory allocation

## Testing Strategy

- Unit tests for all Lambda functions
- Integration tests for API endpoints
- End-to-end testing of upload/email/download flow
- Load testing for concurrent uploads
- Security testing for file upload validation

## Monitoring

Set up CloudWatch dashboards for:
- Lambda function duration and errors
- API Gateway request metrics
- S3 upload/download rates
- SES email delivery status
- Cost tracking and billing alerts

## Agent Development Workflow

This project uses specialized Claude Code agents with the following dependencies:

### Sequential Dependencies
1. **aws-solutions-architect** → Creates foundation architecture and system design
2. **aws-security-specialist** → Defines security requirements for all components
3. **aws-cost-optimizer** → Provides cost constraints and optimization strategies
4. **aws-infrastructure-engineer** → Deploys AWS infrastructure (CDK/CloudFormation)
5. **serverless-backend-api-developer** → Implements Lambda functions and API Gateway
6. **email-service-specialist** → Integrates SES with backend for notifications
7. **frontend-developer** → Builds static website with S3 upload capabilities
8. **serverless-testing-specialist** → Validates all components and end-to-end flow

### Parallel Work Opportunities
- **Security + Cost Control** can work in parallel after Solutions Architect
- **Email Service + Frontend** can work in parallel after Backend API is complete
- **Testing** can begin unit testing as soon as Backend API functions are available

### Agent Integration Points
- Infrastructure must be deployed before Backend and Frontend integration
- Backend API endpoints required before Email Service and Frontend development
- All agents should follow the security requirements defined by the Security Specialist
- Cost optimization constraints from Cost Optimizer should guide all implementation decisions