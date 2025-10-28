/**
 * Migration: Add curriculum generation tables
 * Creates tables for storing generated curriculum data and intermediate results
 */

exports.up = (pgm) => {
  // Program specifications table
  pgm.createTable('program_specifications', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    program_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'programs',
      onDelete: 'CASCADE',
    },
    introduction: { type: 'text', notNull: true },
    course_overview: { type: 'text', notNull: true },
    needs_analysis: { type: 'text', notNull: true },
    ksc_matrix: { type: 'text', notNull: true },
    comparative_analysis: { type: 'text', notNull: true },
    target_audience: { type: 'text', notNull: true },
    entry_requirements: { type: 'text', notNull: true },
    career_outcomes: { type: 'text', notNull: true },
    generated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
  });

  // Unit specifications table
  pgm.createTable('unit_specifications', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    unit_id: { type: 'varchar(255)', notNull: true, unique: true },
    program_id: {
      type: 'uuid',
      notNull: true,
      references: 'programs',
      onDelete: 'CASCADE',
    },
    module_code: { type: 'varchar(50)', notNull: true },
    unit_title: { type: 'varchar(255)', notNull: true },
    unit_overview: { type: 'text', notNull: true },
    learning_outcomes: { type: 'jsonb', notNull: true },
    indicative_content: { type: 'text', notNull: true },
    teaching_strategies: { type: 'jsonb', notNull: true },
    assessment_methods: { type: 'jsonb', notNull: true },
    reading_list: { type: 'jsonb', notNull: true },
    generated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
  });

  // Assessment packages table
  pgm.createTable('assessment_packages', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    program_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'programs',
      onDelete: 'CASCADE',
    },
    mcqs: { type: 'jsonb', notNull: true },
    case_studies: { type: 'jsonb', notNull: true },
    rubrics: { type: 'jsonb', notNull: true },
    marking_schemes: { type: 'jsonb', notNull: true },
    learning_outcome_mappings: { type: 'jsonb', notNull: true },
    generated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
  });

  // Intermediate results table for resume capability
  pgm.createTable('generation_intermediate_results', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    job_id: { type: 'varchar(255)', notNull: true },
    stage: { type: 'varchar(50)', notNull: true },
    data: { type: 'jsonb', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
  });

  // Create indexes
  pgm.createIndex('program_specifications', 'program_id');
  pgm.createIndex('unit_specifications', 'program_id');
  pgm.createIndex('unit_specifications', 'module_code');
  pgm.createIndex('assessment_packages', 'program_id');
  pgm.createIndex('generation_intermediate_results', 'job_id');
  pgm.createIndex('generation_intermediate_results', ['job_id', 'stage'], { unique: true });
};

exports.down = (pgm) => {
  pgm.dropTable('generation_intermediate_results');
  pgm.dropTable('assessment_packages');
  pgm.dropTable('unit_specifications');
  pgm.dropTable('program_specifications');
};
