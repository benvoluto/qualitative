import { getDb } from "@/lib/db/client";

async function runMigration(): Promise<void> {
  try {
    const sql = getDb();
    console.log("Applying migration 036: extract_rules customer scope...\n");
    await sql`
      ALTER TABLE extract_rules
        ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL
    `;
    console.log("Added customer_id column to extract_rules");
    await sql`
      CREATE INDEX IF NOT EXISTS idx_extract_rules_customer_id
        ON extract_rules(customer_id)
        WHERE customer_id IS NOT NULL
    `;
    console.log("Created partial index on extract_rules.customer_id");
    console.log("\n=== Migration 036 completed successfully ===");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
  process.exit(0);
}

runMigration();
