# Requirements Document

## Introduction

This specification defines the migration of the Curriculum Generator App from a Docker-based PostgreSQL deployment to a MongoDB-based architecture deployed on Render. The migration maintains all existing functionality while adapting the data layer to MongoDB's document model and replacing AWS services with Render-compatible alternatives. The system will continue to use OpenAI for all AI operations.

## Glossary

- **System**: The Curriculum Generator App
- **MongoDB**: NoSQL document database replacing PostgreSQL
- **Render**: Cloud platform for deployment replacing Docker/AWS
- **MongoDB Atlas**: Cloud-hosted MongoDB service with vector search capabilities
- **OpenAI**: AI service provider for embeddings and content generation
- **Render Services**: Web services, background workers, and cron jobs on Render
- **Environment Variables**: Configuration stored in Render dashboard
- **Vector Search**: MongoDB Atlas Search with vector capabilities replacing Pinecone

## Requirements

### Requirement 1

**User Story:** As a developer, I want to migrate from PostgreSQL to MongoDB, so that I can use a document-based data model better suited for flexible curriculum structures

#### Acceptance Criteria

1. THE System SHALL use MongoDB as the primary database with collections for programs, modules, learningOutcomes, knowledgeBase, assessments, skillMappings, generationJobs, competitorPrograms, users, and auditLogs
2. THE System SHALL use Mongoose ODM for schema definition and data validation
3. THE System SHALL maintain all existing data relationships using embedded documents and references where appropriate
4. THE System SHALL implement database indexes on frequently queried fields including programId, userId, status, and createdAt
5. THE System SHALL connect to MongoDB Atlas cloud service with connection string stored in environment variables

### Requirement 2

**User Story:** As a developer, I want to replace Pinecone with MongoDB Atlas Vector Search, so that I can consolidate vector storage with the main database

#### Acceptance Criteria

1. THE System SHALL use MongoDB Atlas Search with vector search capabilities for storing and querying embeddings
2. THE System SHALL create vector search indexes on the knowledgeBase collection with 1536 dimensions for OpenAI embeddings
3. THE System SHALL perform similarity searches using MongoDB aggregation pipeline with vectorSearch stage
4. THE System SHALL maintain similarity threshold filtering above 0.75
5. THE System SHALL store embeddings as arrays of numbers in MongoDB documents alongside metadata

### Requirement 3

**User Story:** As a developer, I want to deploy the application on Render, so that I can eliminate Docker complexity and use a managed platform

#### Acceptance Criteria

1. THE System SHALL deploy the frontend as a Render Web Service with automatic builds from the Git repository
2. THE System SHALL deploy the backend API as a Render Web Service with health check endpoints
3. THE System SHALL deploy background workers as Render Background Workers for async job processing
4. THE System SHALL use Render environment variables for all configuration including database URLs and API keys
5. THE System SHALL configure auto-deploy on Git push to the main branch

### Requirement 4

**User Story:** As a developer, I want to replace AWS S3 with Render Disk storage or cloud alternatives, so that I can store uploaded files without AWS dependencies

#### Acceptance Criteria

1. THE System SHALL store uploaded Excel files using Render Persistent Disks mounted to the web service
2. WHERE file storage exceeds Render disk limits, THE System SHALL use Cloudinary or similar service for file storage
3. THE System SHALL store file metadata in MongoDB including filename, size, uploadDate, and storagePath
4. THE System SHALL implement file cleanup for temporary files older than 7 days
5. THE System SHALL validate file uploads with maximum size of 50 megabytes

### Requirement 5

**User Story:** As a developer, I want to use OpenAI exclusively for AI operations, so that I have a single AI provider with consistent APIs

#### Acceptance Criteria

1. THE System SHALL use OpenAI GPT-4 or GPT-4-turbo for all content generation tasks
2. THE System SHALL use OpenAI text-embedding-3-large model for generating embeddings with 1536 dimensions
3. THE System SHALL implement retry logic with exponential backoff for OpenAI API failures
4. THE System SHALL track OpenAI API usage and costs in MongoDB for monitoring
5. THE System SHALL set timeout of 30 seconds for OpenAI API calls

### Requirement 6

**User Story:** As a developer, I want to replace Redis with Render Redis, so that I can use managed Redis without Docker

#### Acceptance Criteria

1. THE System SHALL use Render Redis add-on for caching and job queue management
2. THE System SHALL configure Bull queue to connect to Render Redis instance
3. THE System SHALL implement cache layers with TTLs: API responses 5 minutes, knowledge base queries 1 hour, generated content 24 hours
4. THE System SHALL store session data in Render Redis with 30 minute expiration
5. THE System SHALL handle Redis connection failures gracefully with fallback to direct database queries

### Requirement 7

**User Story:** As a developer, I want to remove all Docker configurations, so that the codebase is simplified for Render deployment

#### Acceptance Criteria

1. THE System SHALL remove Dockerfile, docker-compose.yml, and all Docker-related configuration files
2. THE System SHALL replace Docker environment variables with Render environment variable configuration
3. THE System SHALL update documentation to remove Docker setup instructions
4. THE System SHALL provide Render-specific deployment instructions including service configuration
5. THE System SHALL maintain development environment setup using local MongoDB and Redis installations

### Requirement 8

**User Story:** As a developer, I want comprehensive documentation for running the application, so that new developers can set up and understand the system quickly

#### Acceptance Criteria

1. THE System SHALL include a SETUP.md document with step-by-step local development setup instructions
2. THE System SHALL include a DEPLOYMENT.md document with Render deployment instructions and configuration
3. THE System SHALL include an ARCHITECTURE.md document explaining the MongoDB schema design and data flow
4. THE System SHALL include a WORKFLOW.md document describing the complete application workflow from upload to export
5. THE System SHALL include environment variable templates with descriptions for all required configuration

### Requirement 9

**User Story:** As a developer, I want to maintain all existing API endpoints and functionality, so that the migration is transparent to users

#### Acceptance Criteria

1. THE System SHALL maintain all existing REST API endpoints with identical request and response formats
2. THE System SHALL preserve all business logic for curriculum generation, quality assurance, and benchmarking
3. THE System SHALL maintain response time targets: API endpoints under 2 seconds, curriculum generation under 5 minutes
4. THE System SHALL preserve all authentication and authorization mechanisms
5. THE System SHALL maintain backward compatibility with existing frontend code

### Requirement 10

**User Story:** As a developer, I want automated database migrations for MongoDB, so that schema changes can be applied consistently

#### Acceptance Criteria

1. THE System SHALL use migrate-mongo or similar tool for managing MongoDB schema migrations
2. THE System SHALL version all schema changes with migration scripts
3. THE System SHALL support rollback of migrations for error recovery
4. THE System SHALL run migrations automatically on Render deployment using build commands
5. THE System SHALL log all migration executions with timestamps and status

### Requirement 11

**User Story:** As a developer, I want monitoring and logging configured for Render, so that I can track application health and debug issues

#### Acceptance Criteria

1. THE System SHALL use Render's built-in logging for application logs
2. THE System SHALL integrate with external monitoring services like Sentry for error tracking
3. THE System SHALL implement health check endpoints at /health for Render health monitoring
4. THE System SHALL log all critical operations including curriculum generation, file uploads, and API errors
5. THE System SHALL track performance metrics including response times, error rates, and OpenAI API costs

### Requirement 12

**User Story:** As a developer, I want the application to scale on Render, so that it can handle increased load

#### Acceptance Criteria

1. THE System SHALL configure Render auto-scaling for web services based on CPU and memory usage
2. THE System SHALL support horizontal scaling of background workers for parallel job processing
3. THE System SHALL use MongoDB connection pooling with maximum 20 connections per service instance
4. THE System SHALL implement rate limiting at 100 requests per minute per user
5. THE System SHALL handle at least 100 concurrent users with acceptable performance
