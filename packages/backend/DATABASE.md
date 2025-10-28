# Database Documentation

## Overview

The Curriculum Generator App uses PostgreSQL 15 as its primary relational database. The database schema supports the complete curriculum generation workflow, including user management, program data, knowledge base, and audit logging.

## Quick Start

### 1. Start the Database

Using Docker Compose (recommended):
```bash
docker-compose up -d postgres
```

Or use your local PostgreSQL installation.

### 2. Run Migrations

```bash
cd packages/backend
npm run migrate:up
```

### 3. Seed Development Data

```bash
npm run db:seed
```

### 4. Verify Setup

```bash
npm run db:verify
```

## Database Schema

### Entity Relationship Overview

```
users
  └── programs (created_by)
       ├── modules
       │    ├── learning_outcomes
       │    └── assessments
       ├── skill_mappings
       └── generation_jobs

knowledge_base (standalone)
competitor_programs (standalone)
audit_logs (references users)
```

### Table Descriptions

#### users
Stores user accounts with authentication and role information.

**Columns:**
- `id` (UUID, PK): Unique user identifier
- `email` (VARCHAR): User email address (unique)
- `role` (VARCHAR): User role (Administrator, SME, Student)
- `auth_provider_id` (VARCHAR): External auth provider ID (Auth0)
- `created_at` (TIMESTAMP): Account creation timestamp
- `last_login` (TIMESTAMP): Last login timestamp

**Indexes:**
- Primary key on `id`
- Unique constraint on `email`

---

#### programs
Stores curriculum program metadata and status.

**Columns:**
- `id` (UUID, PK): Unique program identifier
- `program_name` (VARCHAR): Program title
- `qualification_level` (VARCHAR): Level (e.g., "Level 5")
- `qualification_type` (VARCHAR): Type (e.g., "Professional Certificate")
- `total_credits` (INTEGER): Total credit hours (default: 120)
- `industry_sector` (VARCHAR): Industry sector
- `status` (VARCHAR): Program status (draft, submitted, under review, approved)
- `created_by` (UUID, FK): Reference to users table
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

**Indexes:**
- Primary key on `id`
- Index on `status` for filtering
- Foreign key to `users(id)`

---

#### modules
Stores course modules within programs.

**Columns:**
- `id` (UUID, PK): Unique module identifier
- `program_id` (UUID, FK): Reference to programs table
- `module_code` (VARCHAR): Module code (e.g., "BI101")
- `module_title` (VARCHAR): Module title
- `hours` (INTEGER): Module duration in hours
- `module_aim` (TEXT): Module objectives
- `core_elective` (VARCHAR): Core or Elective designation
- `sequence_order` (INTEGER): Order within program
- `created_at` (TIMESTAMP): Creation timestamp

**Indexes:**
- Primary key on `id`
- Index on `program_id` for efficient joins
- Foreign key to `programs(id)` with CASCADE delete

---

#### learning_outcomes
Stores learning outcomes for each module.

**Columns:**
- `id` (UUID, PK): Unique outcome identifier
- `module_id` (UUID, FK): Reference to modules table
- `outcome_text` (TEXT): Learning outcome description
- `assessment_criteria` (JSONB): Assessment criteria array
- `knowledge_skill_competency` (VARCHAR): KSC classification
- `bloom_level` (VARCHAR): Bloom's Taxonomy level
- `created_at` (TIMESTAMP): Creation timestamp

**Indexes:**
- Primary key on `id`
- Index on `module_id` for efficient joins
- Foreign key to `modules(id)` with CASCADE delete

---

#### assessments
Stores assessment questions and case studies.

**Columns:**
- `id` (UUID, PK): Unique assessment identifier
- `module_id` (UUID, FK): Reference to modules table
- `question_type` (VARCHAR): Type (multiple_choice, case_study, etc.)
- `question_text` (TEXT): Question content
- `options` (JSONB): Answer options for MCQs
- `correct_answer` (TEXT): Correct answer
- `explanation` (TEXT): Answer explanation
- `difficulty` (VARCHAR): Difficulty level (easy, medium, hard)
- `learning_outcome_id` (UUID, FK): Reference to learning_outcomes
- `created_at` (TIMESTAMP): Creation timestamp

**Indexes:**
- Primary key on `id`
- Index on `module_id` for efficient joins
- Foreign key to `modules(id)` with CASCADE delete
- Foreign key to `learning_outcomes(id)`

---

#### skill_mappings
Stores skill mappings with activities and KPIs.

**Columns:**
- `id` (UUID, PK): Unique skill mapping identifier
- `program_id` (UUID, FK): Reference to programs table
- `skill_name` (VARCHAR): Skill name
- `domain` (VARCHAR): Skill domain
- `activities` (JSONB): Array of practical activities
- `kpis` (JSONB): Array of measurable KPIs
- `linked_outcomes` (UUID[]): Array of learning outcome IDs
- `assessment_criteria` (JSONB): Assessment criteria
- `created_at` (TIMESTAMP): Creation timestamp

**Indexes:**
- Primary key on `id`
- Foreign key to `programs(id)` with CASCADE delete

---

#### knowledge_base
Stores educational content for RAG retrieval.

**Columns:**
- `id` (UUID, PK): Unique knowledge base entry identifier
- `content` (TEXT): Text content
- `source_url` (VARCHAR): Source URL
- `source_type` (VARCHAR): Source type (peer-reviewed, textbook, etc.)
- `publication_date` (DATE): Publication date
- `domain` (VARCHAR): Content domain
- `credibility_score` (INTEGER): Credibility score (0-100)
- `metadata` (JSONB): Additional metadata
- `embedding_id` (VARCHAR): Reference to Pinecone vector ID
- `created_at` (TIMESTAMP): Creation timestamp

**Indexes:**
- Primary key on `id`
- Index on `domain` for filtering
- Check constraint on `credibility_score` (0-100)

---

#### generation_jobs
Tracks async curriculum generation jobs.

**Columns:**
- `id` (UUID, PK): Unique job identifier
- `program_id` (UUID, FK): Reference to programs table
- `status` (VARCHAR): Job status (queued, processing, completed, failed)
- `progress` (INTEGER): Progress percentage (0-100)
- `started_at` (TIMESTAMP): Job start time
- `completed_at` (TIMESTAMP): Job completion time
- `error_message` (TEXT): Error message if failed
- `created_at` (TIMESTAMP): Creation timestamp

**Indexes:**
- Primary key on `id`
- Index on `status` for job queue queries
- Foreign key to `programs(id)` with CASCADE delete

---

#### competitor_programs
Stores competitor curriculum data for benchmarking.

**Columns:**
- `id` (UUID, PK): Unique competitor program identifier
- `institution_name` (VARCHAR): Institution name
- `program_name` (VARCHAR): Program name
- `level` (VARCHAR): Qualification level
- `topics` (JSONB): Array of topics covered
- `structure` (JSONB): Program structure metadata
- `created_at` (TIMESTAMP): Creation timestamp

**Indexes:**
- Primary key on `id`

---

#### audit_logs
Stores audit trail of all system actions.

**Columns:**
- `id` (UUID, PK): Unique log entry identifier
- `user_id` (UUID, FK): Reference to users table
- `action` (VARCHAR): Action performed
- `resource_type` (VARCHAR): Resource type affected
- `resource_id` (UUID): Resource identifier
- `details` (JSONB): Additional details
- `created_at` (TIMESTAMP): Action timestamp

**Indexes:**
- Primary key on `id`
- Index on `user_id` for user activity queries
- Index on `created_at` for time-based queries
- Foreign key to `users(id)`

---

## Migration Management

### Creating a New Migration

```bash
npm run migrate:create <migration-name>
```

This creates a new migration file in `migrations/` directory.

### Migration File Structure

```javascript
exports.up = (pgm) => {
  // Apply changes
  pgm.createTable('table_name', {
    // columns
  });
};

exports.down = (pgm) => {
  // Rollback changes
  pgm.dropTable('table_name');
};
```

### Applying Migrations

```bash
# Apply all pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Rollback specific number of migrations
npm run migrate:down 2
```

## Database Connection

### Configuration

Database connection is configured via environment variable:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/curriculum_db
```

### Connection Pool

The application uses a connection pool with the following settings:
- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

### Usage Examples

```typescript
import db from './db';

// Simple query
const result = await db.query(
  'SELECT * FROM programs WHERE status = $1',
  ['draft']
);

// Transaction
await db.transaction(async (client) => {
  await client.query('INSERT INTO programs ...');
  await client.query('INSERT INTO modules ...');
});

// Health check
const isHealthy = await db.healthCheck();
```

## Seeding Data

The seed script populates the database with development data:

- 5 users (1 admin, 2 SMEs, 2 students)
- 3 programs with different statuses
- 6 modules for the first program
- 5 learning outcomes per module
- 3 assessments per module
- 2 skill mappings
- 3 knowledge base entries
- 2 competitor programs
- Sample audit logs

Run seeding:
```bash
npm run db:seed
```

## Backup and Restore

### Backup

```bash
# Using Docker
docker exec curriculum-postgres pg_dump -U postgres curriculum_db > backup.sql

# Using local PostgreSQL
pg_dump -U postgres curriculum_db > backup.sql
```

### Restore

```bash
# Using Docker
docker exec -i curriculum-postgres psql -U postgres curriculum_db < backup.sql

# Using local PostgreSQL
psql -U postgres curriculum_db < backup.sql
```

## Performance Optimization

### Indexes

All frequently queried columns have indexes:
- Foreign keys for joins
- Status fields for filtering
- Timestamp fields for sorting

### Query Optimization Tips

1. Use parameterized queries to prevent SQL injection
2. Limit result sets with `LIMIT` and `OFFSET`
3. Use `EXPLAIN ANALYZE` to identify slow queries
4. Consider materialized views for complex aggregations
5. Use connection pooling (already configured)

### Monitoring Queries

```sql
-- Show slow queries
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;

-- Show table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Troubleshooting

### Connection Issues

1. Verify PostgreSQL is running:
   ```bash
   docker-compose ps postgres
   ```

2. Check connection string in `.env`

3. Test connection:
   ```bash
   npm run db:verify
   ```

### Migration Issues

1. Check migration status:
   ```bash
   npm run migrate
   ```

2. View applied migrations:
   ```sql
   SELECT * FROM pgmigrations ORDER BY run_on DESC;
   ```

3. Rollback and reapply if needed:
   ```bash
   npm run migrate:down
   npm run migrate:up
   ```

### Performance Issues

1. Check for missing indexes
2. Analyze query plans with `EXPLAIN`
3. Monitor connection pool usage
4. Consider read replicas for heavy read workloads

## Security Considerations

1. **Never commit credentials**: Use environment variables
2. **Use parameterized queries**: Prevent SQL injection
3. **Limit permissions**: Use role-based database users
4. **Encrypt connections**: Use SSL/TLS in production
5. **Regular backups**: Automated daily backups at 2:00 AM UTC
6. **Audit logging**: All actions are logged in `audit_logs` table

## Production Deployment

### Pre-deployment Checklist

- [ ] Run all migrations on staging
- [ ] Test rollback procedures
- [ ] Verify backup strategy
- [ ] Configure SSL/TLS
- [ ] Set up monitoring and alerts
- [ ] Review and optimize slow queries
- [ ] Configure connection pool for production load
- [ ] Set up read replicas if needed

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

### Monitoring

Set up monitoring for:
- Connection pool usage
- Query performance
- Disk space
- Replication lag (if using replicas)
- Backup success/failure
