import { getDb } from "@/lib/db/client";

async function runMigration(): Promise<void> {
  try {
    const sql = getDb();
    console.log("Applying migration 037: extract_positions table...\n");
    await sql`
      CREATE TABLE IF NOT EXISTS extract_positions (
        extract_id UUID PRIMARY KEY REFERENCES extracts(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        width INTEGER NOT NULL DEFAULT 220,
        height INTEGER NOT NULL DEFAULT 160,
        color VARCHAR(32),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log("Created extract_positions");
    await sql`CREATE INDEX IF NOT EXISTS idx_extract_positions_account_id ON extract_positions(account_id)`;
    console.log("Indexed account_id");
    console.log("\n=== Migration 037 completed successfully ===");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
  process.exit(0);
}

runMigration();
