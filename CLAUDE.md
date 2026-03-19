# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered curriculum generation system for AGCQ. Processes SME submissions via Excel templates, uses RAG with OpenAI, and outputs complete program/unit specifications and learning materials through a 13-step workflow.

## Monorepo Structure

Turborepo with three packages:

- `packages/backend` — Express API server + Bull background worker (port 4000)
- `packages/frontend` — Next.js 14 App Router (port 3000)
- `packages/shared-types` — Shared TypeScript interfaces (`ProgramOverview`, `ValidationResult`, `GenerationJob`, etc.)

## Common Commands

### Root (runs across all packages via Turbo)

```bash
npm run dev          # Start all services (frontend + backend + worker)
npm run build        # Build all packages
npm run lint         # Lint all packages
npm run format       # Prettier write all files
npm test             # Run all tests
```

### Backend (`packages/backend`)

```bash
npm run dev          # API server with hot reload (tsx watch)
npm run dev:worker   # Background worker with hot reload
npm run build        # Compile TS to dist/
npm test             # Jest tests
npm test -- path/to/test.test.ts  # Run a single test file
npm run test:watch   # Jest watch mode
npm run test:coverage
npm run migrate      # Run MongoDB migrations (migrate-mongo)
npm run migrate:up   # Run pending migrations
npm run migrate:down   # Rollback last migration
npm run migrate:status # Check pending migrations
npm run db:seed      # Seed MongoDB with sample data
npm run create:indexes
npm run test:mongodb # Test MongoDB connection
npm run test:redis   # Test Redis connection
```

### Frontend (`packages/frontend`)

```bash
npm run dev          # Next.js dev server (port 3000)
npm run build        # Production build
npm start            # Production server
npm run lint         # Next.js lint
```

## Architecture

### 13-Step Workflow (v3 API)

The core feature is a 13-step curriculum generation workflow at `/api/v3/workflow`:

1. Program Foundation
2. Competency & Knowledge Framework (KSA)
3. Program Learning Outcomes (PLOs)
4. Course Framework & MLOs
5. Topic-Level Sources (AGI Standards)
6. Reading Lists
7. Auto-Gradable Assessments — **uses SSE streaming** (`step7StreamRoutes.ts`)
8. Case Studies
9. Glossary
10. Lesson Plans — **separate Bull queue** (`step10Queue.ts`)
11. PowerPoint Generation — **separate Bull queue** (`step11Queue.ts`), module-by-module
12. Assignment Packs — **separate Bull queue** (`step12Queue.ts`), module-by-module with auto-chaining
13. Summative Exam — uses generic Bull queue, **30min timeout, 2 attempts only**

Steps 1-9 and 13 use a generic Bull queue (`packages/backend/src/queues/stepQueue.ts`) with 3 retries and exponential backoff (1min→2min→4min). Steps 10-12 each have dedicated queues for module-by-module processing. The API returns `202 Accepted` with a `jobId`, and the frontend polls `GET /api/v3/workflow/:id/step/:stepNumber/status`.

**Module-by-module chaining (Steps 10-12):** Only one module is queued at startup. The job processor automatically chains to the next ungenerated module on completion. Job IDs include module index: `step{N}-{workflowId}-module-{moduleIndex}`.

### Backend Layers

- **Routes** (`src/routes/`) — Express route handlers. `workflowRoutes.ts` is the main one.
- **Services** (`src/services/`) — Business logic. `workflowService.ts` orchestrates the 13-step process. `llmService.ts` wraps OpenAI with a circuit breaker (5 failures → OPEN, 60s cooldown → HALF_OPEN, 2 successes → CLOSED).
- **Models** (`src/models/`) — Mongoose schemas. `CurriculumWorkflow.ts` is the main state document with `step1` through `step13` sub-documents.
- **Queues** (`src/queues/`) — Bull job queue definitions. `stepQueue.ts` (generic, Steps 1-9 and 13), `step10Queue.ts` (lesson plans), `step11Queue.ts` (PPT generation), and `step12Queue.ts` (assignment packs).
- **Workers** (`src/workers/`) — `curriculumWorker.ts` polls MongoDB every 5s for `status: 'queued'` jobs, processes up to 5 in parallel.
- **Middleware** (`src/middleware/`) — Auth0 JWT validation (`validateJWT`, `loadUser`), rate limiting, CORS.

### Frontend Layers

- **App Router** (`src/app/`) — Pages under `/workflow`, `/standalone`, `/admin`, `/projects`, `/student`
- **Hooks** (`src/hooks/`) — `useWorkflow.ts` (React Query mutations/queries for all 13 steps), `useStepStatus.ts` (polling), `useStep7Streaming.ts` (SSE), `useStep10Status.ts`
- **Stores** (`src/stores/`) — Zustand for auth, UI, toast, theme (NOT for workflow data — that's React Query)
- **Contexts** (`src/contexts/`) — `GenerationContext.tsx` tracks in-flight generation progress, persists to localStorage, auto-clears entries >15min old
- **API Client** (`src/lib/api.ts`) — Axios instance (`api`) with 60s timeout + legacy `fetchAPI` wrapper (used by React Query hooks)

### External Services

- **MongoDB Atlas** (M10+ for vector search) with Mongoose ODM
- **Redis** for Bull queues and caching (graceful fallback when unavailable — steps run synchronously)
- **OpenAI** GPT-4o/GPT-5 via LangChain for content generation, `text-embedding-3-large` for embeddings (1536 dimensions)
- **Auth0** for JWT authentication
- **Sentry** for error tracking
- **Socket.io** for real-time progress updates (room-based: `job:{jobId}`, events: `job:progress`, `job:completed`, `job:failed`)

## Critical Implementation Details

### Redis Configuration

- Redis config uses `config.redis.url` (NOT host/port) — see `packages/backend/src/config/index.ts`
- Bull queues must use URL-based initialization: `new Bull('name', redisUrl, { ... })`
- `step10Queue.ts` uses an older host/port pattern (legacy, works at runtime)
- TLS is auto-enabled for `rediss://` protocol
- Render's Redis uses self-signed certs → `rejectUnauthorized: false` in cacheService

### Queue Job Pattern

- Job IDs follow format: `step{N}-{workflowId}` (generic) or `step{N}-{workflowId}-module-{moduleIndex}` (Steps 10-12)
- Call `removeStepJob()` before re-submitting a step to avoid duplicates
- When Redis is unavailable (`if (!stepQueue)`), steps fall back to synchronous execution in the API process
- Unique module counting uses `new Set()` on module IDs to prevent duplicates from inflating counts

### Race Condition Safeguards

- `workflowService` always refetches the workflow document from MongoDB before AND after module generation (Steps 10-12) to avoid working with stale in-memory state
- After generating a module, checks if another process already added that module during generation before saving

### Frontend Async Responses

- `WorkflowResponse` type has `data: CurriculumWorkflow` — async responses need `(response as any)?.data?.jobId` cast

### Step 7 SSE Streaming

- Uses **manual fetch with response body streaming** (NOT EventSource API) in `useStep7Streaming.ts`
- Endpoint: `POST /api/v3/workflow/{workflowId}/step7/stream`
- Manually parses SSE format (lines starting with `data:`), handles incomplete chunks with TextDecoder
- Auth token read synchronously from localStorage — no refresh on expiry during streaming

### Frontend State Architecture

- **Workflow data**: React Query (TanStack Query) with 1-minute stale time, no refetch on window focus
- **Progress tracking**: `GenerationContext` provides optimistic elapsed time + logarithmic progress (caps at 95%)
- **Polling**: `useStepStatus` (Steps 1-9, 13) and `useStep10Status` (module-by-module) poll at 10s intervals
- **Provider nesting order**: QueryProvider → ThemeProvider → GenerationProvider → ToastContainer

### LLM Service

- Circuit breaker wraps OpenAI calls: 5 failure threshold, 60s cooldown, 2 successes to reset
- 5 max retries with exponential backoff (2sec base) for OpenAI API calls
- GPT-5 uses `max_completion_tokens` instead of `max_tokens`
- Default timeout: 60 minutes to accommodate large token outputs
- Every call logs token usage + cost to `analyticsStorageService` asynchronously

### Auth Bypass in Development

- When `AUTH0_DOMAIN` or `AUTH0_AUDIENCE` are not set, middleware creates a mock user with `sub: 'anonymous-user'` and ADMINISTRATOR role — enables local development without Auth0

### RAG / Knowledge Base

- Semantic search with min similarity threshold 0.65
- Deduplicates by first 100 characters of content, limits to top 10 results
- Silently continues if KB unavailable

### workflowService Signatures

- `processStep3()` takes 2 arguments (workflowId + input), not 1

### Step 11 Error Persistence

- On job failure, the failed event handler writes `step11.lastError = { message, moduleIndex, timestamp }` to the workflow document — allows the frontend to detect failures beyond just queue state

### Pre-existing TypeScript Errors

These files have known TS errors — do not attempt to fix them unless explicitly asked:

- `workflowRoutes.ts` — property mismatches in edit/approve endpoints
- `seed.ts`, `examples/`, `mockRepository.ts`

## Code Style

- **Prettier**: 100 char width, 2 spaces, single quotes, trailing commas (ES5), semicolons
- **ESLint**: `@typescript-eslint/no-explicit-any: warn`, `no-unused-vars: warn` (with `_` prefix ignore)
- **Backend TS**: `strict: false`, target ES2022, CommonJS output
- **Frontend TS**: `strict: true`, target ES2022, Next.js plugin, path alias `@/*` → `./src/*`
- **Husky** pre-commit hooks with lint-staged
- Frontend step components are large monolithic files (~1400-1600 lines per step) — this is intentional

## Testing

- Backend: Jest with `ts-jest` preset, node environment, pattern `**/__tests__/**/*.test.ts`
- Path alias in jest config: `@/*` → `./src/*`
- MongoDB migrations: `migrate-mongo` with CommonJS modules in `migrations/mongodb/`, changelog collection: `changelog`

## Environment Variables

Required for backend: `MONGODB_URI`, `OPENAI_API_KEY`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`
Optional: `REDIS_URL` (queues/caching), `SENTRY_DSN`, `ENCRYPTION_KEY`

Required for frontend: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AUTH0_DOMAIN`, `NEXT_PUBLIC_AUTH0_CLIENT_ID`

See `packages/backend/.env.example` and `packages/frontend/.env.example` for full lists.

## Local Development

Requires Node.js 18+, MongoDB 6.0+, Redis 7+ (optional), OpenAI API key, Auth0 account. Run three processes: API server, background worker, and frontend. See `SETUP.md` for detailed instructions.

## Deployment

Hosted on Render. `render.yaml` defines the blueprint. Backend runs via `npx tsx src/index.ts`. Frontend is standard Next.js. Auto-deploys on push to main. Health check at `GET /health`. Server timeouts set to 60 minutes.
