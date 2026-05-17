import * as dotenv from "dotenv";
dotenv.config({ path: ".env.development.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function updateExtractCustomers() {
  console.log("Updating extracts with customer info from meetings...\n");

  // Get all extracts without customer_id but with meeting_id
  const extractsToUpdate = await sql`
    SELECT e.id, e.meeting_id, m.customer_id, c.name as customer_name
    FROM extracts e
    JOIN meetings m ON e.meeting_id = m.id
    LEFT JOIN customers c ON m.customer_id = c.id
    WHERE e.customer_id IS NULL AND m.customer_id IS NOT NULL
  `;

  console.log(`Found ${extractsToUpdate.length} extracts to update\n`);

  let updated = 0;
  for (const extract of extractsToUpdate) {
    await sql`
      UPDATE extracts
      SET customer_id = ${extract.customer_id}
      WHERE id = ${extract.id}
    `;
    console.log(`  Updated extract ${extract.id.slice(0, 8)}... -> ${extract.customer_name}`);
    updated++;
  }

  // Also check extracts that already have customer_id but meeting has different customer
  const mismatchedExtracts = await sql`
    SELECT e.id, e.customer_id as old_customer_id, m.customer_id as new_customer_id,
           c1.name as old_name, c2.name as new_name
    FROM extracts e
    JOIN meetings m ON e.meeting_id = m.id
    LEFT JOIN customers c1 ON e.customer_id = c1.id
    LEFT JOIN customers c2 ON m.customer_id = c2.id
    WHERE e.customer_id IS NOT NULL
      AND m.customer_id IS NOT NULL
      AND e.customer_id != m.customer_id
  `;

  if (mismatchedExtracts.length > 0) {
    console.log(`\nFound ${mismatchedExtracts.length} extracts with mismatched customer_id:`);
    for (const extract of mismatchedExtracts) {
      console.log(`  ${extract.old_name} -> ${extract.new_name}`);
      await sql`
        UPDATE extracts
        SET customer_id = ${extract.new_customer_id}
        WHERE id = ${extract.id}
      `;
      updated++;
    }
  }

  // Show summary
  const summary = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(customer_id) as with_customer
    FROM extracts
  `;

  console.log(`\n========================================`);
  console.log(`Update complete!`);
  console.log(`  Extracts updated: ${updated}`);
  console.log(`  Total extracts: ${summary[0].total}`);
  console.log(`  Extracts with customer: ${summary[0].with_customer}`);
  console.log(`========================================`);
}

updateExtractCustomers().catch(console.error);
