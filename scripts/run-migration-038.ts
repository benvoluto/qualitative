import { getDb } from "@/lib/db/client";

async function runMigration(): Promise<void> {
  try {
    const sql = getDb();
    console.log("Applying migration 038: extracts.meeting_id nullable...\n");
    await sql`ALTER TABLE extracts ALTER COLUMN meeting_id DROP NOT NULL`;
    console.log("Dropped NOT NULL on extracts.meeting_id");
    console.log("\n=== Migration 038 completed successfully ===");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
  process.exit(0);
}

runMigration();
