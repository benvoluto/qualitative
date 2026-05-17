-- Add status tracking for actions and requests
-- Actions can be: pending, assigned, done
-- Requests can be: pending, ticket_added

-- Update action_item_status to support new values (assigned, done)
-- PostgreSQL allows adding values to enums or we can use VARCHAR
-- Since action_item_status is likely VARCHAR, we just need to accept new values

-- Add request_status column for feature requests (non-action items)
ALTER TABLE extracts ADD COLUMN IF NOT EXISTS request_status VARCHAR(50) DEFAULT NULL;

-- Add index for filtering by status
CREATE INDEX IF NOT EXISTS idx_extracts_action_item_status ON extracts(action_item_status) WHERE is_action_item = true;
CREATE INDEX IF NOT EXISTS idx_extracts_request_status ON extracts(request_status) WHERE is_action_item = false;
