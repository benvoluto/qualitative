-- Add user prompt templates and notification preferences
-- Prompt templates: NULL means use system default

ALTER TABLE users ADD COLUMN IF NOT EXISTS deal_email_prompt_template TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_email_prompt_template TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes_prompt_template TEXT;

-- Notification preferences
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_on_draft_created BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_on_notes_created BOOLEAN DEFAULT false;
