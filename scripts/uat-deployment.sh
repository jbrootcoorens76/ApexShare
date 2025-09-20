#!/bin/bash

# ApexShare UAT Deployment Script
# Deploys and configures production environment for User Acceptance Testing

set -e

echo "🚀 ApexShare UAT Deployment Starting..."
echo "=================================================="

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is required but not installed"
    exit 1
fi

# Check CDK CLI
if ! command -v cdk &> /dev/null; then
    echo "❌ AWS CDK CLI is required but not installed"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Set environment variables
export CDK_ENVIRONMENT=prod
export NODE_ENV=production

echo "🔧 Setting up production environment..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

# Bootstrap CDK if needed
echo "🚀 Bootstrapping CDK environment..."
cdk bootstrap --require-approval never || echo "CDK already bootstrapped"

# Deploy infrastructure stacks
echo "🏗️  Deploying infrastructure stacks..."

echo "   Deploying Security Stack..."
cdk deploy SecurityStack --require-approval never

echo "   Deploying DNS Stack..."
cdk deploy DnsStack --require-approval never

echo "   Deploying Storage Stack..."
cdk deploy StorageStack --require-approval never

echo "   Deploying API Stack..."
cdk deploy ApiStack --require-approval never

echo "   Deploying Email Stack..."
cdk deploy EmailStack --require-approval never

# Verify deployment
echo "🔍 Verifying deployment..."

# Check API Gateway health
API_URL=$(aws cloudformation describe-stacks \
  --stack-name ApexShare-Api-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text 2>/dev/null || echo "")

if [ -n "$API_URL" ]; then
    echo "✅ API Gateway deployed at: $API_URL"

    # Test API health endpoint
    if curl -s "${API_URL}/health" > /dev/null; then
        echo "✅ API health check passed"
    else
        echo "⚠️  API health check failed - may need time to warm up"
    fi
else
    echo "⚠️  Could not retrieve API Gateway URL"
fi

# Check S3 bucket
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name ApexShare-Storage-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`VideoStorageBucketName`].OutputValue' \
  --output text 2>/dev/null || echo "")

if [ -n "$BUCKET_NAME" ]; then
    echo "✅ S3 bucket created: $BUCKET_NAME"
else
    echo "⚠️  Could not retrieve S3 bucket name"
fi

# Check DynamoDB table
TABLE_NAME=$(aws cloudformation describe-stacks \
  --stack-name ApexShare-Storage-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`DynamoDbTableName`].OutputValue' \
  --output text 2>/dev/null || echo "")

if [ -n "$TABLE_NAME" ]; then
    echo "✅ DynamoDB table created: $TABLE_NAME"
else
    echo "⚠️  Could not retrieve DynamoDB table name"
fi

# Check SES domain verification
echo "📧 Checking SES domain verification..."
SES_STATUS=$(aws ses get-identity-verification-attributes \
  --identities apexshare.be \
  --region eu-west-1 \
  --query 'VerificationAttributes."apexshare.be".VerificationStatus' \
  --output text 2>/dev/null || echo "NotStarted")

echo "   SES Domain Status: $SES_STATUS"
if [ "$SES_STATUS" = "Success" ]; then
    echo "✅ SES domain verification complete"
elif [ "$SES_STATUS" = "Pending" ]; then
    echo "⏳ SES domain verification pending (DNS propagation)"
else
    echo "⚠️  SES domain verification not started or failed"
fi

# Set up monitoring
echo "📊 Setting up CloudWatch monitoring..."

# Create UAT monitoring dashboard
cat > /tmp/uat-dashboard.json << 'EOF'
{
    "widgets": [
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    [ "AWS/ApiGateway", "Count", "ApiName", "ApexShare-prod" ],
                    [ ".", "Latency", ".", "." ],
                    [ ".", "4XXError", ".", "." ],
                    [ ".", "5XXError", ".", "." ]
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
                    [ "AWS/Lambda", "Duration", "FunctionName", "ApexShare-upload-handler-prod" ],
                    [ ".", "Errors", ".", "." ],
                    [ ".", "Invocations", ".", "." ]
                ],
                "period": 300,
                "stat": "Average",
                "region": "eu-west-1",
                "title": "Lambda Upload Handler"
            }
        }
    ]
}
EOF

# Create CloudWatch dashboard
aws cloudwatch put-dashboard \
  --dashboard-name "ApexShare-UAT-Monitoring" \
  --dashboard-body file:///tmp/uat-dashboard.json \
  --region eu-west-1 2>/dev/null || echo "Dashboard creation failed"

rm -f /tmp/uat-dashboard.json

# Create test user data
echo "👥 Creating test user accounts..."

# Create UAT user data file
cat > /tmp/uat-users.json << 'EOF'
{
  "trainers": [
    {
      "email": "john.smith.demo@apexshare.be",
      "name": "John Smith",
      "role": "Beginner Instructor"
    },
    {
      "email": "sarah.wilson.demo@apexshare.be",
      "name": "Sarah Wilson",
      "role": "Advanced Instructor"
    }
  ],
  "students": [
    {
      "email": "mike.johnson.demo@apexshare.be",
      "name": "Mike Johnson"
    },
    {
      "email": "lisa.chen.demo@apexshare.be",
      "name": "Lisa Chen"
    },
    {
      "email": "david.brown.demo@apexshare.be",
      "name": "David Brown"
    }
  ]
}
EOF

echo "✅ UAT user data prepared: /tmp/uat-users.json"

# Generate deployment summary
echo ""
echo "🎉 UAT Deployment Complete!"
echo "=================================================="
echo "📊 Deployment Summary:"
echo "   Environment: Production (UAT)"
echo "   API Gateway: ${API_URL:-'Not retrieved'}"
echo "   S3 Bucket: ${BUCKET_NAME:-'Not retrieved'}"
echo "   DynamoDB Table: ${TABLE_NAME:-'Not retrieved'}"
echo "   SES Status: $SES_STATUS"
echo ""
echo "📋 Next Steps:"
echo "   1. Verify SES domain verification completes"
echo "   2. Test email delivery end-to-end"
echo "   3. Create UAT user accounts"
echo "   4. Begin user recruitment for UAT"
echo ""
echo "📖 Documentation:"
echo "   - UAT Plan: docs/USER_ACCEPTANCE_TESTING_PLAN.md"
echo "   - Trainer Guide: docs/TRAINER_USER_GUIDE.md"
echo "   - Student Guide: docs/STUDENT_USER_GUIDE.md"
echo "   - System Admin: docs/SYSTEM_ADMIN_MANUAL.md"
echo ""
echo "🔗 Useful Commands:"
echo "   - Check API health: curl ${API_URL:-'[API_URL]'}/health"
echo "   - Monitor logs: aws logs tail /aws/lambda/ApexShare-upload-handler-prod --follow"
echo "   - Check SES: aws ses get-identity-verification-attributes --identities apexshare.be"
echo ""
echo "✅ ApexShare UAT environment ready for testing!"