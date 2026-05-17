-- Migration: 006_email_drafts
-- Description: Create email_drafts table for storing generated email drafts
-- Date: 2024-12-26

-- Create email_drafts table
CREATE TABLE email_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    draft_type VARCHAR(50) NOT NULL,  -- 'follow_up', 'action_items', 'meeting_notes'
    subject TEXT,
    body TEXT,
    recipient_email VARCHAR(255),
    recipient_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'sent', 'discarded'
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on meeting_id for lookups
CREATE INDEX idx_email_drafts_meeting ON email_drafts(meeting_id);

-- Create index on status for filtering
CREATE INDEX idx_email_drafts_status ON email_drafts(status);

-- Add updated_at trigger
CREATE TRIGGER update_email_drafts_updated_at
BEFORE UPDATE ON email_drafts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
