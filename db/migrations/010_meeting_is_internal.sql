-- Add is_internal flag to meetings table
-- This flag indicates if a meeting only has participants from the internal organization
-- (configured via the INTERNAL_DOMAIN env var, or per-account in the multi-tenant model).

ALTER TABLE meetings ADD COLUMN is_internal BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_meetings_is_internal ON meetings(is_internal);
