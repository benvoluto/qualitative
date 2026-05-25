-- Migration: 035_customers_domain_column
-- Description: Add missing customers.domain column. The original schema never
-- created it via migration (see the note in 021_migrate_data_to_companies.sql),
-- but lib/db/customers.ts INSERTs/SELECTs the column and the Customer type
-- declares it. Migration 026 already added customers.domain_aliases for the
-- same reason. Backfill from the linked company.domain when available so
-- existing rows keep their effective domain.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS domain VARCHAR(255);

UPDATE customers c
SET domain = co.domain
FROM companies co
WHERE c.company_id = co.id
  AND c.domain IS NULL
  AND co.domain IS NOT NULL;
