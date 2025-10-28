# Quick Start Guide

Get the Curriculum Generator App running in 5 minutes.

## Prerequisites

Ensure you have installed:
- Node.js 18+ and npm 9+
- MongoDB 6.0+ (local or MongoDB Atlas account)
- Redis 7+ (local or cloud Redis)

## Setup (First Time)

### Option 1: Automated Setup (Recommended)

```bash
make setup
```

This will:
- Install all Node.js dependencies
- Copy environment file templates
- Check for MongoDB and Redis installation
- Set up Git hooks

### Option 2: Manual Setup

```bash
# 1. Install Node.js dependencies
npm install

# 2. Copy environment files
cp packages/frontend/.env.example packages/frontend/.env.local
cp packages/backend/.env.example packages/backend/.env

# 3. Set up Git hooks
npm run prepare

# 4. Start MongoDB and Redis
# macOS:
brew services start mongodb-community
brew services start redis

# Linux:
sudo systemctl start mongod
sudo systemctl start redis

# 5. Run database migrations
cd packages/backend
npm run migrate
cd ../..
```

## Configure Environment Variables

Edit the following files with your API keys and configuration:

1. `packages/frontend/.env.local` - Frontend configuration
2. `packages/backend/.env` - Backend API configuration
3. `packages/ai-service/.env` - AI service configuration

**Required for basic functionality:**
- `OPENAI_API_KEY` - Get from https://platform.openai.com/api-keys

## Start Development

```bash
# Start all services
make dev

# Or use npm
npm run dev
```

This starts:
- Frontend at http://localhost:3000
- Backend API at http://localhost:4000

## Verify Installation

Check that all services are running:

```bash
# Check MongoDB
mongosh --eval "db.adminCommand('ping')"

# Check Redis
redis-cli ping

# Check frontend
curl http://localhost:3000

# Check backend
curl http://localhost:4000/health
```

## Common Commands

```bash
make help              # Show all available commands
make dev               # Start development servers
make build             # Build all packages
make test              # Run tests
make lint              # Lint code
make format            # Format code
make migrate           # Run database migrations
make services-start    # Start MongoDB and Redis
make services-stop     # Stop MongoDB and Redis
make services-status   # Check service status
make clean             # Clean build artifacts
```

## Troubleshooting

### Port Already in Use

If ports 3000 or 4000 are in use, update the PORT in respective `.env` files.

### MongoDB Not Running

```bash
# macOS:
brew services start mongodb-community

# Linux:
sudo systemctl start mongod

# Check status:
make services-status
```

### Redis Not Running

```bash
# macOS:
brew services start redis

# Linux:
sudo systemctl start redis

# Check status:
redis-cli ping
```

### Node Modules Issues

```bash
make clean
npm install
```

## Next Steps

1. Review the architecture in `.kiro/specs/curriculum-generator-app/design.md`
2. Check the implementation tasks in `.kiro/specs/curriculum-generator-app/tasks.md`
3. Read the contributing guide in `CONTRIBUTING.md`

## Getting Help

- Check the main README.md for detailed documentation
- Review the design document for architecture details
- See CONTRIBUTING.md for development guidelines
