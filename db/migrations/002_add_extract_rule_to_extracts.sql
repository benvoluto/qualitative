-- Migration: 002_add_extract_rule_to_extracts
-- Description: Add extract_rule_id to extracts table to link extracts to their source rules
-- Date: 2024-12-23

-- Add extract_rule_id column to extracts table
ALTER TABLE extracts
ADD COLUMN extract_rule_id UUID REFERENCES extract_rules(id) ON DELETE SET NULL;

-- Add index for the new column
CREATE INDEX idx_extracts_rule ON extracts(extract_rule_id);
