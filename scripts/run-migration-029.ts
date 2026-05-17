import { getDb } from "@/lib/db/client";

async function runMigration() {
  try {
    const sql = getDb();

    console.log("Applying migration 029: Widen email_drafts recipient fields...\n");

    await sql`ALTER TABLE email_drafts ALTER COLUMN recipient_email TYPE TEXT`;
    console.log("Widened recipient_email to TEXT");

    await sql`ALTER TABLE email_drafts ALTER COLUMN recipient_name TYPE TEXT`;
    console.log("Widened recipient_name to TEXT");

    console.log("\n=== Migration 029 completed successfully ===");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
