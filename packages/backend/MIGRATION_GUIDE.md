# Database Migration Guide

Quick reference for common database operations.

## Setup (First Time)

```bash
# 1. Start PostgreSQL
docker-compose up -d postgres

# 2. Navigate to backend
cd packages/backend

# 3. Run migrations
npm run migrate:up

# 4. Seed development data
npm run db:seed

# 5. Verify setup
npm run db:verify
```

## Daily Development

### Check Database Status
```bash
npm run db:verify
```

### View Migration Status
```bash
npm run migrate
```

### Reset Database (Development Only)
```bash
# Rollback all migrations
npm run migrate:down

# Reapply migrations
npm run migrate:up

# Reseed data
npm run db:seed
```

## Creating New Migrations

### 1. Create Migration File
```bash
npm run migrate:create add-new-table
```

### 2. Edit Migration File
```javascript
// migrations/TIMESTAMP_add-new-table.js
exports.up = (pgm) => {
  pgm.createTable('new_table', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Add indexes
  pgm.createIndex('new_table', 'name');
};

exports.down = (pgm) => {
  pgm.dropTable('new_table');
};
```

### 3. Apply Migration
```bash
npm run migrate:up
```

### 4. Test Rollback
```bash
npm run migrate:down
npm run migrate:up
```

## Common Migration Operations

### Add Column
```javascript
pgm.addColumn('table_name', {
  new_column: {
    type: 'varchar(100)',
    notNull: false,
  },
});
```

### Modify Column
```javascript
pgm.alterColumn('table_name', 'column_name', {
  type: 'text',
  notNull: true,
});
```

### Add Index
```javascript
pgm.createIndex('table_name', 'column_name', {
  name: 'idx_table_column',
});
```

### Add Foreign Key
```javascript
pgm.addConstraint('child_table', 'fk_parent', {
  foreignKeys: {
    columns: 'parent_id',
    references: 'parent_table(id)',
    onDelete: 'CASCADE',
  },
});
```

### Add Check Constraint
```javascript
pgm.addConstraint('table_name', 'check_positive', {
  check: 'value > 0',
});
```

## Troubleshooting

### Migration Failed
```bash
# Check error message
npm run migrate

# Rollback failed migration
npm run migrate:down

# Fix migration file
# Reapply
npm run migrate:up
```

### Database Connection Error
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Seed Script Error
```bash
# Check if migrations are applied
npm run db:verify

# Clear and reseed
npm run migrate:down
npm run migrate:up
npm run db:seed
```

## Best Practices

1. **Always test rollback**: Ensure `down` migration works
2. **Use transactions**: Wrap related changes in transactions
3. **Add indexes**: Index foreign keys and frequently queried columns
4. **Document changes**: Add comments explaining complex migrations
5. **Test on staging**: Apply migrations to staging before production
6. **Backup first**: Always backup production before migrations
7. **Version control**: Commit migration files to git
8. **Sequential naming**: Let node-pg-migrate handle timestamps

## Production Deployment

### Pre-deployment
```bash
# 1. Backup production database
pg_dump -U user -h host dbname > backup_$(date +%Y%m%d).sql

# 2. Test migrations on staging
npm run migrate:up

# 3. Verify staging
npm run db:verify
```

### Deployment
```bash
# 1. Apply migrations
npm run migrate:up

# 2. Verify production
npm run db:verify

# 3. Monitor application logs
```

### Rollback (if needed)
```bash
# Rollback last migration
npm run migrate:down

# Restore from backup (if necessary)
psql -U user -h host dbname < backup_YYYYMMDD.sql
```

## Useful SQL Queries

### Check Table Structure
```sql
\d table_name
```

### View All Tables
```sql
\dt
```

### Check Indexes
```sql
\di
```

### View Foreign Keys
```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

### Check Table Sizes
```sql
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```
