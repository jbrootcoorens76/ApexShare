# ApexShare - Directory Structure

This document outlines the organized directory structure for the ApexShare project.

## Root Directory Structure

```
ApexShare/
├── .claude/                     # Claude Code agent configurations
│   └── agents/                  # Individual agent specification files
├── docs/                        # Project documentation
│   ├── ARCHITECTURE_FOUNDATION.md
│   ├── TECHNICAL_SPECIFICATIONS.md
│   ├── SECURITY_FRAMEWORK.md
│   ├── PROJECT_STATUS.md
│   ├── DEVELOPMENT_NOTES.md
│   └── training_movie_prd.md
├── lib/                         # CDK infrastructure code
│   ├── stacks/                  # CDK stack definitions
│   │   ├── storage-stack.ts     # S3, DynamoDB
│   │   ├── api-stack.ts         # API Gateway, Lambda
│   │   ├── frontend-stack.ts    # S3 Static Site, CloudFront
│   │   ├── email-stack.ts       # SES configuration
│   │   └── monitoring-stack.ts  # CloudWatch, alarms
│   └── constructs/              # Reusable CDK constructs
│       ├── lambda-construct.ts
│       ├── s3-construct.ts
│       └── api-construct.ts
├── lambda/                      # Lambda function source code
│   ├── upload-handler/          # Generate presigned S3 upload URLs
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── email-sender/            # Send notification emails via SES
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── download-handler/        # Generate presigned download URLs
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── [cost-optimization-functions]/  # Various cost optimization Lambda functions
├── frontend/                    # Static website
│   ├── src/                     # Source files
│   │   ├── components/
│   │   ├── services/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── style.css
│   └── dist/                    # Built files for S3 deployment
├── tests/                       # Test files
│   ├── unit/                    # Unit tests
│   │   ├── lambda/
│   │   └── lib/
│   └── integration/             # Integration tests
│       ├── api/
│       └── e2e/
├── scripts/                     # Deployment and utility scripts
│   ├── deploy.sh
│   ├── setup-env.sh
│   └── cleanup.sh
├── .gitignore                   # Git ignore patterns
├── package.json                 # Node.js dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── CLAUDE.md                   # Claude Code agent coordination
└── README.md                   # Project overview
```

## Directory Purposes

### `/docs/`
Contains all project documentation including architecture, specifications, and requirements.

### `/lib/`
CDK infrastructure as code organized into:
- **stacks/**: Complete CDK stack definitions for deployment
- **constructs/**: Reusable CDK constructs for common patterns

### `/lambda/`
Individual Lambda function directories, each containing:
- **src/**: TypeScript source code
- **package.json**: Function-specific dependencies
- **tsconfig.json**: Function-specific TypeScript config

### `/frontend/`
Static website code for the trainer interface:
- **src/**: Development source files
- **dist/**: Production-ready files for S3 deployment

### `/tests/`
Comprehensive testing suite:
- **unit/**: Individual component tests
- **integration/**: Cross-service integration tests

### `/scripts/`
Automation scripts for deployment, environment setup, and maintenance.

## Development Workflow

1. **Infrastructure**: Work in `/lib/` to define AWS resources
2. **Backend**: Implement Lambda functions in `/lambda/`
3. **Frontend**: Build website in `/frontend/src/`
4. **Testing**: Add tests in `/tests/`
5. **Documentation**: Update files in `/docs/`

## File Naming Conventions

- **Stacks**: `{service}-stack.ts` (e.g., `api-stack.ts`)
- **Constructs**: `{component}-construct.ts` (e.g., `lambda-construct.ts`)
- **Lambda**: `index.ts` in each function's `src/` directory
- **Tests**: `{component}.test.ts` or `{component}.spec.ts`

This structure supports the agent-based development workflow while maintaining clear separation of concerns and making the codebase easily navigable for all contributors.