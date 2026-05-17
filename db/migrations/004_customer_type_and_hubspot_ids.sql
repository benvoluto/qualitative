-- Migration: 004_customer_type_and_hubspot_ids
-- Description: Add customer_type and HubSpot ID fields to customers table
-- Date: 2024-12-26

-- Add customer_type column ('deal' or 'customer')
ALTER TABLE customers
ADD COLUMN customer_type VARCHAR(50) DEFAULT 'customer';

-- Add HubSpot Company ID (for linking to HubSpot companies)
ALTER TABLE customers
ADD COLUMN hubspot_company_id VARCHAR(255);

-- Add HubSpot Deal ID (for linking to HubSpot deals)
ALTER TABLE customers
ADD COLUMN hubspot_deal_id VARCHAR(255);

-- Create unique indexes on HubSpot IDs (partial - only where not null)
CREATE UNIQUE INDEX idx_customers_hubspot_company_id
ON customers(hubspot_company_id)
WHERE hubspot_company_id IS NOT NULL;

CREATE UNIQUE INDEX idx_customers_hubspot_deal_id
ON customers(hubspot_deal_id)
WHERE hubspot_deal_id IS NOT NULL;

-- Create index on customer_type for filtering
CREATE INDEX idx_customers_type ON customers(customer_type);
