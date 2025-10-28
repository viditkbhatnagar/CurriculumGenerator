/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // File uploads table for tracking uploaded Excel files
  pgm.createTable('file_uploads', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    program_id: {
      type: 'uuid',
      references: 'programs(id)',
      onDelete: 'CASCADE',
    },
    original_filename: {
      type: 'varchar(255)',
      notNull: true,
    },
    stored_filename: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    file_size: {
      type: 'bigint',
      notNull: true,
    },
    mime_type: {
      type: 'varchar(100)',
      notNull: true,
    },
    storage_path: {
      type: 'varchar(500)',
      notNull: true,
    },
    storage_type: {
      type: 'varchar(20)',
      notNull: true,
      default: 'local', // 'local' or 's3'
    },
    upload_status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'pending', // 'pending', 'completed', 'failed'
    },
    uploaded_by: {
      type: 'uuid',
      references: 'users(id)',
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
  pgm.createIndex('file_uploads', 'program_id', { name: 'idx_file_uploads_program' });
  pgm.createIndex('file_uploads', 'uploaded_by', { name: 'idx_file_uploads_user' });
  pgm.createIndex('file_uploads', 'upload_status', { name: 'idx_file_uploads_status' });
};

exports.down = (pgm) => {
  pgm.dropTable('file_uploads');
};
