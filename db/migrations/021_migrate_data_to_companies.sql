-- Migration: 021_migrate_data_to_companies
-- Description: Migrate existing customer data to companies table and link records
-- Date: 2025-01-07

-- Step 1: Create company records from unique hubspot_company_id values in customers
-- Uses the most recently synced customer record for each hubspot_company_id
INSERT INTO companies (name, domain, address, hubspot_company_id, hubspot_synced_at, created_at)
SELECT DISTINCT ON (hubspot_company_id)
    name,
    domain,
    address,
    hubspot_company_id,
    hubspot_synced_at,
    COALESCE(created_at, NOW())
FROM customers
WHERE hubspot_company_id IS NOT NULL
ORDER BY hubspot_company_id, hubspot_synced_at DESC NULLS LAST, updated_at DESC NULLS LAST;

-- Step 2: Link customers to their parent company
UPDATE customers c
SET company_id = co.id
FROM companies co
WHERE c.hubspot_company_id = co.hubspot_company_id
  AND c.hubspot_company_id IS NOT NULL;

-- Step 3: Link meetings to companies (via their customer relationship)
UPDATE meetings m
SET company_id = c.company_id
FROM customers c
WHERE m.customer_id = c.id
  AND c.company_id IS NOT NULL;

-- Step 4: Link extracts to companies (via their customer relationship)
UPDATE extracts e
SET company_id = c.company_id
FROM customers c
WHERE e.customer_id = c.id
  AND c.company_id IS NOT NULL;

-- Step 5: Link company_summaries to companies (via their customer relationship)
UPDATE company_summaries cs
SET company_id = c.company_id
FROM customers c
WHERE cs.customer_id = c.id
  AND c.company_id IS NOT NULL;

-- Step 6: Link personnel to companies (via their customer relationship)
UPDATE personnel p
SET company_id = c.company_id
FROM customers c
WHERE p.customer_id = c.id
  AND c.company_id IS NOT NULL;
