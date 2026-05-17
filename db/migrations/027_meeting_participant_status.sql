-- Add participation_status column to meeting_participants table
-- Tracks whether a participant actually participated in the discussion
-- Values: 'invited' (on invite list but didn't speak), 'participated' (spoke in meeting), 'n/a' (unknown/not determinable)

ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS participation_status VARCHAR(20) DEFAULT 'n/a';

-- Add index for filtering by participation status
CREATE INDEX IF NOT EXISTS idx_meeting_participants_status ON meeting_participants(participation_status);
