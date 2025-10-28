/**
 * Benchmarking Routes
 * API endpoints for curriculum benchmarking against competitor institutions
 * Implements Requirements 7.1, 7.2, 7.5
 */

import express, { Request, Response, NextFunction } from 'express';
// import { getPool } from '../db'; // Removed - migrating to MongoDB
import { createAuditLog } from '../services/auditService';
import { benchmarkingService } from '../services/benchmarkingService';

const router = express.Router();
// const db = getPool(); // Removed - migrating to MongoDB

/**
 * GET /api/benchmarks/compare/:programId
 * Compare curriculum against competitor institutions
 * Implements Requirements 7.2, 7.5
 */
router.get('/compare/:programId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const programId = req.params.programId;
    const userId = (req as any).user?.id;

    // Check if program exists
    const programResult = await db.query(
      'SELECT * FROM programs WHERE id = $1',
      [programId]
    );

    if (programResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROGRAM_NOT_FOUND',
          message: 'Program not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    // Generate benchmark report
    const report = await benchmarkingService.compareCurriculum(programId);

    // Log the action
    if (userId) {
      await createAuditLog({
        userId,
        action: 'BENCHMARK_CURRICULUM',
        resourceType: 'program',
        resourceId: programId,
        details: {
          competitorsCompared: report.comparisons.length,
          overallSimilarity: report.overallSimilarity,
        },
      });
    }

    res.json({
      data: report,
    });
  } catch (error: any) {
    console.error('Benchmarking error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'CURRICULUM_NOT_FOUND',
          message: 'Curriculum not generated for this program',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    next(error);
  }
});

/**
 * POST /api/benchmarks/competitors
 * Add a competitor program for benchmarking
 * Implements Requirement 7.1
 */
router.post('/competitors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { institutionName, programName, level, topics, structure } = req.body;
    const userId = (req as any).user?.id;

    // Validation
    if (!institutionName || !programName) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Institution name and program name are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    // Insert competitor program
    const query = `
      INSERT INTO competitor_programs (
        institution_name, program_name, level, topics, structure
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      institutionName,
      programName,
      level || null,
      JSON.stringify(topics || []),
      JSON.stringify(structure || {}),
    ];

    const result = await db.query(query, values);
    const competitor = result.rows[0];

    // Log the action
    if (userId) {
      await createAuditLog({
        userId,
        action: 'ADD_COMPETITOR_PROGRAM',
        resourceType: 'competitor_program',
        resourceId: competitor.id,
        details: {
          institutionName,
          programName,
        },
      });
    }

    res.status(201).json({
      message: 'Competitor program added successfully',
      data: {
        id: competitor.id,
        institutionName: competitor.institution_name,
        programName: competitor.program_name,
        level: competitor.level,
        topics: competitor.topics,
        structure: competitor.structure,
        createdAt: competitor.created_at,
      },
    });
  } catch (error) {
    console.error('Failed to add competitor program:', error);
    next(error);
  }
});

/**
 * GET /api/benchmarks/competitors
 * List all competitor programs
 * Implements Requirement 7.1
 */
router.get('/competitors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { institution, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM competitor_programs WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (institution) {
      query += ` AND institution_name ILIKE $${paramIndex}`;
      values.push(`%${institution}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    const result = await db.query(query, values);

    res.json({
      data: result.rows.map(row => ({
        id: row.id,
        institutionName: row.institution_name,
        programName: row.program_name,
        level: row.level,
        topics: row.topics,
        structure: row.structure,
        createdAt: row.created_at,
      })),
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Failed to list competitor programs:', error);
    next(error);
  }
});

/**
 * GET /api/benchmarks/competitors/:id
 * Get competitor program details
 */
router.get('/competitors/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const competitorId = req.params.id;

    const result = await db.query(
      'SELECT * FROM competitor_programs WHERE id = $1',
      [competitorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'COMPETITOR_NOT_FOUND',
          message: 'Competitor program not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    const competitor = result.rows[0];

    res.json({
      data: {
        id: competitor.id,
        institutionName: competitor.institution_name,
        programName: competitor.program_name,
        level: competitor.level,
        topics: competitor.topics,
        structure: competitor.structure,
        createdAt: competitor.created_at,
      },
    });
  } catch (error) {
    console.error('Failed to get competitor program:', error);
    next(error);
  }
});

/**
 * PUT /api/benchmarks/competitors/:id
 * Update competitor program
 */
router.put('/competitors/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const competitorId = req.params.id;
    const { institutionName, programName, level, topics, structure } = req.body;
    const userId = (req as any).user?.id;

    // Check if competitor exists
    const existingResult = await db.query(
      'SELECT * FROM competitor_programs WHERE id = $1',
      [competitorId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'COMPETITOR_NOT_FOUND',
          message: 'Competitor program not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    // Build update query
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (institutionName !== undefined) {
      fields.push(`institution_name = $${paramIndex}`);
      values.push(institutionName);
      paramIndex++;
    }

    if (programName !== undefined) {
      fields.push(`program_name = $${paramIndex}`);
      values.push(programName);
      paramIndex++;
    }

    if (level !== undefined) {
      fields.push(`level = $${paramIndex}`);
      values.push(level);
      paramIndex++;
    }

    if (topics !== undefined) {
      fields.push(`topics = $${paramIndex}`);
      values.push(JSON.stringify(topics));
      paramIndex++;
    }

    if (structure !== undefined) {
      fields.push(`structure = $${paramIndex}`);
      values.push(JSON.stringify(structure));
      paramIndex++;
    }

    if (fields.length === 0) {
      return res.status(400).json({
        error: {
          code: 'NO_UPDATES',
          message: 'No fields to update',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    values.push(competitorId);

    const query = `
      UPDATE competitor_programs 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    const competitor = result.rows[0];

    // Log the action
    if (userId) {
      await createAuditLog({
        userId,
        action: 'UPDATE_COMPETITOR_PROGRAM',
        resourceType: 'competitor_program',
        resourceId: competitorId,
        details: { updates: { institutionName, programName, level } },
      });
    }

    res.json({
      message: 'Competitor program updated successfully',
      data: {
        id: competitor.id,
        institutionName: competitor.institution_name,
        programName: competitor.program_name,
        level: competitor.level,
        topics: competitor.topics,
        structure: competitor.structure,
      },
    });
  } catch (error) {
    console.error('Failed to update competitor program:', error);
    next(error);
  }
});

/**
 * DELETE /api/benchmarks/competitors/:id
 * Delete competitor program
 */
router.delete('/competitors/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const competitorId = req.params.id;
    const userId = (req as any).user?.id;

    // Check if competitor exists
    const existingResult = await db.query(
      'SELECT * FROM competitor_programs WHERE id = $1',
      [competitorId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'COMPETITOR_NOT_FOUND',
          message: 'Competitor program not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    // Delete competitor
    await db.query('DELETE FROM competitor_programs WHERE id = $1', [competitorId]);

    // Log the action
    if (userId) {
      await createAuditLog({
        userId,
        action: 'DELETE_COMPETITOR_PROGRAM',
        resourceType: 'competitor_program',
        resourceId: competitorId,
        details: {},
      });
    }

    res.json({
      message: 'Competitor program deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete competitor program:', error);
    next(error);
  }
});

export default router;
