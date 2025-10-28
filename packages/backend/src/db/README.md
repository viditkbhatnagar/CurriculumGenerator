# Database Setup

This directory contains database configuration, migrations, and seeding scripts for the Curriculum Generator App.

## Prerequisites

- PostgreSQL 15+ installed and running
- Database created (default: `curriculum_db`)
- Environment variables configured in `.env`

## Environment Variables

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/curriculum_db
```

## Running Migrations

### Apply all pending migrations
```bash
npm run migrate:up
```

### Rollback last migration
```bash
npm run migrate:down
```

### Create a new migration
```bash
npm run migrate:create <migration-name>
```

## Seeding the Database

To populate the database with development data:

```bash
npm run db:seed
```

This will create:
- 5 sample users (admin, SMEs, students)
- 3 sample programs with different statuses
- Modules and learning outcomes for the first program
- Sample assessments and skill mappings
- Knowledge base entries
- Competitor programs for benchmarking
- Audit log entries

## Database Schema

### Core Tables

- **users**: User accounts with roles (Administrator, SME, Student)
- **programs**: Curriculum programs with metadata
- **modules**: Course modules within programs
- **learning_outcomes**: Learning outcomes for each module
- **assessments**: Questions and assessments linked to modules
- **skill_mappings**: Skills mapped to activities and KPIs
- **knowledge_base**: Educational content for RAG
- **generation_jobs**: Async job tracking for curriculum generation
- **competitor_programs**: Competitor curriculum data for benchmarking
- **audit_logs**: Audit trail of all system actions

### Indexes

Performance indexes are created on:
- `programs.status`
- `modules.program_id`
- `learning_outcomes.module_id`
- `assessments.module_id`
- `knowledge_base.domain`
- `generation_jobs.status`
- `audit_logs.user_id`
- `audit_logs.created_at`

## Database Connection

The database connection is managed through a singleton Pool instance in `index.ts`:

```typescript
import db from './db';

// Simple query
const result = await db.query('SELECT * FROM programs WHERE status = $1', ['draft']);

// Transaction
await db.transaction(async (client) => {
  await client.query('INSERT INTO programs ...');
  await client.query('INSERT INTO modules ...');
});

// Health check
const isHealthy = await db.healthCheck();
```

## Migration Files

Migrations are stored in the `migrations/` directory and follow the naming convention:
```
<timestamp>_<description>.js
```

Each migration exports `up` and `down` functions for applying and rolling back changes.
