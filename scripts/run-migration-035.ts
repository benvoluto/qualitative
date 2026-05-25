import { getDb } from "@/lib/db/client";

async function runMigration(): Promise<void> {
  try {
    const sql = getDb();
    console.log("Applying migration 035: Add customers.domain column...\n");
    await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS domain VARCHAR(255)`;
    console.log("Added domain column to customers table");
    const updated = await sql`
      UPDATE customers c
      SET domain = co.domain
      FROM companies co
      WHERE c.company_id = co.id
        AND c.domain IS NULL
        AND co.domain IS NOT NULL
      RETURNING c.id
    `;
    console.log(`Backfilled domain on ${updated.length} customer row(s) from linked companies`);
    console.log("\n=== Migration 035 completed successfully ===");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
  process.exit(0);
}

runMigration();
