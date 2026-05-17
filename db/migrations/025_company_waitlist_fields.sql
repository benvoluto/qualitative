-- Add waitlist fields to companies table
-- These fields track whether a company is on a waitlist and related metadata

-- Add waitlist boolean (defaults to false)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS waitlist BOOLEAN DEFAULT false;

-- Add waitlist date (when they were added to waitlist)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS waitlist_date DATE;

-- Add waitlist followup date
ALTER TABLE companies ADD COLUMN IF NOT EXISTS waitlist_followup DATE;

-- Add waitlist source (where they came from)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS waitlist_source TEXT;

-- Add deal_stage to companies (copied from associated deals/customers)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS deal_stage TEXT;

-- Add index for waitlist queries
CREATE INDEX IF NOT EXISTS idx_companies_waitlist ON companies (waitlist) WHERE waitlist = true;
CREATE INDEX IF NOT EXISTS idx_companies_waitlist_date ON companies (waitlist_date) WHERE waitlist_date IS NOT NULL;
