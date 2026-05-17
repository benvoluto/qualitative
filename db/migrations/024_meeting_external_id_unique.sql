-- Add unique constraint on external_id to prevent duplicate meetings
-- This prevents race conditions during sync from creating duplicate meetings

-- First, identify and handle any existing duplicates
-- We keep the oldest meeting (smallest created_at) and delete newer duplicates
-- Note: Run this manually first to check for duplicates before applying the constraint

-- Check for duplicates (run this first to see if any exist):
-- SELECT external_id, COUNT(*), array_agg(id) as meeting_ids
-- FROM meetings
-- WHERE external_id IS NOT NULL
-- GROUP BY external_id
-- HAVING COUNT(*) > 1;

-- Add unique constraint (allows NULL values - multiple meetings can have NULL external_id)
-- PostgreSQL allows multiple NULL values in a unique constraint by default
CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_external_id_unique
ON meetings (external_id)
WHERE external_id IS NOT NULL;

-- Add index on source + external_id for faster lookups during sync
CREATE INDEX IF NOT EXISTS idx_meetings_source_external_id
ON meetings (source, external_id)
WHERE external_id IS NOT NULL;
