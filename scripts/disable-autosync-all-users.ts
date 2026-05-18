/**
 * Script to disable meeting autosync for all users.
 * Run with: npx tsx scripts/disable-autosync-all-users.ts
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function disableAutosyncForAllUsers(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = neon(databaseUrl);

  console.log("Disabling meeting autosync for all users...");

  // First, show current state
  const beforeCount = await sql`
    SELECT
      COUNT(*) FILTER (WHERE meeting_autosync_enabled = TRUE) as enabled_count,
      COUNT(*) FILTER (WHERE meeting_autosync_enabled = FALSE) as disabled_count,
      COUNT(*) as total
    FROM users
  `;
  console.log("Before:", beforeCount[0]);

  // Disable autosync for all users
  const result = await sql`
    UPDATE users
    SET meeting_autosync_enabled = FALSE
    WHERE meeting_autosync_enabled = TRUE
    RETURNING id, email
  `;

  console.log(`Updated ${result.length} user(s):`);
  for (const user of result) {
    console.log(`  - ${user.email} (${user.id})`);
  }

  // Verify final state
  const afterCount = await sql`
    SELECT
      COUNT(*) FILTER (WHERE meeting_autosync_enabled = TRUE) as enabled_count,
      COUNT(*) FILTER (WHERE meeting_autosync_enabled = FALSE) as disabled_count,
      COUNT(*) as total
    FROM users
  `;
  console.log("After:", afterCount[0]);

  console.log("\nDone! Autosync is now disabled for all users.");
}

disableAutosyncForAllUsers().catch(console.error);
