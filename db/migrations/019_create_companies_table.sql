-- Migration: 019_create_companies_table
-- Description: Create companies table synced from HubSpot, separate from customers/deals
-- Date: 2025-01-07

-- Companies table - represents HubSpot companies as first-class entities
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    address TEXT,
    city VARCHAR(255),
    state VARCHAR(255),
    zip VARCHAR(50),
    country VARCHAR(255),
    hubspot_company_id VARCHAR(255),
    hubspot_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint for hubspot_company_id (needed for upsert operations)
ALTER TABLE companies ADD CONSTRAINT companies_hubspot_company_id_unique UNIQUE (hubspot_company_id);
CREATE INDEX idx_companies_domain ON companies(domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_companies_name ON companies(name);

-- Trigger for updated_at
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
