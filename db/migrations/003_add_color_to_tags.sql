-- Migration: 003_add_color_to_tags
-- Description: Add color column to tags table for visual distinction
-- Date: 2024-12-23

-- Add color column to tags table
ALTER TABLE tags ADD COLUMN color VARCHAR(7);

-- Create unique index on color (only one tag per color)
CREATE UNIQUE INDEX idx_tags_color ON tags(color) WHERE color IS NOT NULL;
