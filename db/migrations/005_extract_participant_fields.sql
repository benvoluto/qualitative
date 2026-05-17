-- Migration: 005_extract_participant_fields
-- Description: Add participant name and email fields to extracts table
-- Date: 2024-12-26

-- Add participant_name column
ALTER TABLE extracts
ADD COLUMN participant_name VARCHAR(255);

-- Add participant_email column
ALTER TABLE extracts
ADD COLUMN participant_email VARCHAR(255);

-- Create index on participant_email for lookups (partial - only where not null)
CREATE INDEX idx_extracts_participant_email
ON extracts(participant_email)
WHERE participant_email IS NOT NULL;
