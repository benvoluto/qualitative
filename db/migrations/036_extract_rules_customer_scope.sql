-- Migration: 036_extract_rules_customer_scope
-- Description: Adds optional customer_id to extract_rules so a rule can be
-- scoped to a specific organization. Rules with customer_id IS NULL remain
-- global and apply to every meeting's extraction; rules with a customer_id
-- only apply to meetings whose own customer_id matches.

ALTER TABLE extract_rules
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_extract_rules_customer_id
  ON extract_rules(customer_id)
  WHERE customer_id IS NOT NULL;
