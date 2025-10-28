# Local Development Setup Guide

This guide will help you set up the Curriculum Generator App for local development using MongoDB and Redis.

## Prerequisites

- Node.js 18+ and npm
- MongoDB 6.0+ (local installation or MongoDB Atlas account)
- Redis 7+ (local installation or cloud Redis)
- OpenAI API key
- Auth0 account (for authentication)

## Step 1: Clone the Repository

```bash
git clone <repository-url>
cd curriculum-generator-app
```

## Step 2: Install Dependencies

```bash
# Install root dependencies
npm install

# Install package dependencies
cd packages/backend && npm install
cd ../frontend && npm install
cd ../..
```

## Step 3: Set Up MongoDB

### Option A: Local MongoDB Installation

**macOS (using Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community@6.0
brew services start mongodb-community@6.0
```

**Ubuntu/Debian:**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

**Windows:**
Download and install from [MongoDB Download Center](https://www.mongodb.com/try/download/community)

### Option B: MongoDB Atlas (Cloud)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (M0 free tier is fine for development)
3. Create a database user with read/write permissions
4. Whitelist your IP address (or use 0.0.0.0/0 for development)
5. Get your connection string from the "Connect" button

**Note:** For vector search functionality, you'll need at least an M10 cluster tier.

## Step 4: Set Up Redis

### Option A: Local Redis Installation

**macOS (using Homebrew):**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis-server
```

**Windows:**
Download from [Redis Windows](https://github.com/microsoftarchive/redis/releases)

### Option B: Cloud Redis

Use [Redis Cloud](https://redis.com/try-free/) or [Upstash](https://upstash.com/) for a free cloud Redis instance.

## Step 5: Configure Environment Variables

### Backend Configuration

Create `packages/backend/.env`:

```bash
# Server Configuration
PORT=4000
NODE_ENV=development

# MongoDB Configuration
# For local MongoDB:
MONGODB_URI=mongodb://localhost:27017/curriculum_db
# For MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/curriculum_db

# Redis Configuration
# For local Redis:
REDIS_URL=redis://localhost:6379
# For cloud Redis:
# REDIS_URL=redis://username:password@host:port

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_CHAT_MODEL=gpt-4-turbo

# Auth0 Configuration
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-api-audience

# File Storage Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800

# Security Configuration
ENCRYPTION_KEY=dev-encryption-key-32-characters
API_SIGNING_SECRET=dev-api-signing-secret
CORS_ORIGINS=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring Configuration (optional for local dev)
SENTRY_DSN=
LOG_LEVEL=debug

# Session Configuration
SESSION_TIMEOUT_SECONDS=1800
```

### Frontend Configuration

Create `packages/frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_AUTH0_DOMAIN=your-domain.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id
```

## Step 6: Set Up Auth0

1. Create a free account at [Auth0](https://auth0.com/)
2. Create a new application (Single Page Application)
3. Configure Allowed Callback URLs: `http://localhost:3000/callback`
4. Configure Allowed Logout URLs: `http://localhost:3000`
5. Configure Allowed Web Origins: `http://localhost:3000`
6. Create an API in Auth0 with an identifier (this is your AUTH0_AUDIENCE)
7. Copy your domain, client ID, and audience to the .env files

## Step 7: Initialize the Database

Run database migrations:

```bash
cd packages/backend
npm run migrate
```

(Optional) Seed the database with sample data:

```bash
npm run seed
```

## Step 8: Create MongoDB Vector Search Index

If using MongoDB Atlas with vector search:

1. Go to your cluster in MongoDB Atlas
2. Click on "Search" tab
3. Click "Create Search Index"
4. Choose "JSON Editor"
5. Select database: `curriculum_db`, collection: `knowledgebases`
6. Paste this configuration:

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "embedding": {
        "type": "knnVector",
        "dimensions": 1536,
        "similarity": "cosine"
      },
      "domain": {
        "type": "string"
      },
      "credibilityScore": {
        "type": "number"
      },
      "publicationDate": {
        "type": "date"
      }
    }
  }
}
```

7. Name the index: `knowledge_base_vector_index`
8. Click "Create Search Index"

## Step 9: Start the Development Servers

### Terminal 1: Start Backend API

```bash
cd packages/backend
npm run dev
```

The API will start on http://localhost:4000

### Terminal 2: Start Background Worker

```bash
cd packages/backend
npm run worker
```

### Terminal 3: Start Frontend

```bash
cd packages/frontend
npm run dev
```

The frontend will start on http://localhost:3000

## Step 10: Verify Installation

1. Open http://localhost:3000 in your browser
2. You should see the application homepage
3. Check the backend health endpoint: http://localhost:4000/health
4. You should see: `{"status":"ok","database":"connected","redis":"connected"}`

## Common Issues and Troubleshooting

### MongoDB Connection Issues

**Error: "MongoServerError: Authentication failed"**
- Verify your username and password in the connection string
- Ensure the database user has proper permissions

**Error: "MongooseServerSelectionError: connect ECONNREFUSED"**
- Ensure MongoDB is running: `brew services list` (macOS) or `sudo systemctl status mongod` (Linux)
- Check if MongoDB is listening on the correct port (default: 27017)

### Redis Connection Issues

**Error: "Error: connect ECONNREFUSED 127.0.0.1:6379"**
- Ensure Redis is running: `brew services list` (macOS) or `sudo systemctl status redis` (Linux)
- Test Redis connection: `redis-cli ping` (should return "PONG")

### OpenAI API Issues

**Error: "OpenAI API key is invalid"**
- Verify your API key is correct in .env
- Check your OpenAI account has available credits
- Ensure there are no extra spaces in the API key

### Port Already in Use

**Error: "EADDRINUSE: address already in use :::4000"**
- Another process is using port 4000
- Find and kill the process: `lsof -ti:4000 | xargs kill -9` (macOS/Linux)
- Or change the PORT in your .env file

### Auth0 Configuration Issues

**Error: "Invalid state"**
- Clear browser cookies and local storage
- Verify callback URLs in Auth0 dashboard match your local URLs
- Ensure Auth0 domain and client ID are correct

## Development Workflow

### Running Tests

```bash
# Backend tests
cd packages/backend
npm test

# Frontend tests
cd packages/frontend
npm test
```

### Database Migrations

```bash
# Create a new migration
cd packages/backend
npm run migrate:create migration-name

# Run migrations
npm run migrate

# Rollback last migration
npm run migrate:down
```

### Linting and Formatting

```bash
# Lint all packages
npm run lint

# Format code
npm run format
```

### Viewing Logs

Backend logs are output to the console. For structured logging:

```bash
cd packages/backend
npm run dev | npx pino-pretty
```

## Next Steps

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the system design
- Read [WORKFLOW.md](./WORKFLOW.md) to understand the application workflow
- Read [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions

## Getting Help

If you encounter issues not covered in this guide:

1. Check the [GitHub Issues](repository-url/issues)
2. Review the [MongoDB documentation](https://docs.mongodb.com/)
3. Review the [Render documentation](https://render.com/docs)
4. Contact the development team

## Development Tips

- Use MongoDB Compass for visual database exploration
- Use Redis Commander for Redis data visualization
- Use Postman or Thunder Client for API testing
- Enable debug logging: `LOG_LEVEL=debug` in .env
- Use `console.log` statements liberally during development
- Commit often and write descriptive commit messages
