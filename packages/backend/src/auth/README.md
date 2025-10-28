# Authentication and Authorization System

This directory contains the authentication and authorization implementation for the Curriculum Generator App.

## Overview

The system uses Auth0 for authentication with JWT tokens, implements role-based access control (RBAC), manages sessions with Redis, and provides comprehensive audit logging.

## Components

### 1. Authentication Middleware (`middleware/auth.ts`)

- **validateJWT**: Validates JWT tokens from Auth0
- **loadUser**: Loads user from database and attaches to request
- **requireRole**: Checks if user has required role(s)
- **auditAction**: Logs authenticated actions
- **handleAuthError**: Handles JWT validation errors

### 2. User Service (`services/userService.ts`)

Manages user CRUD operations:
- Get user by Auth0 provider ID, email, or internal ID
- Create new users
- Update user roles
- Delete users
- List all users

### 3. Audit Service (`services/auditService.ts`)

Tracks all authenticated actions:
- Create audit log entries
- Query logs by user, resource, or filters
- Cleanup old logs

### 4. Session Service (`services/sessionService.ts`)

Manages user sessions in Redis:
- Create/update sessions
- Get session data
- Refresh sessions (extend TTL)
- Delete sessions (logout)
- Session timeout: 30 minutes

## User Roles

Three roles are supported:

1. **ADMINISTRATOR**: Full system access
   - Manage users and roles
   - View all audit logs
   - Access all resources

2. **SME** (Subject Matter Expert): Content creation
   - Upload curriculum content
   - View own programs
   - Edit own content

3. **STUDENT**: Learning access
   - Access tutor bot
   - Use simulations
   - View assigned content

## API Endpoints

### Authentication Routes (`/api/auth`)

```
GET  /api/auth/me              - Get current user profile
POST /api/auth/session         - Create session after login
POST /api/auth/session/refresh - Refresh session
POST /api/auth/logout          - Logout and delete session
```

### User Management Routes (`/api/users`)

```
GET    /api/users              - List all users (admin only)
GET    /api/users/:id          - Get user by ID (admin only)
PUT    /api/users/:id/role     - Update user role (admin only)
DELETE /api/users/:id          - Delete user (admin only)
GET    /api/users/:id/audit-logs - Get user audit logs (admin or self)
```

## Usage Examples

### Protecting Routes

```typescript
import { validateJWT, loadUser, requireRole, auditAction } from './middleware/auth';
import { UserRole } from './types/auth';

// Require authentication
router.get('/protected', validateJWT, loadUser, (req, res) => {
  res.json({ user: req.user });
});

// Require specific role
router.post('/admin-only', 
  validateJWT, 
  loadUser, 
  requireRole(UserRole.ADMINISTRATOR),
  (req, res) => {
    // Admin-only logic
  }
);

// Multiple roles allowed
router.get('/content',
  validateJWT,
  loadUser,
  requireRole(UserRole.ADMINISTRATOR, UserRole.SME),
  (req, res) => {
    // Admin or SME can access
  }
);

// With audit logging
router.post('/programs',
  validateJWT,
  loadUser,
  requireRole(UserRole.SME),
  auditAction('CREATE_PROGRAM', 'programs'),
  (req, res) => {
    // Create program logic
  }
);
```

### Client Authentication Flow

1. **Login**: User authenticates with Auth0
2. **Get Token**: Client receives JWT token
3. **Create Session**: POST to `/api/auth/session` with JWT
4. **Make Requests**: Include JWT in Authorization header
5. **Refresh**: POST to `/api/auth/session/refresh` before expiry
6. **Logout**: POST to `/api/auth/logout`

### Request Headers

```
Authorization: Bearer <jwt-token>
```

## Configuration

Required environment variables in `.env`:

```bash
# Auth0 Configuration
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-api-audience

# Redis for Sessions
REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/db
```

## Security Features

1. **JWT Validation**: All tokens validated against Auth0 JWKS
2. **Rate Limiting**: 100 requests/minute per user
3. **Session Timeout**: 30 minutes of inactivity
4. **Audit Logging**: All authenticated actions logged
5. **Role-Based Access**: Granular permission control
6. **Secure Headers**: Helmet.js for security headers

## Error Responses

All errors follow consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req-123456"
  }
}
```

Common error codes:
- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: Insufficient permissions
- `INVALID_TOKEN`: JWT validation failed
- `SESSION_NOT_FOUND`: Session expired or invalid
- `RATE_LIMIT_EXCEEDED`: Too many requests

## Testing

Test authentication with curl:

```bash
# Get user profile
curl -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/auth/me

# Create session
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  http://localhost:4000/api/auth/session

# List users (admin only)
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:4000/api/users
```

## Audit Log Schema

```typescript
{
  id: string;
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: {
    method: string;
    path: string;
    params: object;
    query: object;
    statusCode: number;
  };
  createdAt: Date;
}
```

## Session Data Schema

```typescript
{
  userId: string;
  email: string;
  role: string;
  lastActivity: string;
}
```

## Best Practices

1. Always use `validateJWT` and `loadUser` together
2. Add `requireRole` for protected resources
3. Use `auditAction` for sensitive operations
4. Handle auth errors with `handleAuthError`
5. Refresh sessions before expiry
6. Clean up sessions on logout
7. Never expose sensitive user data in responses
8. Log security events for monitoring

## Maintenance

### Session Cleanup

Sessions auto-expire after 30 minutes. No manual cleanup needed.

### Audit Log Cleanup

Run periodic cleanup for old logs:

```typescript
import { deleteOldAuditLogs } from './services/auditService';

// Delete logs older than 90 days
await deleteOldAuditLogs(90);
```

### User Management

Admins can manage users through the API:
- Update roles as needed
- Delete inactive users
- Review audit logs for security

## Troubleshooting

**Issue**: "Invalid token" errors
- Check Auth0 domain and audience configuration
- Verify token hasn't expired
- Ensure JWKS endpoint is accessible

**Issue**: Session not found
- Session may have expired (30 min timeout)
- User needs to re-authenticate
- Check Redis connection

**Issue**: Permission denied
- Verify user has correct role
- Check role assignment in database
- Review audit logs for access attempts
