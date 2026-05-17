import { getDb } from "@/lib/db/client";

async function runMigration() {
  try {
    const sql = getDb();

    console.log("Applying migration 026: Company domain aliases...\n");

    // Add domain_aliases column to companies
    await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS domain_aliases TEXT[] DEFAULT '{}'`;
    console.log("Added domain_aliases column to companies");

    // Add index for searching domain aliases
    await sql`CREATE INDEX IF NOT EXISTS idx_companies_domain_aliases ON companies USING GIN (domain_aliases)`;
    console.log("Created GIN index for companies domain_aliases");

    // Add domain_aliases to customers table
    await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS domain_aliases TEXT[] DEFAULT '{}'`;
    console.log("Added domain_aliases column to customers");

    await sql`CREATE INDEX IF NOT EXISTS idx_customers_domain_aliases ON customers USING GIN (domain_aliases)`;
    console.log("Created GIN index for customers domain_aliases");

    console.log("\n--- Fixing Oakland data ---\n");

    // Get the legacy Oakland customer (the one without domain)
    const legacyOakland = await sql`
      SELECT id, name, domain FROM customers
      WHERE id = 'e16b7320-223c-4846-bef5-b21a383c910d'
    `;
    console.log("Legacy Oakland customer:", legacyOakland[0]);

    // Get the correct Oakland customer (Oakland - 2025 with domain)
    const correctOakland = await sql`
      SELECT id, name, domain FROM customers
      WHERE id = '05bb312a-09f0-4d48-aa12-5411c52c78fa'
    `;
    console.log("Correct Oakland customer:", correctOakland[0]);

    // Update meetings that were incorrectly assigned to the legacy customer
    const meetingsUpdated = await sql`
      UPDATE meetings
      SET customer_id = '05bb312a-09f0-4d48-aa12-5411c52c78fa'
      WHERE customer_id = 'e16b7320-223c-4846-bef5-b21a383c910d'
      RETURNING id, name
    `;
    console.log(`\nUpdated ${meetingsUpdated.length} meetings to correct Oakland customer:`);
    for (const m of meetingsUpdated) {
      console.log(`  - ${m.name}`);
    }

    // Update extracts that were incorrectly assigned
    const extractsUpdated = await sql`
      UPDATE extracts
      SET customer_id = '05bb312a-09f0-4d48-aa12-5411c52c78fa'
      WHERE customer_id = 'e16b7320-223c-4846-bef5-b21a383c910d'
      RETURNING id
    `;
    console.log(`Updated ${extractsUpdated.length} extracts to correct Oakland customer`);

    // Update the correct Oakland customer's domain to ousd.org
    await sql`
      UPDATE customers
      SET domain = 'ousd.org'
      WHERE id = '05bb312a-09f0-4d48-aa12-5411c52c78fa'
    `;
    console.log("\nUpdated Oakland - 2025 customer domain to ousd.org");

    // Also update the company's domain and add the old domain as an alias
    await sql`
      UPDATE companies
      SET domain = 'ousd.org',
          domain_aliases = ARRAY['ousd.k12.ca.us']
      WHERE id = 'd261acfc-2506-4e84-9025-3e1dfd5df52b'
    `;
    console.log("Updated Oakland Unified School District company: domain = ousd.org, alias = ousd.k12.ca.us");

    // Delete the legacy Oakland customer
    const deleted = await sql`
      DELETE FROM customers
      WHERE id = 'e16b7320-223c-4846-bef5-b21a383c910d'
      RETURNING id, name
    `;
    console.log(`\nDeleted legacy customer: ${deleted[0]?.name || 'not found'}`);

    console.log("\n=== Migration 026 completed successfully ===");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
