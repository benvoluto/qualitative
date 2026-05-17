import { getDb } from "@/lib/db/client";

async function runMigration() {
  try {
    const sql = getDb();

    console.log("Applying migration 030: Add meeting_url column...\n");

    await sql`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS meeting_url TEXT`;
    console.log("Added meeting_url column to meetings table");

    console.log("\n=== Migration 030 completed successfully ===");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
