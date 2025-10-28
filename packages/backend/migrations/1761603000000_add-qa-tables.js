/**
 * Migration: Add QA Reports and Intermediate Results Tables
 * Creates tables for quality assurance reports and generation intermediate results
 */

exports.up = async (pgm) => {
  // Create QA reports table
  pgm.createTable('qa_reports', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    program_id: {
      type: 'uuid',
      notNull: true,
      references: 'programs',
      onDelete: 'CASCADE',
      unique: true,
    },
    overall_score: {
      type: 'integer',
      notNull: true,
      check: 'overall_score >= 0 AND overall_score <= 100',
    },
    compliance_issues: {
      type: 'jsonb',
      notNull: true,
      default: '[]',
    },
    recommendations: {
      type: 'jsonb',
      notNull: true,
      default: '[]',
    },
    passed_checks: {
      type: 'jsonb',
      notNull: true,
      default: '[]',
    },
    generated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create generation intermediate results table
  pgm.createTable('generation_intermediate_results', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    job_id: {
      type: 'varchar(255)',
      notNull: true,
    },
    stage: {
      type: 'varchar(50)',
      notNull: true,
    },
    data: {
      type: 'jsonb',
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create indexes
  pgm.createIndex('qa_reports', 'program_id');
  pgm.createIndex('qa_reports', 'overall_score');
  pgm.createIndex('qa_reports', 'generated_at');
  
  pgm.createIndex('generation_intermediate_results', 'job_id');
  pgm.createIndex('generation_intermediate_results', 'stage');
  pgm.createIndex('generation_intermediate_results', ['job_id', 'stage'], { unique: true });

  // Add comments
  pgm.sql(`
    COMMENT ON TABLE qa_reports IS 'Quality assurance reports for curriculum validation';
    COMMENT ON TABLE generation_intermediate_results IS 'Intermediate results for curriculum generation jobs';
  `);
};

exports.down = async (pgm) => {
  pgm.dropTable('generation_intermediate_results');
  pgm.dropTable('qa_reports');
};
