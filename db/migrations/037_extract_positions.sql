-- Migration: 037_extract_positions
-- Description: Per-extract canvas position for the affinity map view. Each
-- customer has exactly one map, and each extract belongs to one customer
-- through its meeting → customer link, so we key positions on extract_id.
-- A missing row means "not yet placed" — auto-layout decides.

CREATE TABLE IF NOT EXISTS extract_positions (
  extract_id UUID PRIMARY KEY REFERENCES extracts(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  width INTEGER NOT NULL DEFAULT 220,
  height INTEGER NOT NULL DEFAULT 160,
  color VARCHAR(32),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extract_positions_account_id ON extract_positions(account_id);
