# Local MongoDB Setup Guide

## Quick Start

### Option 1: Using Homebrew (macOS - Recommended)

```bash
# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community

# Verify it's running
mongosh --eval "db.version()"
```

### Option 2: Using Docker

```bash
# Start MongoDB container
docker run -d \
  --name mongodb-local \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongo:latest

# Verify it's running
docker ps | grep mongodb-local

# Connect to MongoDB
mongosh mongodb://localhost:27017
```

### Option 3: Download and Run Manually

1. Download MongoDB Community Server from: https://www.mongodb.com/try/download/community
2. Extract and run:
   ```bash
   # Create data directory
   mkdir -p ~/mongodb-data
   
   # Start MongoDB
   /path/to/mongodb/bin/mongod --dbpath ~/mongodb-data
   ```

## Verify MongoDB is Running

```bash
# Check if MongoDB is listening on port 27017
lsof -i :27017

# Or use mongosh to connect
mongosh mongodb://localhost:27017
```

## Run Migrations

Once MongoDB is running:

```bash
cd packages/backend

# Check migration status
npm run migrate:status

# Run migrations
npm run migrate:up

# Rollback if needed
npm run migrate:down
```

## Environment Variables

For local development, create a `.env` file in `packages/backend/`:

```bash
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/curriculum_db

# Or if using a specific database name
MONGODB_DATABASE=curriculum_db
```

## Useful MongoDB Commands

```bash
# Connect to MongoDB shell
mongosh

# Show databases
show dbs

# Use curriculum database
use curriculum_db

# Show collections
show collections

# Query a collection
db.programs.find().pretty()

# Count documents
db.programs.countDocuments()

# Drop database (careful!)
db.dropDatabase()
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 27017
lsof -i :27017

# Kill the process
kill -9 <PID>
```

### Permission Issues
```bash
# Fix data directory permissions
sudo chown -R $(whoami) ~/mongodb-data
```

### Connection Refused
- Make sure MongoDB is running: `brew services list` or `docker ps`
- Check if port 27017 is accessible: `telnet localhost 27017`
- Verify firewall settings aren't blocking the connection

## Stop MongoDB

### Homebrew
```bash
brew services stop mongodb-community
```

### Docker
```bash
docker stop mongodb-local
docker rm mongodb-local
```

### Manual
```bash
# Find MongoDB process
ps aux | grep mongod

# Kill it
kill <PID>
```
