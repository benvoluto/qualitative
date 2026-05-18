-- Migration: 032_saas_accounts_billing
-- Description: Multi-tenant foundation. Adds accounts + subscriptions tables,
-- moves prompt template config to accounts, and adds account_id NOT NULL to
-- every tenant-scoped table.
--
-- ASSUMES A WIPED DATABASE. Adding NOT NULL account_id on existing rows will
-- fail; that's intentional — drop the database before applying this migration
-- if you have legacy single-tenant data.

-- ============================================
-- Accounts (the SaaS tenant boundary)
-- ============================================

CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    -- Email domain whose participants count as "internal". Meetings with only
    -- internal participants are filtered from sync. Lowercase, no @ prefix.
    internal_domain VARCHAR(255),
    -- Additional domains treated as internal (subsidiaries, contractors).
    internal_domain_aliases TEXT[] DEFAULT ARRAY[]::TEXT[],
    -- Per-account prompt templates. NULL means use the built-in default.
    deal_email_prompt_template TEXT,
    customer_email_prompt_template TEXT,
    notes_prompt_template TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_internal_domain ON accounts(internal_domain);

-- ============================================
-- Subscriptions (Stripe billing state)
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
    account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    -- 'free' or 'pro' (extend as needed)
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    -- Mirrors Stripe statuses: trialing, active, past_due, canceled, unpaid, incomplete...
    -- Free-tier accounts stay 'active' with plan='free'.
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ============================================
-- Users → accounts (1:1 for v1)
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMP WITH TIME ZONE;

-- 1:1 constraint — drop later if multi-user-per-account is added.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account_id_unique ON users(account_id) WHERE account_id IS NOT NULL;

-- Drop prompt template columns — now on accounts.
ALTER TABLE users DROP COLUMN IF EXISTS deal_email_prompt_template;
ALTER TABLE users DROP COLUMN IF EXISTS customer_email_prompt_template;
ALTER TABLE users DROP COLUMN IF EXISTS notes_prompt_template;

-- Backfill: if any users exist, create an account for each and link them.
-- Safe to run on empty DB (no-op).
DO $$
DECLARE
    u RECORD;
    new_account_id UUID;
BEGIN
    FOR u IN SELECT id, email FROM users WHERE account_id IS NULL LOOP
        INSERT INTO accounts (name, internal_domain)
        VALUES (split_part(u.email, '@', 2), lower(split_part(u.email, '@', 2)))
        RETURNING id INTO new_account_id;

        UPDATE users SET account_id = new_account_id WHERE id = u.id;
    END LOOP;
END $$;

ALTER TABLE users ALTER COLUMN account_id SET NOT NULL;

-- ============================================
-- Tenant-scoped tables: add account_id NOT NULL
-- ============================================
-- Top-level tenant tables only. Junction tables (extract_tags, extract_rule_tags,
-- meeting_participants, extract_participants) inherit isolation via their parent FK
-- and can have account_id added later if/when we enable RLS.

-- Clear globally-seeded data from earlier migrations that conflicts with per-account
-- scoping. The default 34 tags from migration 001 are dropped; the onboarding flow
-- will seed per-account tags alongside the default extract rules.
TRUNCATE TABLE tags CASCADE;

ALTER TABLE meetings           ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE extracts           ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE extract_rules      ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE tags               ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE customers          ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE companies          ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE personnel          ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE roles              ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE groups             ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE email_drafts       ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE activity_summaries ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE company_summaries  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

-- Enforce NOT NULL. Will fail loudly if the tables aren't empty / weren't backfilled.
ALTER TABLE meetings           ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE extracts           ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE extract_rules      ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE tags               ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE customers          ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE companies          ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE personnel          ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE roles              ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE groups             ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE email_drafts       ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE activity_summaries ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE company_summaries  ALTER COLUMN account_id SET NOT NULL;

-- Indexes on account_id (critical for tenant query performance)
CREATE INDEX IF NOT EXISTS idx_meetings_account_id           ON meetings(account_id);
CREATE INDEX IF NOT EXISTS idx_extracts_account_id           ON extracts(account_id);
CREATE INDEX IF NOT EXISTS idx_extract_rules_account_id      ON extract_rules(account_id);
CREATE INDEX IF NOT EXISTS idx_tags_account_id               ON tags(account_id);
CREATE INDEX IF NOT EXISTS idx_customers_account_id          ON customers(account_id);
CREATE INDEX IF NOT EXISTS idx_companies_account_id          ON companies(account_id);
CREATE INDEX IF NOT EXISTS idx_personnel_account_id          ON personnel(account_id);
CREATE INDEX IF NOT EXISTS idx_roles_account_id              ON roles(account_id);
CREATE INDEX IF NOT EXISTS idx_groups_account_id             ON groups(account_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_account_id       ON email_drafts(account_id);
CREATE INDEX IF NOT EXISTS idx_activity_summaries_account_id ON activity_summaries(account_id);
CREATE INDEX IF NOT EXISTS idx_company_summaries_account_id  ON company_summaries(account_id);

-- ============================================
-- Drop legacy global UNIQUE constraints that conflict with multi-tenancy
-- ============================================
-- tags.name was globally UNIQUE in 001 — now must be unique per-account.
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_account_name_unique ON tags(account_id, name);

-- roles.name was globally UNIQUE in 001 — same treatment.
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_account_name_unique ON roles(account_id, name);
