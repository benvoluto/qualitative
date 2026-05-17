import { getDb } from "@/lib/db/client";

async function runMigration() {
  try {
    const sql = getDb();

    console.log("Applying migration 028: Workflow status 'transcribed'...\n");

    // Check current state before migration
    const before = await sql`
      SELECT workflow_status, COUNT(*)::int as count
      FROM meetings
      GROUP BY workflow_status
      ORDER BY workflow_status
    `;
    console.log("Before migration:");
    for (const row of before) {
      console.log(`  ${row.workflow_status}: ${row.count}`);
    }

    // Meetings with transcript but no extracts → "transcribed"
    const result1 = await sql`
      UPDATE meetings m SET workflow_status = 'transcribed'
      WHERE m.workflow_status = 'completed'
        AND m.transcript IS NOT NULL
        AND m.transcript != ''
        AND NOT EXISTS (SELECT 1 FROM extracts e WHERE e.meeting_id = m.id)
    `;
    console.log(`\nUpdated ${(result1 as unknown[]).length} meetings: completed → transcribed (has transcript, no extracts)`);

    // Meetings with no transcript and no extracts that were somehow "completed" → "pending"
    const result2 = await sql`
      UPDATE meetings SET workflow_status = 'pending'
      WHERE workflow_status = 'completed'
        AND (transcript IS NULL OR transcript = '')
        AND NOT EXISTS (SELECT 1 FROM extracts e WHERE e.meeting_id = meetings.id)
    `;
    console.log(`Updated ${(result2 as unknown[]).length} meetings: completed → pending (no transcript, no extracts)`);

    // Check state after migration
    const after = await sql`
      SELECT workflow_status, COUNT(*)::int as count
      FROM meetings
      GROUP BY workflow_status
      ORDER BY workflow_status
    `;
    console.log("\nAfter migration:");
    for (const row of after) {
      console.log(`  ${row.workflow_status}: ${row.count}`);
    }

    console.log("\n=== Migration 028 completed successfully ===");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
