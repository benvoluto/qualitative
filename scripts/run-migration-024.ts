import { getDb } from "@/lib/db/client";

interface DuplicateRow {
  external_id: string;
  count: string;
  meeting_ids: string[];
}

async function runMigration() {
  try {
    const sql = getDb();

    console.log("Checking for duplicate external_ids before migration 024...\n");

    // Check for duplicates
    const duplicates = await sql`
      SELECT external_id, COUNT(*)::text as count, array_agg(id) as meeting_ids
      FROM meetings
      WHERE external_id IS NOT NULL
      GROUP BY external_id
      HAVING COUNT(*) > 1
    ` as DuplicateRow[];

    if (duplicates.length > 0) {
      console.log("⚠️  Found duplicate external_ids! Cannot apply unique constraint.\n");
      console.log("Duplicates found:");
      for (const dup of duplicates) {
        console.log(`  external_id: ${dup.external_id}`);
        console.log(`  count: ${dup.count}`);
        console.log(`  meeting_ids: ${dup.meeting_ids.join(", ")}`);
        console.log("");
      }
      console.log("Please resolve duplicates before running migration.");
      process.exit(1);
    }

    console.log("✓ No duplicate external_ids found. Proceeding with migration...\n");

    console.log("Applying migration 024: Unique constraint on external_id...");

    // Add unique constraint
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_external_id_unique
      ON meetings (external_id)
      WHERE external_id IS NOT NULL
    `;
    console.log("✓ Created unique index on external_id");

    // Add composite index for faster lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_meetings_source_external_id
      ON meetings (source, external_id)
      WHERE external_id IS NOT NULL
    `;
    console.log("✓ Created composite index on source + external_id");

    console.log("\n✓ Migration 024 completed successfully");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
