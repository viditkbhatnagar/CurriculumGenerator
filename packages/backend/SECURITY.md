# Security Implementation Guide

This document describes the security measures implemented in the Curriculum Generator App backend.

## Overview

The application implements multiple layers of security to protect sensitive data and prevent common attacks:

1. **Rate Limiting** - Prevents abuse and DDoS attacks
2. **Input Validation & Sanitization** - Prevents injection attacks
3. **CORS Configuration** - Controls cross-origin access
4. **HTTPS/TLS** - Encrypts data in transit
5. **Data Encryption at Rest** - Protects sensitive data using AES-256
6. **API Request Signing** - Ensures request authenticity for sensitive operations

## 1. Rate Limiting

### Configuration

Rate limiting is applied per user (when authenticated) or per IP address (for unauthenticated requests).

**Default Settings:**
- Window: 60 seconds (1 minute)
- Max Requests: 100 per window
- Applies to: All API endpoints except `/health` and `/metrics`

**Environment Variables:**
```bash
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Customization

To adjust rate limits for specific routes, create a custom rate limiter:

```typescript
import rateLimit from 'express-rate-limit';

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // Only 10 requests per minute
});

app.use('/api/sensitive-endpoint', strictLimiter, yourHandler);
```

## 2. Input Validation & Sanitization

### Automatic Sanitization

All request inputs (body, query, params) are automatically sanitized to prevent:
- SQL Injection
- XSS (Cross-Site Scripting)
- Command Injection
- Path Traversal

### Using Validation Middleware

**Validate UUID Parameters:**
```typescript
import { validateUUIDParam } from '../middleware/security';

router.get('/programs/:id', validateUUIDParam('id'), handler);
```

**Validate Required Fields:**
```typescript
import { validateRequiredFields } from '../middleware/security';

router.post('/programs', 
  validateRequiredFields(['programName', 'qualificationLevel']),
  handler
);
```

**Validate Field Types:**
```typescript
import { validateFieldTypes } from '../middleware/security';

router.post('/programs',
  validateFieldTypes({
    programName: 'string',
    totalCredits: 'number',
    modules: 'array',
  }),
  handler
);
```

### Manual Sanitization

For custom validation needs:

```typescript
import { sanitizeString, sanitizeObject, isValidEmail, isValidUrl } from '../middleware/security';

const cleanInput = sanitizeString(userInput);
const cleanObject = sanitizeObject(requestBody);
const isValid = isValidEmail(email);
```

## 3. CORS Configuration

### Setup

CORS is configured to only allow requests from approved origins.

**Environment Variable:**
```bash
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com,https://app.yourdomain.com
```

**Features:**
- Credentials support enabled
- Specific allowed methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
- Custom headers allowed: X-Request-ID, X-API-Signature, X-API-Timestamp
- Preflight cache: 24 hours

### Adding New Origins

Update the `CORS_ORIGINS` environment variable with comma-separated origins:

```bash
CORS_ORIGINS=http://localhost:3000,https://staging.example.com,https://production.example.com
```

## 4. HTTPS/TLS Configuration

### Development

HTTPS is disabled by default in development. To enable:

1. Generate self-signed certificates:
```bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes
```

2. Update environment variables:
```bash
ENABLE_HTTPS=true
SSL_KEY_PATH=./certs/key.pem
SSL_CERT_PATH=./certs/cert.pem
```

### Production

In production, use certificates from a trusted Certificate Authority (Let's Encrypt, AWS Certificate Manager, etc.):

```bash
ENABLE_HTTPS=true
SSL_KEY_PATH=/path/to/production/key.pem
SSL_CERT_PATH=/path/to/production/cert.pem
```

**Security Headers:**
- HSTS enabled with 1-year max-age
- Content Security Policy configured
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff

## 5. Data Encryption at Rest

### AES-256-GCM Encryption

Sensitive data is encrypted using AES-256-GCM (Galois/Counter Mode) which provides both confidentiality and authenticity.

### Configuration

Set a strong encryption key (minimum 32 characters):

```bash
ENCRYPTION_KEY=your-very-secure-32-character-key-here-change-in-production
```

**Important:** 
- Use a cryptographically secure random key in production
- Never commit the encryption key to version control
- Rotate keys periodically
- Store keys in a secure key management service (AWS KMS, HashiCorp Vault, etc.)

### Usage

```typescript
import { encryptionService } from '../services/encryptionService';

// Encrypt sensitive data
const encrypted = encryptionService.encrypt('sensitive data');
// Store encrypted.encrypted, encrypted.iv, encrypted.authTag, encrypted.salt in database

// Decrypt data
const decrypted = encryptionService.decrypt(encrypted);

// Encrypt JSON objects
const encryptedObj = encryptionService.encryptJSON({ ssn: '123-45-6789' });
const decryptedObj = encryptionService.decryptJSON(encryptedObj);

// One-way hashing (for passwords, tokens)
const hash = encryptionService.hash('password');

// Generate secure tokens
const token = encryptionService.generateToken(32);
```

### What to Encrypt

Encrypt the following types of data:
- Personal Identifiable Information (PII)
- Authentication credentials
- API keys and secrets
- Financial information
- Health information
- Any data subject to compliance requirements (GDPR, HIPAA, etc.)

## 6. API Request Signing

### Purpose

API request signing ensures that sensitive operations are only performed by authorized clients and that requests haven't been tampered with.

### Configuration

Set a signing secret:

```bash
API_SIGNING_SECRET=your-api-signing-secret-change-in-production
```

### Server-Side Implementation

Protect sensitive endpoints with signature verification:

```typescript
import { requireSignature } from '../middleware/security';

// Require signature for sensitive operations
router.delete('/programs/:id', 
  validateJWT,
  loadUser,
  requireSignature,
  handler
);

router.post('/users/:id/promote',
  validateJWT,
  loadUser,
  requireRole(UserRole.ADMINISTRATOR),
  requireSignature,
  handler
);
```

### Client-Side Implementation

Generate and include signature in requests:

```typescript
import crypto from 'crypto';

function generateSignature(method: string, path: string, body: any, timestamp: number, secret: string): string {
  const payload = `${method}:${path}:${JSON.stringify(body)}:${timestamp}`;
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

// Making a signed request
const timestamp = Date.now();
const method = 'DELETE';
const path = '/api/programs/123';
const body = {};
const signature = generateSignature(method, path, body, timestamp, API_SIGNING_SECRET);

fetch('https://api.example.com/api/programs/123', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-API-Timestamp': timestamp.toString(),
    'X-API-Signature': signature,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});
```

### Signature Validation

- Signatures are valid for 5 minutes from the timestamp
- Uses HMAC-SHA256 for cryptographic security
- Timing-safe comparison prevents timing attacks

## Security Best Practices

### 1. Environment Variables

- Never commit `.env` files to version control
- Use different secrets for each environment (dev, staging, production)
- Rotate secrets regularly
- Use a secrets management service in production

### 2. Authentication & Authorization

- Always validate JWT tokens
- Check user roles before allowing access to resources
- Log all authentication failures
- Implement session timeouts (default: 30 minutes)

### 3. Database Security

- Use parameterized queries (already implemented with `pg` library)
- Never concatenate user input into SQL queries
- Implement database connection pooling
- Use read-only database users where appropriate

### 4. Logging & Monitoring

- Log all security events (failed auth, rate limit exceeded, etc.)
- Never log sensitive data (passwords, tokens, PII)
- Monitor for suspicious patterns
- Set up alerts for security incidents

### 5. Dependencies

- Regularly update dependencies
- Run security audits: `npm audit`
- Use tools like Snyk or Dependabot
- Review security advisories

### 6. Error Handling

- Never expose stack traces to clients in production
- Use generic error messages for security failures
- Log detailed errors server-side
- Implement proper error tracking (Sentry)

## Testing Security

### Manual Testing

Test rate limiting:
```bash
# Should succeed
for i in {1..100}; do curl http://localhost:4000/api/programs; done

# Should fail with 429
for i in {101..110}; do curl http://localhost:4000/api/programs; done
```

Test input validation:
```bash
# Should be rejected
curl -X POST http://localhost:4000/api/programs \
  -H "Content-Type: application/json" \
  -d '{"name": "<script>alert(1)</script>"}'

# Should be rejected
curl -X POST http://localhost:4000/api/programs \
  -H "Content-Type: application/json" \
  -d '{"name": "DROP TABLE programs;"}'
```

### Automated Testing

Run security tests:
```bash
npm run test:security
```

Run vulnerability scan:
```bash
npm audit
npm audit fix
```

## Incident Response

If a security incident occurs:

1. **Immediate Actions:**
   - Identify and isolate affected systems
   - Revoke compromised credentials
   - Block malicious IP addresses
   - Enable additional logging

2. **Investigation:**
   - Review logs for the incident timeline
   - Identify the attack vector
   - Assess the scope of the breach
   - Document findings

3. **Remediation:**
   - Patch vulnerabilities
   - Rotate all secrets and keys
   - Update security policies
   - Notify affected users if required

4. **Post-Incident:**
   - Conduct a post-mortem
   - Update security procedures
   - Implement additional monitoring
   - Train team on lessons learned

## Compliance

### GDPR Compliance

- Data encryption at rest and in transit
- Audit logging of all data access
- User consent management
- Right to be forgotten (data deletion)
- Data portability

### Security Standards

- OWASP Top 10 protection
- CWE/SANS Top 25 mitigation
- PCI DSS compliance for payment data (if applicable)
- SOC 2 Type II controls

## Contact

For security concerns or to report vulnerabilities:
- Email: security@yourdomain.com
- Use responsible disclosure practices
- Allow 90 days for remediation before public disclosure
