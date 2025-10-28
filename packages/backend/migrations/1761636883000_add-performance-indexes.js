/**
 * Migration: Add Performance Indexes
 * Adds database indexes for frequently queried fields
 * Implements Requirement 12.1, 12.4
 */

exports.up = async (pgm) => {
  // Programs table indexes
  pgm.createIndex('programs', 'created_by', {
    name: 'idx_programs_created_by',
  });
  pgm.createIndex('programs', 'created_at', {
    name: 'idx_programs_created_at',
  });
  pgm.createIndex('programs', ['status', 'created_at'], {
    name: 'idx_programs_status_created_at',
  });

  // Modules table indexes
  pgm.createIndex('modules', ['program_id', 'sequence_order'], {
    name: 'idx_modules_program_sequence',
  });

  // Learning outcomes table indexes
  pgm.createIndex('learning_outcomes', 'bloom_level', {
    name: 'idx_learning_outcomes_bloom_level',
  });
  pgm.createIndex('learning_outcomes', 'knowledge_skill_competency', {
    name: 'idx_learning_outcomes_ksc',
  });

  // Knowledge base table indexes
  pgm.createIndex('knowledge_base', 'publication_date', {
    name: 'idx_knowledge_base_publication_date',
  });
  pgm.createIndex('knowledge_base', 'credibility_score', {
    name: 'idx_knowledge_base_credibility',
  });
  pgm.createIndex('knowledge_base', ['domain', 'publication_date'], {
    name: 'idx_knowledge_base_domain_date',
  });
  pgm.createIndex('knowledge_base', 'source_type', {
    name: 'idx_knowledge_base_source_type',
  });

  // Add full-text search index for knowledge base content
  pgm.sql(`
    CREATE INDEX idx_knowledge_base_content_fts 
    ON knowledge_base 
    USING gin(to_tsvector('english', content))
  `);

  // Assessments table indexes
  pgm.createIndex('assessments', 'learning_outcome_id', {
    name: 'idx_assessments_learning_outcome',
  });
  pgm.createIndex('assessments', 'question_type', {
    name: 'idx_assessments_question_type',
  });
  pgm.createIndex('assessments', 'difficulty', {
    name: 'idx_assessments_difficulty',
  });

  // Skill mappings table indexes
  pgm.createIndex('skill_mappings', 'domain', {
    name: 'idx_skill_mappings_domain',
  });

  // Generation jobs table indexes
  pgm.createIndex('generation_jobs', ['program_id', 'status'], {
    name: 'idx_generation_jobs_program_status',
  });
  pgm.createIndex('generation_jobs', 'started_at', {
    name: 'idx_generation_jobs_started_at',
  });
  pgm.createIndex('generation_jobs', 'completed_at', {
    name: 'idx_generation_jobs_completed_at',
  });

  // Competitor programs table indexes
  pgm.createIndex('competitor_programs', 'institution_name', {
    name: 'idx_competitor_programs_institution',
  });
  pgm.createIndex('competitor_programs', 'level', {
    name: 'idx_competitor_programs_level',
  });

  // Users table indexes
  pgm.createIndex('users', 'role', {
    name: 'idx_users_role',
  });
  pgm.createIndex('users', 'auth_provider_id', {
    name: 'idx_users_auth_provider',
  });
  pgm.createIndex('users', 'last_login', {
    name: 'idx_users_last_login',
  });

  // Audit logs table indexes (already has some, adding more)
  pgm.createIndex('audit_logs', 'action', {
    name: 'idx_audit_logs_action',
  });
  pgm.createIndex('audit_logs', 'resource_type', {
    name: 'idx_audit_logs_resource_type',
  });
  pgm.createIndex('audit_logs', ['user_id', 'created_at'], {
    name: 'idx_audit_logs_user_created',
  });

  // Content source attribution indexes (if table exists)
  pgm.sql(`
    DO $$ 
    BEGIN
      IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'content_source_attribution') THEN
        CREATE INDEX IF NOT EXISTS idx_content_source_content_id 
        ON content_source_attribution(content_id);
        
        CREATE INDEX IF NOT EXISTS idx_content_source_content_type 
        ON content_source_attribution(content_type);
        
        CREATE INDEX IF NOT EXISTS idx_content_source_created_at 
        ON content_source_attribution(created_at);
      END IF;
    END $$;
  `);
};

exports.down = async (pgm) => {
  // Drop all indexes created in up migration
  pgm.dropIndex('programs', 'created_by', { name: 'idx_programs_created_by', ifExists: true });
  pgm.dropIndex('programs', 'created_at', { name: 'idx_programs_created_at', ifExists: true });
  pgm.dropIndex('programs', ['status', 'created_at'], { name: 'idx_programs_status_created_at', ifExists: true });

  pgm.dropIndex('modules', ['program_id', 'sequence_order'], { name: 'idx_modules_program_sequence', ifExists: true });

  pgm.dropIndex('learning_outcomes', 'bloom_level', { name: 'idx_learning_outcomes_bloom_level', ifExists: true });
  pgm.dropIndex('learning_outcomes', 'knowledge_skill_competency', { name: 'idx_learning_outcomes_ksc', ifExists: true });

  pgm.dropIndex('knowledge_base', 'publication_date', { name: 'idx_knowledge_base_publication_date', ifExists: true });
  pgm.dropIndex('knowledge_base', 'credibility_score', { name: 'idx_knowledge_base_credibility', ifExists: true });
  pgm.dropIndex('knowledge_base', ['domain', 'publication_date'], { name: 'idx_knowledge_base_domain_date', ifExists: true });
  pgm.dropIndex('knowledge_base', 'source_type', { name: 'idx_knowledge_base_source_type', ifExists: true });
  pgm.dropIndex('knowledge_base', 'content', { name: 'idx_knowledge_base_content_fts', ifExists: true });

  pgm.dropIndex('assessments', 'learning_outcome_id', { name: 'idx_assessments_learning_outcome', ifExists: true });
  pgm.dropIndex('assessments', 'question_type', { name: 'idx_assessments_question_type', ifExists: true });
  pgm.dropIndex('assessments', 'difficulty', { name: 'idx_assessments_difficulty', ifExists: true });

  pgm.dropIndex('skill_mappings', 'domain', { name: 'idx_skill_mappings_domain', ifExists: true });

  pgm.dropIndex('generation_jobs', ['program_id', 'status'], { name: 'idx_generation_jobs_program_status', ifExists: true });
  pgm.dropIndex('generation_jobs', 'started_at', { name: 'idx_generation_jobs_started_at', ifExists: true });
  pgm.dropIndex('generation_jobs', 'completed_at', { name: 'idx_generation_jobs_completed_at', ifExists: true });

  pgm.dropIndex('competitor_programs', 'institution_name', { name: 'idx_competitor_programs_institution', ifExists: true });
  pgm.dropIndex('competitor_programs', 'level', { name: 'idx_competitor_programs_level', ifExists: true });

  pgm.dropIndex('users', 'role', { name: 'idx_users_role', ifExists: true });
  pgm.dropIndex('users', 'auth_provider_id', { name: 'idx_users_auth_provider', ifExists: true });
  pgm.dropIndex('users', 'last_login', { name: 'idx_users_last_login', ifExists: true });

  pgm.dropIndex('audit_logs', 'action', { name: 'idx_audit_logs_action', ifExists: true });
  pgm.dropIndex('audit_logs', 'resource_type', { name: 'idx_audit_logs_resource_type', ifExists: true });
  pgm.dropIndex('audit_logs', ['user_id', 'created_at'], { name: 'idx_audit_logs_user_created', ifExists: true });

  pgm.sql(`
    DO $$ 
    BEGIN
      IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'content_source_attribution') THEN
        DROP INDEX IF EXISTS idx_content_source_content_id;
        DROP INDEX IF EXISTS idx_content_source_content_type;
        DROP INDEX IF EXISTS idx_content_source_created_at;
      END IF;
    END $$;
  `);
};
