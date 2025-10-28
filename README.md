# Curriculum Generator App

AI-powered curriculum generation system for AGCQ using MongoDB, OpenAI, and deployed on Render.

## Overview

The Curriculum Generator App automates the creation of professional certification preparation courses. It processes Subject Matter Expert (SME) submissions via Excel templates, uses Retrieval-Augmented Generation (RAG) with OpenAI, and outputs complete program specifications, unit specifications, and learning materials.

## Project Structure

This is a monorepo containing:

- `packages/frontend` - Next.js 14 frontend application
- `packages/backend` - Node.js/Express API server with background workers
- `packages/shared-types` - Shared TypeScript types

## Technology Stack

### Frontend
- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- React Query + Zustand

### Backend
- Node.js 18+ with Express
- TypeScript
- Mongoose ODM for MongoDB
- Bull queue for background jobs

### Database & Storage
- MongoDB Atlas (with vector search)
- Redis (caching and job queue)
- Render Persistent Disk (file storage)

### AI Services
- OpenAI GPT-4-turbo (content generation)
- OpenAI text-embedding-3-large (embeddings)

### Deployment
- Render (Web Services + Background Workers)
- MongoDB Atlas (managed database)
- Render Redis (managed cache)

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- MongoDB 6.0+ (local) or MongoDB Atlas account
- Redis 7+ (local) or cloud Redis
- OpenAI API key
- Auth0 account

## Quick Start

### 1. Install Dependencies

```bash
# Install all dependencies
npm install
```

### 2. Set Up Local Development Environment

Follow the comprehensive setup guide:

```bash
# See detailed instructions in SETUP.md
cat SETUP.md
```

**Quick setup:**

```bash
# Install MongoDB (macOS)
brew install mongodb-community@6.0
brew services start mongodb-community@6.0

# Install Redis (macOS)
brew install redis
brew services start redis

# Copy environment files
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env.local

# Edit .env files with your credentials
```

### 3. Configure Environment Variables

**Backend (.env):**
```bash
MONGODB_URI=mongodb://localhost:27017/curriculum_db
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-your-key-here
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-api-audience
```

**Frontend (.env.local):**
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_AUTH0_DOMAIN=your-domain.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id
```

### 4. Initialize Database

```bash
cd packages/backend
npm run migrate
npm run seed  # Optional: add sample data
```

### 5. Start Development Servers

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

**Terminal 3 - Frontend:**
```bash
cd packages/frontend
npm run dev
```

## Available Scripts

### Root Level
- `npm run dev` - Start all services in development mode
- `npm run build` - Build all packages
- `npm run lint` - Lint all packages
- `npm run format` - Format code with Prettier
- `npm test` - Run all tests

### Backend
- `npm run dev` - Start API server with hot reload
- `npm run worker` - Start background worker
- `npm run build` - Build TypeScript
- `npm run migrate` - Run database migrations
- `npm run migrate:down` - Rollback last migration
- `npm test` - Run backend tests

### Frontend
- `npm run dev` - Start Next.js dev server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run frontend tests

## Services

### Local Development
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:4000
- **API Health Check:** http://localhost:4000/health
- **MongoDB:** localhost:27017
- **Redis:** localhost:6379

### Production (Render)
- **Frontend:** https://curriculum-frontend.onrender.com
- **Backend API:** https://curriculum-api.onrender.com
- **MongoDB Atlas:** Managed cluster
- **Render Redis:** Managed instance

## Documentation

Comprehensive documentation is available:

- **[SETUP.md](./SETUP.md)** - Local development setup guide
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Render deployment instructions
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and data models
- **[WORKFLOW.md](./WORKFLOW.md)** - Application workflows and processes

## Key Features

### For Administrators
- Upload and validate SME Excel submissions
- Manage knowledge base (PDFs, DOCX, URLs)
- Generate curricula with AI
- Review quality assurance reports
- Benchmark against competitors
- Export documents (DOCX, PDF, SCORM)
- View analytics and metrics

### For SMEs
- Upload course content via Excel template
- Review generated curricula
- Provide feedback and request adjustments
- Approve final curriculum

### For Students
- Interactive AI tutor bot
- Workplace simulations
- Personalized learning support

## Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write code following TypeScript best practices
   - Add tests for new functionality
   - Update documentation as needed

3. **Run quality checks**
   ```bash
   npm run lint
   npm run format
   npm test
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```
   Pre-commit hooks will run automatically

5. **Push and create a pull request**
   ```bash
   git push origin feature/your-feature-name
   ```

## MongoDB Vector Search

The app uses MongoDB Atlas Search with vector capabilities for semantic search:

- **Embedding Model:** OpenAI text-embedding-3-large (1536 dimensions)
- **Similarity Metric:** Cosine similarity
- **Index:** `knowledge_base_vector_index` on `knowledgebases` collection
- **Minimum Cluster:** M10 (for vector search support)

## Deployment

### Deploy to Render

Follow the deployment guide for step-by-step instructions:

```bash
cat DEPLOYMENT.md
```

**Quick deployment:**

1. Create MongoDB Atlas cluster (M10+)
2. Create Render services (Frontend, API, Worker)
3. Add Render Redis add-on
4. Configure environment variables
5. Push to main branch (auto-deploy)

### Environment-Specific Configuration

- **Development:** Local MongoDB + Redis
- **Staging:** MongoDB Atlas + Render Redis (separate cluster)
- **Production:** MongoDB Atlas + Render Redis (production cluster)

## Monitoring and Logging

- **Application Logs:** Render dashboard
- **Error Tracking:** Sentry integration
- **Performance Metrics:** Custom metrics in MongoDB
- **Health Checks:** `/health` endpoint

## Troubleshooting

### Common Issues

**MongoDB connection failed:**
```bash
# Check MongoDB is running
brew services list  # macOS
sudo systemctl status mongod  # Linux

# Test connection
mongosh mongodb://localhost:27017/curriculum_db
```

**Redis connection failed:**
```bash
# Check Redis is running
redis-cli ping  # Should return "PONG"
```

**OpenAI API errors:**
- Verify API key is correct
- Check account has available credits
- Review rate limits

See [SETUP.md](./SETUP.md) for detailed troubleshooting.

## Architecture

The system follows a microservices-inspired architecture:

```
Frontend (Next.js) → API (Express) → MongoDB Atlas
                          ↓
                    Background Worker
                          ↓
                    OpenAI API + Redis
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## Contributing

1. Follow the development workflow above
2. Write tests for new features
3. Update documentation
4. Follow TypeScript and React best practices
5. Use conventional commits

## Support

For issues and questions:
- Check documentation in `/docs` folder
- Review [GitHub Issues](repository-url/issues)
- Contact the development team

## License

Proprietary - AGCQ
