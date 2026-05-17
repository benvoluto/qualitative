-- Migration: 020_add_company_id_columns
-- Description: Add company_id foreign key to customers, meetings, extracts, and company_summaries
-- Date: 2025-01-07

-- Add company_id to customers (links customer/deal records to parent company)
ALTER TABLE customers ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX idx_customers_company_id ON customers(company_id) WHERE company_id IS NOT NULL;

-- Add company_id to meetings (primary company relationship)
ALTER TABLE meetings ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX idx_meetings_company_id ON meetings(company_id) WHERE company_id IS NOT NULL;

-- Add company_id to extracts
ALTER TABLE extracts ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX idx_extracts_company_id ON extracts(company_id) WHERE company_id IS NOT NULL;

-- Add company_id to company_summaries
ALTER TABLE company_summaries ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX idx_company_summaries_company_id ON company_summaries(company_id) WHERE company_id IS NOT NULL;

-- Add company_id to personnel (people can be associated with a company)
ALTER TABLE personnel ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX idx_personnel_company_id ON personnel(company_id) WHERE company_id IS NOT NULL;
