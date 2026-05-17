-- Migration: 001_initial_schema
-- Description: Create initial database schema for Qualitative meeting insights platform
-- Date: 2024-12-22

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Core Entity Tables
-- ============================================

-- Customers (organizations)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Roles (e.g., Psychologist, Speech-Language Pathologist)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Groups (e.g., school department)
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Personnel (individuals associated with customers)
CREATE TABLE personnel (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    email VARCHAR(255),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tags for categorizing extracts
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50), -- e.g., 'system', 'user-defined'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Meeting Tables
-- ============================================

-- Meetings
CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255), -- ID from Google Meet/Zoom
    name VARCHAR(255),
    meeting_date TIMESTAMP WITH TIME ZONE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    transcript TEXT,
    user_notes TEXT,
    workflow_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    source VARCHAR(50), -- 'google_meet', 'zoom', 'manual'
    recording_url TEXT,
    transcript_source VARCHAR(50), -- 'google_meet', 'gemini', 'manual'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meeting participants (junction table)
CREATE TABLE meeting_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(meeting_id, personnel_id)
);

-- ============================================
-- Extraction Rules Tables
-- ============================================

-- Extraction rules (templates for extracting insights)
CREATE TABLE extract_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    summary TEXT,
    quotes JSONB DEFAULT '[]'::jsonb, -- Example quotes that match this rule
    action_items JSONB DEFAULT '[]'::jsonb, -- Example action items
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extract rule tags (junction table)
CREATE TABLE extract_rule_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extract_rule_id UUID NOT NULL REFERENCES extract_rules(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(extract_rule_id, tag_id)
);

-- ============================================
-- Extracts Tables
-- ============================================

-- Extracts (insights extracted from meetings)
CREATE TABLE extracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    extract_date TIMESTAMP WITH TIME ZONE,
    summary TEXT,
    quotes JSONB DEFAULT '[]'::jsonb, -- Array of quote strings
    is_action_item BOOLEAN DEFAULT false,
    action_item_status VARCHAR(50), -- null, 'pending', 'completed', 'dismissed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extract participants (junction table)
CREATE TABLE extract_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extract_id UUID NOT NULL REFERENCES extracts(id) ON DELETE CASCADE,
    personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(extract_id, personnel_id)
);

-- Extract tags (junction table)
CREATE TABLE extract_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extract_id UUID NOT NULL REFERENCES extracts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(extract_id, tag_id)
);

-- ============================================
-- Workflow Tables (for future use)
-- ============================================

-- Workflow step types
CREATE TABLE workflow_step_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE, -- 'draft_email', 'hubspot_task', 'linear_feature_request', 'linear_bug'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflows
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    summary TEXT,
    status VARCHAR(50) DEFAULT 'active', -- active, paused, archived
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow steps
CREATE TABLE workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    step_type_id UUID REFERENCES workflow_step_types(id) ON DELETE SET NULL,
    name VARCHAR(255),
    step_order INTEGER NOT NULL,
    trigger_config JSONB DEFAULT '{}'::jsonb, -- Configuration for when step triggers
    action_config JSONB DEFAULT '{}'::jsonb, -- Configuration for the action
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- User/Auth Tables
-- ============================================

-- Users (authenticated employees)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    image TEXT,
    google_access_token TEXT,
    google_refresh_token TEXT,
    google_token_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================

CREATE INDEX idx_personnel_customer ON personnel(customer_id);
CREATE INDEX idx_personnel_role ON personnel(role_id);
CREATE INDEX idx_meetings_customer ON meetings(customer_id);
CREATE INDEX idx_meetings_date ON meetings(meeting_date);
CREATE INDEX idx_meetings_status ON meetings(workflow_status);
CREATE INDEX idx_extracts_meeting ON extracts(meeting_id);
CREATE INDEX idx_extracts_customer ON extracts(customer_id);
CREATE INDEX idx_extracts_action_item ON extracts(is_action_item) WHERE is_action_item = true;
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- Seed Default Tags
-- ============================================

INSERT INTO tags (name, type) VALUES
    ('feature_request', 'system'),
    ('user_confusion', 'system'),
    ('document_tracking_issues', 'system'),
    ('reporting', 'system'),
    ('user_interface_issue', 'system'),
    ('login_issues', 'system'),
    ('missing_data', 'system'),
    ('search_issues', 'system'),
    ('help_desk_tickets', 'system'),
    ('template_needs', 'system'),
    ('organizational_structure', 'system'),
    ('deployment_strategy', 'system'),
    ('billing_issues', 'system'),
    ('positive_feedback', 'system'),
    ('negative_feedback', 'system'),
    ('user_support', 'system'),
    ('parse_accuracy', 'system'),
    ('data_accuracy', 'system'),
    ('troubleshooting', 'system'),
    ('onboarding', 'system'),
    ('integration_issues', 'system'),
    ('reporting_process', 'system'),
    ('policy_enforcement', 'system'),
    ('workflow_process', 'system'),
    ('best_practices', 'system'),
    ('client_management', 'system'),
    ('workflow_changes', 'system'),
    ('deal_timeframes', 'system'),
    ('deployment_issues', 'system'),
    ('deployment_timeframe', 'system'),
    ('product_feedback', 'system'),
    ('bug_reports', 'system'),
    ('training_requests', 'system'),
    ('app_performance_issues', 'system')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Seed Default Workflow Step Types
-- ============================================

INSERT INTO workflow_step_types (name, description) VALUES
    ('draft_email', 'Generate a draft follow-up email'),
    ('hubspot_task', 'Create a task in HubSpot'),
    ('linear_feature_request', 'Create a feature request in Linear'),
    ('linear_bug', 'Create a bug report in Linear')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Updated_at Trigger Function
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_personnel_updated_at BEFORE UPDATE ON personnel FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_extract_rules_updated_at BEFORE UPDATE ON extract_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_extracts_updated_at BEFORE UPDATE ON extracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflow_step_types_updated_at BEFORE UPDATE ON workflow_step_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflow_steps_updated_at BEFORE UPDATE ON workflow_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
