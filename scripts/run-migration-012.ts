import { getDb } from "@/lib/db/client";

async function runMigration() {
  try {
    const sql = getDb();

    // Create table
    await sql`
      CREATE TABLE IF NOT EXISTS company_summaries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          extract_ids_hash VARCHAR(64) NOT NULL,
          summary_text TEXT NOT NULL,
          meeting_links JSONB DEFAULT '[]',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log("Created table company_summaries");

    // Create unique index
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_company_summaries_customer_hash
      ON company_summaries(customer_id, extract_ids_hash)
    `;
    console.log("Created unique index");

    // Create trigger function
    await sql`
      CREATE OR REPLACE FUNCTION update_company_summaries_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;
    console.log("Created trigger function");

    // Drop existing trigger if exists and create new one
    await sql`DROP TRIGGER IF EXISTS update_company_summaries_updated_at ON company_summaries`;
    await sql`
      CREATE TRIGGER update_company_summaries_updated_at
          BEFORE UPDATE ON company_summaries
          FOR EACH ROW
          EXECUTE FUNCTION update_company_summaries_updated_at()
    `;
    console.log("Created trigger");

    console.log("Migration 012 completed successfully");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
