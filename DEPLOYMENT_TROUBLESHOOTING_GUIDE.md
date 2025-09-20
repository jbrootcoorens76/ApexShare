# ApexShare Deployment Troubleshooting Guide

## Quick Reference Commands

```bash
# Environment setup
export CDK_ENVIRONMENT=prod
cd "/Users/jimmybrootcoorens/Library/Mobile Documents/com~apple~CloudDocs/JBIT /apps/ApexShare"

# Build and validate
npm run build
npx tsc --noEmit

# Deploy specific stacks
npx cdk deploy ApexShare-Security-prod --app "node dist/bin/apexshare.js" --require-approval never
npx cdk deploy ApexShare-Storage-prod --app "node dist/bin/apexshare.js" --require-approval never

# Troubleshooting commands
npx cdk diff ApexShare-Storage-prod --app "node dist/bin/apexshare.js"
npx cdk synth ApexShare-Storage-prod --app "node dist/bin/apexshare.js"
aws cloudformation describe-stacks --stack-name ApexShare-Storage-prod
```

## Common Issues and Solutions

### 1. CloudFront SSL Certificate Regional Requirements

**Symptoms:**
- `The specified SSL certificate doesn't exist, isn't in us-east-1 region, isn't valid, or doesn't include a valid certificate chain`
- CloudFront distribution creation fails
- Frontend stack deployment blocked

**Root Cause:**
CloudFront requires SSL certificates to be created in us-east-1 region regardless of deployment region.

**Solution:**
1. Ensure DNS stack creates certificates in us-east-1:
   ```typescript
   // In DNS Stack - Create certificate for CloudFront
   this.usEast1Certificate = new DnsValidatedCertificate(this, 'UsEast1Certificate', {
     domainName: domain,
     subjectAlternativeNames: [`*.${domain}`],
     hostedZone: this.hostedZone,
     region: 'us-east-1' // CRITICAL: Must be us-east-1
   });
   ```

2. Update Frontend stack to use us-east-1 certificate:
   ```typescript
   // In Frontend Stack
   const distribution = new Distribution(this, 'Distribution', {
     certificate: props.usEast1Certificate, // Use us-east-1 certificate
     domainNames: [domain]
   });
   ```

3. If stack failed, clean up and redeploy:
   ```bash
   # Delete failed Frontend stack
   npx cdk destroy ApexShare-Frontend-prod --app "node dist/bin/apexshare.js" --force

   # Redeploy DNS stack with us-east-1 certificate
   npx cdk deploy ApexShare-DNS-prod --app "node dist/bin/apexshare.js"

   # Deploy Frontend stack with proper certificate
   npx cdk deploy ApexShare-Frontend-prod --app "node dist/bin/apexshare.js"
   ```

### 2. AWS Budgets Cost Filter Format Requirements

**Symptoms:**
- `Invalid request provided: Request is missing a Dimension Key`
- AWS Budgets creation fails in Monitoring stack
- Cost filter validation errors

**Root Cause:**
AWS Budgets API requires `TagKeyValue` format instead of separate `TagKey` and `TagValue`.

**Solution:**
1. Use correct `TagKeyValue` format in Monitoring stack:
   ```typescript
   // CORRECT format for AWS Budgets
   costFilters: {
     TagKeyValue: ['Environment$prod', 'Project$ApexShare']
     // Format: TagKey$TagValue with $ separator
   }
   ```

2. Avoid incorrect format:
   ```typescript
   // INCORRECT - Don't use this format
   costFilters: {
     TagKey: ['Environment'],
     TagValue: ['prod']
   }
   ```

3. Complete budget configuration example:
   ```typescript
   const budget = new Budget(this, 'ProductionBudget', {
     budget: {
       budgetName: 'ApexShare-Production-Budget',
       budgetLimit: { amount: 1000, unit: 'USD' },
       timeUnit: TimeUnit.MONTHLY,
       budgetType: BudgetType.COST,
       costFilters: {
         TagKeyValue: ['Environment$prod']
       }
     }
   });
   ```

### 3. Infrastructure Validation Regional Accuracy

**Symptoms:**
- Validation scripts report missing resources
- Resources appear not deployed despite successful CloudFormation
- Regional mismatch in validation results

**Root Cause:**
Validation scripts checking wrong AWS region (often us-east-1 instead of deployment region).

**Solution:**
1. Use region-aware validation script:
   ```bash
   #!/bin/bash
   # Get correct region
   REGION=${AWS_REGION:-eu-west-1}
   echo "Validating resources in region: $REGION"

   # Validate with correct region
   aws s3 ls --region $REGION | grep apexshare
   aws dynamodb list-tables --region $REGION | grep ApexShare
   aws cloudformation describe-stacks --region $REGION --stack-name ApexShare-Storage-prod
   ```

2. Include region verification:
   ```bash
   # Verify region before validation
   if [ -z "$REGION" ]; then
       echo "❌ ERROR: No AWS region configured"
       exit 1
   fi
   echo "🌍 Using AWS region: $REGION"
   ```

3. Check both regional and global resources:
   ```bash
   # Regional resources (eu-west-1)
   aws s3 ls --region eu-west-1 | grep apexshare
   aws dynamodb list-tables --region eu-west-1 | grep ApexShare

   # CloudFront certificates (us-east-1)
   aws acm list-certificates --region us-east-1 --query 'CertificateSummaryList[?contains(DomainName, `apexshare`)]'
   ```

### 4. KMS Key Alias Conflicts

**Symptoms:**
- `AlreadyExistsException: An alias with the name arn:aws:kms:eu-west-1:...:alias/... already exists`

**Root Cause:**
Multiple stacks attempting to create KMS keys with identical aliases.

**Solution:**
1. Ensure Security Stack is deployed first:
   ```bash
   npx cdk deploy ApexShare-Security-prod --app "node dist/bin/apexshare.js"
   ```

2. Verify cross-stack references are properly configured in `bin/apexshare.ts`:
   ```typescript
   const crossStackRefs = {
     securityStack: {
       kmsKeys: securityStack.kmsKeys,
       // ... other references
     }
   };
   ```

3. Check Storage Stack receives references:
   ```typescript
   const storageStack = new StorageStack(app, stackName, {
     config,
     crossStackRefs,
     env: { account, region }
   });
   ```

### 2. TypeScript Compilation Errors

**Symptoms:**
- Build failures with TypeScript errors
- Missing type definitions

**Solution:**
1. Clean and rebuild:
   ```bash
   rm -rf dist/
   npm run build
   ```

2. Check `tsconfig.json` includes all necessary paths:
   ```json
   {
     "include": ["bin/**/*", "lib/**/*", "lambda/**/*"],
     "paths": {
       "@/*": ["./lib/*"],
       "@lambda/*": ["./lambda/*"]
     }
   }
   ```

### 3. Cross-Stack Reference Failures

**Symptoms:**
- `Cannot read property 'kmsKeys' of undefined`
- Missing cross-stack references error

**Solution:**
1. Verify Security Stack exports are correct:
   ```typescript
   // In SecurityStack
   new cdk.CfnOutput(this, 'S3EncryptionKeyId', {
     value: this.kmsKeys.s3.keyId,
     exportName: `${this.stackName}-S3EncryptionKeyId`
   });
   ```

2. Check Storage Stack imports properly:
   ```typescript
   // In StorageStack constructor
   if (!crossStackRefs?.securityStack?.kmsKeys) {
     throw new Error('Storage Stack requires KMS keys from Security Stack');
   }
   ```

### 4. CloudFormation Stack State Issues

**Symptoms:**
- Stack in `UPDATE_ROLLBACK_COMPLETE` state
- Resources stuck in intermediate states

**Solution:**
1. Check stack status:
   ```bash
   aws cloudformation describe-stacks --stack-name ApexShare-Storage-prod
   ```

2. If rollback is complete, destroy and redeploy:
   ```bash
   npx cdk destroy ApexShare-Storage-prod --app "node dist/bin/apexshare.js"
   npx cdk deploy ApexShare-Storage-prod --app "node dist/bin/apexshare.js"
   ```

3. For stuck resources, manually delete via AWS Console if safe.

### 5. Resource Naming Conflicts

**Symptoms:**
- Resource already exists errors
- Bucket name conflicts

**Solution:**
1. Check resource names in `lib/shared/config.ts`:
   ```typescript
   videosBucket: `apexshare-videos-${env}-${region}`,
   uploadsTable: `ApexShare-Uploads-${env}`,
   ```

2. Ensure environment-specific naming is working:
   ```bash
   echo $CDK_ENVIRONMENT  # Should output 'prod'
   ```

## Deployment Sequence

### Proven Successful Order (Final Validation):
1. **Security Stack** (creates KMS keys, IAM roles, WAF)
2. **DNS Stack** (creates Route53 hosted zone, certificates in both regions)
3. **Storage Stack** (creates S3 buckets, DynamoDB with KMS from Security)
4. **API Stack** (creates Lambda functions, API Gateway)
5. **Email Stack** (creates SES configuration, email templates)
6. **Frontend Stack** (creates CloudFront with us-east-1 certificate)
7. **Monitoring Stack** (creates CloudWatch dashboards, budgets with correct filters)

### Critical Requirements:
- **DNS Stack MUST create both regional and us-east-1 certificates**
- **Frontend Stack MUST use us-east-1 certificate for CloudFront**
- **Monitoring Stack MUST use TagKeyValue format for budget filters**
- **All validation MUST check correct deployment region (eu-west-1)**

### Verification Steps:

After each stack deployment:

```bash
# Verify stack status
aws cloudformation describe-stacks --stack-name [STACK-NAME] --query 'Stacks[0].StackStatus'

# Check exports are available
aws cloudformation list-exports --query 'Exports[?starts_with(Name, `ApexShare-Security-prod`)]'

# Validate resources exist (region-aware)
REGION=${AWS_REGION:-eu-west-1}
aws s3 ls --region $REGION | grep apexshare
aws dynamodb list-tables --region $REGION | grep ApexShare
```

### Complete Deployment Validation Checklist:

#### DNS Stack Validation:
```bash
# Check certificates in both regions
aws acm list-certificates --region eu-west-1 --query 'CertificateSummaryList[?contains(DomainName, `apexshare`)]'
aws acm list-certificates --region us-east-1 --query 'CertificateSummaryList[?contains(DomainName, `apexshare`)]'

# Verify Route53 hosted zone
aws route53 list-hosted-zones --query 'HostedZones[?contains(Name, `apexshare`)]'
```

#### Frontend Stack Validation:
```bash
# Verify CloudFront distribution
aws cloudfront list-distributions --query 'DistributionList.Items[?contains(Comment, `ApexShare`)]'

# Check certificate region for CloudFront
aws cloudfront get-distribution --id [DISTRIBUTION-ID] --query 'Distribution.DistributionConfig.ViewerCertificate'
```

#### Monitoring Stack Validation:
```bash
# Verify budget creation
aws budgets describe-budgets --account-id [ACCOUNT-ID] --query 'Budgets[?contains(BudgetName, `ApexShare`)]'

# Check CloudWatch dashboards
aws cloudwatch list-dashboards --query 'DashboardEntries[?contains(DashboardName, `ApexShare`)]'
```

## Monitoring and Debugging

### CloudWatch Logs
```bash
# View CloudFormation events
aws cloudformation describe-stack-events --stack-name ApexShare-Storage-prod

# Monitor deployment progress
aws logs tail /aws/cloudformation/ApexShare-Storage-prod --follow
```

### CDK Debugging
```bash
# Generate CloudFormation template
npx cdk synth ApexShare-Storage-prod --app "node dist/bin/apexshare.js" > template.json

# Compare with deployed stack
npx cdk diff ApexShare-Storage-prod --app "node dist/bin/apexshare.js"

# Debug mode
CDK_DEBUG=true npx cdk deploy ApexShare-Storage-prod --app "node dist/bin/apexshare.js"
```

### Resource Validation
```bash
# Check S3 buckets
aws s3api list-buckets --query 'Buckets[?starts_with(Name, `apexshare`)]'

# Check DynamoDB tables
aws dynamodb describe-table --table-name ApexShare-Uploads-prod

# Check KMS keys
aws kms list-aliases --query 'Aliases[?starts_with(AliasName, `alias/apexshare`)]'
```

## Emergency Procedures

### CRITICAL: Systematic Resource Cleanup Protocol

**⚠️ ALWAYS follow this procedure when CloudFormation stack deletion occurs to prevent resource conflicts:**

#### 1. Immediate Full Cleanup (Required after any stack failure)
```bash
# 1. Check what AWS resources exist
echo "=== Checking existing resources ==="
aws s3 ls | grep apexshare
aws dynamodb list-tables | grep apexshare
aws kms list-aliases | grep apexshare

# 2. Clean ALL S3 buckets immediately
echo "=== Cleaning S3 buckets ==="
aws s3 rb s3://apexshare-videos-prod --force 2>/dev/null || echo "Bucket doesn't exist"
aws s3 rb s3://apexshare-frontend-prod --force 2>/dev/null || echo "Bucket doesn't exist"
aws s3 rb s3://apexshare-templates-prod --force 2>/dev/null || echo "Bucket doesn't exist"
aws s3 rb s3://apexshare-access-logs-prod --force 2>/dev/null || echo "Bucket doesn't exist"

# 3. Clean ALL DynamoDB tables immediately
echo "=== Cleaning DynamoDB tables ==="
aws dynamodb update-table --table-name apexshare-uploads-prod --no-deletion-protection-enabled 2>/dev/null || echo "Table doesn't exist"
aws dynamodb delete-table --table-name apexshare-uploads-prod 2>/dev/null || echo "Table doesn't exist"

# 4. Verify cleanup completed
echo "=== Verifying cleanup ==="
aws s3 ls | grep apexshare && echo "❌ S3 cleanup incomplete" || echo "✅ S3 cleaned"
aws dynamodb list-tables | grep apexshare && echo "❌ DynamoDB cleanup incomplete" || echo "✅ DynamoDB cleaned"

echo "=== Cleanup complete - ready for fresh deployment ==="
```

#### 2. CloudFormation Stack Cleanup
```bash
# Only after resource cleanup, clean the stack
aws cloudformation update-termination-protection --stack-name ApexShare-Storage-prod --no-enable-termination-protection
npx cdk destroy ApexShare-Storage-prod --app "node dist/bin/apexshare.js" --force
```

#### 3. Complete Infrastructure Reset
```bash
# Full cleanup script for complete reset (CAUTION: Data loss!)
echo "=== Complete Infrastructure Reset ==="

# 1. Destroy all stacks in reverse order
npx cdk destroy ApexShare-Frontend-prod --app "node dist/bin/apexshare.js" --force
npx cdk destroy ApexShare-API-prod --app "node dist/bin/apexshare.js" --force
npx cdk destroy ApexShare-Storage-prod --app "node dist/bin/apexshare.js" --force
npx cdk destroy ApexShare-DNS-prod --app "node dist/bin/apexshare.js" --force
npx cdk destroy ApexShare-Security-prod --app "node dist/bin/apexshare.js" --force

# 2. Clean ALL AWS resources (run full cleanup script above)
# 3. Clean build artifacts
rm -rf dist/ node_modules/ cdk.out/
npm install
npm run build

# 4. Redeploy in correct order
npx cdk deploy ApexShare-Security-prod --app "node dist/bin/apexshare.js"
npx cdk deploy ApexShare-Storage-prod --app "node dist/bin/apexshare.js"
# ... continue with other stacks
```

### Partial Recovery (Storage Stack Only)
```bash
# ALWAYS run full resource cleanup first
./scripts/cleanup-aws-resources.sh  # Run the cleanup script above

# Then deploy fresh
npx cdk deploy ApexShare-Security-prod --app "node dist/bin/apexshare.js"  # Ensure Security exists
npx cdk deploy ApexShare-Storage-prod --app "node dist/bin/apexshare.js"
```

### ⚠️ **NEVER SKIP RESOURCE CLEANUP**
- CloudFormation stack deletion does NOT guarantee all AWS resources are deleted
- Remaining resources cause "AlreadyExists" errors on redeployment
- Always verify with `aws s3 ls` and `aws dynamodb list-tables` before redeploying
- This saves hours of debugging time and prevents deployment failures

## Environment-Specific Notes

### Production Environment
- `CDK_ENVIRONMENT=prod`
- Resources have `RETAIN` removal policy
- Enhanced monitoring enabled
- WAF protection active

### Development Environment
- `CDK_ENVIRONMENT=dev`
- Resources have `DESTROY` removal policy
- Basic monitoring
- Reduced security controls

## Contact and Escalation

### Before Escalating:
1. Check this troubleshooting guide
2. Review `DEPLOYMENT_LESSONS_LEARNED.md`
3. Verify environment variables are set correctly
4. Ensure AWS credentials are valid
5. Check AWS service health dashboard

### Escalation Criteria:
- AWS service outages
- Account-level permission issues
- Unrecoverable CloudFormation stack states
- Critical security incidents

## Authentication System Troubleshooting

### 5. Authentication Network Errors (CRITICAL)

**Symptoms:**
- Login attempts result in network errors
- Users cannot access platform despite successful infrastructure deployment
- API calls to authentication endpoints fail
- Authentication tokens not being generated
- Frontend shows "Login failed" or network errors

**Root Cause:**
Authentication system not properly configured or accessible despite successful infrastructure deployment.

**Solution:**

#### Phase 1: Verify Authentication Infrastructure
```bash
# 1. Check API Gateway endpoint accessibility
curl -f https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1/health || echo "❌ API endpoint not accessible"

# 2. Test login endpoint directly
curl -X POST https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1/login \
  -H "Content-Type: application/json" \
  -d '{"email":"trainer@apexshare.be","password":"demo123"}' || echo "❌ Login endpoint failed"

# 3. Verify Lambda functions are deployed
aws lambda list-functions --region eu-west-1 --query 'Functions[?contains(FunctionName, `auth`)].FunctionName'

# 4. Check API Gateway configuration
aws apigateway get-rest-apis --query 'items[?contains(name, `ApexShare`)].{name:name,id:id}'
```

#### Phase 2: Authentication System Configuration
```typescript
// Ensure API Gateway has proper CORS configuration
const api = new RestApi(this, 'AuthApi', {
  restApiName: 'ApexShare Authentication API',
  defaultCorsPreflightOptions: {
    allowOrigins: ['https://apexshare.be'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization']
  }
});

// Login endpoint properly configured
const loginResource = api.root.addResource('login');
loginResource.addMethod('POST', new LambdaIntegration(authLambda), {
  authorizationType: AuthorizationType.NONE
});
```

#### Phase 3: Frontend API Configuration Verification
```bash
# 1. Check frontend environment variables
curl -s https://apexshare.be/static/js/main.*.js | grep -o "REACT_APP_API_URL" || echo "❌ API URL not configured"

# 2. Verify frontend can reach API
curl -f https://apexshare.be || echo "❌ Frontend not accessible"

# 3. Test from frontend domain to API
curl -H "Origin: https://apexshare.be" -X OPTIONS https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1/login
```

#### Phase 4: Demo Account Validation
```bash
# Test both demo accounts
echo "Testing trainer account..."
curl -X POST https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1/login \
  -H "Content-Type: application/json" \
  -d '{"email":"trainer@apexshare.be","password":"demo123"}'

echo "Testing student account..."
curl -X POST https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@apexshare.be","password":"demo123"}'
```

#### Quick Resolution Steps:
1. **Verify API Endpoint:** Ensure `https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1` is accessible
2. **Test Demo Accounts:** Use `trainer@apexshare.be / demo123` or `student@apexshare.be / demo123`
3. **Check CORS Configuration:** Ensure API allows requests from `https://apexshare.be`
4. **Lambda Function Logs:** Check CloudWatch logs for authentication Lambda errors
5. **Frontend Configuration:** Verify frontend is configured with correct API endpoints

#### Prevention Checklist:
- [ ] End-to-end authentication testing before marking deployment complete
- [ ] Demo accounts created and tested during deployment
- [ ] API Gateway endpoints tested independently
- [ ] CORS configuration verified for frontend domain
- [ ] Lambda function permissions and environment variables validated
- [ ] Frontend API configuration confirmed in production build

### Authentication System Status Validation

**Working System Indicators:**
```bash
✅ API Endpoint: https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1 (accessible)
✅ Login Endpoint: /login (POST) returns JWT tokens
✅ Demo Accounts: trainer@apexshare.be and student@apexshare.be working
✅ Frontend: https://apexshare.be (accessible with login functionality)
✅ JWT Authentication: Proper token generation and validation
✅ Dashboard Access: Both trainer and student dashboards accessible after login
```

**Immediate Actions if Authentication Fails:**
1. Run authentication validation script above
2. Check CloudWatch logs for Lambda function errors
3. Verify API Gateway configuration and deployment
4. Test demo accounts directly via API calls
5. Check frontend console for network errors
6. Validate CORS configuration for cross-origin requests

### Documentation Updates
When encountering new issues:
1. Add to this guide
2. Update `DEPLOYMENT_LESSONS_LEARNED.md`
3. Consider infrastructure code improvements
4. Update monitoring and alerting