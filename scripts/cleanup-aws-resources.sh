#!/bin/bash

# ApexShare AWS Resource Cleanup Script
# Usage: ./scripts/cleanup-aws-resources.sh [environment]
# Example: ./scripts/cleanup-aws-resources.sh prod

set -e

ENVIRONMENT=${1:-prod}
PROJECT="apexshare"

echo "🧹 ApexShare AWS Resource Cleanup for environment: $ENVIRONMENT"
echo "=================================================="

# Check if AWS CLI is configured
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

echo "📋 Current AWS Account:"
aws sts get-caller-identity --query '[Account,Arn]' --output table

echo ""
echo "🔍 Checking existing resources..."

# Check S3 buckets
echo "📦 S3 Buckets:"
aws s3 ls | grep $PROJECT-.*-$ENVIRONMENT || echo "  No S3 buckets found"

# Check DynamoDB tables
echo "🗃️  DynamoDB Tables:"
aws dynamodb list-tables --query 'TableNames[?contains(@, `'$PROJECT'`) && contains(@, `'$ENVIRONMENT'`)]' --output table

# Check KMS keys (aliases only)
echo "🔐 KMS Key Aliases:"
aws kms list-aliases --query 'Aliases[?contains(AliasName, `'$PROJECT'`) && contains(AliasName, `'$ENVIRONMENT'`)].AliasName' --output table

echo ""
read -p "🚨 Do you want to DELETE all ApexShare resources for environment '$ENVIRONMENT'? (yes/no): " -r
if [[ ! $REPLY =~ ^yes$ ]]; then
    echo "❌ Cleanup cancelled."
    exit 0
fi

echo ""
echo "🗑️  Starting cleanup process..."

# Clean S3 buckets
echo "📦 Cleaning S3 buckets..."
BUCKETS=(
    "$PROJECT-videos-$ENVIRONMENT"
    "$PROJECT-frontend-$ENVIRONMENT"
    "$PROJECT-templates-$ENVIRONMENT"
    "$PROJECT-access-logs-$ENVIRONMENT"
)

for bucket in "${BUCKETS[@]}"; do
    echo "  Deleting bucket: $bucket"
    aws s3 rb s3://$bucket --force 2>/dev/null || echo "    Bucket $bucket doesn't exist or already deleted"
done

# Clean DynamoDB tables
echo "🗃️  Cleaning DynamoDB tables..."
TABLES=(
    "$PROJECT-uploads-$ENVIRONMENT"
)

for table in "${TABLES[@]}"; do
    echo "  Disabling deletion protection for table: $table"
    aws dynamodb update-table --table-name $table --no-deletion-protection-enabled 2>/dev/null || echo "    Table $table doesn't exist"

    echo "  Deleting table: $table"
    aws dynamodb delete-table --table-name $table 2>/dev/null || echo "    Table $table doesn't exist or already deleted"
done

# Wait a moment for deletions to propagate
sleep 3

echo ""
echo "✅ Verifying cleanup completion..."

# Verify S3 cleanup
S3_REMAINING=$(aws s3 ls | grep $PROJECT-.*-$ENVIRONMENT | wc -l)
if [ $S3_REMAINING -eq 0 ]; then
    echo "✅ S3 buckets cleaned successfully"
else
    echo "⚠️  Some S3 buckets remain:"
    aws s3 ls | grep $PROJECT-.*-$ENVIRONMENT
fi

# Verify DynamoDB cleanup
DYNAMO_REMAINING=$(aws dynamodb list-tables --query 'TableNames[?contains(@, `'$PROJECT'`) && contains(@, `'$ENVIRONMENT'`)]' --output text | wc -w)
if [ $DYNAMO_REMAINING -eq 0 ]; then
    echo "✅ DynamoDB tables cleaned successfully"
else
    echo "⚠️  Some DynamoDB tables remain (may be in DELETING state):"
    aws dynamodb list-tables --query 'TableNames[?contains(@, `'$PROJECT'`) && contains(@, `'$ENVIRONMENT'`)]' --output table
fi

echo ""
echo "🎉 Cleanup complete! Ready for fresh deployment."
echo ""
echo "📝 Next steps:"
echo "   1. Build: npm run build"
echo "   2. Deploy: npx cdk deploy ApexShare-Storage-$ENVIRONMENT --app \"node dist/bin/apexshare.js\""
echo ""