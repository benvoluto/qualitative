-- Migration: 021_migrate_data_to_companies
-- Description: No-op for fresh installs.
--
-- The original migration moved HubSpot-synced customer rows into a new companies
-- table. It referenced columns (customers.domain, etc.) that only existed in the
-- legacy marker database — they were added out-of-band, not via a migration.
-- On a clean install there are no rows to move, so this migration is intentionally
-- empty. Kept as a placeholder so the file numbering stays continuous.

SELECT 1;
