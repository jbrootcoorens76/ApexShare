#!/bin/bash

# ApexShare Infrastructure Deployment Script
# This script handles the deployment of the ApexShare infrastructure
# across different environments with proper validation and safety checks.

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CDK_APP="$PROJECT_ROOT/bin/apexshare.ts"

# Default values
ENVIRONMENT=""
SKIP_BOOTSTRAP=false
SKIP_BUILD=false
DRY_RUN=false
STACK_NAME=""
FORCE=false

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy ApexShare infrastructure to AWS using CDK.

OPTIONS:
    -e, --environment ENV    Target environment (dev, staging, prod)
    -s, --stack STACK       Deploy specific stack only
    -b, --skip-bootstrap    Skip CDK bootstrap process
    -n, --skip-build        Skip Lambda function builds
    -d, --dry-run          Show what would be deployed without deploying
    -f, --force            Force deployment without confirmation
    -h, --help             Show this help message

EXAMPLES:
    $0 --environment dev                    # Deploy all stacks to dev
    $0 --environment prod --stack Storage   # Deploy only Storage stack to prod
    $0 --environment staging --dry-run      # Show what would be deployed to staging
    $0 --environment dev --force            # Deploy to dev without confirmation

ENVIRONMENTS:
    dev      - Development environment (cost-optimized, limited monitoring)
    staging  - Staging environment (production-like, full monitoring)
    prod     - Production environment (full security, monitoring, backup)

EOF
}

# Function to validate prerequisites
validate_prerequisites() {
    print_status "Validating prerequisites..."

    # Check if AWS CLI is installed and configured
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured or invalid."
        exit 1
    fi

    # Check if CDK is installed
    if ! command -v cdk &> /dev/null; then
        print_error "AWS CDK is not installed. Please run 'npm install -g aws-cdk'."
        exit 1
    fi

    # Check if Node.js and npm are installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed."
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed."
        exit 1
    fi

    # Check if TypeScript is compiled
    if [ ! -d "$PROJECT_ROOT/dist" ] && [ "$SKIP_BUILD" = false ]; then
        print_status "TypeScript not compiled. Building project..."
        cd "$PROJECT_ROOT"
        npm run build
    fi

    print_success "Prerequisites validated successfully"
}

# Function to build Lambda functions
build_lambda_functions() {
    if [ "$SKIP_BUILD" = true ]; then
        print_status "Skipping Lambda function builds"
        return
    fi

    print_status "Building Lambda functions..."

    local lambda_dirs=(
        "$PROJECT_ROOT/lambda/upload-handler"
        "$PROJECT_ROOT/lambda/download-handler"
        "$PROJECT_ROOT/lambda/email-sender"
    )

    for lambda_dir in "${lambda_dirs[@]}"; do
        if [ -d "$lambda_dir" ]; then
            print_status "Building $(basename "$lambda_dir")..."
            cd "$lambda_dir"

            if [ -f "package.json" ]; then
                npm ci --production
                npm run build
            else
                print_warning "No package.json found in $lambda_dir"
            fi
        else
            print_warning "Lambda directory not found: $lambda_dir"
        fi
    done

    cd "$PROJECT_ROOT"
    print_success "Lambda functions built successfully"
}

# Function to bootstrap CDK
bootstrap_cdk() {
    if [ "$SKIP_BOOTSTRAP" = true ]; then
        print_status "Skipping CDK bootstrap"
        return
    fi

    print_status "Bootstrapping CDK..."

    local account=$(aws sts get-caller-identity --query Account --output text)
    local region=$(aws configure get region)

    if [ -z "$region" ]; then
        print_error "AWS region not configured. Please set it with 'aws configure' or export AWS_DEFAULT_REGION"
        exit 1
    fi

    print_status "Bootstrapping CDK for account $account in region $region"

    cdk bootstrap aws://$account/$region \
        --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess \
        --context environment=$ENVIRONMENT

    print_success "CDK bootstrap completed"
}

# Function to validate environment configuration
validate_environment() {
    print_status "Validating environment configuration for: $ENVIRONMENT"

    case $ENVIRONMENT in
        dev|staging|prod)
            print_success "Valid environment: $ENVIRONMENT"
            ;;
        *)
            print_error "Invalid environment: $ENVIRONMENT. Must be dev, staging, or prod"
            exit 1
            ;;
    esac

    # Check if configuration files exist
    local config_file="$PROJECT_ROOT/lib/shared/config.ts"
    if [ ! -f "$config_file" ]; then
        print_error "Configuration file not found: $config_file"
        exit 1
    fi

    # Validate environment-specific requirements
    case $ENVIRONMENT in
        prod)
            print_warning "Deploying to PRODUCTION environment!"
            print_warning "This will create resources that may incur costs."
            print_warning "Ensure you have:"
            print_warning "  - Proper backup strategies"
            print_warning "  - Monitoring and alerting configured"
            print_warning "  - Domain ownership verified"
            ;;
        staging)
            print_status "Deploying to staging environment"
            print_status "This environment mimics production settings"
            ;;
        dev)
            print_status "Deploying to development environment"
            print_status "Using cost-optimized settings"
            ;;
    esac
}

# Function to show deployment plan
show_deployment_plan() {
    print_status "Generating deployment plan..."

    export CDK_ENVIRONMENT=$ENVIRONMENT

    if [ -n "$STACK_NAME" ]; then
        print_status "Planning deployment for stack: $STACK_NAME"
        cdk diff "ApexShare-$STACK_NAME-$ENVIRONMENT" --app "$CDK_APP"
    else
        print_status "Planning deployment for all stacks"
        cdk diff --app "$CDK_APP"
    fi
}

# Function to deploy infrastructure
deploy_infrastructure() {
    print_status "Starting deployment..."

    export CDK_ENVIRONMENT=$ENVIRONMENT

    local deploy_args=()
    deploy_args+=(--app "$CDK_APP")
    deploy_args+=(--require-approval never)

    if [ "$FORCE" = true ] || [ "$DRY_RUN" = true ]; then
        deploy_args+=(--require-approval never)
    fi

    if [ -n "$STACK_NAME" ]; then
        deploy_args+=("ApexShare-$STACK_NAME-$ENVIRONMENT")
        print_status "Deploying stack: ApexShare-$STACK_NAME-$ENVIRONMENT"
    else
        deploy_args+=("ApexShare-*-$ENVIRONMENT")
        print_status "Deploying all stacks for environment: $ENVIRONMENT"
    fi

    if [ "$DRY_RUN" = true ]; then
        print_status "DRY RUN - Would execute: cdk deploy ${deploy_args[*]}"
        show_deployment_plan
        return
    fi

    # Ask for confirmation unless force is specified
    if [ "$FORCE" = false ]; then
        echo
        print_warning "About to deploy to $ENVIRONMENT environment."
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Deployment cancelled by user"
            exit 0
        fi
    fi

    print_status "Executing deployment..."
    cdk deploy "${deploy_args[@]}"

    print_success "Deployment completed successfully!"
}

# Function to show post-deployment instructions
show_post_deployment_instructions() {
    echo
    print_success "🎉 ApexShare infrastructure deployed successfully!"
    echo
    print_status "📋 Post-deployment checklist:"
    echo "  1. ☐ Update DNS name servers with your domain registrar"
    echo "  2. ☐ Verify SES domain identity and DKIM records"
    echo "  3. ☐ Test upload and download functionality"
    echo "  4. ☐ Configure monitoring alert recipients"
    echo "  5. ☐ Review security settings and access controls"

    if [ "$ENVIRONMENT" = "prod" ]; then
        echo
        print_warning "🔐 Production-specific tasks:"
        echo "  1. ☐ Set up backup schedules"
        echo "  2. ☐ Configure cost alerts and budgets"
        echo "  3. ☐ Schedule security audits"
        echo "  4. ☐ Test disaster recovery procedures"
        echo "  5. ☐ Document operational procedures"
    fi

    echo
    print_status "📖 Useful commands:"
    echo "  Check stack status:    cdk list --app $CDK_APP"
    echo "  View stack outputs:    aws cloudformation describe-stacks --stack-name ApexShare-<Stack>-$ENVIRONMENT"
    echo "  Monitor deployment:    aws cloudformation describe-stack-events --stack-name ApexShare-<Stack>-$ENVIRONMENT"
    echo "  Access CloudWatch:     https://console.aws.amazon.com/cloudwatch"
    echo
}

# Function to cleanup on exit
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        print_error "Deployment failed with exit code $exit_code"
        print_status "Check the error messages above for details"
        print_status "You may need to:"
        print_status "  - Fix configuration issues"
        print_status "  - Resolve AWS permission problems"
        print_status "  - Check AWS service limits"
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--stack)
            STACK_NAME="$2"
            shift 2
            ;;
        -b|--skip-bootstrap)
            SKIP_BOOTSTRAP=true
            shift
            ;;
        -n|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required arguments
if [ -z "$ENVIRONMENT" ]; then
    print_error "Environment is required. Use -e or --environment"
    show_usage
    exit 1
fi

# Main execution
main() {
    print_status "🚀 Starting ApexShare infrastructure deployment"
    print_status "Environment: $ENVIRONMENT"
    print_status "Timestamp: $(date)"
    echo

    validate_prerequisites
    validate_environment
    build_lambda_functions
    bootstrap_cdk

    if [ "$DRY_RUN" = true ]; then
        show_deployment_plan
    else
        deploy_infrastructure
        show_post_deployment_instructions
    fi

    print_success "✅ All operations completed successfully!"
}

# Execute main function
main "$@"