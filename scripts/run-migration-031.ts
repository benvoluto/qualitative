import { getDb } from "@/lib/db/client";

async function runMigration() {
  try {
    const sql = getDb();

    console.log("Applying migration 031: Add recording_passcode column...\n");

    await sql`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recording_passcode TEXT`;
    console.log("Added recording_passcode column to meetings table");

    console.log("\n=== Migration 031 completed successfully ===");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
