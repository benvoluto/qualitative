-- Add deal_stage column to store the HubSpot deal stage for the company
-- Add hubspot_synced_at column to track when the company was last synced from HubSpot
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deal_stage VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS hubspot_synced_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient lookup of companies needing sync
CREATE INDEX IF NOT EXISTS idx_customers_hubspot_synced_at ON customers(hubspot_synced_at);
