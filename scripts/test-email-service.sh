#!/bin/bash

# ApexShare Email Service Test Script
# This script tests the SES configuration and email delivery

set -e

REGION="eu-west-1"
DOMAIN="apexshare.be"
FROM_EMAIL="no-reply@apexshare.be"

echo "🔍 Testing ApexShare Email Service"
echo "================================="

# Check domain verification status
echo -n "📧 Checking domain verification status... "
DOMAIN_STATUS=$(aws ses get-identity-verification-attributes --identities $DOMAIN --region $REGION --query "VerificationAttributes.\"$DOMAIN\".VerificationStatus" --output text)
echo "$DOMAIN_STATUS"

if [ "$DOMAIN_STATUS" != "Success" ]; then
    echo "❌ Domain verification not complete. Current status: $DOMAIN_STATUS"
    echo "   Please wait for DNS propagation (up to 24 hours)"
    exit 1
fi

# Check DKIM verification status
echo -n "🔐 Checking DKIM verification status... "
DKIM_STATUS=$(aws ses get-identity-dkim-attributes --identities $DOMAIN --region $REGION --query "DkimAttributes.\"$DOMAIN\".DkimVerificationStatus" --output text)
echo "$DKIM_STATUS"

if [ "$DKIM_STATUS" != "Success" ]; then
    echo "❌ DKIM verification not complete. Current status: $DKIM_STATUS"
    echo "   Please check DKIM CNAME records in Route 53"
    exit 1
fi

# Check SES sending quota
echo "📊 Checking SES sending limits..."
aws ses get-send-quota --region $REGION

# Check if we're in sandbox mode
SANDBOX_STATUS=$(aws ses get-send-quota --region $REGION --query "Max24HourSend == \`200.0\`")
if [ "$SANDBOX_STATUS" = "true" ]; then
    echo "⚠️  SES is in sandbox mode - emails can only be sent to verified addresses"
    echo "   Request production access to send to any email address"
fi

# Test email sending (replace with your verified email address)
read -p "Enter a verified email address to test with: " TEST_EMAIL

if [ -z "$TEST_EMAIL" ]; then
    echo "❌ No email address provided. Skipping email test."
    exit 0
fi

echo "📮 Sending test email to $TEST_EMAIL..."

SUBJECT="ApexShare Email Service Test"
BODY_TEXT="This is a test email from the ApexShare email service. If you receive this, the email configuration is working correctly!"
BODY_HTML="<html><body><h2>ApexShare Email Test</h2><p>This is a test email from the ApexShare email service.</p><p>If you receive this, the email configuration is working correctly!</p><p><strong>Sent from:</strong> $FROM_EMAIL</p></body></html>"

aws ses send-email \
    --source "$FROM_EMAIL" \
    --destination "ToAddresses=$TEST_EMAIL" \
    --message "Subject={Data=\"$SUBJECT\"},Body={Text={Data=\"$BODY_TEXT\"},Html={Data=\"$BODY_HTML\"}}" \
    --configuration-set-name "apexshare-emails-prod" \
    --region $REGION

if [ $? -eq 0 ]; then
    echo "✅ Test email sent successfully!"
    echo "   Check the recipient's inbox (and spam folder)"
    echo "   Monitor CloudWatch metrics for delivery confirmation"
else
    echo "❌ Failed to send test email"
    exit 1
fi

echo ""
echo "🎉 Email service test completed!"
echo "   Domain: $DOMAIN"
echo "   From: $FROM_EMAIL"
echo "   Configuration Set: apexshare-emails-prod"
echo ""
echo "💡 Next steps:"
echo "   1. Monitor CloudWatch metrics for email delivery"
echo "   2. Test the full upload → email workflow"
echo "   3. Request SES production access if in sandbox mode"