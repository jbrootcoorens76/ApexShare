# ApexShare
Serverless motorcycle training video sharing system built on AWS

## Project Status
**Current Phase:** Foundation Complete - Ready for Infrastructure Implementation
**Progress:** 30% Complete
**Last Updated:** September 19, 2025
**Status:** ✅ On Track

## Overview

ApexShare is a serverless AWS solution that enables motorcycle trainers to upload GoPro footage and automatically email students with secure download links. The system is built entirely on AWS managed services with zero server maintenance requirements.

### Key Features
- **Zero Server Maintenance:** Fully serverless AWS architecture
- **Secure File Sharing:** Presigned URLs with automatic expiration
- **Automatic Notifications:** Email students when videos are ready
- **Cost Optimized:** Pay-per-use model with intelligent resource allocation
- **Scalable:** Supports 1-1000+ concurrent users seamlessly
- **Mobile Friendly:** Responsive design for all devices

## Architecture

### AWS Services Used
- **Frontend:** S3 Static Website + CloudFront CDN
- **API:** API Gateway + Lambda functions
- **Storage:** S3 bucket with lifecycle policies
- **Database:** DynamoDB with TTL
- **Email:** SES (Simple Email Service)
- **Security:** WAF, Cognito, encrypted storage
- **Monitoring:** CloudWatch with billing alerts

### Security Features
- Zero-trust architecture
- Encryption at rest and in transit
- Principle of least privilege IAM
- Comprehensive audit logging
- Input validation and rate limiting

## Development Progress

### ✅ Completed Phases
- **Step 1:** Architecture Foundation (aws-solutions-architect)
- **Step 2a:** Security Framework (aws-security-specialist)
- **Step 2b:** Cost Optimization (integrated into architecture)

### 🔄 Current Phase
- **Step 3:** Infrastructure Implementation (aws-infrastructure-engineer) - Ready to Start

### ⏳ Upcoming Phases
- **Step 4:** Backend API Development (serverless-backend-api-developer)
- **Step 5:** Email Service Integration (email-service-specialist)
- **Step 6:** Frontend Development (frontend-developer)
- **Step 7:** Testing & Validation (serverless-testing-specialist)

## Documentation

### Foundation Documents (Complete)
- **[docs/ARCHITECTURE_FOUNDATION.md](./docs/ARCHITECTURE_FOUNDATION.md)** - Complete AWS serverless architecture
- **[docs/TECHNICAL_SPECIFICATIONS.md](./docs/TECHNICAL_SPECIFICATIONS.md)** - Implementation patterns and code templates
- **[docs/SECURITY_FRAMEWORK.md](./docs/SECURITY_FRAMEWORK.md)** - Comprehensive security implementation
- **[docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md)** - Detailed project tracking and status
- **[CLAUDE.md](./CLAUDE.md)** - Claude Code agent coordination guide

### Project Management
- **[docs/training_movie_prd.md](./docs/training_movie_prd.md)** - Original product requirements

## Quick Start for Contributors

### Prerequisites
- AWS Account with appropriate permissions
- Node.js 18+ for Lambda development
- AWS CDK or SAM CLI for infrastructure deployment
- TypeScript knowledge for Lambda functions

### Development Workflow
1. **Review Architecture:** Start with ARCHITECTURE_FOUNDATION.md
2. **Understand Security:** Review SECURITY_FRAMEWORK.md requirements
3. **Check Current Status:** See PROJECT_STATUS.md for latest progress
4. **Follow Agent Guide:** Use CLAUDE.md for agent coordination

### Next Steps for Development
The project is ready for infrastructure implementation. The next developer should:

1. **Infrastructure Engineer:** Deploy AWS infrastructure using CDK/CloudFormation
2. **Backend Developer:** Implement Lambda functions and API Gateway
3. **Email Specialist:** Configure SES and notification workflows
4. **Frontend Developer:** Build static website with upload capabilities
5. **Testing Specialist:** Validate all components and end-to-end flow

## Cost Estimates

### Development Phase
- **Monthly Cost:** ~$50-100
- **Duration:** 2-4 weeks

### Production Phase
- **Low Usage:** ~$20-50/month
- **High Usage:** ~$100-500/month
- **Cost Optimization:** 60% storage savings via lifecycle policies

## Contributing

This project uses specialized Claude Code agents for development. Each agent has specific expertise and dependencies:

- Agents work sequentially with clear handoff points
- All security requirements must be followed
- Cost optimization is built into all decisions
- Comprehensive testing is required before deployment

## Support

For questions about:
- **Architecture:** See ARCHITECTURE_FOUNDATION.md
- **Security:** See SECURITY_FRAMEWORK.md
- **Implementation:** See TECHNICAL_SPECIFICATIONS.md
- **Project Status:** See PROJECT_STATUS.md
- **Agent Coordination:** See CLAUDE.md

## License

[License details to be added]

---

**Project maintained by specialized Claude Code agents**
**Foundation Phase Complete - Ready for Infrastructure Implementation**
