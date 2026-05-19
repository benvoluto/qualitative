-- Migration: 034_user_zoom_validated_at
-- Description: Adds users.zoom_validated_at so the Zoom status endpoint can
-- skip the per-hour refresh-token roundtrip when we've recently confirmed the
-- connection is healthy.

ALTER TABLE users ADD COLUMN IF NOT EXISTS zoom_validated_at TIMESTAMP WITH TIME ZONE;
