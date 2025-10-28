# Quick Start Guide

Get the Curriculum Generator App running in under 2 minutes with synthetic data - no database setup required!

## Prerequisites

- Node.js 18+ installed
- npm or yarn

## Steps

### 1. Install Dependencies

```bash
cd packages/backend
npm install
```

### 2. Configure Environment

Copy the local development environment file:

```bash
cp .env.local.example .env
```

This enables mock data mode (`USE_MOCK_DATA=true`), so you don't need MongoDB or PostgreSQL.

### 3. Start the Server

```bash
npm run dev
```

You should see:

```
🔧 Using MOCK DATA (synthetic in-memory data)
✅ Synthetic data initialized
  Users: 2
  Programs: 1
  Modules: 3
  Learning Outcomes: 3
  Assessments: 3
  Knowledge Base: 2
  Skill Mappings: 1
  Generation Jobs: 1
  File Uploads: 1
  Audit Logs: 1
✅ Data service initialized
Server running on port 4000
```

### 4. Test the API

The server is now running with sample data. Try these endpoints:

```bash
# Get all programs
curl http://localhost:4000/api/programs

# Get all modules
curl http://localhost:4000/api/modules

# Get all users
curl http://localhost:4000/api/users
```

### 5. Explore Sample Data

Run the data service examples to see what's available:

```bash
npm run data:examples
```

This will show you:
- All available sample data
- How to query data
- How to create new records
- How to work with relationships

## What's Next?

### Option A: Continue with Mock Data

Perfect for:
- Frontend development
- UI/UX testing
- Feature prototyping
- Quick demos

Just keep `USE_MOCK_DATA=true` in your `.env` file.

### Option B: Switch to Real MongoDB

When you're ready to persist data:

1. **Install MongoDB** (or use MongoDB Atlas)
   ```bash
   # macOS
   brew install mongodb-community
   brew services start mongodb-community
   
   # Or use MongoDB Atlas (cloud)
   # Get connection string from https://cloud.mongodb.com
   ```

2. **Update .env**
   ```bash
   USE_MOCK_DATA=false
   MONGODB_URI=mongodb://localhost:27017/curriculum_db
   # Or for Atlas:
   # MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/curriculum_db
   ```

3. **Initialize MongoDB**
   ```bash
   npm run mongodb:init
   ```

4. **Restart Server**
   ```bash
   npm run dev
   ```

## Available Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run dev:worker       # Start background worker

# Database
npm run mongodb:init     # Initialize MongoDB indexes
npm run data:examples    # Run data service examples

# Testing
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage

# Build
npm run build            # Build for production
npm start                # Start production server
```

## Sample Data Overview

The mock data includes:

### Users
- **Admin User**: admin@example.com (administrator role)
- **SME User**: sme@example.com (subject matter expert role)

### Programs
- **Bachelor of Computer Science**
  - Level 8, 120 credits
  - Information Technology sector
  - Status: draft

### Modules
- **CS101**: Introduction to Programming (core, 120 hours)
- **CS102**: Data Structures and Algorithms (core, 120 hours)
- **CS201**: Web Development (elective, 90 hours)

### Learning Outcomes
- Programming skills (Apply level)
- Fundamental concepts (Understand level)
- Data structure implementation (Apply level)

### Assessments
- MCQ question (easy)
- Essay question (medium)
- Practical question (hard)

### Knowledge Base
- Python programming entry
- Data structures entry
- Each with mock embeddings for RAG

### Other
- 1 Skill Mapping (Problem Solving)
- 1 Completed Generation Job
- 1 File Upload
- 1 Audit Log

## Troubleshooting

### Port Already in Use

If port 4000 is already in use, change it in `.env`:

```bash
PORT=4001
```

### Module Not Found Errors

Make sure you're in the backend directory:

```bash
cd packages/backend
npm install
```

### Mock Data Not Loading

Check your `.env` file has:

```bash
USE_MOCK_DATA=true
```

And restart the server.

### Need to Reset Data

Just restart the server - mock data resets automatically since it's in-memory.

## Documentation

- [Synthetic Data Guide](./SYNTHETIC_DATA_GUIDE.md) - Complete guide to mock data
- [MongoDB Setup Guide](./MONGODB_SETUP.md) - Guide for real database setup
- [Data Service Examples](./src/examples/dataServiceUsage.example.ts) - Code examples

## Support

For issues or questions:
1. Check the logs for error messages
2. Review the documentation above
3. Check that all dependencies are installed
4. Verify your `.env` configuration

## Production Deployment

**Important**: Never use mock data in production!

For production deployment:
1. Set `USE_MOCK_DATA=false`
2. Use MongoDB Atlas or a production MongoDB instance
3. Set all required environment variables
4. Run `npm run build` and `npm start`

See [MongoDB Setup Guide](./MONGODB_SETUP.md) for production configuration.
