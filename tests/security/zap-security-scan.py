#!/usr/bin/env python3
"""
OWASP ZAP Security Testing Script for ApexShare
Performs automated security scanning of the ApexShare application
"""

import time
import json
import sys
import os
from datetime import datetime
from zapv2 import ZAPv2

# Configuration
ZAP_PROXY_HOST = 'localhost'
ZAP_PROXY_PORT = 8080
TARGET_URL = os.getenv('TARGET_URL', 'https://apexshare.be')
API_URL = os.getenv('API_URL', 'https://api.apexshare.be')
REPORT_OUTPUT_DIR = os.getenv('REPORT_OUTPUT_DIR', './security-reports')

# Security scan configuration
SCAN_CONFIG = {
    'spider_max_depth': 5,
    'spider_max_children': 10,
    'active_scan_policy': 'Default Policy',
    'auth_method': None,  # No authentication required for public endpoints
    'excluded_urls': [
        # Exclude admin or sensitive endpoints if any
        '/admin/',
        '/internal/'
    ],
    'included_urls': [
        f'{TARGET_URL}/*',
        f'{API_URL}/*'
    ]
}

class ApexShareSecurityScanner:
    def __init__(self):
        self.zap = ZAPv2(proxies={'http': f'http://{ZAP_PROXY_HOST}:{ZAP_PROXY_PORT}',
                                 'https': f'http://{ZAP_PROXY_HOST}:{ZAP_PROXY_PORT}'})
        self.scan_id = None
        self.results = {
            'scan_info': {},
            'spider_results': {},
            'active_scan_results': {},
            'vulnerability_summary': {},
            'recommendations': []
        }

    def check_zap_connection(self):
        """Verify ZAP is running and accessible"""
        try:
            version = self.zap.core.version
            print(f"✓ Connected to OWASP ZAP version: {version}")
            return True
        except Exception as e:
            print(f"✗ Error connecting to ZAP: {e}")
            print("Please ensure OWASP ZAP is running on localhost:8080")
            return False

    def configure_zap(self):
        """Configure ZAP for ApexShare testing"""
        print("Configuring ZAP for ApexShare security testing...")

        # Set context for ApexShare
        context_name = "ApexShare"
        try:
            # Create or get context
            context_id = self.zap.context.new_context(context_name)
            print(f"✓ Created context: {context_name} (ID: {context_id})")

            # Include target URLs in context
            for url in SCAN_CONFIG['included_urls']:
                self.zap.context.include_in_context(context_name, url)
                print(f"✓ Included in context: {url}")

            # Exclude sensitive URLs
            for url in SCAN_CONFIG['excluded_urls']:
                self.zap.context.exclude_from_context(context_name, url)
                print(f"✓ Excluded from context: {url}")

            # Configure API scanning
            self.configure_api_scanning()

            return context_id

        except Exception as e:
            print(f"✗ Error configuring ZAP: {e}")
            return None

    def configure_api_scanning(self):
        """Configure specific settings for API endpoint scanning"""
        print("Configuring API scanning settings...")

        # Add custom headers for API requests
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'OWASP-ZAP-Security-Scanner',
            'Accept': 'application/json'
        }

        for header_name, header_value in headers.items():
            self.zap.replacer.add_rule(
                description=f"Add {header_name} header",
                enabled=True,
                matchtype='REQ_HEADER',
                matchstring=header_name,
                replacement=header_value
            )

    def spider_scan(self, target_url):
        """Perform spider scan to discover endpoints"""
        print(f"Starting spider scan on: {target_url}")

        # Start spider scan
        self.scan_id = self.zap.spider.scan(target_url,
                                           maxchildren=SCAN_CONFIG['spider_max_children'],
                                           recurse=True,
                                           subtreeonly=True)

        print(f"Spider scan started with ID: {self.scan_id}")

        # Wait for spider to complete
        while int(self.zap.spider.status(self.scan_id)) < 100:
            progress = self.zap.spider.status(self.scan_id)
            print(f"Spider progress: {progress}%")
            time.sleep(5)

        print("✓ Spider scan completed")

        # Get spider results
        spider_results = self.zap.spider.results(self.scan_id)
        self.results['spider_results'] = {
            'urls_found': len(spider_results),
            'urls': spider_results
        }

        print(f"Spider found {len(spider_results)} URLs")
        return spider_results

    def active_scan(self, target_url):
        """Perform active security scan"""
        print(f"Starting active scan on: {target_url}")

        # Start active scan
        scan_id = self.zap.ascan.scan(target_url,
                                     recurse=True,
                                     inscopeonly=True,
                                     scanpolicyname=SCAN_CONFIG['active_scan_policy'])

        print(f"Active scan started with ID: {scan_id}")

        # Wait for active scan to complete
        while int(self.zap.ascan.status(scan_id)) < 100:
            progress = self.zap.ascan.status(scan_id)
            print(f"Active scan progress: {progress}%")
            time.sleep(10)

        print("✓ Active scan completed")

        # Get scan results
        alerts = self.zap.core.alerts(baseurl=target_url)
        self.results['active_scan_results'] = {
            'scan_id': scan_id,
            'alerts_count': len(alerts),
            'alerts': alerts
        }

        return alerts

    def test_specific_vulnerabilities(self):
        """Test for specific vulnerabilities relevant to ApexShare"""
        print("Testing for ApexShare-specific vulnerabilities...")

        vulnerabilities_tested = []

        # Test 1: API Security
        vulnerabilities_tested.extend(self.test_api_security())

        # Test 2: File Upload Security
        vulnerabilities_tested.extend(self.test_file_upload_security())

        # Test 3: Authentication/Authorization
        vulnerabilities_tested.extend(self.test_auth_security())

        # Test 4: Input Validation
        vulnerabilities_tested.extend(self.test_input_validation())

        # Test 5: CORS Configuration
        vulnerabilities_tested.extend(self.test_cors_security())

        return vulnerabilities_tested

    def test_api_security(self):
        """Test API-specific security vulnerabilities"""
        print("Testing API security...")
        tests = []

        # Test for SQL injection in API parameters
        injection_payloads = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "' UNION SELECT * FROM information_schema.tables --"
        ]

        for payload in injection_payloads:
            test_data = {
                'studentEmail': f'test{payload}@example.com',
                'fileName': f'test{payload}.mp4',
                'fileSize': 1024,
                'contentType': 'video/mp4',
                'sessionDate': '2025-01-20'
            }

            # Test upload endpoint
            response = self.test_api_endpoint('POST', f'{API_URL}/upload', test_data)
            tests.append({
                'test': 'SQL Injection in Upload API',
                'payload': payload,
                'response_code': response.get('status_code', 'N/A'),
                'vulnerable': response.get('status_code') == 200
            })

        # Test for NoSQL injection
        nosql_payloads = [
            '{"$ne": null}',
            '{"$gt": ""}',
            '{"$where": "function() { return true; }"}'
        ]

        for payload in nosql_payloads:
            response = self.test_api_endpoint('GET', f'{API_URL}/download/{payload}')
            tests.append({
                'test': 'NoSQL Injection in Download API',
                'payload': payload,
                'response_code': response.get('status_code', 'N/A'),
                'vulnerable': response.get('status_code') == 200
            })

        return tests

    def test_file_upload_security(self):
        """Test file upload security vulnerabilities"""
        print("Testing file upload security...")
        tests = []

        # Test malicious file types
        malicious_files = [
            {'name': 'malicious.php', 'type': 'application/x-php'},
            {'name': 'script.js', 'type': 'application/javascript'},
            {'name': 'executable.exe', 'type': 'application/x-msdownload'},
            {'name': 'large_file.mp4', 'size': 10 * 1024 * 1024 * 1024}  # 10GB
        ]

        for file_info in malicious_files:
            test_data = {
                'studentEmail': 'security-test@example.com',
                'fileName': file_info['name'],
                'fileSize': file_info.get('size', 1024),
                'contentType': file_info.get('type', 'video/mp4'),
                'sessionDate': '2025-01-20'
            }

            response = self.test_api_endpoint('POST', f'{API_URL}/upload', test_data)
            tests.append({
                'test': f'Malicious File Upload - {file_info["name"]}',
                'file_type': file_info.get('type', 'unknown'),
                'response_code': response.get('status_code', 'N/A'),
                'rejected': response.get('status_code') == 400
            })

        return tests

    def test_auth_security(self):
        """Test authentication and authorization vulnerabilities"""
        print("Testing authentication/authorization security...")
        tests = []

        # Test unauthorized access to download endpoints
        test_file_ids = [
            'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            '../../../etc/passwd',
            'admin',
            'null',
            '1'
        ]

        for file_id in test_file_ids:
            response = self.test_api_endpoint('GET', f'{API_URL}/download/{file_id}')
            tests.append({
                'test': f'Unauthorized Access Test - {file_id}',
                'file_id': file_id,
                'response_code': response.get('status_code', 'N/A'),
                'properly_protected': response.get('status_code') in [404, 410, 403]
            })

        return tests

    def test_input_validation(self):
        """Test input validation vulnerabilities"""
        print("Testing input validation...")
        tests = []

        # Test XSS payloads
        xss_payloads = [
            '<script>alert("XSS")</script>',
            'javascript:alert("XSS")',
            '"><script>alert("XSS")</script>',
            'onload="alert(\'XSS\')"'
        ]

        for payload in xss_payloads:
            test_data = {
                'studentEmail': 'test@example.com',
                'studentName': payload,
                'trainerName': payload,
                'notes': payload,
                'fileName': 'test.mp4',
                'fileSize': 1024,
                'contentType': 'video/mp4',
                'sessionDate': '2025-01-20'
            }

            response = self.test_api_endpoint('POST', f'{API_URL}/upload', test_data)
            tests.append({
                'test': 'XSS Input Validation',
                'payload': payload,
                'response_code': response.get('status_code', 'N/A'),
                'properly_sanitized': response.get('status_code') == 400
            })

        return tests

    def test_cors_security(self):
        """Test CORS configuration security"""
        print("Testing CORS security...")
        tests = []

        # Test CORS with various origins
        malicious_origins = [
            'https://evil.com',
            'http://localhost:3000',
            'null',
            '*'
        ]

        for origin in malicious_origins:
            headers = {
                'Origin': origin,
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }

            response = self.test_api_endpoint('OPTIONS', f'{API_URL}/upload', headers=headers)
            tests.append({
                'test': f'CORS Origin Test - {origin}',
                'origin': origin,
                'response_code': response.get('status_code', 'N/A'),
                'allows_origin': 'access-control-allow-origin' in response.get('headers', {})
            })

        return tests

    def test_api_endpoint(self, method, url, data=None, headers=None):
        """Helper method to test API endpoints"""
        try:
            # Use ZAP to make the request
            if method == 'GET':
                self.zap.core.access_url(url)
            elif method == 'POST':
                # Convert data to JSON if provided
                json_data = json.dumps(data) if data else ''
                self.zap.core.send_request(f"""POST {url} HTTP/1.1
Host: {url.split('/')[2]}
Content-Type: application/json
Content-Length: {len(json_data)}

{json_data}""")
            elif method == 'OPTIONS':
                header_string = '\n'.join([f'{k}: {v}' for k, v in (headers or {}).items()])
                self.zap.core.send_request(f"""OPTIONS {url} HTTP/1.1
Host: {url.split('/')[2]}
{header_string}

""")

            # Get the last response
            messages = self.zap.core.messages()
            if messages:
                last_message = messages[-1]
                return {
                    'status_code': int(last_message.get('responseHeader', '').split()[1]),
                    'headers': {},  # Would need to parse response headers
                    'body': last_message.get('responseBody', '')
                }

        except Exception as e:
            print(f"Error testing endpoint {url}: {e}")

        return {'status_code': 'ERROR', 'headers': {}, 'body': ''}

    def analyze_results(self):
        """Analyze scan results and generate recommendations"""
        print("Analyzing security scan results...")

        alerts = self.results['active_scan_results'].get('alerts', [])

        # Categorize vulnerabilities by risk level
        risk_summary = {
            'High': [],
            'Medium': [],
            'Low': [],
            'Informational': []
        }

        for alert in alerts:
            risk_level = alert.get('risk', 'Informational')
            risk_summary[risk_level].append(alert)

        self.results['vulnerability_summary'] = {
            'total_vulnerabilities': len(alerts),
            'high_risk': len(risk_summary['High']),
            'medium_risk': len(risk_summary['Medium']),
            'low_risk': len(risk_summary['Low']),
            'informational': len(risk_summary['Informational']),
            'by_category': risk_summary
        }

        # Generate recommendations
        recommendations = []

        if risk_summary['High']:
            recommendations.append({
                'priority': 'CRITICAL',
                'issue': f"{len(risk_summary['High'])} high-risk vulnerabilities found",
                'action': 'Immediate remediation required before production deployment'
            })

        if risk_summary['Medium']:
            recommendations.append({
                'priority': 'HIGH',
                'issue': f"{len(risk_summary['Medium'])} medium-risk vulnerabilities found",
                'action': 'Plan remediation within current sprint'
            })

        # Check for common issues
        alert_names = [alert.get('alert', '') for alert in alerts]

        if any('Cross Site Scripting' in name for name in alert_names):
            recommendations.append({
                'priority': 'HIGH',
                'issue': 'XSS vulnerabilities detected',
                'action': 'Implement proper input validation and output encoding'
            })

        if any('SQL Injection' in name for name in alert_names):
            recommendations.append({
                'priority': 'CRITICAL',
                'issue': 'SQL injection vulnerabilities detected',
                'action': 'Use parameterized queries and input validation'
            })

        if not recommendations:
            recommendations.append({
                'priority': 'INFO',
                'issue': 'No critical security issues found',
                'action': 'Continue regular security testing and monitoring'
            })

        self.results['recommendations'] = recommendations

    def generate_report(self):
        """Generate comprehensive security report"""
        print("Generating security report...")

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        # Create reports directory
        os.makedirs(REPORT_OUTPUT_DIR, exist_ok=True)

        # Generate JSON report
        json_report_path = f"{REPORT_OUTPUT_DIR}/security_report_{timestamp}.json"
        with open(json_report_path, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)

        # Generate HTML report
        html_report_path = f"{REPORT_OUTPUT_DIR}/security_report_{timestamp}.html"
        self.generate_html_report(html_report_path)

        # Generate summary report
        summary_path = f"{REPORT_OUTPUT_DIR}/security_summary_{timestamp}.txt"
        self.generate_summary_report(summary_path)

        print(f"✓ Security reports generated:")
        print(f"  - JSON: {json_report_path}")
        print(f"  - HTML: {html_report_path}")
        print(f"  - Summary: {summary_path}")

        return {
            'json_report': json_report_path,
            'html_report': html_report_path,
            'summary_report': summary_path
        }

    def generate_html_report(self, output_path):
        """Generate HTML security report"""
        vulnerability_summary = self.results['vulnerability_summary']

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>ApexShare Security Scan Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background: #2c3e50; color: white; padding: 20px; text-align: center; }}
        .summary {{ background: #ecf0f1; padding: 15px; margin: 20px 0; }}
        .risk-high {{ color: #e74c3c; font-weight: bold; }}
        .risk-medium {{ color: #f39c12; font-weight: bold; }}
        .risk-low {{ color: #f1c40f; }}
        .risk-info {{ color: #3498db; }}
        .recommendation {{ background: #e8f5e8; padding: 10px; margin: 10px 0; border-left: 4px solid #27ae60; }}
        .vulnerability {{ background: #fff; border: 1px solid #ddd; padding: 15px; margin: 10px 0; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>ApexShare Security Scan Report</h1>
        <p>Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
    </div>

    <div class="summary">
        <h2>Executive Summary</h2>
        <p>Total Vulnerabilities Found: <strong>{vulnerability_summary['total_vulnerabilities']}</strong></p>
        <ul>
            <li class="risk-high">High Risk: {vulnerability_summary['high_risk']}</li>
            <li class="risk-medium">Medium Risk: {vulnerability_summary['medium_risk']}</li>
            <li class="risk-low">Low Risk: {vulnerability_summary['low_risk']}</li>
            <li class="risk-info">Informational: {vulnerability_summary['informational']}</li>
        </ul>
    </div>

    <div class="recommendations">
        <h2>Recommendations</h2>
        {''.join([f'<div class="recommendation"><strong>{rec["priority"]}</strong>: {rec["issue"]} - {rec["action"]}</div>' for rec in self.results['recommendations']])}
    </div>

    <div class="vulnerabilities">
        <h2>Detailed Vulnerabilities</h2>
        {''.join([f'<div class="vulnerability"><h3 class="risk-{alert.get("risk", "info").lower()}">{alert.get("alert", "Unknown")}</h3><p><strong>Risk:</strong> {alert.get("risk", "Unknown")}</p><p><strong>Description:</strong> {alert.get("desc", "No description")}</p><p><strong>URL:</strong> {alert.get("url", "Unknown")}</p></div>' for alert in self.results['active_scan_results'].get('alerts', [])])}
    </div>
</body>
</html>
        """

        with open(output_path, 'w') as f:
            f.write(html_content)

    def generate_summary_report(self, output_path):
        """Generate text summary report"""
        vulnerability_summary = self.results['vulnerability_summary']

        with open(output_path, 'w') as f:
            f.write("APEXSHARE SECURITY SCAN SUMMARY\n")
            f.write("=" * 50 + "\n\n")
            f.write(f"Scan Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Target: {TARGET_URL}\n")
            f.write(f"API: {API_URL}\n\n")

            f.write("VULNERABILITY SUMMARY:\n")
            f.write(f"  Total: {vulnerability_summary['total_vulnerabilities']}\n")
            f.write(f"  High Risk: {vulnerability_summary['high_risk']}\n")
            f.write(f"  Medium Risk: {vulnerability_summary['medium_risk']}\n")
            f.write(f"  Low Risk: {vulnerability_summary['low_risk']}\n")
            f.write(f"  Informational: {vulnerability_summary['informational']}\n\n")

            f.write("RECOMMENDATIONS:\n")
            for i, rec in enumerate(self.results['recommendations'], 1):
                f.write(f"  {i}. [{rec['priority']}] {rec['issue']}\n")
                f.write(f"     Action: {rec['action']}\n\n")

    def run_full_scan(self):
        """Run complete security assessment"""
        print("Starting comprehensive ApexShare security assessment...")

        self.results['scan_info'] = {
            'target_url': TARGET_URL,
            'api_url': API_URL,
            'start_time': datetime.now().isoformat(),
            'zap_version': self.zap.core.version
        }

        # Check ZAP connection
        if not self.check_zap_connection():
            return False

        # Configure ZAP
        context_id = self.configure_zap()
        if not context_id:
            return False

        # Run spider scan
        self.spider_scan(TARGET_URL)
        self.spider_scan(API_URL)

        # Run active scan
        self.active_scan(TARGET_URL)
        self.active_scan(API_URL)

        # Run specific vulnerability tests
        specific_tests = self.test_specific_vulnerabilities()
        self.results['specific_tests'] = specific_tests

        # Analyze results
        self.analyze_results()

        # Add scan completion info
        self.results['scan_info']['end_time'] = datetime.now().isoformat()

        # Generate reports
        report_paths = self.generate_report()

        print("\n" + "=" * 50)
        print("SECURITY SCAN COMPLETED")
        print("=" * 50)
        print(f"Total vulnerabilities: {self.results['vulnerability_summary']['total_vulnerabilities']}")
        print(f"High risk: {self.results['vulnerability_summary']['high_risk']}")
        print(f"Medium risk: {self.results['vulnerability_summary']['medium_risk']}")
        print("=" * 50)

        return True

def main():
    """Main execution function"""
    if len(sys.argv) > 1:
        if sys.argv[1] == '--help':
            print("ApexShare Security Scanner")
            print("Usage: python zap-security-scan.py [options]")
            print("Environment variables:")
            print("  TARGET_URL: Frontend URL (default: https://apexshare.be)")
            print("  API_URL: API URL (default: https://api.apexshare.be)")
            print("  REPORT_OUTPUT_DIR: Report directory (default: ./security-reports)")
            return

    scanner = ApexShareSecurityScanner()
    success = scanner.run_full_scan()

    if success:
        print("Security scan completed successfully!")
        sys.exit(0)
    else:
        print("Security scan failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()