# Curriculum Generation System

## Overview

The curriculum generation system orchestrates the complete pipeline for automatically creating professional certification curricula from SME-submitted Excel templates.

## Architecture

### Components

1. **Job Queue System** (`jobQueueService.ts`)
   - Bull queue with Redis for async job management
   - Configurable retry logic and error handling
   - Job progress tracking and status updates

2. **WebSocket Service** (`websocketService.ts`)
   - Real-time progress notifications to clients
   - Job subscription management
   - Event broadcasting for job updates

3. **Curriculum Generator Service** (`curriculumGeneratorService.ts`)
   - Main orchestration service
   - Implements the complete generation pipeline
   - Handles all stages: validate → retrieve → generate → qa → benchmark

4. **Worker Process** (`worker.ts`, `curriculumGenerationWorker.ts`)
   - Background job processor
   - Runs independently from API server
   - Processes curriculum generation jobs with concurrency of 5

### Pipeline Stages

The curriculum generation pipeline consists of 8 stages:

1. **Validate (5%)** - Validate program data structure and requirements
2. **Retrieve (15%)** - Retrieve relevant context from knowledge base
3. **Generate Program Spec (30%)** - Generate program specification document with all sections
4. **Generate Unit Specs (50%)** - Generate unit specifications for each module (parallelized)
5. **Generate Assessments (65%)** - Create assessment package with MCQs, case studies, rubrics
6. **Generate Skill Book (75%)** - Generate skill mappings with activities and KPIs
7. **Quality Assurance (85%)** - Run automated quality checks
8. **Benchmarking (95%)** - Compare against competitor programs

## API Endpoints

### Trigger Generation
```
POST /api/curriculum/generate/:programId
```
Starts curriculum generation for a program. Returns job ID for tracking.

### Check Status
```
GET /api/curriculum/status/:jobId
```
Get real-time status of a generation job.

### Get Curriculum
```
GET /api/curriculum/:programId
```
Retrieve the complete generated curriculum for a program.

### Queue Statistics
```
GET /api/curriculum/queue/stats
```
Get statistics about the job queue (waiting, active, completed, failed).

## Database Schema

### New Tables

1. **program_specifications** - Stores generated program specification documents
2. **unit_specifications** - Stores unit specifications for each module
3. **assessment_packages** - Stores MCQs, case studies, rubrics, and marking schemes
4. **generation_intermediate_results** - Stores intermediate results for resume capability

## Running the System

### Start API Server
```bash
npm run dev
```

### Start Worker Process
```bash
npm run dev:worker
```

### Production
```bash
npm run build
npm start              # API server
npm run start:worker   # Worker process
```

## WebSocket Integration

Clients can subscribe to job updates via WebSocket:

```javascript
const socket = io('http://localhost:4000', { path: '/ws' });

// Subscribe to job updates
socket.emit('subscribe:job', jobId);

// Listen for progress updates
socket.on('job:progress', (update) => {
  console.log(`Progress: ${update.progress}%`);
  console.log(`Stage: ${update.stage}`);
  console.log(`Message: ${update.message}`);
});

// Listen for completion
socket.on('job:completed', (result) => {
  console.log('Job completed!', result);
});

// Listen for failures
socket.on('job:failed', (error) => {
  console.error('Job failed:', error);
});
```

## Performance

- Target: Complete 120-hour program generation in under 5 minutes
- Parallel processing of unit specifications
- Intermediate result caching for resume capability
- Redis caching for repeated content generation

## Error Handling

- Automatic retry with exponential backoff (3 attempts)
- Graceful degradation with fallback strategies
- Detailed error logging and tracking
- WebSocket notifications for failures

## Monitoring

- Job queue statistics (waiting, active, completed, failed)
- Progress tracking with stage-level granularity
- Audit logging for all generation activities
- Performance metrics (generation time, success rate)

## Future Enhancements

- Implement actual QA service integration
- Implement actual benchmarking service integration
- Add support for resume/restart of failed jobs
- Implement priority queue for urgent generations
- Add support for partial regeneration (specific sections only)
