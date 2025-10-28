-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create initial tables (basic structure)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,
    auth_provider_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_name VARCHAR(255) NOT NULL,
    qualification_level VARCHAR(50) NOT NULL,
    qualification_type VARCHAR(50) NOT NULL,
    total_credits INTEGER NOT NULL DEFAULT 120,
    industry_sector VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'draft',
    created_by UUID REFERENCES users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_programs_status ON programs(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Insert a default admin user for development
INSERT INTO users (email, role, auth_provider_id) 
VALUES ('admin@agcq.com', 'Administrator', 'dev-admin-001')
ON CONFLICT (email) DO NOTHING;
