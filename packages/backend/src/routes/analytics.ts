/**
 * Analytics Routes
 * API endpoints for system analytics and metrics
 * Implements Requirement 10.3
 */

import express, { Request, Response, NextFunction } from 'express';
// import { getPool } from '../db'; // Removed - migrating to MongoDB

const router = express.Router();
// const db = getPool(); // Removed - migrating to MongoDB

/**
 * GET /api/analytics/dashboard
 * Get dashboard metrics
 * Implements Requirement 10.3
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await db.connect();

    try {
      // Get total programs
      const totalProgramsResult = await client.query(
        'SELECT COUNT(*) as count FROM programs'
      );
      const totalPrograms = parseInt(totalProgramsResult.rows[0].count);

      // Get programs by status
      const programsByStatusResult = await client.query(`
        SELECT status, COUNT(*) as count 
        FROM programs 
        GROUP BY status
      `);
      const programsByStatus = programsByStatusResult.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>);

      // Get generation success rate
      const generationStatsResult = await client.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM generation_jobs
      `);
      const generationStats = generationStatsResult.rows[0];
      const successRate = generationStats.total > 0 
        ? (parseInt(generationStats.completed) / parseInt(generationStats.total)) * 100 
        : 0;

      // Get average generation time (in minutes)
      const avgTimeResult = await client.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60) as avg_minutes
        FROM generation_jobs
        WHERE status = 'completed' AND completed_at IS NOT NULL
      `);
      const avgGenerationTime = avgTimeResult.rows[0].avg_minutes 
        ? parseFloat(avgTimeResult.rows[0].avg_minutes).toFixed(2)
        : null;

      // Get total knowledge base sources
      const kbSourcesResult = await client.query(
        'SELECT COUNT(*) as count FROM knowledge_base'
      );
      const totalKBSources = parseInt(kbSourcesResult.rows[0].count);

      // Get active users (users who have created programs in last 30 days)
      const activeUsersResult = await client.query(`
        SELECT COUNT(DISTINCT created_by) as count
        FROM programs
        WHERE created_at >= NOW() - INTERVAL '30 days'
        AND created_by IS NOT NULL
      `);
      const activeUsers = parseInt(activeUsersResult.rows[0].count);

      // Get recent activity (last 7 days)
      const recentActivityResult = await client.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as programs_created
        FROM programs
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      res.json({
        data: {
          overview: {
            totalPrograms,
            programsByStatus,
            successRate: parseFloat(successRate.toFixed(2)),
            avgGenerationTime: avgGenerationTime ? parseFloat(avgGenerationTime) : null,
            totalKBSources,
            activeUsers,
          },
          recentActivity: recentActivityResult.rows.map(row => ({
            date: row.date,
            programsCreated: parseInt(row.programs_created),
          })),
          timestamp: new Date().toISOString(),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get dashboard metrics:', error);
    next(error);
  }
});

/**
 * GET /api/analytics/programs
 * Get program statistics
 * Implements Requirement 10.3
 */
router.get('/programs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, status } = req.query;
    const client = await db.connect();

    try {
      let whereClause = 'WHERE 1=1';
      const values: any[] = [];
      let paramIndex = 1;

      if (startDate) {
        whereClause += ` AND created_at >= $${paramIndex}`;
        values.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND created_at <= $${paramIndex}`;
        values.push(endDate);
        paramIndex++;
      }

      if (status) {
        whereClause += ` AND status = $${paramIndex}`;
        values.push(status);
        paramIndex++;
      }

      // Get program statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total_programs,
          COUNT(DISTINCT industry_sector) as unique_sectors,
          AVG(total_credits) as avg_credits,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_programs,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_programs,
          COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_programs
        FROM programs
        ${whereClause}
      `;

      const statsResult = await client.query(statsQuery, values);
      const stats = statsResult.rows[0];

      // Get programs by qualification level
      const levelQuery = `
        SELECT qualification_level, COUNT(*) as count
        FROM programs
        ${whereClause}
        GROUP BY qualification_level
        ORDER BY count DESC
      `;

      const levelResult = await client.query(levelQuery, values);

      // Get programs by industry sector
      const sectorQuery = `
        SELECT industry_sector, COUNT(*) as count
        FROM programs
        ${whereClause}
        AND industry_sector IS NOT NULL
        GROUP BY industry_sector
        ORDER BY count DESC
        LIMIT 10
      `;

      const sectorResult = await client.query(sectorQuery, values);

      // Get quality score trends (if QA reports exist)
      const qualityQuery = `
        SELECT 
          DATE_TRUNC('day', generated_at) as date,
          AVG(overall_score) as avg_score
        FROM qa_reports
        WHERE generated_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', generated_at)
        ORDER BY date DESC
      `;

      const qualityResult = await client.query(qualityQuery);

      res.json({
        data: {
          statistics: {
            totalPrograms: parseInt(stats.total_programs),
            uniqueSectors: parseInt(stats.unique_sectors),
            avgCredits: stats.avg_credits ? parseFloat(stats.avg_credits).toFixed(2) : null,
            completedPrograms: parseInt(stats.completed_programs),
            draftPrograms: parseInt(stats.draft_programs),
            processingPrograms: parseInt(stats.processing_programs),
          },
          byQualificationLevel: levelResult.rows.map(row => ({
            level: row.qualification_level,
            count: parseInt(row.count),
          })),
          byIndustrySector: sectorResult.rows.map(row => ({
            sector: row.industry_sector,
            count: parseInt(row.count),
          })),
          qualityTrends: qualityResult.rows.map(row => ({
            date: row.date,
            avgScore: parseFloat(row.avg_score).toFixed(2),
          })),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get program statistics:', error);
    next(error);
  }
});

/**
 * GET /api/analytics/users
 * Get user engagement data
 * Implements Requirement 10.3
 */
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await db.connect();

    try {
      // Get total users
      const totalUsersResult = await client.query(
        'SELECT COUNT(*) as count FROM users'
      );
      const totalUsers = parseInt(totalUsersResult.rows[0].count);

      // Get users by role
      const usersByRoleResult = await client.query(`
        SELECT role, COUNT(*) as count
        FROM users
        GROUP BY role
      `);
      const usersByRole = usersByRoleResult.rows.reduce((acc, row) => {
        acc[row.role] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>);

      // Get active users (logged in within last 30 days)
      const activeUsersResult = await client.query(`
        SELECT COUNT(*) as count
        FROM users
        WHERE last_login >= NOW() - INTERVAL '30 days'
      `);
      const activeUsers = parseInt(activeUsersResult.rows[0].count);

      // Get programs per user
      const programsPerUserResult = await client.query(`
        SELECT 
          u.id,
          u.email,
          u.role,
          COUNT(p.id) as program_count,
          MAX(p.created_at) as last_program_created
        FROM users u
        LEFT JOIN programs p ON u.id = p.created_by
        GROUP BY u.id, u.email, u.role
        HAVING COUNT(p.id) > 0
        ORDER BY program_count DESC
        LIMIT 20
      `);

      // Get user activity over time (last 30 days)
      const activityResult = await client.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(DISTINCT user_id) as active_users,
          COUNT(*) as total_actions
        FROM audit_logs
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      // Get most common actions
      const actionsResult = await client.query(`
        SELECT 
          action,
          COUNT(*) as count
        FROM audit_logs
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY action
        ORDER BY count DESC
        LIMIT 10
      `);

      res.json({
        data: {
          overview: {
            totalUsers,
            usersByRole,
            activeUsers,
            activeUserPercentage: totalUsers > 0 
              ? parseFloat(((activeUsers / totalUsers) * 100).toFixed(2))
              : 0,
          },
          topContributors: programsPerUserResult.rows.map(row => ({
            userId: row.id,
            email: row.email,
            role: row.role,
            programCount: parseInt(row.program_count),
            lastProgramCreated: row.last_program_created,
          })),
          activityTimeline: activityResult.rows.map(row => ({
            date: row.date,
            activeUsers: parseInt(row.active_users),
            totalActions: parseInt(row.total_actions),
          })),
          topActions: actionsResult.rows.map(row => ({
            action: row.action,
            count: parseInt(row.count),
          })),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get user engagement data:', error);
    next(error);
  }
});

/**
 * GET /api/analytics/generation-performance
 * Get curriculum generation performance metrics
 */
router.get('/generation-performance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await db.connect();

    try {
      // Get generation job statistics
      const jobStatsResult = await client.query(`
        SELECT 
          status,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60) as avg_duration_minutes
        FROM generation_jobs
        GROUP BY status
      `);

      // Get generation performance over time
      const performanceResult = await client.query(`
        SELECT 
          DATE(started_at) as date,
          COUNT(*) as total_jobs,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          AVG(CASE 
            WHEN status = 'completed' AND completed_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (completed_at - started_at)) / 60 
          END) as avg_duration_minutes
        FROM generation_jobs
        WHERE started_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(started_at)
        ORDER BY date DESC
      `);

      // Get slowest generations
      const slowestResult = await client.query(`
        SELECT 
          gj.id as job_id,
          gj.program_id,
          p.program_name,
          EXTRACT(EPOCH FROM (gj.completed_at - gj.started_at)) / 60 as duration_minutes,
          gj.started_at,
          gj.completed_at
        FROM generation_jobs gj
        JOIN programs p ON gj.program_id = p.id
        WHERE gj.status = 'completed' AND gj.completed_at IS NOT NULL
        ORDER BY duration_minutes DESC
        LIMIT 10
      `);

      res.json({
        data: {
          jobStatistics: jobStatsResult.rows.map(row => ({
            status: row.status,
            count: parseInt(row.count),
            avgDurationMinutes: row.avg_duration_minutes 
              ? parseFloat(row.avg_duration_minutes).toFixed(2)
              : null,
          })),
          performanceTimeline: performanceResult.rows.map(row => ({
            date: row.date,
            totalJobs: parseInt(row.total_jobs),
            completed: parseInt(row.completed),
            failed: parseInt(row.failed),
            avgDurationMinutes: row.avg_duration_minutes 
              ? parseFloat(row.avg_duration_minutes).toFixed(2)
              : null,
          })),
          slowestGenerations: slowestResult.rows.map(row => ({
            jobId: row.job_id,
            programId: row.program_id,
            programName: row.program_name,
            durationMinutes: parseFloat(row.duration_minutes).toFixed(2),
            startedAt: row.started_at,
            completedAt: row.completed_at,
          })),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get generation performance metrics:', error);
    next(error);
  }
});

/**
 * GET /api/analytics/knowledge-base
 * Get knowledge base statistics
 */
router.get('/knowledge-base', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await db.connect();

    try {
      // Get total sources
      const totalSourcesResult = await client.query(
        'SELECT COUNT(*) as count FROM knowledge_base'
      );
      const totalSources = parseInt(totalSourcesResult.rows[0].count);

      // Get sources by domain
      const byDomainResult = await client.query(`
        SELECT domain, COUNT(*) as count
        FROM knowledge_base
        GROUP BY domain
        ORDER BY count DESC
      `);

      // Get sources by type
      const byTypeResult = await client.query(`
        SELECT source_type, COUNT(*) as count
        FROM knowledge_base
        GROUP BY source_type
        ORDER BY count DESC
      `);

      // Get average credibility score
      const avgCredibilityResult = await client.query(`
        SELECT AVG(credibility_score) as avg_score
        FROM knowledge_base
        WHERE credibility_score IS NOT NULL
      `);

      // Get sources added over time
      const timelineResult = await client.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as sources_added
        FROM knowledge_base
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      res.json({
        data: {
          overview: {
            totalSources,
            avgCredibilityScore: avgCredibilityResult.rows[0].avg_score 
              ? parseFloat(avgCredibilityResult.rows[0].avg_score).toFixed(2)
              : null,
          },
          byDomain: byDomainResult.rows.map(row => ({
            domain: row.domain,
            count: parseInt(row.count),
          })),
          byType: byTypeResult.rows.map(row => ({
            type: row.source_type,
            count: parseInt(row.count),
          })),
          timeline: timelineResult.rows.map(row => ({
            date: row.date,
            sourcesAdded: parseInt(row.sources_added),
          })),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get knowledge base statistics:', error);
    next(error);
  }
});

export default router;
