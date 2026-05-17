import { getDb } from "@/lib/db/client";

async function runMigration() {
  try {
    const sql = getDb();

    console.log("Applying migration 014: User prompt templates and notifications...");

    // Add prompt template columns
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS deal_email_prompt_template TEXT`;
    console.log("Added deal_email_prompt_template column");

    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_email_prompt_template TEXT`;
    console.log("Added customer_email_prompt_template column");

    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS notes_prompt_template TEXT`;
    console.log("Added notes_prompt_template column");

    // Add notification preference columns
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255)`;
    console.log("Added notification_email column");

    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_on_draft_created BOOLEAN DEFAULT false`;
    console.log("Added notify_on_draft_created column");

    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_on_notes_created BOOLEAN DEFAULT false`;
    console.log("Added notify_on_notes_created column");

    // Verify columns exist
    const result = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('deal_email_prompt_template', 'customer_email_prompt_template', 'notes_prompt_template', 'notification_email', 'notify_on_draft_created', 'notify_on_notes_created')
    `;
    console.log("Columns verified:", result.map(r => r.column_name));

    console.log("Migration 014 completed successfully");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
