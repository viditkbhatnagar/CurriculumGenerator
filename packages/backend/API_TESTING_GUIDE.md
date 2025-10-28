# API Testing Guide

## Quick Browser Tests

Open these URLs in your browser:

1. **Health Check**: http://localhost:4000/health
2. **Metrics**: http://localhost:4000/metrics  
3. **API Root**: http://localhost:4000/api

## cURL Commands

### Health Check
```bash
curl http://localhost:4000/health | jq
```

### Get API Info
```bash
curl http://localhost:4000/api
```

### List Programs (requires auth)
```bash
curl http://localhost:4000/api/programs
```

### Create a Test User
```bash
curl -X POST http://localhost:4000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "role": "administrator",
    "authProviderId": "test-auth-123"
  }'
```

## Using Postman or Insomnia

### Import this collection:

**Base URL**: `http://localhost:4000`

**Endpoints to test**:

1. **GET /health** - Check server health
2. **GET /api** - Get API info
3. **GET /api/programs** - List programs
4. **POST /api/programs** - Create program
5. **GET /api/users** - List users
6. **POST /api/users** - Create user

## Using Browser DevTools

1. Open browser DevTools (F12)
2. Go to Console tab
3. Run these commands:

```javascript
// Test health endpoint
fetch('http://localhost:4000/health')
  .then(r => r.json())
  .then(console.log);

// Test API root
fetch('http://localhost:4000/api')
  .then(r => r.json())
  .then(console.log);

// Create a test user
fetch('http://localhost:4000/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    role: 'administrator',
    authProviderId: 'test-auth-' + Date.now()
  })
})
  .then(r => r.json())
  .then(console.log);

// List users
fetch('http://localhost:4000/api/users')
  .then(r => r.json())
  .then(console.log);
```

## Test MongoDB Connection

```bash
# Run the test script
cd packages/backend
node test-mongo-connection.js
```

## Test Creating Data

### Create a User
```bash
curl -X POST http://localhost:4000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "role": "administrator",
    "authProviderId": "auth0|123456"
  }' | jq
```

### List Users
```bash
curl http://localhost:4000/api/users | jq
```

### Create Audit Log
```bash
curl -X POST http://localhost:4000/api/audit \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID_HERE",
    "action": "test_action",
    "resourceType": "test",
    "details": {"test": true}
  }' | jq
```

## Verify Data in MongoDB Atlas

1. Go to MongoDB Atlas Dashboard
2. Click "Browse Collections"
3. Select `curriculum_db` database
4. Check collections:
   - `users` - Should see created users
   - `auditlogs` - Should see audit entries
   - `programs` - Will be empty initially

## Common Issues

### CORS Errors
If testing from a different origin, you may see CORS errors. The backend is configured to allow:
- http://localhost:3000
- http://localhost:5173

### Authentication Required
Some endpoints require authentication. For testing without auth:
1. Temporarily disable auth middleware
2. Or use the test endpoints that don't require auth

### Port Already in Use
If port 4000 is busy:
```bash
# Find process using port 4000
lsof -i :4000

# Kill it
kill -9 <PID>

# Or change PORT in .env file
```

## Frontend Testing (If Available)

If you have a frontend application:

1. Start the frontend:
```bash
cd packages/frontend
npm run dev
```

2. Open http://localhost:3000 (or the port shown)
3. The frontend should connect to the backend API

## API Documentation

### Available Endpoints

#### Health & Monitoring
- `GET /health` - Health check
- `GET /metrics` - Performance metrics

#### Users
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

#### Programs
- `GET /api/programs` - List programs
- `POST /api/programs` - Create program
- `GET /api/programs/:id` - Get program
- `PUT /api/programs/:id` - Update program
- `DELETE /api/programs/:id` - Delete program

#### Curriculum
- `POST /api/curriculum/generate/:programId` - Generate curriculum
- `GET /api/curriculum/status/:jobId` - Check generation status

#### Knowledge Base
- `POST /api/knowledge-base/ingest` - Ingest documents
- `GET /api/knowledge-base/search` - Search knowledge base

#### Export
- `GET /api/export/program/:id` - Export program
- `GET /api/export/curriculum/:id` - Export curriculum

## Next Steps

1. Test the health endpoint in browser
2. Try creating a user with cURL
3. Verify the user appears in MongoDB Atlas
4. Test other endpoints as needed
5. Start the frontend if available

## Troubleshooting

### Server Not Responding
```bash
# Check if server is running
curl http://localhost:4000/health

# Check server logs
# (Look at the terminal where you ran npm run dev)
```

### Database Connection Issues
```bash
# Test MongoDB connection
node test-mongo-connection.js

# Verify collections
node verify-collections.js
```

### Can't Create Data
- Check server logs for errors
- Verify MongoDB connection is healthy
- Check that collections exist in Atlas
- Ensure validation rules aren't blocking inserts
