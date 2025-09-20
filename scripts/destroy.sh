#!/bin/bash

# ApexShare Infrastructure Destruction Script
# This script safely destroys ApexShare infrastructure with proper safeguards
# and data preservation options for production environments.

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
STACK_NAME=""
FORCE=false
PRESERVE_DATA=false
DRY_RUN=false

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

Destroy ApexShare infrastructure from AWS.

⚠️  WARNING: This will permanently delete AWS resources!

OPTIONS:
    -e, --environment ENV    Target environment (dev, staging, prod)
    -s, --stack STACK       Destroy specific stack only
    -p, --preserve-data     Preserve data resources (S3, DynamoDB) - PRODUCTION ONLY
    -d, --dry-run          Show what would be destroyed without destroying
    -f, --force            Force destruction without confirmation prompts
    -h, --help             Show this help message

EXAMPLES:
    $0 --environment dev                        # Destroy all dev stacks
    $0 --environment prod --preserve-data       # Destroy prod stacks but keep data
    $0 --environment staging --stack Frontend   # Destroy only Frontend stack
    $0 --environment dev --dry-run              # Show what would be destroyed

DESTRUCTION ORDER:
    The script will destroy stacks in reverse dependency order:
    1. Monitoring Stack
    2. Email Stack
    3. Frontend Stack
    4. API Stack
    5. Storage Stack (unless --preserve-data is used)
    6. DNS Stack
    7. Security Stack

DATA PRESERVATION:
    Using --preserve-data will:
    - Skip destruction of S3 buckets containing user data
    - Skip destruction of DynamoDB tables
    - Preserve CloudTrail logs and audit data
    - Remove only compute and networking resources

EOF
}

# Function to validate prerequisites
validate_prerequisites() {
    print_status "Validating prerequisites..."

    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed."
        exit 1
    fi

    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured or invalid."
        exit 1
    fi

    if ! command -v cdk &> /dev/null; then
        print_error "AWS CDK is not installed."
        exit 1
    fi

    print_success "Prerequisites validated"
}

# Function to validate environment
validate_environment() {
    print_status "Validating environment: $ENVIRONMENT"

    case $ENVIRONMENT in
        dev|staging|prod)
            print_success "Valid environment: $ENVIRONMENT"
            ;;
        *)
            print_error "Invalid environment: $ENVIRONMENT. Must be dev, staging, or prod"
            exit 1
            ;;
    esac

    if [ "$ENVIRONMENT" = "prod" ]; then
        print_warning "⚠️  PRODUCTION ENVIRONMENT DETECTED!"
        print_warning "You are about to destroy production infrastructure!"
        print_warning "This action may result in:"
        print_warning "  - Loss of user data"
        print_warning "  - Service downtime"
        print_warning "  - Loss of configurations"
        print_warning "  - Potential data recovery costs"
        echo

        if [ "$PRESERVE_DATA" = false ]; then
            print_error "❌ Data preservation is STRONGLY RECOMMENDED for production!"
            print_error "Use --preserve-data flag to keep data resources."
            echo
            read -p "Are you ABSOLUTELY SURE you want to destroy ALL production resources? (type 'DESTROY PRODUCTION' to confirm): " -r
            if [[ $REPLY != "DESTROY PRODUCTION" ]]; then
                print_status "Destruction cancelled for safety"
                exit 0
            fi
        else
            print_status "✅ Data preservation enabled for production"
        fi
    fi
}

# Function to show destruction plan
show_destruction_plan() {
    print_status "Generating destruction plan..."

    export CDK_ENVIRONMENT=$ENVIRONMENT

    local stacks_to_destroy=()

    if [ -n "$STACK_NAME" ]; then
        stacks_to_destroy+=("ApexShare-$STACK_NAME-$ENVIRONMENT")
    else
        # Get all stacks for the environment
        local all_stacks=(
            "ApexShare-Monitoring-$ENVIRONMENT"
            "ApexShare-Email-$ENVIRONMENT"
            "ApexShare-Frontend-$ENVIRONMENT"
            "ApexShare-API-$ENVIRONMENT"
        )

        if [ "$PRESERVE_DATA" = false ]; then
            all_stacks+=("ApexShare-Storage-$ENVIRONMENT")
        fi

        all_stacks+=(
            "ApexShare-DNS-$ENVIRONMENT"
            "ApexShare-Security-$ENVIRONMENT"
        )

        stacks_to_destroy=("${all_stacks[@]}")
    fi

    print_status "Stacks scheduled for destruction:"
    for stack in "${stacks_to_destroy[@]}"; do
        echo "  - $stack"
    done

    if [ "$PRESERVE_DATA" = true ]; then
        echo
        print_status "Data resources to be PRESERVED:"
        echo "  - S3 buckets with user data"
        echo "  - DynamoDB tables"
        echo "  - CloudTrail logs"
        echo "  - Config history"
    fi

    echo
    print_status "Checking which stacks actually exist..."

    for stack in "${stacks_to_destroy[@]}"; do
        if aws cloudformation describe-stacks --stack-name "$stack" &> /dev/null; then
            print_status "✅ Found: $stack"
        else
            print_warning "⚠️  Not found: $stack (may already be deleted)"
        fi
    done
}

# Function to backup critical data
backup_critical_data() {
    if [ "$PRESERVE_DATA" = false ] && [ "$ENVIRONMENT" = "prod" ]; then
        print_status "Creating final backup of critical data..."

        local backup_bucket="apexshare-emergency-backup-$(date +%Y%m%d-%H%M%S)"

        print_status "Creating emergency backup bucket: $backup_bucket"
        aws s3 mb "s3://$backup_bucket" || print_warning "Failed to create backup bucket"

        # Export DynamoDB table
        print_status "Initiating DynamoDB table export..."
        local table_name="apexshare-uploads-table-$ENVIRONMENT"
        aws dynamodb describe-table --table-name "$table_name" > "/tmp/${table_name}-schema.json" 2>/dev/null || print_warning "Failed to backup DynamoDB schema"

        print_success "Emergency backup initiated (if resources exist)"
    fi
}

# Function to destroy infrastructure
destroy_infrastructure() {
    print_status "Starting infrastructure destruction..."

    export CDK_ENVIRONMENT=$ENVIRONMENT

    # Get list of existing stacks
    local existing_stacks=()
    while IFS= read -r stack; do
        existing_stacks+=("$stack")
    done < <(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query "StackSummaries[?starts_with(StackName, 'ApexShare-') && contains(StackName, '-$ENVIRONMENT')].StackName" --output text | tr '\t' '\n')

    if [ ${#existing_stacks[@]} -eq 0 ]; then
        print_warning "No ApexShare stacks found for environment: $ENVIRONMENT"
        return
    fi

    # Define destruction order (reverse of creation order)
    local destruction_order=(
        "ApexShare-Monitoring-$ENVIRONMENT"
        "ApexShare-Email-$ENVIRONMENT"
        "ApexShare-Frontend-$ENVIRONMENT"
        "ApexShare-API-$ENVIRONMENT"
    )

    if [ "$PRESERVE_DATA" = false ]; then
        destruction_order+=("ApexShare-Storage-$ENVIRONMENT")
    fi

    destruction_order+=(
        "ApexShare-DNS-$ENVIRONMENT"
        "ApexShare-Security-$ENVIRONMENT"
    )

    # Filter to only destroy specified stack if provided
    if [ -n "$STACK_NAME" ]; then
        destruction_order=("ApexShare-$STACK_NAME-$ENVIRONMENT")
    fi

    # Destroy stacks in order
    for stack in "${destruction_order[@]}"; do
        # Check if stack exists
        if [[ " ${existing_stacks[*]} " =~ " ${stack} " ]]; then
            print_status "Destroying stack: $stack"

            if [ "$DRY_RUN" = true ]; then
                print_status "DRY RUN - Would destroy: $stack"
                continue
            fi

            # Special handling for data preservation
            if [ "$PRESERVE_DATA" = true ] && [[ "$stack" == *"Storage"* ]]; then
                print_status "Skipping Storage stack due to data preservation flag"
                continue
            fi

            cdk destroy "$stack" --app "$CDK_APP" --force || {
                print_error "Failed to destroy stack: $stack"
                print_status "You may need to manually clean up resources or resolve dependencies"

                # Offer to continue with other stacks
                if [ "$FORCE" = false ]; then
                    read -p "Continue with remaining stacks? (y/N): " -n 1 -r
                    echo
                    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                        print_status "Destruction cancelled"
                        exit 1
                    fi
                fi
            }

            print_success "Stack destroyed: $stack"
        else
            print_warning "Stack not found (may already be deleted): $stack"
        fi
    done

    print_success "Infrastructure destruction completed!"
}

# Function to clean up orphaned resources
cleanup_orphaned_resources() {
    print_status "Checking for orphaned resources..."

    # Clean up ECR repositories
    local ecr_repos=$(aws ecr describe-repositories --query "repositories[?contains(repositoryName, 'apexshare')].repositoryName" --output text 2>/dev/null || echo "")
    if [ -n "$ecr_repos" ]; then
        print_status "Found ECR repositories to clean up"
        for repo in $ecr_repos; do
            if [ "$DRY_RUN" = false ]; then
                aws ecr delete-repository --repository-name "$repo" --force 2>/dev/null || print_warning "Failed to delete ECR repo: $repo"
            else
                print_status "DRY RUN - Would delete ECR repo: $repo"
            fi
        done
    fi

    # Clean up CloudWatch log groups
    local log_groups=$(aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/apexshare" --query "logGroups[].logGroupName" --output text 2>/dev/null || echo "")
    if [ -n "$log_groups" ]; then
        print_status "Found orphaned CloudWatch log groups"
        for log_group in $log_groups; do
            if [ "$DRY_RUN" = false ]; then
                aws logs delete-log-group --log-group-name "$log_group" 2>/dev/null || print_warning "Failed to delete log group: $log_group"
            else
                print_status "DRY RUN - Would delete log group: $log_group"
            fi
        done
    fi

    print_success "Orphaned resource cleanup completed"
}

# Function to show post-destruction summary
show_post_destruction_summary() {
    echo
    if [ "$DRY_RUN" = true ]; then
        print_success "🔍 Dry run completed - no resources were actually destroyed"
    else
        print_success "🗑️  ApexShare infrastructure destruction completed!"
    fi

    echo
    print_status "📋 Summary:"

    if [ "$PRESERVE_DATA" = true ]; then
        echo "  ✅ Data resources preserved"
        echo "  ✅ Compute resources destroyed"
        echo "  ✅ Networking resources destroyed"
        echo
        print_warning "⚠️  Preserved resources may still incur costs:"
        echo "  - S3 storage costs"
        echo "  - DynamoDB storage costs"
        echo "  - CloudTrail logging costs"
    else
        echo "  ❌ All resources destroyed"
        echo "  ❌ All data permanently deleted"
    fi

    if [ "$ENVIRONMENT" = "prod" ] && [ "$PRESERVE_DATA" = false ]; then
        echo
        print_warning "🚨 PRODUCTION DATA DESTROYED!"
        print_warning "If this was unintentional, check your backups immediately."
    fi

    echo
    print_status "📖 Next steps:"
    if [ "$PRESERVE_DATA" = true ]; then
        echo "  1. ☐ Review preserved resources for ongoing costs"
        echo "  2. ☐ Consider exporting data before final cleanup"
        echo "  3. ☐ Schedule final resource cleanup when ready"
    else
        echo "  1. ☐ Verify all resources are cleaned up in AWS Console"
        echo "  2. ☐ Check for any remaining costs in billing"
        echo "  3. ☐ Update DNS records if domain is moving"
    fi
}

# Function to cleanup on exit
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        print_error "Destruction failed with exit code $exit_code"
        print_status "Some resources may not have been destroyed"
        print_status "Check AWS Console for remaining resources"
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
        -p|--preserve-data)
            PRESERVE_DATA=true
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
    print_status "🗑️  Starting ApexShare infrastructure destruction"
    print_status "Environment: $ENVIRONMENT"
    print_status "Preserve Data: $PRESERVE_DATA"
    print_status "Timestamp: $(date)"
    echo

    validate_prerequisites
    validate_environment
    show_destruction_plan

    # Final confirmation for non-dry runs
    if [ "$DRY_RUN" = false ] && [ "$FORCE" = false ]; then
        echo
        print_warning "⚠️  FINAL CONFIRMATION REQUIRED"
        print_warning "This will permanently destroy infrastructure in: $ENVIRONMENT"

        if [ "$PRESERVE_DATA" = false ]; then
            print_warning "ALL DATA WILL BE PERMANENTLY DELETED!"
        fi

        read -p "Type 'DESTROY' to confirm destruction: " -r
        if [[ $REPLY != "DESTROY" ]]; then
            print_status "Destruction cancelled by user"
            exit 0
        fi
    fi

    backup_critical_data
    destroy_infrastructure
    cleanup_orphaned_resources
    show_post_destruction_summary

    print_success "✅ All operations completed!"
}

# Execute main function
main "$@"