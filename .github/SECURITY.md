# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | ✅ Supported       |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in FinFlow, please **do not** open a public GitHub issue.

Instead, report via email to: **security@finflow.app**

You should receive a response within 48 hours. If not, please follow up.

**Please include:**
- Description of the vulnerability
- Steps to reproduce
- Affected version(s)
- Potential impact

## Disclosure Policy

When a vulnerability is reported, we:
1. Acknowledge receipt within 48 hours
2. Validate the issue within 5 business days
3. Release a fix within 14 days (depending on severity)
4. Publicly disclose after the fix is deployed

## Security Practices

- All database queries use parameterized statements
- JWT tokens are signed and validated with algorithm checking
- Webhooks are verified via HMAC-SHA256 with constant-time comparison
- Rate limiting is enforced on all endpoints
- Security headers (HSTS, CSP, XFO, etc.) are set on all responses
- Containers run as non-root users
- Multi-stage builds minimize attack surface
- CI pipeline includes SAST (CodeQL), container scanning (Trivy), and secret detection (Trufflehog)
