# ApexShare UAT Phase 1 - Quick Reference Guide

## 🚀 What's Working Now

### ✅ Email Service
- **Domain:** apexshare.be (pending verification)
- **Quota:** 50,000 emails/day
- **Test Emails:** UAT test addresses configured
- **Status:** Ready for email notifications testing

### ✅ DNS Management
- **Route 53:** Fully operational
- **Records:** All DNS records configured
- **Nameservers:** Ready for domain registrar configuration

### ✅ SSL Certificates
- **Certificates:** Created for apexshare.be domains
- **Status:** Pending domain validation
- **Coverage:** Main domain, www, and wildcard

### ✅ Monitoring
- **Dashboard:** ApexShare-UAT-Basic-Monitoring
- **Metrics:** Email delivery tracking
- **Access:** CloudWatch console

---

## ⚠️ What Needs Attention

### 🔧 Critical Configuration Required
1. **Domain Nameservers** - Configure at registrar
2. **Storage Infrastructure** - Deploy simplified version
3. **API Services** - Deploy basic functionality

### 📋 Route 53 Nameservers
Configure these at your domain registrar for apexshare.be:
```
ns-993.awsdns-60.net
ns-1062.awsdns-04.org
ns-432.awsdns-54.com
ns-1934.awsdns-49.co.uk
```

---

## 🧪 UAT Test Users

### Test Email Addresses (configured in SES)
**Trainers:**
- john.smith.demo@apexshare.be
- sarah.wilson.demo@apexshare.be

**Students:**
- mike.johnson.demo@apexshare.be
- lisa.chen.demo@apexshare.be
- david.brown.demo@apexshare.be

*Note: These require domain verification to be functional*

---

## 🛠️ Quick Commands

### Check Infrastructure Status
```bash
# List CloudFormation stacks
aws cloudformation list-stacks --query 'StackSummaries[?contains(StackName, `ApexShare`)].{Name:StackName,Status:StackStatus}' --output table

# Check SES domain status
aws ses get-identity-verification-attributes --identities apexshare.be --region eu-west-1

# Check SSL certificate status
aws acm list-certificates --region eu-west-1 --query 'CertificateSummaryList[?contains(DomainName, `apexshare`)].{Domain:DomainName,Status:Status}' --output table
```

### Monitor Services
```bash
# View CloudWatch dashboard
aws cloudwatch get-dashboard --dashboard-name "ApexShare-UAT-Basic-Monitoring" --region eu-west-1

# Check SES send quota
aws ses get-send-quota --region eu-west-1
```

---

## 📞 Support Resources

### AWS Console Access
- **CloudWatch Dashboards:** Monitor email delivery
- **SES Console:** Manage email service
- **Route 53 Console:** DNS management
- **ACM Console:** SSL certificate status

### Documentation
- **Full Report:** UAT_PHASE_1_REPORT.md
- **User Guides:** docs/ directory
- **API Documentation:** Available after API deployment

---

## 🎯 Next Steps Priority

### High Priority (Immediate)
1. Configure domain nameservers
2. Deploy simplified storage stack
3. Create basic API endpoints

### Medium Priority (1-3 days)
1. Complete SSL certificate validation
2. Verify SES domain verification
3. Test email delivery end-to-end

### Low Priority (1-7 days)
1. Set up user accounts
2. Prepare UAT testing scenarios
3. Document testing procedures

---

## 🔍 Troubleshooting

### Common Issues
1. **Domain not resolving:** Check nameserver configuration
2. **SSL certificates pending:** Verify DNS propagation
3. **Email not sending:** Check SES domain verification
4. **Dashboard not loading:** Verify CloudWatch permissions

### Quick Fixes
- **DNS Issues:** Wait 2-48 hours for propagation
- **SES Issues:** Verify domain verification records
- **SSL Issues:** Check certificate validation records
- **Monitoring Issues:** Refresh CloudWatch console

---

*ApexShare UAT Quick Reference*
*Updated: September 20, 2025*
*Phase 1 Status: Foundation Ready*