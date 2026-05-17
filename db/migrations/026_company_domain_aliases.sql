-- Add domain_aliases column to companies table
-- Stores additional domains that should match to this company (e.g., ousd.org for ousd.k12.ca.us)

ALTER TABLE companies ADD COLUMN IF NOT EXISTS domain_aliases TEXT[] DEFAULT '{}';

-- Add index for searching domain aliases
CREATE INDEX IF NOT EXISTS idx_companies_domain_aliases ON companies USING GIN (domain_aliases);

-- Also add domain_aliases to customers table for legacy support
ALTER TABLE customers ADD COLUMN IF NOT EXISTS domain_aliases TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_customers_domain_aliases ON customers USING GIN (domain_aliases);
