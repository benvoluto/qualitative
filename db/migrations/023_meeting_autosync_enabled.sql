-- Add meeting_autosync_enabled column to users table
-- Default to FALSE so existing users have autosync disabled

ALTER TABLE users
ADD COLUMN IF NOT EXISTS meeting_autosync_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- No need to update existing users since DEFAULT FALSE handles that
