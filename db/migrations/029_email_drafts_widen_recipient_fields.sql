-- Migration: Widen recipient fields on email_drafts
-- recipient_email and recipient_name store comma-separated lists of all
-- meeting participants, which can exceed 255 characters.

ALTER TABLE email_drafts ALTER COLUMN recipient_email TYPE TEXT;
ALTER TABLE email_drafts ALTER COLUMN recipient_name TYPE TEXT;
