/**
 * Script to enable email notifications for all users.
 * Run with: npx tsx scripts/enable-notifications-all-users.ts
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

// Load environment variables from .env.development.local
config({ path: ".env.development.local" });

async function enableNotificationsForAllUsers(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = neon(databaseUrl);

  console.log("Enabling email notifications for all users...\n");

  // First, show current state
  const beforeState = await sql`
    SELECT
      email,
      notification_email,
      notify_on_notes_created,
      notify_on_draft_created
    FROM users
    ORDER BY email
  `;

  console.log("Current notification settings:");
  console.log("─".repeat(80));
  for (const user of beforeState) {
    console.log(`  ${user.email}`);
    console.log(`    Notification email: ${user.notification_email || "(uses account email)"}`);
    console.log(`    Notify on notes: ${user.notify_on_notes_created ? "✓ enabled" : "✗ disabled"}`);
    console.log(`    Notify on drafts: ${user.notify_on_draft_created ? "✓ enabled" : "✗ disabled"}`);
  }
  console.log("─".repeat(80));

  // Enable notifications for all users
  const result = await sql`
    UPDATE users
    SET
      notify_on_notes_created = TRUE,
      notify_on_draft_created = TRUE
    WHERE notify_on_notes_created = FALSE
       OR notify_on_draft_created = FALSE
    RETURNING id, email
  `;

  console.log(`\nUpdated ${result.length} user(s):`);
  for (const user of result) {
    console.log(`  ✓ ${user.email}`);
  }

  // Show final state
  const afterState = await sql`
    SELECT
      email,
      notification_email,
      notify_on_notes_created,
      notify_on_draft_created
    FROM users
    ORDER BY email
  `;

  console.log("\nFinal notification settings:");
  console.log("─".repeat(80));
  for (const user of afterState) {
    console.log(`  ${user.email}`);
    console.log(`    Notification email: ${user.notification_email || "(uses account email)"}`);
    console.log(`    Notify on notes: ${user.notify_on_notes_created ? "✓ enabled" : "✗ disabled"}`);
    console.log(`    Notify on drafts: ${user.notify_on_draft_created ? "✓ enabled" : "✗ disabled"}`);
  }
  console.log("─".repeat(80));

  console.log("\nDone! Email notifications are now enabled for all users.");
  console.log("Users will receive emails when:");
  console.log("  - Meeting notes are generated");
  console.log("  - Email drafts are created");
}

enableNotificationsForAllUsers().catch(console.error);
