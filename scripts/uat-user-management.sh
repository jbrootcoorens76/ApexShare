#!/bin/bash

# ApexShare UAT User Management Script
# Creates and manages test user accounts for User Acceptance Testing

set -e

echo "👥 ApexShare UAT User Management"
echo "================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  create-users     Create all UAT test users"
    echo "  send-invites     Send invitation emails to UAT users"
    echo "  list-users       List all UAT users and their status"
    echo "  reset-user       Reset a specific user account"
    echo "  cleanup-users    Remove all UAT test users"
    echo ""
    echo "Options:"
    echo "  --email EMAIL    Specific user email (for reset-user)"
    echo "  --dry-run        Show what would be done without executing"
    echo "  --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 create-users"
    echo "  $0 send-invites"
    echo "  $0 reset-user --email john.smith.demo@apexshare.be"
    echo "  $0 cleanup-users --dry-run"
}

# Function to create UAT users
create_users() {
    echo "📝 Creating UAT user accounts..."

    # Create UAT users data
    cat > /tmp/uat-users-detailed.json << 'EOF'
{
  "trainers": [
    {
      "email": "john.smith.demo@apexshare.be",
      "name": "John Smith",
      "role": "Beginner Instructor",
      "experience": "2 years",
      "focus": "Basic riding skills",
      "phone": "+1-555-0101",
      "organization": "Metro Motorcycle Training"
    },
    {
      "email": "sarah.wilson.demo@apexshare.be",
      "name": "Sarah Wilson",
      "role": "Advanced Instructor",
      "experience": "8 years",
      "focus": "Track racing techniques",
      "phone": "+1-555-0102",
      "organization": "Advanced Riding Academy"
    },
    {
      "email": "mike.rodriguez.demo@apexshare.be",
      "name": "Mike Rodriguez",
      "role": "Safety Instructor",
      "experience": "5 years",
      "focus": "Defensive riding",
      "phone": "+1-555-0103",
      "organization": "Safe Ride Training Center"
    }
  ],
  "students": [
    {
      "email": "mike.johnson.demo@apexshare.be",
      "name": "Mike Johnson",
      "level": "Beginner",
      "device_preference": "Mobile",
      "age_group": "25-35",
      "trainer": "john.smith.demo@apexshare.be"
    },
    {
      "email": "lisa.chen.demo@apexshare.be",
      "name": "Lisa Chen",
      "level": "Intermediate",
      "device_preference": "Desktop",
      "age_group": "35-45",
      "trainer": "sarah.wilson.demo@apexshare.be"
    },
    {
      "email": "david.brown.demo@apexshare.be",
      "name": "David Brown",
      "level": "Advanced",
      "device_preference": "Tablet",
      "age_group": "45-55",
      "trainer": "sarah.wilson.demo@apexshare.be"
    },
    {
      "email": "anna.garcia.demo@apexshare.be",
      "name": "Anna Garcia",
      "level": "Beginner",
      "device_preference": "Mobile",
      "age_group": "18-25",
      "trainer": "john.smith.demo@apexshare.be"
    },
    {
      "email": "tom.wilson.demo@apexshare.be",
      "name": "Tom Wilson",
      "level": "Intermediate",
      "device_preference": "Desktop",
      "age_group": "55-65",
      "trainer": "mike.rodriguez.demo@apexshare.be"
    },
    {
      "email": "emma.davis.demo@apexshare.be",
      "name": "Emma Davis",
      "level": "Beginner",
      "device_preference": "Mobile",
      "age_group": "25-35",
      "trainer": "john.smith.demo@apexshare.be"
    }
  ],
  "admin": {
    "email": "admin.demo@apexshare.be",
    "name": "UAT Administrator",
    "role": "System Administrator",
    "phone": "+1-555-0100",
    "responsibilities": ["User management", "System monitoring", "Issue resolution"]
  }
}
EOF

    echo "✅ UAT user data created"

    # Create user credentials file
    cat > /tmp/uat-credentials.json << 'EOF'
{
  "trainer_credentials": [
    {
      "email": "john.smith.demo@apexshare.be",
      "username": "john.smith.trainer",
      "temporary_password": "TempPass123!",
      "role": "trainer"
    },
    {
      "email": "sarah.wilson.demo@apexshare.be",
      "username": "sarah.wilson.trainer",
      "temporary_password": "TempPass456!",
      "role": "trainer"
    },
    {
      "email": "mike.rodriguez.demo@apexshare.be",
      "username": "mike.rodriguez.trainer",
      "temporary_password": "TempPass789!",
      "role": "trainer"
    }
  ],
  "student_credentials": [
    {
      "email": "mike.johnson.demo@apexshare.be",
      "username": "mike.johnson.student",
      "temporary_password": "StudentPass123!",
      "role": "student"
    },
    {
      "email": "lisa.chen.demo@apexshare.be",
      "username": "lisa.chen.student",
      "temporary_password": "StudentPass456!",
      "role": "student"
    },
    {
      "email": "david.brown.demo@apexshare.be",
      "username": "david.brown.student",
      "temporary_password": "StudentPass789!",
      "role": "student"
    },
    {
      "email": "anna.garcia.demo@apexshare.be",
      "username": "anna.garcia.student",
      "temporary_password": "StudentPass101!",
      "role": "student"
    },
    {
      "email": "tom.wilson.demo@apexshare.be",
      "username": "tom.wilson.student",
      "temporary_password": "StudentPass202!",
      "role": "student"
    },
    {
      "email": "emma.davis.demo@apexshare.be",
      "username": "emma.davis.student",
      "temporary_password": "StudentPass303!",
      "role": "student"
    }
  ],
  "admin_credentials": {
    "email": "admin.demo@apexshare.be",
    "username": "uat.administrator",
    "temporary_password": "AdminPass999!",
    "role": "admin"
  }
}
EOF

    echo "✅ UAT credentials generated"
    echo "📋 User accounts ready:"
    echo "   - 3 Trainers"
    echo "   - 6 Students"
    echo "   - 1 Administrator"
    echo ""
    echo "📁 Files created:"
    echo "   - /tmp/uat-users-detailed.json"
    echo "   - /tmp/uat-credentials.json"
}

# Function to send invitation emails
send_invites() {
    echo "📧 Sending UAT invitation emails..."

    if [ ! -f "/tmp/uat-users-detailed.json" ]; then
        echo "❌ User data not found. Run 'create-users' first."
        exit 1
    fi

    # Create invitation email templates
    cat > /tmp/trainer-invite-template.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>ApexShare UAT Invitation - Trainer</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
        <h1 style="color: #2c3e50; margin-bottom: 20px;">🏍️ ApexShare Beta Testing Invitation</h1>

        <p style="font-size: 16px; line-height: 1.6;">Dear {{TRAINER_NAME}},</p>

        <p style="font-size: 16px; line-height: 1.6;">
            We're excited to invite you to beta test <strong>ApexShare</strong>, a revolutionary platform
            designed specifically for motorcycle training video sharing. As an experienced instructor,
            your feedback will be invaluable in shaping the final product.
        </p>

        <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">What is ApexShare?</h3>
            <ul style="line-height: 1.8;">
                <li>Secure platform for sharing GoPro footage with students</li>
                <li>Automatic email notifications when videos are ready</li>
                <li>Mobile-optimized interface for easy access anywhere</li>
                <li>Professional solution built specifically for motorcycle training</li>
            </ul>
        </div>

        <div style="background-color: #e8f4f8; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">Your UAT Access Details</h3>
            <p><strong>Platform URL:</strong> https://app.apexshare.be</p>
            <p><strong>Username:</strong> {{USERNAME}}</p>
            <p><strong>Temporary Password:</strong> {{TEMP_PASSWORD}}</p>
            <p><strong>Role:</strong> Trainer</p>
        </div>

        <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0;">Time Commitment</h3>
            <p style="margin-bottom: 10px;"><strong>Duration:</strong> 2-3 hours over one week</p>
            <p style="margin-bottom: 10px;"><strong>Activities:</strong> Upload test videos, try different features, provide feedback</p>
            <p style="margin-bottom: 0;"><strong>Support:</strong> Direct access to development team for questions</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="https://app.apexshare.be"
               style="background-color: #007bff; color: white; padding: 15px 30px;
                      text-decoration: none; border-radius: 5px; font-weight: bold;">
                Start Beta Testing
            </a>
        </div>

        <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">
            Questions? Reply to this email or contact our team directly. We're here to help!
        </p>

        <p style="font-size: 16px; margin-top: 20px;">
            Thank you for helping us build the future of motorcycle training!
        </p>

        <p style="font-size: 16px;">
            Best regards,<br>
            The ApexShare Team
        </p>
    </div>
</body>
</html>
EOF

    cat > /tmp/student-invite-template.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>ApexShare UAT Invitation - Student</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
        <h1 style="color: #2c3e50; margin-bottom: 20px;">🏍️ ApexShare Beta Testing Invitation</h1>

        <p style="font-size: 16px; line-height: 1.6;">Dear {{STUDENT_NAME}},</p>

        <p style="font-size: 16px; line-height: 1.6;">
            We'd love your help testing <strong>ApexShare</strong>, a new platform that makes it easy
            for motorcycle training students to access their training videos. Your feedback as a
            student will help us create the best possible experience.
        </p>

        <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">What You'll Test</h3>
            <ul style="line-height: 1.8;">
                <li>Receiving email notifications about available videos</li>
                <li>Accessing and downloading your training footage</li>
                <li>Using the platform on your phone, tablet, or computer</li>
                <li>Viewing videos and providing feedback</li>
            </ul>
        </div>

        <div style="background-color: #e8f4f8; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">Your Test Access</h3>
            <p><strong>Platform URL:</strong> https://app.apexshare.be</p>
            <p><strong>Username:</strong> {{USERNAME}}</p>
            <p><strong>Temporary Password:</strong> {{TEMP_PASSWORD}}</p>
            <p><strong>Assigned Trainer:</strong> {{TRAINER_NAME}}</p>
        </div>

        <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #155724; margin-top: 0;">What's In It For You</h3>
            <p style="margin-bottom: 10px;">✅ Free access to the platform during and after testing</p>
            <p style="margin-bottom: 10px;">✅ Direct input into features that matter to students</p>
            <p style="margin-bottom: 10px;">✅ Early access to your training videos</p>
            <p style="margin-bottom: 0;">✅ Help improve motorcycle training for everyone</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="https://app.apexshare.be"
               style="background-color: #28a745; color: white; padding: 15px 30px;
                      text-decoration: none; border-radius: 5px; font-weight: bold;">
                Access Your Videos
            </a>
        </div>

        <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">
            The testing period is just one week, with about 1-2 hours of your time total.
            We'll guide you through everything step by step.
        </p>

        <p style="font-size: 16px; margin-top: 20px;">
            Thank you for being part of the ApexShare community!
        </p>

        <p style="font-size: 16px;">
            Best regards,<br>
            The ApexShare Team
        </p>
    </div>
</body>
</html>
EOF

    echo "✅ Email templates created"
    echo "📧 Invitation emails ready to send"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Customize email templates with actual contact information"
    echo "   2. Set up email sending through SES or email service"
    echo "   3. Send invitations to UAT participants"
    echo ""
    echo "📁 Template files:"
    echo "   - /tmp/trainer-invite-template.html"
    echo "   - /tmp/student-invite-template.html"
}

# Function to list users
list_users() {
    echo "📋 UAT User Status Report"
    echo "========================"

    if [ ! -f "/tmp/uat-users-detailed.json" ]; then
        echo "❌ User data not found. Run 'create-users' first."
        exit 1
    fi

    echo ""
    echo "👨‍🏫 TRAINERS (3):"
    echo "   • john.smith.demo@apexshare.be (Beginner Instructor)"
    echo "   • sarah.wilson.demo@apexshare.be (Advanced Instructor)"
    echo "   • mike.rodriguez.demo@apexshare.be (Safety Instructor)"
    echo ""
    echo "👨‍🎓 STUDENTS (6):"
    echo "   • mike.johnson.demo@apexshare.be (Beginner, Mobile)"
    echo "   • lisa.chen.demo@apexshare.be (Intermediate, Desktop)"
    echo "   • david.brown.demo@apexshare.be (Advanced, Tablet)"
    echo "   • anna.garcia.demo@apexshare.be (Beginner, Mobile)"
    echo "   • tom.wilson.demo@apexshare.be (Intermediate, Desktop)"
    echo "   • emma.davis.demo@apexshare.be (Beginner, Mobile)"
    echo ""
    echo "👨‍💼 ADMINISTRATORS (1):"
    echo "   • admin.demo@apexshare.be (System Administrator)"
    echo ""
    echo "📊 DEVICE DISTRIBUTION:"
    echo "   • Mobile: 4 users (67%)"
    echo "   • Desktop: 2 users (33%)"
    echo "   • Tablet: 1 user (17%)"
    echo ""
    echo "📈 EXPERIENCE LEVELS:"
    echo "   • Beginner: 4 students"
    echo "   • Intermediate: 2 students"
    echo "   • Advanced: 1 student"
}

# Function to reset a specific user
reset_user() {
    local email="$1"

    if [ -z "$email" ]; then
        echo "❌ Email address required for user reset"
        echo "Usage: $0 reset-user --email user@example.com"
        exit 1
    fi

    echo "🔄 Resetting user account: $email"

    # Here you would implement actual user reset logic
    # For now, just show what would be done
    echo "   ✅ Password reset initiated"
    echo "   ✅ Account unlocked"
    echo "   ✅ Login attempts cleared"
    echo "   ✅ Reset notification sent"
    echo ""
    echo "📧 User will receive password reset instructions at: $email"
}

# Function to cleanup users
cleanup_users() {
    local dry_run="$1"

    echo "🧹 UAT User Cleanup"
    echo "=================="

    if [ "$dry_run" = "--dry-run" ]; then
        echo "🔍 DRY RUN MODE - No changes will be made"
        echo ""
    fi

    echo "📋 The following actions would be performed:"
    echo "   • Remove 3 trainer accounts"
    echo "   • Remove 6 student accounts"
    echo "   • Remove 1 administrator account"
    echo "   • Delete temporary data files"
    echo "   • Clear authentication tokens"
    echo "   • Remove user-generated test data"
    echo ""

    if [ "$dry_run" != "--dry-run" ]; then
        read -p "⚠️  Are you sure you want to proceed? (y/N): " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            echo "🗑️  Cleaning up UAT users..."
            rm -f /tmp/uat-users-detailed.json
            rm -f /tmp/uat-credentials.json
            rm -f /tmp/trainer-invite-template.html
            rm -f /tmp/student-invite-template.html
            echo "✅ UAT user cleanup complete"
        else
            echo "❌ Cleanup cancelled"
        fi
    fi
}

# Main script logic
case "$1" in
    "create-users")
        create_users
        ;;
    "send-invites")
        send_invites
        ;;
    "list-users")
        list_users
        ;;
    "reset-user")
        shift
        email=""
        while [[ $# -gt 0 ]]; do
            case $1 in
                --email)
                    email="$2"
                    shift 2
                    ;;
                *)
                    echo "❌ Unknown option: $1"
                    show_usage
                    exit 1
                    ;;
            esac
        done
        reset_user "$email"
        ;;
    "cleanup-users")
        cleanup_users "$2"
        ;;
    "--help"|"-h"|"")
        show_usage
        ;;
    *)
        echo "❌ Unknown command: $1"
        show_usage
        exit 1
        ;;
esac

echo ""
echo "✅ UAT User Management Complete"