import { getDb } from "@/lib/db/client";

async function runMigration() {
  try {
    const sql = getDb();

    console.log("Applying migration 016: Extract status tracking...");

    // Add request_status column for feature requests
    await sql`ALTER TABLE extracts ADD COLUMN IF NOT EXISTS request_status VARCHAR(50) DEFAULT NULL`;
    console.log("Added request_status column");

    // Add indexes for filtering by status
    await sql`CREATE INDEX IF NOT EXISTS idx_extracts_action_item_status ON extracts(action_item_status) WHERE is_action_item = true`;
    console.log("Added action_item_status index");

    await sql`CREATE INDEX IF NOT EXISTS idx_extracts_request_status ON extracts(request_status) WHERE is_action_item = false`;
    console.log("Added request_status index");

    // Verify column exists
    const result = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'extracts'
      AND column_name = 'request_status'
    `;
    console.log("Column verified:", result.length > 0 ? "request_status exists" : "request_status not found");

    console.log("Migration 016 completed successfully");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
