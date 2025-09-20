# DNS Delegation Guide for ApexShare Production Environment

**Date:** September 20, 2025
**Environment:** Production UAT
**Domain:** apexshare.be
**Status:** REQUIRED - Final step to activate production environment

---

## Overview

DNS delegation is the final step required to complete the ApexShare production environment setup. All AWS infrastructure is deployed and configured, but the domain nameservers need to be updated at the domain registrar to point to AWS Route 53.

**Current Status:** Infrastructure foundation complete, DNS delegation pending

---

## Required Nameserver Configuration

### AWS Route 53 Nameservers (to be configured at registrar)

The domain **apexshare.be** must be configured with these exact nameservers:

```
ns-1749.awsdns-26.co.uk
ns-462.awsdns-57.com
ns-953.awsdns-55.net
ns-1397.awsdns-46.org
```

### Hosted Zone Information
- **Route 53 Hosted Zone ID:** Z01849761J5PCHN8DJA44
- **Domain:** apexshare.be
- **DNS Records Configured:** 15 records
- **Status:** Ready for delegation

---

## Step-by-Step DNS Delegation Process

### Step 1: Access Domain Registrar Control Panel
1. Log into your domain registrar's control panel
2. Navigate to DNS management for **apexshare.be**
3. Look for "Nameservers" or "DNS Settings" section

### Step 2: Update Nameservers
Replace any existing nameservers with these AWS Route 53 nameservers:

**Primary Nameserver:** `ns-1749.awsdns-26.co.uk`
**Secondary Nameserver:** `ns-462.awsdns-57.com`
**Tertiary Nameserver:** `ns-953.awsdns-55.net`
**Quaternary Nameserver:** `ns-1397.awsdns-46.org`

### Step 3: Save Configuration
1. Save the nameserver changes at your registrar
2. Note: Changes may take 5-30 minutes to propagate
3. Some registrars may show a 24-48 hour estimate (typically much faster)

### Step 4: Verify DNS Propagation
Use these commands to verify DNS delegation:

```bash
# Check nameserver delegation
dig NS apexshare.be

# Check if Route 53 is responding
dig apexshare.be @ns-1749.awsdns-26.co.uk

# Verify SES verification record
dig TXT _amazonses.apexshare.be
```

---

## What Happens After DNS Delegation

### Automatic Service Activation (5-30 minutes after delegation)

1. **SES Domain Verification**
   - Domain verification record automatically validates
   - Email sending capabilities fully activated
   - DKIM authentication becomes operational

2. **SSL Certificate Validation**
   - ACM certificates automatically validate via DNS
   - HTTPS becomes available for all ApexShare domains
   - SSL/TLS encryption fully operational

3. **Complete Production Environment**
   - All AWS services become fully operational
   - Infrastructure health reaches 100%
   - Ready to proceed to UAT Phase 2

### Services That Become Active

- **Email Service (SES):** Domain verified, ready for production email sending
- **SSL Certificates:** Fully validated, HTTPS enabled
- **Domain Resolution:** apexshare.be resolves to AWS infrastructure
- **Subdomain Access:** All configured subdomains become accessible

---

## DNS Records Currently Configured

The following DNS records are already configured in Route 53 and will become active after delegation:

### Domain Verification Records
- **SES Domain Verification:** TXT record for Amazon SES
- **DKIM Authentication:** 3 CNAME records for email authentication
- **SPF Record:** TXT record for email sender verification
- **DMARC Policy:** TXT record for email security policy

### SSL Certificate Validation Records
- **ACM Validation:** CNAME records for certificate validation
- **Wildcard Certificate:** Validation for *.apexshare.be
- **Root Domain Certificate:** Validation for apexshare.be

### Infrastructure Records
- **Root Domain:** A record (when frontend is deployed)
- **Subdomain Configuration:** CNAME records for services
- **Email Configuration:** MX records (if needed for custom email)

---

## Verification Steps After Delegation

### 1. DNS Resolution Test
```bash
# Should return AWS nameservers
dig NS apexshare.be

# Should return Route 53 response
nslookup apexshare.be
```

### 2. SES Domain Verification Check
1. Log into AWS Console
2. Navigate to Amazon SES
3. Check "Verified identities"
4. Confirm apexshare.be shows "Verified" status

### 3. SSL Certificate Status Check
1. Log into AWS Console
2. Navigate to Certificate Manager (ACM)
3. Check certificate status for apexshare.be domains
4. Confirm status shows "Issued"

### 4. Email Service Test
After verification completes:
```bash
# Test email sending capability
aws ses send-email --destination ToAddresses=test@example.com \
  --message Subject={Data="Test"},Body={Text={Data="Test email"}} \
  --source noreply@apexshare.be
```

---

## Expected Timeline

### Immediate (0-5 minutes)
- Nameserver changes saved at registrar
- DNS propagation begins

### Short-term (5-30 minutes)
- DNS delegation propagates globally
- SES domain verification completes automatically
- SSL certificates validate automatically
- All services become operational

### Complete (30 minutes - 2 hours)
- Global DNS propagation complete
- All caching systems updated
- Production environment fully operational

---

## Troubleshooting Common Issues

### Issue: DNS Changes Not Propagating
**Solution:**
- Check TTL values at registrar (some have 24-hour TTL)
- Try flushing local DNS cache
- Test from different networks/locations

### Issue: SES Domain Still Pending
**Solution:**
- Verify DNS propagation completed first
- Check Route 53 for TXT record presence
- Wait up to 72 hours for Amazon to verify

### Issue: SSL Certificates Not Validating
**Solution:**
- Ensure DNS delegation is complete
- Verify CNAME validation records in Route 53
- ACM validation can take up to 30 minutes after DNS

### Issue: Services Still Not Accessible
**Solution:**
- Confirm all 4 nameservers are configured correctly
- Verify no typos in nameserver entries
- Check registrar for any additional DNS settings

---

## Post-Delegation Next Steps

### Immediate Actions After DNS Delegation
1. **Verify Infrastructure Health:** Check all services show 100% operational
2. **Test Email Delivery:** Send test emails to confirm SES functionality
3. **Validate SSL Access:** Confirm HTTPS access works for all domains
4. **Update Documentation:** Record completion of DNS delegation

### Proceed to UAT Phase 2
Once DNS delegation is complete and verified:
1. **UAT Phase 2: Pilot User Group** can begin immediately
2. Real user testing with full production environment
3. Complete end-to-end workflow validation
4. Performance and scalability testing

---

## Support and Contacts

### DNS Issues
- **Domain Registrar Support:** Contact registrar for nameserver configuration help
- **Propagation Checking:** Use online DNS propagation checkers
- **AWS Route 53 Support:** AWS Console support for hosted zone issues

### AWS Service Issues
- **SES Support:** Amazon SES console for email service issues
- **ACM Support:** Certificate Manager console for SSL issues
- **General AWS:** AWS Support Center for infrastructure questions

### Critical Contact Information
- **Technical Lead:** Available for DNS delegation coordination
- **AWS Account:** Production account access for verification
- **Domain Registrar:** Account credentials for nameserver updates

---

## Security Considerations

### DNS Security
- Verify nameserver changes are made by authorized personnel only
- Document all DNS changes for audit trail
- Monitor for any unauthorized DNS modifications

### Service Security
- SES domain verification ensures email authenticity
- SSL certificates provide encryption in transit
- Route 53 DNSSEC can be enabled for additional security

---

## Conclusion

DNS delegation is the final critical step to activate the complete ApexShare production environment. All infrastructure is deployed and ready - only nameserver configuration at the registrar level is required.

**Expected Result:** Within 30 minutes of nameserver configuration, all AWS services will be fully operational and UAT Phase 2 can begin.

**Critical Success Factor:** Accurate configuration of all 4 nameservers exactly as specified above.

---

*DNS Delegation Guide for ApexShare*
*Generated: September 20, 2025*
*Status: DNS Delegation Required to Complete Production Environment*