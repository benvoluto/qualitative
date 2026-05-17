-- Migration: 002_teams_zoom_tokens
-- Description: Add Microsoft Teams OAuth token fields to users table
-- Date: 2024-12-23

-- Add Microsoft Teams OAuth fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS ms_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ms_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ms_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient Microsoft token lookups
CREATE INDEX IF NOT EXISTS idx_users_ms_token ON users(ms_access_token) WHERE ms_access_token IS NOT NULL;

-- Update source column comment to reflect new sources
COMMENT ON COLUMN meetings.source IS 'google_meet, zoom, teams, hubspot, manual';
COMMENT ON COLUMN meetings.transcript_source IS 'google_meet, teams, zoom, gemini, manual';
