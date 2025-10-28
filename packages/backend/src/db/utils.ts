import { QueryResult } from 'pg';
import db from './index';

/**
 * Check if a table exists in the database
 */
export async function tableExists(tableName: string): Promise<boolean> {
  const result = await db.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [tableName]
  );
  return result.rows[0].exists;
}

/**
 * Get row count for a table
 */
export async function getRowCount(tableName: string): Promise<number> {
  const result = await db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Truncate all tables (useful for testing)
 */
export async function truncateAllTables(): Promise<void> {
  const tables = [
    'audit_logs',
    'competitor_programs',
    'generation_jobs',
    'skill_mappings',
    'assessments',
    'knowledge_base',
    'learning_outcomes',
    'modules',
    'programs',
    'users',
  ];

  await db.transaction(async (client) => {
    for (const table of tables) {
      await client.query(`TRUNCATE TABLE ${table} CASCADE`);
    }
  });
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  tables: Array<{ name: string; rowCount: number }>;
  totalRows: number;
}> {
  const tables = [
    'users',
    'programs',
    'modules',
    'learning_outcomes',
    'assessments',
    'skill_mappings',
    'knowledge_base',
    'generation_jobs',
    'competitor_programs',
    'audit_logs',
  ];

  const stats = await Promise.all(
    tables.map(async (table) => ({
      name: table,
      rowCount: await getRowCount(table),
    }))
  );

  const totalRows = stats.reduce((sum, stat) => sum + stat.rowCount, 0);

  return {
    tables: stats,
    totalRows,
  };
}

/**
 * Verify database schema is up to date
 */
export async function verifySchema(): Promise<{
  isValid: boolean;
  missingTables: string[];
}> {
  const requiredTables = [
    'users',
    'programs',
    'modules',
    'learning_outcomes',
    'assessments',
    'skill_mappings',
    'knowledge_base',
    'generation_jobs',
    'competitor_programs',
    'audit_logs',
  ];

  const missingTables: string[] = [];

  for (const table of requiredTables) {
    const exists = await tableExists(table);
    if (!exists) {
      missingTables.push(table);
    }
  }

  return {
    isValid: missingTables.length === 0,
    missingTables,
  };
}

/**
 * Create a new audit log entry
 */
export async function createAuditLog(
  userId: string,
  action: string,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, any>
): Promise<void> {
  await db.query(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, action, resourceType, resourceId, details ? JSON.stringify(details) : null]
  );
}

/**
 * Get recent audit logs
 */
export async function getRecentAuditLogs(
  limit: number = 50
): Promise<QueryResult['rows']> {
  const result = await db.query(
    `SELECT 
      al.*,
      u.email as user_email,
      u.role as user_role
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     ORDER BY al.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}
