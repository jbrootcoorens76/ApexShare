#!/bin/bash

# Frontend Deployment Script for ApexShare
# Builds and deploys the React frontend to S3 with CloudFront invalidation

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
ENVIRONMENT="${1:-staging}"
FORCE_DEPLOY="${2:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be one of: development, staging, production"
    exit 1
fi

log_info "Starting frontend deployment for environment: $ENVIRONMENT"

# Environment-specific configuration
case $ENVIRONMENT in
    "development")
        S3_BUCKET="apexshare-frontend-dev"
        CLOUDFRONT_DISTRIBUTION_ID=""
        API_BASE_URL="https://api-dev.apexshare.be"
        DOMAIN="dev.apexshare.be"
        ;;
    "staging")
        S3_BUCKET="apexshare-frontend-staging"
        CLOUDFRONT_DISTRIBUTION_ID=""
        API_BASE_URL="https://api-staging.apexshare.be"
        DOMAIN="staging.apexshare.be"
        ;;
    "production")
        S3_BUCKET="apexshare-frontend-prod"
        CLOUDFRONT_DISTRIBUTION_ID=""
        API_BASE_URL="https://api.apexshare.be"
        DOMAIN="apexshare.be"
        ;;
esac

# Change to frontend directory
cd "$SCRIPT_DIR"

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    log_error "package.json not found. Are you in the frontend directory?"
    exit 1
fi

# Create environment file
log_info "Creating environment configuration..."
cat > .env.local << EOF
VITE_ENVIRONMENT=$ENVIRONMENT
VITE_API_BASE_URL=$API_BASE_URL
VITE_AWS_REGION=eu-west-1
VITE_DOMAIN=$DOMAIN
VITE_ENABLE_ANALYTICS=$([ "$ENVIRONMENT" = "production" ] && echo "true" || echo "false")
VITE_ENABLE_DETAILED_LOGGING=$([ "$ENVIRONMENT" = "production" ] && echo "false" || echo "true")
VITE_MAX_FILE_SIZE=5368709120
VITE_CHUNK_SIZE=10485760
VITE_MAX_CONCURRENT_UPLOADS=3
EOF

# Install dependencies
log_info "Installing dependencies..."
npm ci

# Run type checking
log_info "Running type checking..."
npm run typecheck

# Run linting
log_info "Running linting..."
npm run lint

# Build the application
log_info "Building application for $ENVIRONMENT..."
npm run build

# Verify build output
if [[ ! -d "dist" ]]; then
    log_error "Build failed - dist directory not found"
    exit 1
fi

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Get AWS credentials info
log_info "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    log_error "AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

# Check if S3 bucket exists
log_info "Checking S3 bucket: $S3_BUCKET"
if ! aws s3 ls "s3://$S3_BUCKET" &> /dev/null; then
    log_error "S3 bucket $S3_BUCKET does not exist or is not accessible"
    exit 1
fi

# Upload files to S3
log_info "Uploading files to S3 bucket: $S3_BUCKET"

# Upload with proper cache headers
aws s3 sync dist/ "s3://$S3_BUCKET" \
    --delete \
    --cache-control "public, max-age=31536000" \
    --exclude "*.html" \
    --exclude "*.json" \
    --exclude "*.txt"

# Upload HTML files with no-cache
aws s3 sync dist/ "s3://$S3_BUCKET" \
    --cache-control "no-cache" \
    --include "*.html" \
    --include "*.json" \
    --include "*.txt"

# Set proper content types for specific files
aws s3 cp "s3://$S3_BUCKET/index.html" "s3://$S3_BUCKET/index.html" \
    --metadata-directive REPLACE \
    --content-type "text/html; charset=utf-8" \
    --cache-control "no-cache"

log_success "Files uploaded to S3 successfully"

# Get CloudFront distribution ID if not set
if [[ -z "$CLOUDFRONT_DISTRIBUTION_ID" ]]; then
    log_info "Looking up CloudFront distribution for domain: $DOMAIN"
    CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudfront list-distributions \
        --query "DistributionList.Items[?contains(Aliases.Items, '$DOMAIN')].Id" \
        --output text)

    if [[ -z "$CLOUDFRONT_DISTRIBUTION_ID" || "$CLOUDFRONT_DISTRIBUTION_ID" = "None" ]]; then
        log_warning "CloudFront distribution not found for domain: $DOMAIN"
        log_warning "Skipping cache invalidation"
    else
        log_info "Found CloudFront distribution: $CLOUDFRONT_DISTRIBUTION_ID"
    fi
fi

# Invalidate CloudFront cache
if [[ -n "$CLOUDFRONT_DISTRIBUTION_ID" && "$CLOUDFRONT_DISTRIBUTION_ID" != "None" ]]; then
    log_info "Creating CloudFront invalidation..."
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --paths "/*" \
        --query "Invalidation.Id" \
        --output text)

    log_info "Invalidation created with ID: $INVALIDATION_ID"
    log_info "Waiting for invalidation to complete (this may take a few minutes)..."

    aws cloudfront wait invalidation-completed \
        --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --id "$INVALIDATION_ID"

    log_success "CloudFront cache invalidated successfully"
fi

# Clean up
rm -f .env.local

# Deployment summary
log_success "Frontend deployment completed successfully!"
log_info "Environment: $ENVIRONMENT"
log_info "S3 Bucket: $S3_BUCKET"
log_info "Domain: https://$DOMAIN"

if [[ -n "$CLOUDFRONT_DISTRIBUTION_ID" && "$CLOUDFRONT_DISTRIBUTION_ID" != "None" ]]; then
    log_info "CloudFront Distribution: $CLOUDFRONT_DISTRIBUTION_ID"
fi

log_info "The frontend is now live and ready to use!"

# Performance recommendations
log_info ""
log_info "Performance Tips:"
log_info "- Test the site on different devices and network conditions"
log_info "- Monitor Core Web Vitals and loading performance"
log_info "- Check browser console for any JavaScript errors"

if [[ "$ENVIRONMENT" = "production" ]]; then
    log_warning ""
    log_warning "Production Deployment Complete!"
    log_warning "Please verify the site is working correctly at: https://$DOMAIN"
fi