# How to Run the Curriculum Generator App

## 🚀 Quick Start (5 Minutes - No Setup Required!)

The **fastest** way to see the app running:

```bash
# 1. Go to backend directory
cd packages/backend

# 2. Install dependencies
npm install

# 3. Copy environment file for mock data
cp .env.local.example .env

# 4. Start the server
npm run dev
```

**That's it!** The server is now running with synthetic mock data at `http://localhost:4000`

### Test It:
```bash
# Health check
curl http://localhost:4000/health

# List programs (mock data)
curl http://localhost:4000/api/programs

# Get metrics
curl http://localhost:4000/metrics
```

---

## 🗄️ Run with Real Database (30 Minutes Setup)

### Prerequisites:
- MongoDB Atlas account (free at https://cloud.mongodb.com)
- Redis (install with `brew install redis` on macOS)
- OpenAI API key (optional, for AI features)

### Step 1: Set Up MongoDB Atlas (15 min)

```bash
# 1. Create MongoDB Atlas account
# Go to: https://cloud.mongodb.com

# 2. Create a cluster (M0 free tier for testing)

# 3. Add your IP to Network Access
# In Atlas: Network Access → Add IP → Allow from Anywhere (0.0.0.0/0)

# 4. Create a database user
# In Atlas: Database Access → Add New User
# Username: curriculum_user
# Password: [save this!]

# 5. Get connection string
# In Atlas: Connect → Connect your application → Copy connection string
# Example: mongodb+srv://curriculum_user:PASSWORD@cluster0.xxxxx.mongodb.net/
```

### Step 2: Set Up Redis (5 min)

```bash
# macOS
brew install redis
brew services start redis

# Linux
sudo apt-get install redis-server
sudo systemctl start redis-server

# Verify it's running
redis-cli ping
# Should return: PONG
```

### Step 3: Configure Environment (5 min)

```bash
cd packages/backend

# Copy environment template
cp .env.example .env

# Edit .env file
nano .env
```

**Update these values in .env:**
```bash
# MongoDB (REQUIRED)
MONGODB_URI=mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/curriculum_db?retryWrites=true&w=majority

# Redis (REQUIRED)
REDIS_URL=redis://localhost:6379

# OpenAI (OPTIONAL - for AI features)
OPENAI_API_KEY=sk-your-api-key-here

# Disable mock data
USE_MOCK_DATA=false
```

### Step 4: Initialize Database (3 min)

```bash
cd packages/backend

# Run migrations
npm run migrate:up

# Create indexes
npm run create:indexes

# Test connections
npm run test:mongodb
npm run test:redis
```

### Step 5: Start All Services (2 min)

**Terminal 1 - Backend API:**
```bash
cd packages/backend
npm run dev
```

**Terminal 2 - Background Worker:**
```bash
cd packages/backend
npm run worker
```

**Terminal 3 - Frontend (Optional):**
```bash
cd packages/frontend
npm install
npm run dev
```

### Access the Application:
- **Backend API:** http://localhost:4000
- **Frontend:** http://localhost:3000
- **Health Check:** http://localhost:4000/health

---

## 🧪 Testing

### Test MongoDB Connection
```bash
cd packages/backend
npm run test:mongodb
```

### Test Redis Connection
```bash
npm run test:redis
```

### Test Vector Search (requires M10+ Atlas cluster)
```bash
npm run test:vector-search
```

### Test API Endpoints
```bash
# Health check
curl http://localhost:4000/health

# Create a program
curl -X POST http://localhost:4000/api/programs \
  -H "Content-Type: application/json" \
  -d '{
    "program_name": "Test Program",
    "qualification_level": "Bachelor",
    "qualification_type": "Degree",
    "total_credits": 120,
    "industry_sector": "Technology"
  }'

# List programs
curl http://localhost:4000/api/programs
```

---

## 🛠️ Using Makefile (Convenience Commands)

```bash
# Show all available commands
make help

# Start all services
make dev

# Start MongoDB and Redis (macOS)
make services-start

# Stop MongoDB and Redis
make services-stop

# Check service status
make services-status

# Run migrations
make migrate

# Run tests
make test

# Clean and rebuild
make clean
npm install
```

---

## 📦 Environment Variables Reference

### Required Variables:
```bash
# Server
PORT=4000
NODE_ENV=development

# Database (REQUIRED for real data)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/curriculum_db

# Redis (REQUIRED for caching)
REDIS_URL=redis://localhost:6379

# Development Mode
USE_MOCK_DATA=false  # Set to true for mock data
```

### Optional Variables:
```bash
# OpenAI (for AI features)
OPENAI_API_KEY=sk-your-key-here
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_CHAT_MODEL=gpt-4-turbo

# Auth0 (for authentication)
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-api-audience

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800  # 50MB

# Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=debug
```

---

## 🐛 Troubleshooting

### "MongoDB connection failed"
```bash
# Check your connection string
cat packages/backend/.env | grep MONGODB_URI

# Test connection
npm run test:mongodb

# Make sure Atlas allows your IP
# Go to Atlas → Network Access → Add 0.0.0.0/0
```

### "Redis connection refused"
```bash
# Check if Redis is running
redis-cli ping

# Start Redis
brew services start redis  # macOS
sudo systemctl start redis-server  # Linux
```

### "Port already in use"
```bash
# Find what's using port 4000
lsof -i :4000

# Kill the process or change PORT in .env
PORT=4001
```

### "Module not found" errors
```bash
# Clean and reinstall
rm -rf node_modules
npm install

# Or use Make
make clean
npm install
```

---

## 🚀 Deploy to Production

### Deploy to Render:
```bash
# 1. Push code to GitHub
git add .
git commit -m "Ready for deployment"
git push origin main

# 2. Go to Render dashboard: https://dashboard.render.com

# 3. New → Blueprint

# 4. Connect your GitHub repository

# 5. Add environment variables:
#    - MONGODB_URI (from Atlas)
#    - OPENAI_API_KEY
#    - AUTH0_DOMAIN
#    - AUTH0_AUDIENCE

# 6. Click Deploy!
```

**See full deployment guide:** `RENDER_DEPLOYMENT_GUIDE.md`

---

## 📚 Additional Documentation

- **Project Overview:** `PROJECT_OVERVIEW_AND_SETUP.md`
- **Migration Status:** `MIGRATION_COMPLETION_SUMMARY.md`
- **MongoDB Setup:** `packages/backend/MONGODB_SETUP_START_HERE.md`
- **API Documentation:** `packages/backend/API_ENDPOINTS.md`
- **Testing Guide:** `packages/backend/LOCAL_TESTING_GUIDE.md`
- **Architecture:** `ARCHITECTURE.md`

---

## 🎯 Common Development Tasks

### Add a New Feature
```bash
# 1. Create a feature branch
git checkout -b feature/my-feature

# 2. Make changes and test
npm run dev

# 3. Run tests
npm test

# 4. Commit and push
git add .
git commit -m "feat: add my feature"
git push origin feature/my-feature
```

### Run Tests
```bash
# All tests
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Database Migrations
```bash
# Check migration status
npm run migrate:status

# Run migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Create new migration
npm run migrate:create my-migration-name
```

---

## 🎉 You're Ready!

Choose your path:
1. **Quick Demo:** Use mock data (already done!)
2. **Full Setup:** Follow the Real Database steps above
3. **Production:** Deploy to Render

**Need help?** Check the documentation files or the troubleshooting section above.

---

Last Updated: October 28, 2025
Status: ✅ 100% Complete and Ready to Run!

