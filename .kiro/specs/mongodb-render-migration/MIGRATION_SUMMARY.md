# MongoDB + Render Migration - Complete Specification

## Overview

This specification provides a complete migration plan for the Curriculum Generator App from a Docker-based PostgreSQL/AWS architecture to a MongoDB-based system deployed on Render with OpenAI as the exclusive AI provider.

## What Has Been Created

### 1. Requirements Document
**File:** `.kiro/specs/mongodb-render-migration/requirements.md`

Defines 12 comprehensive requirements covering:
- MongoDB migration with Mongoose ODM
- MongoDB Atlas Vector Search (replacing Pinecone)
- Render deployment architecture
- File storage with Render Persistent Disk
- OpenAI service consolidation
- Redis configuration for Render
- Docker removal
- Comprehensive documentation requirements
- Backward compatibility
- Database migrations
- Monitoring and logging
- Scalability requirements

### 2. Design Document
**File:** `.kiro/specs/mongodb-render-migration/design.md`

Comprehensive design covering:
- High-level architecture diagram
- Complete MongoDB schema with 10 Mongoose models:
  - Program, Module, LearningOutcome
  - KnowledgeBase (with vector embeddings)
  - Assessment, SkillMapping
  - GenerationJob, User, AuditLog, FileUpload
- MongoDB Atlas Vector Search configuration
- Render deployment architecture (3 services + 2 add-ons)
- Migration strategy in 5 phases
- Updated service interfaces:
  - Database service (Mongoose)
  - Vector search service
  - File storage service
  - OpenAI service (consolidated)
- Configuration updates
- Performance optimization strategies
- Security considerations

### 3. Implementation Tasks
**File:** `.kiro/specs/mongodb-render-migration/tasks.md`

Detailed 17-task implementation plan with 60+ subtasks:
1. MongoDB setup and Mongoose models
2. MongoDB Atlas Vector Search configuration
3. Database layer migration (3 subtasks)
4. Pinecone to MongoDB Vector Search migration (3 subtasks)
5. AWS S3 to Render Disk migration (3 subtasks)
6. OpenAI service consolidation (2 subtasks)
7. Redis configuration for Render
8. Docker removal
9. Configuration updates (2 subtasks)
10. Render deployment configuration (3 subtasks)
11. Application initialization updates (2 subtasks)
12. Local testing (4 subtasks)
13. Render deployment (4 subtasks)
14. Monitoring and logging (3 subtasks)
15. Scaling and performance (3 subtasks)
16. Documentation creation (5 subtasks)
17. Final testing and validation (4 subtasks)

### 4. Setup Guide
**File:** `SETUP.md`

Complete local development setup guide including:
- Prerequisites and installation instructions
- MongoDB setup (local and Atlas options)
- Redis setup (local and cloud options)
- Environment variable configuration
- Auth0 setup instructions
- Database initialization
- Vector search index creation
- Development server startup
- Common issues and troubleshooting
- Development tips and best practices

### 5. Deployment Guide
**File:** `DEPLOYMENT.md`

Comprehensive Render deployment guide covering:
- MongoDB Atlas production setup
- Vector search index configuration
- Render service creation (3 services)
- Environment variable configuration
- Auth0 production configuration
- Custom domain setup
- Auto-deploy configuration
- Monitoring and maintenance
- Scaling strategies
- Troubleshooting guide
- Cost optimization tips
- Security best practices

### 6. Architecture Documentation
**File:** `ARCHITECTURE.md`

Detailed architecture documentation including:
- System overview and component diagram
- Complete technology stack
- Detailed architecture diagram
- All 10 MongoDB data models with schemas
- Data relationships and indexes
- Service layer descriptions (9 core services)
- API design patterns
- Vector search implementation details
- Authentication and authorization
- File storage implementation
- Caching strategy with Redis
- Job queue system with Bull
- Error handling patterns
- Performance optimization techniques

### 7. Workflow Documentation
**File:** `WORKFLOW.md`

Complete workflow documentation covering:
- User roles and permissions
- 4 main workflows with sequence diagrams:
  - Curriculum generation workflow
  - Knowledge base ingestion workflow
  - Tutor bot interaction workflow
  - Simulation workflow
- Detailed process flows:
  - Excel upload and validation
  - Curriculum generation pipeline (7 stages)
  - RAG engine process
  - Quality assurance checks
  - Document export process
- Data flow diagrams
- Integration points with external services
- Performance considerations
- Scalability strategies

### 8. Updated README
**File:** `README.md`

Completely rewritten README with:
- MongoDB and Render architecture overview
- Updated technology stack
- Quick start guide
- Environment setup instructions
- Available scripts
- Service URLs (local and production)
- Links to comprehensive documentation
- Key features by user role
- Development workflow
- MongoDB Vector Search information
- Deployment overview
- Monitoring and logging
- Troubleshooting section
- Architecture summary

## Key Architecture Changes

### Database Layer
- **Before:** PostgreSQL with pg driver
- **After:** MongoDB Atlas with Mongoose ODM
- **Benefits:** 
  - Flexible document model for curriculum data
  - Built-in vector search capabilities
  - Easier schema evolution
  - Better fit for nested/hierarchical data

### Vector Search
- **Before:** Pinecone (separate service)
- **After:** MongoDB Atlas Vector Search
- **Benefits:**
  - Consolidated data storage
  - Reduced external dependencies
  - Lower operational complexity
  - Single query for data + vectors

### Deployment
- **Before:** Docker + AWS ECS
- **After:** Render Web Services + Background Workers
- **Benefits:**
  - Simplified deployment
  - Managed infrastructure
  - Auto-scaling
  - Built-in CI/CD
  - Lower DevOps overhead

### File Storage
- **Before:** AWS S3
- **After:** Render Persistent Disk
- **Benefits:**
  - Simpler configuration
  - No AWS dependencies
  - Direct file system access
  - Lower cost for moderate usage

### AI Services
- **Before:** Multiple providers (OpenAI, alternatives)
- **After:** OpenAI exclusively
- **Benefits:**
  - Consistent API
  - Simplified code
  - Better integration
  - Single billing

## Migration Path

### Phase 1: Database Migration
1. Export PostgreSQL data
2. Transform to MongoDB documents
3. Import to MongoDB Atlas
4. Create indexes and vector search index
5. Verify data integrity

### Phase 2: Code Migration
1. Replace pg with Mongoose
2. Update all queries to use Mongoose
3. Replace Pinecone with MongoDB vector search
4. Replace S3 with file system storage
5. Update configuration

### Phase 3: Deployment Setup
1. Create MongoDB Atlas cluster
2. Create Render services
3. Configure environment variables
4. Set up Redis add-on
5. Configure persistent disk

### Phase 4: Testing
1. Functional testing
2. Performance testing
3. Integration testing
4. Security testing

### Phase 5: Documentation
1. Create setup guide
2. Create deployment guide
3. Create architecture guide
4. Create workflow guide
5. Update README

## Implementation Checklist

- [x] Requirements document created
- [x] Design document created
- [x] Implementation tasks defined
- [x] SETUP.md created
- [x] DEPLOYMENT.md created
- [x] ARCHITECTURE.md created
- [x] WORKFLOW.md created
- [x] README.md updated
- [ ] MongoDB models implemented
- [ ] Database layer migrated
- [ ] Vector search implemented
- [ ] File storage migrated
- [ ] OpenAI service consolidated
- [ ] Render deployment configured
- [ ] Testing completed
- [ ] Production deployment

## Next Steps

### For Development Team

1. **Review Specification**
   - Review all documents
   - Ask questions and clarify requirements
   - Approve design decisions

2. **Begin Implementation**
   - Start with Task 1: MongoDB setup
   - Follow tasks sequentially
   - Test each component thoroughly

3. **Local Testing**
   - Set up local MongoDB and Redis
   - Test all functionality
   - Verify vector search accuracy

4. **Deploy to Staging**
   - Create staging Render services
   - Deploy and test
   - Perform load testing

5. **Production Deployment**
   - Create production services
   - Migrate data
   - Monitor closely

### For Project Manager

1. **Resource Allocation**
   - Assign developers to tasks
   - Allocate time for testing
   - Plan deployment windows

2. **Risk Management**
   - Identify potential blockers
   - Plan mitigation strategies
   - Set up rollback procedures

3. **Stakeholder Communication**
   - Share migration plan
   - Set expectations for timeline
   - Plan user communication

## Estimated Timeline

- **Phase 1 (Database Migration):** 1-2 weeks
- **Phase 2 (Code Migration):** 2-3 weeks
- **Phase 3 (Deployment Setup):** 1 week
- **Phase 4 (Testing):** 1-2 weeks
- **Phase 5 (Documentation):** Completed
- **Total:** 5-8 weeks

## Cost Comparison

### Current Architecture (Docker + AWS)
- AWS ECS: ~$100/month
- PostgreSQL RDS: ~$50/month
- Pinecone: ~$70/month
- AWS S3: ~$10/month
- **Total:** ~$230/month

### New Architecture (Render + MongoDB)
- Render Frontend: $7/month
- Render API: $25/month
- Render Worker: $25/month
- Render Redis: $10/month
- Render Disk: $1/month
- MongoDB Atlas M10: $57/month
- **Total:** ~$125/month

**Savings:** ~$105/month (45% reduction)

## Benefits Summary

### Technical Benefits
- Simplified architecture
- Reduced external dependencies
- Better data model fit
- Integrated vector search
- Easier local development
- Faster deployment cycles

### Operational Benefits
- Lower infrastructure costs
- Reduced DevOps overhead
- Managed services
- Auto-scaling
- Built-in monitoring
- Easier troubleshooting

### Developer Benefits
- Simpler setup
- Better documentation
- Consistent tooling
- Faster iteration
- Better debugging
- Modern stack

## Support and Resources

### Documentation
- All documentation in repository root
- Inline code comments
- API documentation (future)

### External Resources
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [Render Documentation](https://render.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)

### Team Support
- Development team for technical questions
- Project manager for timeline/resources
- DevOps team for deployment support

## Conclusion

This specification provides a complete, production-ready migration plan from Docker/PostgreSQL/AWS to MongoDB/Render/OpenAI. All documentation has been created, and the implementation tasks are clearly defined. The migration will result in a simpler, more cost-effective, and easier-to-maintain architecture while preserving all existing functionality.

The next step is to begin implementation following the tasks defined in `tasks.md`, starting with MongoDB setup and Mongoose model creation.
