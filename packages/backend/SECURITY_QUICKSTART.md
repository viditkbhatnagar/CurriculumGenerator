# Security Quick Start Guide

This guide provides a quick overview of how to use the security features in the Curriculum Generator App.

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Rate Limiting](#rate-limiting)
3. [Input Validation](#input-validation)
4. [CORS Configuration](#cors-configuration)
5. [HTTPS/TLS](#httpstls)
6. [Data Encryption](#data-encryption)
7. [API Request Signing](#api-request-signing)
8. [Common Patterns](#common-patterns)

## Environment Setup

Add these variables to your `.env` file:

```bash
# Security Configuration
ENCRYPTION_KEY=your-32-character-encryption-key-change-in-production
API_SIGNING_SECRET=your-api-signing-secret-change-in-production
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
ENABLE_HTTPS=false
SSL_KEY_PATH=./certs/key.pem
SSL_CERT_PATH=./certs/cert.pem
```

## Rate Limiting

Rate limiting is automatically applied to all routes (except `/health` and `/metrics`).

**Default:** 100 requests per minute per user (or IP if not authenticated)

### Custom Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

// Stricter limit for sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
});

router.post('/sensitive-endpoint', strictLimiter, handler);
```

## Input Validation

### Validate UUID Parameters

```typescript
import { validateUUIDParam } from '../middleware/security';

router.get('/programs/:id', validateUUIDParam('id'), handler);
```

### Validate Required Fields

```typescript
import { validateRequiredFields } from '../middleware/security';

router.post('/programs', 
  validateRequiredFields(['programName', 'qualificationLevel']),
  handler
);
```

### Validate Field Types

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

```typescript
import { sanitizeString, sanitizeObject } from '../middleware/security';

const cleanInput = sanitizeString(userInput);
const cleanObject = sanitizeObject(requestBody);
```

## CORS Configuration

CORS is automatically configured based on `CORS_ORIGINS` environment variable.

**Add new origins:**

```bash
CORS_ORIGINS=http://localhost:3000,https://staging.example.com,https://production.example.com
```

## HTTPS/TLS

### Development (Self-Signed Certificate)

```bash
# Generate certificate
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes

# Enable HTTPS
ENABLE_HTTPS=true
```

### Production

```bash
ENABLE_HTTPS=true
SSL_KEY_PATH=/path/to/production/key.pem
SSL_CERT_PATH=/path/to/production/cert.pem
```

## Data Encryption

### Encrypt Sensitive Data

```typescript
import { encryptionService } from '../services/encryptionService';

// Encrypt string
const encrypted = encryptionService.encrypt('sensitive data');

// Store in database
await db.query(
  'INSERT INTO sensitive_data (encrypted, iv, auth_tag, salt) VALUES ($1, $2, $3, $4)',
  [encrypted.encrypted, encrypted.iv, encrypted.authTag, encrypted.salt]
);

// Decrypt
const decrypted = encryptionService.decrypt(encrypted);
```

### Encrypt JSON Objects

```typescript
// Encrypt object
const encryptedObj = encryptionService.encryptJSON({ 
  ssn: '123-45-6789',
  creditCard: '1234-5678-9012-3456'
});

// Decrypt object
const decryptedObj = encryptionService.decryptJSON(encryptedObj);
```

### Hash Data (One-Way)

```typescript
// For passwords, tokens, etc.
const hash = encryptionService.hash('password123');
```

### Generate Secure Tokens

```typescript
const token = encryptionService.generateToken(32); // 32 bytes = 64 hex chars
```

## API Request Signing

### Protect Sensitive Endpoints

```typescript
import { requireSignature } from '../middleware/security';
import { requireRole } from '../middleware/auth';
import { UserRole } from '../types/auth';

router.delete('/programs/:id', 
  validateJWT,
  loadUser,
  requireRole(UserRole.ADMINISTRATOR),
  requireSignature,  // Requires signed request
  handler
);
```

### Client-Side: Generate Signature

```typescript
import crypto from 'crypto';

function generateSignature(
  method: string, 
  path: string, 
  body: any, 
  timestamp: number, 
  secret: string
): string {
  const payload = `${method}:${path}:${JSON.stringify(body)}:${timestamp}`;
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

// Make signed request
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

## Common Patterns

### Secure Route Pattern

```typescript
import { validateJWT, loadUser, requireRole } from '../middleware/auth';
import { validateUUIDParam, validateRequiredFields, requireSignature } from '../middleware/security';
import { UserRole } from '../types/auth';

// Public route (no auth)
router.get('/public/data', handler);

// Authenticated route
router.get('/protected/data', 
  validateJWT,
  loadUser,
  handler
);

// Role-based route
router.post('/admin/action',
  validateJWT,
  loadUser,
  requireRole(UserRole.ADMINISTRATOR),
  validateRequiredFields(['field1', 'field2']),
  handler
);

// Highly sensitive route
router.delete('/critical/:id',
  validateJWT,
  loadUser,
  requireRole(UserRole.ADMINISTRATOR),
  validateUUIDParam('id'),
  requireSignature,  // Requires signed request
  handler
);
```

### Encrypt User Data

```typescript
// When storing sensitive user data
async function createUser(userData: any) {
  const encryptedSSN = encryptionService.encrypt(userData.ssn);
  
  await db.query(
    `INSERT INTO users (name, email, ssn_encrypted, ssn_iv, ssn_auth_tag, ssn_salt)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userData.name,
      userData.email,
      encryptedSSN.encrypted,
      encryptedSSN.iv,
      encryptedSSN.authTag,
      encryptedSSN.salt,
    ]
  );
}

// When retrieving sensitive data
async function getUser(userId: string) {
  const result = await db.query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  
  const user = result.rows[0];
  
  // Decrypt sensitive fields
  const decryptedSSN = encryptionService.decrypt({
    encrypted: user.ssn_encrypted,
    iv: user.ssn_iv,
    authTag: user.ssn_auth_tag,
    salt: user.ssn_salt,
  });
  
  return {
    ...user,
    ssn: decryptedSSN,
  };
}
```

### Validate and Sanitize Input

```typescript
router.post('/create',
  // Validate required fields
  validateRequiredFields(['name', 'email']),
  
  // Validate field types
  validateFieldTypes({
    name: 'string',
    email: 'string',
    age: 'number',
  }),
  
  async (req, res) => {
    // Input is already sanitized by global middleware
    const { name, email, age } = req.body;
    
    // Additional custom validation
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid email format',
        },
      });
    }
    
    // Process request...
  }
);
```

## Testing Security

### Test Rate Limiting

```bash
# Should succeed (first 100 requests)
for i in {1..100}; do curl http://localhost:4000/api/programs; done

# Should fail with 429 (next 10 requests)
for i in {101..110}; do curl http://localhost:4000/api/programs; done
```

### Test Input Validation

```bash
# Should be rejected (XSS attempt)
curl -X POST http://localhost:4000/api/programs \
  -H "Content-Type: application/json" \
  -d '{"name": "<script>alert(1)</script>"}'

# Should be rejected (SQL injection attempt)
curl -X POST http://localhost:4000/api/programs \
  -H "Content-Type: application/json" \
  -d '{"name": "DROP TABLE programs;"}'
```

### Run Security Tests

```bash
npm test -- security.test.ts
```

### Run Vulnerability Scan

```bash
npm audit
npm audit fix
```

## Best Practices

1. **Never commit secrets** - Use environment variables
2. **Rotate keys regularly** - Especially in production
3. **Use HTTPS in production** - Always encrypt data in transit
4. **Encrypt sensitive data** - PII, credentials, financial data
5. **Validate all inputs** - Never trust user input
6. **Log security events** - Failed auth, rate limits, etc.
7. **Monitor for anomalies** - Set up alerts for suspicious activity
8. **Keep dependencies updated** - Run `npm audit` regularly
9. **Use strong secrets** - Minimum 32 characters, cryptographically random
10. **Implement defense in depth** - Multiple layers of security

## Troubleshooting

### CORS Errors

**Problem:** Browser blocks requests with CORS error

**Solution:** Add your frontend origin to `CORS_ORIGINS`:
```bash
CORS_ORIGINS=http://localhost:3000,https://yourfrontend.com
```

### Rate Limit Exceeded

**Problem:** Getting 429 errors

**Solution:** Increase rate limit or wait for window to reset:
```bash
RATE_LIMIT_MAX_REQUESTS=200  # Increase limit
```

### Invalid Signature

**Problem:** Getting "Invalid API signature" error

**Solution:** 
1. Ensure timestamp is current (within 5 minutes)
2. Verify signature generation matches server-side
3. Check `API_SIGNING_SECRET` matches on client and server

### Encryption Errors

**Problem:** "Failed to decrypt data" error

**Solution:**
1. Ensure `ENCRYPTION_KEY` hasn't changed
2. Verify all encryption components (encrypted, iv, authTag, salt) are stored
3. Check data hasn't been corrupted

## Support

For security issues or questions:
- Review [SECURITY.md](./SECURITY.md) for detailed documentation
- Check logs for specific error messages
- Contact security team: security@yourdomain.com
