#!/bin/bash

# ApexShare Testing Framework Runner
# Comprehensive test execution script for all testing scenarios

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Default values
RUN_UNIT=true
RUN_INTEGRATION=true
RUN_E2E=false
RUN_PERFORMANCE=false
RUN_SECURITY=false
GENERATE_COVERAGE=true
ENVIRONMENT="development"
VERBOSE=false
PARALLEL=true

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

print_header() {
    echo ""
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
}

# Function to show usage
show_usage() {
    cat << EOF
ApexShare Testing Framework Runner

Usage: $0 [OPTIONS]

OPTIONS:
    -h, --help              Show this help message
    -u, --unit              Run unit tests only
    -i, --integration       Run integration tests only
    -e, --e2e              Run end-to-end tests only
    -p, --performance      Run performance tests only
    -s, --security         Run security tests only
    -a, --all              Run all test types
    --no-coverage          Skip coverage generation
    --no-parallel          Run tests sequentially
    --env ENVIRONMENT      Set environment (development, staging, production)
    --verbose              Enable verbose output
    --ci                   Run in CI mode (no interactive prompts)

EXAMPLES:
    $0                     # Run unit and integration tests
    $0 --all              # Run all test types
    $0 --unit --verbose   # Run unit tests with verbose output
    $0 --e2e --env staging # Run E2E tests against staging
    $0 --security --ci    # Run security tests in CI mode

ENVIRONMENT VARIABLES:
    TARGET_URL            Frontend URL (default: https://apexshare.be)
    API_URL              API URL (default: https://api.apexshare.be)
    CI                   Set to 'true' for CI mode
EOF
}

# Parse command line arguments
parse_arguments() {
    RUN_UNIT=false
    RUN_INTEGRATION=false
    RUN_E2E=false
    RUN_PERFORMANCE=false
    RUN_SECURITY=false

    if [[ $# -eq 0 ]]; then
        # Default: run unit and integration tests
        RUN_UNIT=true
        RUN_INTEGRATION=true
        return
    fi

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -u|--unit)
                RUN_UNIT=true
                ;;
            -i|--integration)
                RUN_INTEGRATION=true
                ;;
            -e|--e2e)
                RUN_E2E=true
                ;;
            -p|--performance)
                RUN_PERFORMANCE=true
                ;;
            -s|--security)
                RUN_SECURITY=true
                ;;
            -a|--all)
                RUN_UNIT=true
                RUN_INTEGRATION=true
                RUN_E2E=true
                RUN_PERFORMANCE=true
                RUN_SECURITY=true
                ;;
            --no-coverage)
                GENERATE_COVERAGE=false
                ;;
            --no-parallel)
                PARALLEL=false
                ;;
            --env)
                ENVIRONMENT="$2"
                shift
                ;;
            --verbose)
                VERBOSE=true
                ;;
            --ci)
                CI=true
                VERBOSE=false
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
        shift
    done
}

# Setup test environment
setup_environment() {
    print_header "Setting Up Test Environment"

    # Create test results directory
    mkdir -p "$TEST_RESULTS_DIR"

    # Set environment variables
    export NODE_ENV="test"
    export LOG_LEVEL="ERROR"

    case $ENVIRONMENT in
        development)
            export TARGET_URL="${TARGET_URL:-http://localhost:3000}"
            export API_URL="${API_URL:-http://localhost:8080}"
            ;;
        staging)
            export TARGET_URL="${TARGET_URL:-https://staging.apexshare.be}"
            export API_URL="${API_URL:-https://staging-api.apexshare.be}"
            ;;
        production)
            export TARGET_URL="${TARGET_URL:-https://apexshare.be}"
            export API_URL="${API_URL:-https://api.apexshare.be}"
            ;;
    esac

    print_status "Environment: $ENVIRONMENT"
    print_status "Target URL: $TARGET_URL"
    print_status "API URL: $API_URL"
    print_status "Results directory: $TEST_RESULTS_DIR"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi

    # Check if we're in the project root
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        print_error "Not in ApexShare project root directory"
        exit 1
    fi

    # Install dependencies if needed
    if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
        print_status "Installing dependencies..."
        cd "$PROJECT_ROOT"
        npm ci
    fi

    # Check for performance testing tools
    if [[ "$RUN_PERFORMANCE" == true ]]; then
        if ! command -v artillery &> /dev/null; then
            print_warning "Artillery not found globally, will use npx"
        fi
    fi

    # Check for security testing tools
    if [[ "$RUN_SECURITY" == true ]]; then
        if ! command -v python3 &> /dev/null; then
            print_error "Python 3 is required for security testing"
            exit 1
        fi

        if ! python3 -c "import zapv2" 2>/dev/null; then
            print_warning "OWASP ZAP Python library not found, will skip ZAP tests"
        fi
    fi

    print_success "Prerequisites check completed"
}

# Run unit tests
run_unit_tests() {
    print_header "Running Unit Tests"

    cd "$PROJECT_ROOT"

    local jest_args=""
    if [[ "$PARALLEL" == false ]]; then
        jest_args="--runInBand"
    fi

    if [[ "$VERBOSE" == true ]]; then
        jest_args="$jest_args --verbose"
    fi

    if [[ "$GENERATE_COVERAGE" == true ]]; then
        jest_args="$jest_args --coverage"
    fi

    if npm run test:unit -- $jest_args; then
        print_success "Unit tests passed"

        # Move coverage reports
        if [[ -d "coverage" ]]; then
            mv coverage "$TEST_RESULTS_DIR/unit-coverage-$TIMESTAMP"
            print_status "Coverage report saved to $TEST_RESULTS_DIR/unit-coverage-$TIMESTAMP"
        fi

        return 0
    else
        print_error "Unit tests failed"
        return 1
    fi
}

# Run integration tests
run_integration_tests() {
    print_header "Running Integration Tests"

    cd "$PROJECT_ROOT"

    local jest_args=""
    if [[ "$PARALLEL" == false ]]; then
        jest_args="--runInBand"
    fi

    if [[ "$VERBOSE" == true ]]; then
        jest_args="$jest_args --verbose"
    fi

    # Set longer timeout for integration tests
    export TEST_TIMEOUT=30000

    if npm run test:integration -- $jest_args; then
        print_success "Integration tests passed"
        return 0
    else
        print_error "Integration tests failed"
        return 1
    fi
}

# Run end-to-end tests
run_e2e_tests() {
    print_header "Running End-to-End Tests"

    cd "$PROJECT_ROOT"

    # Check if frontend is running (for development)
    if [[ "$ENVIRONMENT" == "development" ]]; then
        if ! curl -s "$TARGET_URL" > /dev/null; then
            print_warning "Frontend not accessible at $TARGET_URL"
            print_warning "Make sure the frontend is running for E2E tests"
        fi
    fi

    local cypress_args="--browser chrome"
    if [[ "$CI" == true ]]; then
        cypress_args="$cypress_args --headless --record false"
    fi

    if [[ "$VERBOSE" == true ]]; then
        cypress_args="$cypress_args --quiet false"
    fi

    # Run Cypress tests
    if npx cypress run $cypress_args; then
        print_success "End-to-end tests passed"

        # Move test artifacts
        if [[ -d "cypress/videos" ]]; then
            cp -r cypress/videos "$TEST_RESULTS_DIR/e2e-videos-$TIMESTAMP"
        fi

        if [[ -d "cypress/screenshots" ]]; then
            cp -r cypress/screenshots "$TEST_RESULTS_DIR/e2e-screenshots-$TIMESTAMP"
        fi

        return 0
    else
        print_error "End-to-end tests failed"

        # Copy failure artifacts
        if [[ -d "cypress/screenshots" ]]; then
            cp -r cypress/screenshots "$TEST_RESULTS_DIR/e2e-failures-$TIMESTAMP"
            print_status "Failure screenshots saved to $TEST_RESULTS_DIR/e2e-failures-$TIMESTAMP"
        fi

        return 1
    fi
}

# Run performance tests
run_performance_tests() {
    print_header "Running Performance Tests"

    cd "$PROJECT_ROOT/tests/performance"

    local artillery_cmd="artillery"
    if ! command -v artillery &> /dev/null; then
        artillery_cmd="npx artillery"
    fi

    local config_file="artillery-config.yml"
    if [[ "$ENVIRONMENT" != "development" ]]; then
        config_file="artillery-config.yml --environment $ENVIRONMENT"
    fi

    local output_file="$TEST_RESULTS_DIR/performance-report-$TIMESTAMP.json"

    print_status "Running load tests against $API_URL"

    if $artillery_cmd run $config_file --output "$output_file"; then
        print_success "Performance tests completed"

        # Generate HTML report if available
        if $artillery_cmd report "$output_file" --output "$TEST_RESULTS_DIR/performance-report-$TIMESTAMP.html" 2>/dev/null; then
            print_status "Performance report generated: performance-report-$TIMESTAMP.html"
        fi

        return 0
    else
        print_error "Performance tests failed"
        return 1
    fi
}

# Run security tests
run_security_tests() {
    print_header "Running Security Tests"

    cd "$PROJECT_ROOT/tests/security"

    local security_exit_code=0

    # Run JavaScript security suite
    print_status "Running custom security test suite..."
    if node security-test-suite.js; then
        print_success "Custom security tests passed"
    else
        print_error "Custom security tests failed"
        security_exit_code=1
    fi

    # Run OWASP ZAP tests if available
    if python3 -c "import zapv2" 2>/dev/null; then
        print_status "Running OWASP ZAP security scan..."

        # Check if ZAP is running
        if curl -s http://localhost:8080 > /dev/null 2>&1; then
            if python3 zap-security-scan.py; then
                print_success "OWASP ZAP security scan completed"
            else
                print_error "OWASP ZAP security scan failed"
                security_exit_code=1
            fi
        else
            print_warning "OWASP ZAP not running on localhost:8080, skipping ZAP tests"
            print_warning "Start ZAP with: zap.sh -daemon -port 8080"
        fi
    else
        print_warning "OWASP ZAP Python library not available, skipping ZAP tests"
    fi

    # Copy security reports
    if [[ -d "security-reports" ]]; then
        cp -r security-reports "$TEST_RESULTS_DIR/security-reports-$TIMESTAMP"
        print_status "Security reports saved to $TEST_RESULTS_DIR/security-reports-$TIMESTAMP"
    fi

    return $security_exit_code
}

# Generate summary report
generate_summary() {
    print_header "Test Summary"

    local summary_file="$TEST_RESULTS_DIR/test-summary-$TIMESTAMP.txt"

    cat > "$summary_file" << EOF
ApexShare Test Execution Summary
================================
Timestamp: $(date)
Environment: $ENVIRONMENT
Target URL: $TARGET_URL
API URL: $API_URL

Tests Executed:
$([ "$RUN_UNIT" == true ] && echo "✓ Unit Tests" || echo "- Unit Tests (skipped)")
$([ "$RUN_INTEGRATION" == true ] && echo "✓ Integration Tests" || echo "- Integration Tests (skipped)")
$([ "$RUN_E2E" == true ] && echo "✓ End-to-End Tests" || echo "- End-to-End Tests (skipped)")
$([ "$RUN_PERFORMANCE" == true ] && echo "✓ Performance Tests" || echo "- Performance Tests (skipped)")
$([ "$RUN_SECURITY" == true ] && echo "✓ Security Tests" || echo "- Security Tests (skipped)")

Results Directory: $TEST_RESULTS_DIR
EOF

    echo ""
    cat "$summary_file"
    echo ""

    print_status "Summary saved to $summary_file"
}

# Main execution function
main() {
    local overall_exit_code=0
    local failed_tests=()

    print_header "ApexShare Testing Framework"
    print_status "Starting test execution at $(date)"

    parse_arguments "$@"
    setup_environment
    check_prerequisites

    # Run selected test suites
    if [[ "$RUN_UNIT" == true ]]; then
        if ! run_unit_tests; then
            failed_tests+=("Unit Tests")
            overall_exit_code=1
        fi
    fi

    if [[ "$RUN_INTEGRATION" == true ]]; then
        if ! run_integration_tests; then
            failed_tests+=("Integration Tests")
            overall_exit_code=1
        fi
    fi

    if [[ "$RUN_E2E" == true ]]; then
        if ! run_e2e_tests; then
            failed_tests+=("End-to-End Tests")
            overall_exit_code=1
        fi
    fi

    if [[ "$RUN_PERFORMANCE" == true ]]; then
        if ! run_performance_tests; then
            failed_tests+=("Performance Tests")
            overall_exit_code=1
        fi
    fi

    if [[ "$RUN_SECURITY" == true ]]; then
        if ! run_security_tests; then
            failed_tests+=("Security Tests")
            overall_exit_code=1
        fi
    fi

    # Generate summary
    generate_summary

    # Final status
    if [[ $overall_exit_code -eq 0 ]]; then
        print_success "All tests passed successfully!"
    else
        print_error "Some tests failed:"
        for failed_test in "${failed_tests[@]}"; do
            print_error "  - $failed_test"
        done
    fi

    print_status "Test execution completed at $(date)"

    return $overall_exit_code
}

# Run main function
main "$@"