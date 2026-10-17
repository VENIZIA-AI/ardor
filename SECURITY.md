# Security Policy

## Supported Versions

The following versions of ARDOR are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, send an email to: [**contact@venizia.ai**, **developer@venizia.ai**]

Include the following information in your report:

- **Description** of the vulnerability
- **Steps to reproduce** the issue
- **Potential impact** of the vulnerability
- **Suggested fix** (if you have one)
- **Your contact information** for follow-up questions

We will:

1. Acknowledge receipt of your report
2. Assign a team member to investigate
3. Keep you informed of our progress
4. Credit you in the security advisory (unless you prefer to remain anonymous)

### Disclosure Policy

- We follow responsible disclosure practices
- Please allow us reasonable time to address the issue before public disclosure
- We will coordinate with you on the disclosure timeline

## Security Best Practices

When using ARDOR in your applications, follow these recommendations:

### Environment Variables

- Never commit `.env` files to version control
- Use environment-specific configurations
- Rotate secrets regularly

### Authentication & Authorization

- Leave the auth token where `DefaultAuthService` stores it; never log it or copy it elsewhere
- Keep `noAuthPaths` to the routes that really need no session; never widen them to make a request work
- Enforce access control on the server - `canAccess` only shapes the UI

### Dependencies

- Keep dependencies up to date
- Regularly audit packages with `bun audit` or `npm audit`
- Review security advisories for dependencies

### Production Deployment

- Serve the application over HTTPS: `crypto.randomUUID` and other secure-context APIs are undefined on plain HTTP
- Set a Content Security Policy for the admin console

## Security Features in ARDOR

- **One storage key for the token** - `DefaultAuthService` writes and clears `LocalStorageKeys.KEY_AUTH_TOKEN`; the network layer only reads it
- **Explicit no-auth paths** - every other request carries the session header
- **Bounded auth recovery** - a 401 triggers one token refresh and one retry, never a loop
- **Browser-pure core** - `ardor-kernel` imports no Node builtin, gated by `make purity` on every release

---

Thank you for helping keep ARDOR and its users safe.
