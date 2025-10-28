# Setup Verification Checklist

Use this checklist to verify your development environment is properly configured.

## ✅ Project Structure

- [x] Monorepo initialized with Turborepo
- [x] Frontend package (Next.js 14)
- [x] Backend package (Node.js/Express)
- [x] AI service package (Python/FastAPI)
- [x] Shared types package (TypeScript)

## ✅ Configuration Files

- [x] TypeScript configured for all JS packages
- [x] ESLint configured
- [x] Prettier configured
- [x] Pre-commit hooks configured (Husky)
- [x] Environment variable templates created

## ✅ Development Tools

- [x] Turborepo for monorepo management
- [x] Lint-staged for pre-commit checks
- [x] Makefile for convenience commands
- [x] Setup scripts created

## ✅ Infrastructure Services

- [x] MongoDB configuration
- [x] Redis configuration
- [x] Database migration scripts

## ✅ Documentation

- [x] README.md with comprehensive guide
- [x] QUICKSTART.md for fast setup
- [x] CONTRIBUTING.md with guidelines
- [x] PROJECT_STRUCTURE.md with architecture
- [x] Environment variable examples

## Verification Steps

### 1. Check Node.js Version
```bash
node -v  # Should be >= 18.0.0
npm -v   # Should be >= 9.0.0
```

### 2. Check MongoDB
```bash
mongod --version  # Should be >= 6.0
```

### 3. Check Redis
```bash
redis-server --version  # Should be >= 7.0
```

### 4. Verify Project Structure
```bash
ls -la packages/
# Should show: ai-service, backend, frontend, shared-types
```

### 5. Check Configuration Files
```bash
ls -la | grep -E "eslint|prettier|turbo"
```

### 6. Verify Scripts
```bash
ls -la scripts/
# Should show: dev.sh, init-db.sql, pinecone-mock.conf, setup.sh
```

### 7. Check Environment Templates
```bash
find packages -name ".env.example"
# Should find 3 files (frontend, backend, ai-service)
```

## Post-Setup Verification

After running `make setup`, verify:

### 1. Dependencies Installed
```bash
# Node modules
ls node_modules/ | wc -l  # Should show many packages
```

### 2. MongoDB and Redis Running
```bash
# Check MongoDB
mongosh --eval "db.adminCommand('ping')"
# Should return: { ok: 1 }

# Check Redis
redis-cli ping
# Should return: PONG
```

### 3. Database Initialized
```bash
cd packages/backend
npm run migrate
# Should run migrations successfully
```

### 4. Git Hooks Installed
```bash
ls .husky/
# Should show pre-commit file
```

## Development Server Verification

After running `make dev` or `npm run dev`:

### 1. Frontend Running
```bash
curl http://localhost:3000
# Should return HTML
```

### 2. Backend API Running
```bash
curl http://localhost:4000/health
# Should return: {"status":"ok","timestamp":"..."}
```

## Common Issues and Solutions

### Issue: Port Already in Use
**Solution**: Change PORT in respective .env files

### Issue: MongoDB Not Running
**Solution**: 
```bash
# macOS:
brew services start mongodb-community

# Linux:
sudo systemctl start mongod
```

### Issue: Redis Not Running
**Solution**: 
```bash
# macOS:
brew services start redis

# Linux:
sudo systemctl start redis
```

### Issue: Husky Hooks Not Working
**Solution**:
```bash
npm run prepare
chmod +x .husky/pre-commit
```

### Issue: TypeScript Errors
**Solution**:
```bash
npm run build
# Check for specific errors in output
```

## Success Criteria

Your setup is complete when:

1. ✅ All packages have dependencies installed
2. ✅ MongoDB and Redis are running
3. ✅ Development servers start without errors
4. ✅ Health check endpoints return success
5. ✅ Pre-commit hooks run on git commit
6. ✅ No TypeScript compilation errors

## Next Steps

Once verification is complete:

1. Review the design document: `.kiro/specs/curriculum-generator-app/design.md`
2. Check the task list: `.kiro/specs/curriculum-generator-app/tasks.md`
3. Start implementing features following the task order
4. Refer to CONTRIBUTING.md for development guidelines

## Getting Help

If you encounter issues not covered here:

1. Check the main README.md
2. Check MongoDB logs: `tail -f /usr/local/var/log/mongodb/mongo.log` (macOS)
3. Check Redis logs: `tail -f /usr/local/var/log/redis.log` (macOS)
4. Check service logs in respective package directories
5. Ensure all environment variables are properly configured
