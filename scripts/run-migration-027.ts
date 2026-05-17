import { getDb } from "@/lib/db/client";

async function runMigration() {
  try {
    const sql = getDb();

    console.log("Applying migration 027: Meeting participant status...\n");

    // Add participation_status column to meeting_participants
    await sql`ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS participation_status VARCHAR(20) DEFAULT 'n/a'`;
    console.log("Added participation_status column to meeting_participants");

    // Add index for filtering by participation status
    await sql`CREATE INDEX IF NOT EXISTS idx_meeting_participants_status ON meeting_participants(participation_status)`;
    console.log("Created index for participation_status");

    console.log("\n=== Migration 027 completed successfully ===");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
