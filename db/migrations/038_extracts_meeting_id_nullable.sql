-- Migration: 038_extracts_meeting_id_nullable
-- Description: Drop NOT NULL on extracts.meeting_id so manually-authored
-- stickies on an affinity map can exist without being tied to a meeting
-- transcript. Existing rows (which all have meeting_id set from extraction)
-- are unaffected.

ALTER TABLE extracts ALTER COLUMN meeting_id DROP NOT NULL;
