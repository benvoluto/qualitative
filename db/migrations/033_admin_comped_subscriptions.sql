-- Migration: 033_admin_comped_subscriptions
-- Description: Adds a `comped` flag to subscriptions so admins can grant Pro
-- without touching Stripe state. Effective plan = comped ? 'pro' : plan.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS comped BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_subscriptions_comped ON subscriptions(comped) WHERE comped IS TRUE;
