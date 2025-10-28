/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Enable UUID extension
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  // Users table
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    role: {
      type: 'varchar(50)',
      notNull: true,
    },
    auth_provider_id: {
      type: 'varchar(255)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    last_login: {
      type: 'timestamp',
    },
  });

  // Programs table
  pgm.createTable('programs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    program_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    qualification_level: {
      type: 'varchar(50)',
      notNull: true,
    },
    qualification_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    total_credits: {
      type: 'integer',
      notNull: true,
      default: 120,
    },
    industry_sector: {
      type: 'varchar(100)',
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
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'draft',
    },
    created_by: {
      type: 'uuid',
      references: 'users(id)',
    },
  });

  // Modules table
  pgm.createTable('modules', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    program_id: {
      type: 'uuid',
      notNull: true,
      references: 'programs(id)',
      onDelete: 'CASCADE',
    },
    module_code: {
      type: 'varchar(20)',
      notNull: true,
    },
    module_title: {
      type: 'varchar(255)',
      notNull: true,
    },
    hours: {
      type: 'integer',
      notNull: true,
    },
    module_aim: {
      type: 'text',
    },
    core_elective: {
      type: 'varchar(20)',
    },
    sequence_order: {
      type: 'integer',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Learning outcomes table
  pgm.createTable('learning_outcomes', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    module_id: {
      type: 'uuid',
      notNull: true,
      references: 'modules(id)',
      onDelete: 'CASCADE',
    },
    outcome_text: {
      type: 'text',
      notNull: true,
    },
    assessment_criteria: {
      type: 'jsonb',
    },
    knowledge_skill_competency: {
      type: 'varchar(20)',
    },
    bloom_level: {
      type: 'varchar(50)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Knowledge base table
  pgm.createTable('knowledge_base', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    content: {
      type: 'text',
      notNull: true,
    },
    source_url: {
      type: 'varchar(500)',
    },
    source_type: {
      type: 'varchar(50)',
    },
    publication_date: {
      type: 'date',
    },
    domain: {
      type: 'varchar(100)',
    },
    credibility_score: {
      type: 'integer',
    },
    metadata: {
      type: 'jsonb',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    embedding_id: {
      type: 'varchar(255)',
    },
  });

  // Add constraint for credibility_score
  pgm.addConstraint('knowledge_base', 'knowledge_base_credibility_score_check', {
    check: 'credibility_score BETWEEN 0 AND 100',
  });

  // Assessments table
  pgm.createTable('assessments', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    module_id: {
      type: 'uuid',
      notNull: true,
      references: 'modules(id)',
      onDelete: 'CASCADE',
    },
    question_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    question_text: {
      type: 'text',
      notNull: true,
    },
    options: {
      type: 'jsonb',
    },
    correct_answer: {
      type: 'text',
    },
    explanation: {
      type: 'text',
    },
    difficulty: {
      type: 'varchar(20)',
    },
    learning_outcome_id: {
      type: 'uuid',
      references: 'learning_outcomes(id)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Skill mappings table
  pgm.createTable('skill_mappings', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    program_id: {
      type: 'uuid',
      notNull: true,
      references: 'programs(id)',
      onDelete: 'CASCADE',
    },
    skill_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    domain: {
      type: 'varchar(100)',
    },
    activities: {
      type: 'jsonb',
      notNull: true,
    },
    kpis: {
      type: 'jsonb',
      notNull: true,
    },
    linked_outcomes: {
      type: 'uuid[]',
      default: '{}',
    },
    assessment_criteria: {
      type: 'jsonb',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Generation jobs table
  pgm.createTable('generation_jobs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    program_id: {
      type: 'uuid',
      notNull: true,
      references: 'programs(id)',
      onDelete: 'CASCADE',
    },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'queued',
    },
    progress: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    started_at: {
      type: 'timestamp',
    },
    completed_at: {
      type: 'timestamp',
    },
    error_message: {
      type: 'text',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Competitor programs table
  pgm.createTable('competitor_programs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    institution_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    program_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    level: {
      type: 'varchar(50)',
    },
    topics: {
      type: 'jsonb',
    },
    structure: {
      type: 'jsonb',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Audit logs table
  pgm.createTable('audit_logs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      references: 'users(id)',
    },
    action: {
      type: 'varchar(100)',
      notNull: true,
    },
    resource_type: {
      type: 'varchar(50)',
    },
    resource_id: {
      type: 'uuid',
    },
    details: {
      type: 'jsonb',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create indexes for performance
  pgm.createIndex('programs', 'status', { name: 'idx_programs_status' });
  pgm.createIndex('modules', 'program_id', { name: 'idx_modules_program' });
  pgm.createIndex('learning_outcomes', 'module_id', { name: 'idx_learning_outcomes_module' });
  pgm.createIndex('assessments', 'module_id', { name: 'idx_assessments_module' });
  pgm.createIndex('knowledge_base', 'domain', { name: 'idx_knowledge_base_domain' });
  pgm.createIndex('generation_jobs', 'status', { name: 'idx_generation_jobs_status' });
  pgm.createIndex('audit_logs', 'user_id', { name: 'idx_audit_logs_user' });
  pgm.createIndex('audit_logs', 'created_at', { name: 'idx_audit_logs_created' });
};

exports.down = (pgm) => {
  // Drop tables in reverse order to handle foreign key constraints
  pgm.dropTable('audit_logs');
  pgm.dropTable('competitor_programs');
  pgm.dropTable('generation_jobs');
  pgm.dropTable('skill_mappings');
  pgm.dropTable('assessments');
  pgm.dropTable('knowledge_base');
  pgm.dropTable('learning_outcomes');
  pgm.dropTable('modules');
  pgm.dropTable('programs');
  pgm.dropTable('users');
  
  // Drop extension
  pgm.dropExtension('pgcrypto');
};
