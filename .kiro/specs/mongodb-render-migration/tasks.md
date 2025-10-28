# Implementation Plan

- [x] 1. Set up MongoDB and create Mongoose models
  - Install mongoose and related dependencies
  - Create all Mongoose model files (Program, Module, LearningOutcome, KnowledgeBase, Assessment, SkillMapping, GenerationJob, User, AuditLog, FileUpload)
  - Define schemas with proper validation, indexes, and relationships
  - Set up MongoDB connection service with connection pooling
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Configure MongoDB Atlas and Vector Search
  - Create MongoDB Atlas cluster (M10 or higher for vector search)
  - Set up database and collections
  - Create vector search index on knowledgeBase collection with 1536 dimensions
  - Configure network access and database users
  - Test connection from local environment
  - _Requirements: 1.5, 2.1, 2.2, 2.3_

- [x] 3. Migrate database layer from PostgreSQL to MongoDB
- [x] 3.1 Replace database connection and query methods
  - Replace pg Pool with Mongoose connection
  - Update db/index.ts to use Mongoose instead of pg
  - Implement transaction support using Mongoose sessions
  - Update health check to use Mongoose connection state
  - _Requirements: 1.1, 1.2_

- [x] 3.2 Update all service files to use Mongoose models
  - Replace SQL queries with Mongoose queries in programService.ts
  - Update uploadService.ts to use Program and Module models
  - Update knowledgeBaseService.ts to use KnowledgeBase model
  - Update curriculumGeneratorService.ts to use GenerationJob model
  - Update userService.ts to use User model
  - Update auditService.ts to use AuditLog model
  - _Requirements: 1.1, 1.2, 1.3, 9.1, 9.2_

- [x] 3.3 Create MongoDB migration scripts
  - Install migrate-mongo package
  - Create migration configuration file
  - Write migration scripts for initial schema setup
  - Write data transformation scripts if migrating existing data
  - Test migrations in development environment
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 4. Replace Pinecone with MongoDB Atlas Vector Search
- [x] 4.1 Create vector search service
  - Create vectorSearchService.ts with MongoDB aggregation pipeline
  - Implement semantic search using $vectorSearch stage
  - Add similarity score filtering and ranking
  - Implement multi-query search with deduplication
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 4.2 Update RAG engine to use MongoDB vector search
  - Replace Pinecone client calls with vectorSearchService
  - Update retrieveContext method to use MongoDB aggregation
  - Update embedding storage to save directly in MongoDB
  - Test vector search accuracy and performance
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4.3 Migrate existing embeddings from Pinecone to MongoDB
  - Export embeddings from Pinecone (if any exist)
  - Transform to MongoDB document format
  - Import into MongoDB knowledgeBase collection
  - Verify vector search works with migrated data
  - _Requirements: 2.1, 2.3_

- [x] 5. Replace AWS S3 with Render Persistent Disk storage
- [x] 5.1 Create file storage service
  - Create fileStorageService.ts for local file system operations
  - Implement saveFile, getFile, and deleteFile methods
  - Add file cleanup for temporary files older than 7 days
  - Create FileUpload model for tracking file metadata
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5.2 Update file upload endpoints
  - Replace S3 upload logic with local file system storage
  - Update multer configuration for file uploads
  - Store files in /app/uploads directory (Render persistent disk mount)
  - Update file download endpoints to serve from local storage
  - _Requirements: 4.1, 4.2, 4.5_

- [x] 5.3 Remove AWS S3 dependencies
  - Uninstall aws-sdk package
  - Remove S3 configuration from config file
  - Remove AWS environment variables from .env.example
  - Update documentation to remove S3 references
  - _Requirements: 4.1, 7.1, 7.2_

- [x] 6. Consolidate AI services to use OpenAI exclusively
- [x] 6.1 Create unified OpenAI service
  - Create openaiService.ts with methods for embeddings and content generation
  - Implement generateEmbedding method using text-embedding-3-large
  - Implement generateEmbeddingsBatch for batch processing
  - Implement generateContent method using GPT-4-turbo
  - Implement generateStructuredContent for JSON responses
  - Add retry logic with exponential backoff
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 6.2 Update all services to use OpenAI service
  - Update embeddingService.ts to use OpenAI service
  - Update llmService.ts to use OpenAI service
  - Update contentGenerationService.ts to use OpenAI service
  - Remove any alternative AI provider code
  - _Requirements: 5.1, 5.2, 5.5_

- [x] 7. Update Redis configuration for Render
  - Update Redis connection to use Render Redis URL
  - Test Bull queue with Render Redis
  - Verify caching works with Render Redis
  - Update session storage configuration
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 8. Remove Docker configuration files
  - Delete Dockerfile files from all packages
  - Delete docker-compose.yml and docker-compose.prod.yml
  - Delete Docker-related scripts
  - Remove Docker instructions from README
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 9. Update configuration for Render deployment
- [x] 9.1 Update backend configuration
  - Update config/index.ts to use MongoDB URI instead of PostgreSQL
  - Add storage configuration for Render persistent disk
  - Update environment variable validation
  - Create new .env.example with MongoDB and Render variables
  - _Requirements: 7.2, 7.4, 8.5_

- [x] 9.2 Update frontend configuration
  - Update Next.js config for Render deployment
  - Configure environment variables for Render
  - Update API URL configuration
  - _Requirements: 7.2, 7.4_

- [x] 10. Create Render deployment configuration
- [x] 10.1 Create render.yaml blueprint
  - Define frontend web service configuration
  - Define backend API web service configuration
  - Define background worker service configuration
  - Configure Render Redis add-on
  - Configure persistent disk for file storage
  - Set up environment variable groups
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 10.2 Configure build and start commands
  - Set build command for frontend: npm install && npm run build
  - Set start command for frontend: npm start
  - Set build command for backend: npm install && npm run build && npm run migrate
  - Set start command for backend: npm start
  - Set start command for worker: npm run worker
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 10.3 Set up health check endpoints
  - Create /health endpoint in backend API
  - Return database connection status
  - Return Redis connection status
  - Configure Render health check path
  - _Requirements: 3.1, 3.2, 11.3_

- [x] 11. Update application startup and initialization
- [x] 11.1 Update backend server startup
  - Connect to MongoDB before starting server
  - Initialize file storage service
  - Set up error handlers for database connection failures
  - Add graceful shutdown handlers
  - _Requirements: 1.5, 4.1, 9.1_

- [x] 11.2 Update worker startup
  - Connect to MongoDB and Redis before processing jobs
  - Initialize Bull queue with Render Redis
  - Set up job processors
  - Add error handlers and retry logic
  - _Requirements: 3.3, 6.1, 6.2_

- [-] 12. Test migration locally
- [x] 12.1 Set up local MongoDB and Redis
  - Install MongoDB locally or use MongoDB Atlas
  - Install Redis locally or use cloud Redis
  - Update .env with local connection strings
  - Test database connection
  - _Requirements: 1.5, 6.1, 7.5_

- [-] 12.2 Test all API endpoints
  - Test program creation and upload
  - Test curriculum generation pipeline
  - Test knowledge base ingestion and search
  - Test file upload and download
  - Test authentication and authorization
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 12.3 Test vector search functionality
  - Ingest test documents into knowledge base
  - Generate embeddings and store in MongoDB
  - Perform semantic searches
  - Verify similarity scores and ranking
  - Compare results with previous Pinecone implementation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 12.4 Test background job processing
  - Trigger curriculum generation jobs
  - Verify jobs are queued in Redis
  - Verify worker processes jobs correctly
  - Test job progress tracking
  - Test job failure and retry logic
  - _Requirements: 6.1, 6.2, 9.2_

- [ ] 13. Deploy to Render
- [ ] 13.1 Create Render services
  - Create frontend web service from GitHub repository
  - Create backend API web service from GitHub repository
  - Create background worker service from GitHub repository
  - Add Render Redis add-on
  - Configure persistent disk for API service
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 13.2 Configure environment variables in Render
  - Add MONGODB_URI from MongoDB Atlas
  - Add REDIS_URL from Render Redis
  - Add OPENAI_API_KEY
  - Add AUTH0_DOMAIN and AUTH0_AUDIENCE
  - Add security keys (ENCRYPTION_KEY, API_SIGNING_SECRET)
  - Add CORS_ORIGINS with frontend URL
  - Add SENTRY_DSN for error tracking
  - _Requirements: 3.4, 7.2, 7.4_

- [ ] 13.3 Configure auto-deploy
  - Enable auto-deploy on main branch push
  - Set up deploy hooks if needed
  - Configure branch-specific deployments
  - _Requirements: 3.5_

- [ ] 13.4 Test deployment
  - Verify all services start successfully
  - Check health endpoints
  - Test API endpoints from frontend
  - Verify database connections
  - Test file uploads to persistent disk
  - _Requirements: 3.1, 3.2, 3.3, 11.3_

- [ ] 14. Set up monitoring and logging
- [ ] 14.1 Configure Render logging
  - Access Render logs for each service
  - Set up log retention
  - Configure log filters
  - _Requirements: 11.1, 11.4_

- [ ] 14.2 Integrate Sentry for error tracking
  - Install Sentry SDK in backend and frontend
  - Configure Sentry DSN in environment variables
  - Set up error boundaries in frontend
  - Test error reporting
  - _Requirements: 11.2, 11.4_

- [ ] 14.3 Implement custom metrics tracking
  - Track OpenAI API usage and costs
  - Track curriculum generation success rate
  - Track API response times
  - Store metrics in MongoDB for analysis
  - _Requirements: 11.5_

- [ ] 15. Configure scaling and performance
- [ ] 15.1 Configure Render auto-scaling
  - Set up auto-scaling rules for API service
  - Configure worker scaling based on queue depth
  - Set resource limits (CPU, memory)
  - _Requirements: 12.1, 12.2_

- [ ] 15.2 Optimize MongoDB performance
  - Verify all indexes are created
  - Test query performance
  - Configure connection pool settings
  - Monitor slow queries
  - _Requirements: 1.4, 12.3_

- [ ] 15.3 Implement rate limiting
  - Add rate limiting middleware to API
  - Configure 100 requests per minute per user
  - Add rate limit headers to responses
  - Test rate limiting behavior
  - _Requirements: 12.4_

- [ ] 16. Create comprehensive documentation
- [ ] 16.1 Create SETUP.md
  - Document local development setup
  - Include MongoDB installation instructions
  - Include Redis installation instructions
  - Document environment variable configuration
  - Include troubleshooting section
  - _Requirements: 8.1, 8.5_

- [ ] 16.2 Create DEPLOYMENT.md
  - Document Render deployment process
  - Include MongoDB Atlas setup instructions
  - Document environment variable configuration in Render
  - Include deployment troubleshooting
  - Document rollback procedures
  - _Requirements: 8.2, 8.5_

- [ ] 16.3 Create ARCHITECTURE.md
  - Document MongoDB schema design
  - Explain data relationships and embedding strategy
  - Document vector search implementation
  - Include architecture diagrams
  - Document service interactions
  - _Requirements: 8.3_

- [ ] 16.4 Create WORKFLOW.md
  - Document complete application workflow from upload to export
  - Include sequence diagrams for key processes
  - Document curriculum generation pipeline
  - Document RAG engine workflow
  - Document quality assurance and benchmarking processes
  - _Requirements: 8.4_

- [ ] 16.5 Update README.md
  - Remove Docker instructions
  - Add MongoDB and Render deployment overview
  - Update quick start guide
  - Add links to detailed documentation
  - Update technology stack section
  - _Requirements: 7.3, 7.4, 8.1, 8.2_

- [ ] 17. Perform final testing and validation
- [ ] 17.1 Run end-to-end tests
  - Test complete SME upload to curriculum generation flow
  - Test student features (tutor bot, simulations)
  - Test admin dashboard functionality
  - Test document export in all formats
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 17.2 Perform load testing
  - Test API response times under load
  - Test concurrent curriculum generation
  - Test vector search performance with large dataset
  - Verify system handles 100+ concurrent users
  - _Requirements: 9.3, 12.5_

- [ ] 17.3 Verify data integrity
  - Verify all data relationships are maintained
  - Test data consistency across operations
  - Verify embeddings are correctly stored and retrieved
  - Test transaction rollback scenarios
  - _Requirements: 1.3, 9.1, 9.2_

- [ ] 17.4 Security testing
  - Test authentication and authorization
  - Verify rate limiting works correctly
  - Test input validation and sanitization
  - Verify encrypted data storage
  - Test CORS configuration
  - _Requirements: 9.4, 12.4_
