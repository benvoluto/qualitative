-- Migration: Add meeting_url column for storing the meeting join link
-- (e.g. Google Meet link, Teams join URL)
-- Separate from recording_url which stores actual recording references

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS meeting_url TEXT;
