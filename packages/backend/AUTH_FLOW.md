# Authentication Flow Diagrams

## 1. Initial Login Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Auth0
    participant Backend
    participant Database
    participant Redis

    User->>Frontend: Click Login
    Frontend->>Auth0: Redirect to Auth0 Login
    Auth0->>User: Show Login Page
    User->>Auth0: Enter Credentials
    Auth0->>Auth0: Validate Credentials
    Auth0->>Frontend: Redirect with JWT Token
    Frontend->>Backend: POST /api/auth/session (with JWT)
    Backend->>Auth0: Validate JWT (JWKS)
    Auth0->>Backend: Token Valid
    Backend->>Database: Get/Create User
    Database->>Backend: User Data
    Backend->>Database: Update last_login
    Backend->>Redis: Create Session
    Redis->>Backend: Session Created
    Backend->>Database: Create Audit Log (LOGIN)
    Backend->>Frontend: Session ID + User Data
    Frontend->>User: Show Dashboard
```

## 2. Authenticated Request Flow

```mermaid
sequenceDiagram
    participant Frontend
    participant Backend
    participant Auth0
    participant Database
    participant Redis

    Frontend->>Backend: API Request (with JWT)
    Backend->>Backend: validateJWT middleware
    Backend->>Auth0: Verify JWT (JWKS)
    Auth0->>Backend: Token Valid
    Backend->>Backend: loadUser middleware
    Backend->>Database: Get User by auth_provider_id
    Database->>Backend: User Data
    Backend->>Backend: requireRole middleware
    alt Has Required Role
        Backend->>Backend: auditAction middleware
        Backend->>Backend: Execute Route Handler
        Backend->>Database: Create Audit Log
        Backend->>Frontend: Success Response
    else Missing Required Role
        Backend->>Database: Log Unauthorized Attempt
        Backend->>Frontend: 403 Forbidden
    end
```

## 3. Session Management Flow

```mermaid
sequenceDiagram
    participant Frontend
    participant Backend
    participant Redis

    Note over Frontend,Redis: Session Creation
    Frontend->>Backend: POST /api/auth/session
    Backend->>Redis: Create Session (30 min TTL)
    Redis->>Backend: Session ID
    Backend->>Frontend: Session ID

    Note over Frontend,Redis: Session Refresh
    Frontend->>Backend: POST /api/auth/session/refresh
    Backend->>Redis: Get Session
    Redis->>Backend: Session Data
    Backend->>Redis: Update Session (extend TTL)
    Backend->>Frontend: Success

    Note over Frontend,Redis: Session Expiry
    Frontend->>Backend: API Request (after 30 min)
    Backend->>Redis: Get Session
    Redis->>Backend: Session Not Found
    Backend->>Frontend: 401 Unauthorized
    Frontend->>Frontend: Redirect to Login
```

## 4. Role-Based Access Control Flow

```mermaid
flowchart TD
    A[API Request] --> B{JWT Valid?}
    B -->|No| C[401 Unauthorized]
    B -->|Yes| D[Load User from DB]
    D --> E{User Found?}
    E -->|No| F[401 User Not Found]
    E -->|Yes| G{Role Check Required?}
    G -->|No| H[Execute Handler]
    G -->|Yes| I{Has Required Role?}
    I -->|No| J[Log Unauthorized Attempt]
    J --> K[403 Forbidden]
    I -->|Yes| L{Audit Logging?}
    L -->|No| H
    L -->|Yes| M[Log Action]
    M --> H
    H --> N[Return Response]
```

## 5. User Creation Flow

```mermaid
sequenceDiagram
    participant User
    participant Auth0
    participant Backend
    participant Database

    User->>Auth0: First Time Login
    Auth0->>Backend: JWT Token (new user)
    Backend->>Backend: validateJWT
    Backend->>Database: Get User by auth_provider_id
    Database->>Backend: User Not Found
    Backend->>Database: Create User (default role: SME)
    Database->>Backend: New User Created
    Backend->>Database: Create Audit Log (USER_CREATED)
    Backend->>User: Welcome Response
```

## 6. Audit Logging Flow

```mermaid
flowchart LR
    A[Authenticated Request] --> B[Execute Handler]
    B --> C{Success?}
    C -->|Yes 2xx| D[auditAction Middleware]
    C -->|No 4xx/5xx| E[No Audit Log]
    D --> F[Collect Request Data]
    F --> G[Create Audit Log Entry]
    G --> H[Store in Database]
    H --> I[Continue Response]
```

## 7. Admin User Management Flow

```mermaid
sequenceDiagram
    participant Admin
    participant Backend
    participant Database
    participant Redis

    Note over Admin,Redis: Update User Role
    Admin->>Backend: PUT /api/users/:id/role
    Backend->>Backend: Validate Admin Role
    Backend->>Database: Update User Role
    Database->>Backend: Updated User
    Backend->>Database: Create Audit Log
    Backend->>Admin: Success

    Note over Admin,Redis: Delete User
    Admin->>Backend: DELETE /api/users/:id
    Backend->>Backend: Validate Admin Role
    Backend->>Backend: Check Not Self-Delete
    Backend->>Database: Delete User
    Backend->>Redis: Delete User Sessions
    Backend->>Database: Create Audit Log
    Backend->>Admin: Success
```

## 8. Security Error Handling Flow

```mermaid
flowchart TD
    A[Request] --> B{JWT Present?}
    B -->|No| C[401 Unauthorized]
    B -->|Yes| D{JWT Valid?}
    D -->|No| E[401 Invalid Token]
    D -->|Yes| F{User Exists?}
    F -->|No| G[401 User Not Found]
    F -->|Yes| H{Has Permission?}
    H -->|No| I[Log Attempt]
    I --> J[403 Forbidden]
    H -->|Yes| K{Rate Limit OK?}
    K -->|No| L[429 Too Many Requests]
    K -->|Yes| M[Process Request]
```

## Key Components

### Middleware Chain
```
Request → validateJWT → loadUser → requireRole → auditAction → Handler
```

### Session Lifecycle
```
Create (30 min) → Refresh (extend 30 min) → Expire/Logout (delete)
```

### User Roles Hierarchy
```
Administrator (Full Access)
    ↓
SME (Content Creation)
    ↓
Student (Learning Access)
```

## Security Checkpoints

1. **JWT Validation**: Every request validates token against Auth0
2. **User Loading**: User data loaded from database
3. **Role Check**: Permissions verified before handler execution
4. **Audit Logging**: All actions logged for security review
5. **Session Management**: 30-minute timeout enforced
6. **Rate Limiting**: 100 requests/minute per IP

## Error Codes Reference

| Code | Status | Description |
|------|--------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid authentication |
| INVALID_TOKEN | 401 | JWT validation failed |
| USER_NOT_FOUND | 401 | User not in database |
| FORBIDDEN | 403 | Insufficient permissions |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

## Best Practices

1. Always use `validateJWT` + `loadUser` together
2. Add `requireRole` for protected resources
3. Use `auditAction` for sensitive operations
4. Refresh sessions before 30-minute expiry
5. Handle errors gracefully with proper status codes
6. Log security events for monitoring
7. Never expose sensitive data in error messages
