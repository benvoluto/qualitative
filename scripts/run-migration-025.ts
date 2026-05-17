import { getDb } from "@/lib/db/client";

async function runMigration() {
  try {
    const sql = getDb();

    console.log("Applying migration 025: Company waitlist fields...");

    // Add waitlist boolean (defaults to false)
    await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS waitlist BOOLEAN DEFAULT false`;
    console.log("Added waitlist column");

    // Add waitlist date
    await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS waitlist_date DATE`;
    console.log("Added waitlist_date column");

    // Add waitlist followup date
    await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS waitlist_followup DATE`;
    console.log("Added waitlist_followup column");

    // Add waitlist source
    await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS waitlist_source TEXT`;
    console.log("Added waitlist_source column");

    // Add deal_stage to companies
    await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS deal_stage TEXT`;
    console.log("Added deal_stage column");

    // Add index for waitlist queries
    await sql`CREATE INDEX IF NOT EXISTS idx_companies_waitlist ON companies (waitlist) WHERE waitlist = true`;
    console.log("Created index for waitlist");

    await sql`CREATE INDEX IF NOT EXISTS idx_companies_waitlist_date ON companies (waitlist_date) WHERE waitlist_date IS NOT NULL`;
    console.log("Created index for waitlist_date");

    console.log("\nMigration 025 completed successfully");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
