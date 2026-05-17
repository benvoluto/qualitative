-- Migration: 022_add_hubspot_contact_id_to_personnel
-- Description: Add hubspot_contact_id to personnel table for HubSpot contact linking
-- Date: 2025-01-21

-- Add hubspot_contact_id to personnel (links to HubSpot contact records)
ALTER TABLE personnel ADD COLUMN hubspot_contact_id VARCHAR(50);
CREATE UNIQUE INDEX idx_personnel_hubspot_contact_id ON personnel(hubspot_contact_id) WHERE hubspot_contact_id IS NOT NULL;

-- Add hubspot_synced_at for tracking sync status
ALTER TABLE personnel ADD COLUMN hubspot_synced_at TIMESTAMP WITH TIME ZONE;
