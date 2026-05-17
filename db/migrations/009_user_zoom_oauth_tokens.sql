-- Migration: 009_user_zoom_oauth_tokens
-- Description: Add Zoom OAuth 2.0 token fields to users table
-- Date: 2024-12-29

-- Add Zoom OAuth fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS zoom_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS zoom_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS zoom_token_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS zoom_user_id VARCHAR(255);

-- Add index for efficient Zoom token lookups
CREATE INDEX IF NOT EXISTS idx_users_zoom_token ON users(zoom_access_token) WHERE zoom_access_token IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.zoom_access_token IS 'Zoom OAuth 2.0 access token';
COMMENT ON COLUMN users.zoom_refresh_token IS 'Zoom OAuth 2.0 refresh token';
COMMENT ON COLUMN users.zoom_token_expires_at IS 'When the Zoom access token expires';
COMMENT ON COLUMN users.zoom_user_id IS 'Zoom user ID for the connected account';
