# Quick Start: Authentication & Authorization

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies
```bash
cd packages/backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and add your Auth0 credentials:
```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.curriculum-generator.com
REDIS_URL=redis://localhost:6379
```

### 3. Start Redis
```bash
docker-compose up redis -d
```

### 4. Start Backend
```bash
npm run dev
```

### 5. Test Authentication

Get a token from Auth0:
```bash
curl --request POST \
  --url https://your-tenant.auth0.com/oauth/token \
  --header 'content-type: application/json' \
  --data '{
    "client_id":"YOUR_CLIENT_ID",
    "client_secret":"YOUR_CLIENT_SECRET",
    "audience":"https://api.curriculum-generator.com",
    "grant_type":"client_credentials"
  }'
```

Test the API:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/api/auth/me
```

## 📝 Protect Your Routes

```typescript
import { validateJWT, loadUser, requireRole } from './middleware/auth';
import { UserRole } from './types/auth';

// Basic auth
router.get('/protected', validateJWT, loadUser, handler);

// With role check
router.post('/admin', 
  validateJWT, 
  loadUser, 
  requireRole(UserRole.ADMINISTRATOR),
  handler
);

// With audit logging
router.put('/resource/:id',
  validateJWT,
  loadUser,
  requireRole(UserRole.ADMINISTRATOR, UserRole.SME),
  auditAction('UPDATE_RESOURCE', 'resources'),
  handler
);
```

## 🔑 User Roles

- **ADMINISTRATOR**: Full system access
- **SME**: Create and manage curriculum content
- **STUDENT**: Access learning materials

## 📚 Documentation

- **Full Guide**: `src/auth/README.md`
- **Auth0 Setup**: `AUTH0_SETUP.md`
- **Examples**: `src/examples/protectedRoute.example.ts`
- **Implementation Summary**: `AUTHENTICATION_IMPLEMENTATION.md`

## ✅ Run Tests

```bash
npm test
```

## 🆘 Troubleshooting

**"Invalid token" error**
- Check AUTH0_DOMAIN and AUTH0_AUDIENCE in .env
- Verify token hasn't expired

**"Redis connection failed"**
- Ensure Redis is running: `docker-compose up redis`
- Check REDIS_URL in .env

**"User not found"**
- User is auto-created on first login
- Check database connection

## 🔗 Useful Endpoints

- `GET /api/auth/me` - Get current user
- `POST /api/auth/session` - Create session
- `POST /api/auth/logout` - Logout
- `GET /api/users` - List users (admin)
- `PUT /api/users/:id/role` - Update role (admin)

## 📞 Need Help?

Check the comprehensive documentation in `src/auth/README.md`
