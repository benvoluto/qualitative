/**
 * Script to consolidate Corpus Christi ISD records:
 * 1. Update the target customer with HubSpot company ID
 * 2. Move all meetings from the source customer to target
 * 3. Move all extracts from the source customer to target
 * 4. Optionally delete the source customer
 *
 * Usage: npx tsx scripts/consolidate-corpus-christi.ts [--dry-run] [--delete-source]
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.development.local" });

import { getDb } from "../lib/db/client";

const TARGET_CUSTOMER_ID = "bad4a0e2-b1d8-43e6-8952-7886c7d11909";
const SOURCE_CUSTOMER_ID = "53292ef7-abc6-4aa3-a096-7120e1a7fa60";
const HUBSPOT_COMPANY_ID = "30684272956";

interface ConsolidationStats {
  meetingsMoved: number;
  extractsMoved: number;
  hubspotIdUpdated: boolean;
  sourceDeleted: boolean;
}

async function consolidateCorpusChristi(
  dryRun: boolean = false,
  deleteSource: boolean = false
): Promise<ConsolidationStats> {
  const sql = getDb();
  const stats: ConsolidationStats = {
    meetingsMoved: 0,
    extractsMoved: 0,
    hubspotIdUpdated: false,
    sourceDeleted: false,
  };

  console.log("=== Consolidating Corpus Christi ISD Records ===\n");

  if (dryRun) {
    console.log("*** DRY RUN MODE - No changes will be made ***\n");
  }

  // Verify customers exist
  const targetCustomer = await sql`SELECT * FROM customers WHERE id = ${TARGET_CUSTOMER_ID}`;
  const sourceCustomer = await sql`SELECT * FROM customers WHERE id = ${SOURCE_CUSTOMER_ID}`;

  if (targetCustomer.length === 0) {
    throw new Error(`Target customer not found: ${TARGET_CUSTOMER_ID}`);
  }
  if (sourceCustomer.length === 0) {
    throw new Error(`Source customer not found: ${SOURCE_CUSTOMER_ID}`);
  }

  console.log("Target customer:");
  console.log(`  ID: ${TARGET_CUSTOMER_ID}`);
  console.log(`  Name: ${targetCustomer[0].name}`);
  console.log(`  Current HubSpot ID: ${targetCustomer[0].hubspot_company_id || "(none)"}\n`);

  console.log("Source customer (to merge):");
  console.log(`  ID: ${SOURCE_CUSTOMER_ID}`);
  console.log(`  Name: ${sourceCustomer[0].name}`);
  console.log(`  HubSpot ID: ${sourceCustomer[0].hubspot_company_id || "(none)"}\n`);

  // Count items to move
  const meetingsToMove = await sql`
    SELECT COUNT(*)::int as count FROM meetings WHERE customer_id = ${SOURCE_CUSTOMER_ID}
  `;
  const extractsToMove = await sql`
    SELECT COUNT(*)::int as count FROM extracts WHERE customer_id = ${SOURCE_CUSTOMER_ID}
  `;

  console.log(`Meetings to move: ${meetingsToMove[0].count}`);
  console.log(`Extracts to move: ${extractsToMove[0].count}\n`);

  // Step 1: Update HubSpot company ID on target customer
  console.log("--- Step 1: Update HubSpot Company ID ---");
  if (!dryRun) {
    // First clear the HubSpot ID from source (to avoid unique constraint violation)
    await sql`
      UPDATE customers
      SET hubspot_company_id = NULL,
          updated_at = NOW()
      WHERE id = ${SOURCE_CUSTOMER_ID}
    `;
    console.log(`  Cleared hubspot_company_id from source customer`);
    // Then set it on the target
    await sql`
      UPDATE customers
      SET hubspot_company_id = ${HUBSPOT_COMPANY_ID},
          hubspot_synced_at = NOW(),
          updated_at = NOW()
      WHERE id = ${TARGET_CUSTOMER_ID}
    `;
  }
  console.log(`✓ Set hubspot_company_id = ${HUBSPOT_COMPANY_ID} on target customer`);
  stats.hubspotIdUpdated = true;

  // Step 2: Move meetings from source to target
  console.log("\n--- Step 2: Move Meetings ---");
  if (meetingsToMove[0].count > 0) {
    const meetings = await sql`
      SELECT id, name FROM meetings WHERE customer_id = ${SOURCE_CUSTOMER_ID}
    `;
    for (const meeting of meetings) {
      console.log(`  Moving: ${meeting.name || meeting.id}`);
    }
    if (!dryRun) {
      await sql`
        UPDATE meetings
        SET customer_id = ${TARGET_CUSTOMER_ID},
            updated_at = NOW()
        WHERE customer_id = ${SOURCE_CUSTOMER_ID}
      `;
    }
    stats.meetingsMoved = meetingsToMove[0].count;
    console.log(`✓ Moved ${stats.meetingsMoved} meeting(s)`);
  } else {
    console.log("  No meetings to move");
  }

  // Step 3: Move extracts from source to target
  console.log("\n--- Step 3: Move Extracts ---");
  if (extractsToMove[0].count > 0) {
    if (!dryRun) {
      await sql`
        UPDATE extracts
        SET customer_id = ${TARGET_CUSTOMER_ID},
            updated_at = NOW()
        WHERE customer_id = ${SOURCE_CUSTOMER_ID}
      `;
    }
    stats.extractsMoved = extractsToMove[0].count;
    console.log(`✓ Moved ${stats.extractsMoved} extract(s)`);
  } else {
    console.log("  No extracts to move");
  }

  // Step 4: Optionally delete source customer
  console.log("\n--- Step 4: Delete Source Customer ---");
  if (deleteSource) {
    if (!dryRun) {
      await sql`DELETE FROM customers WHERE id = ${SOURCE_CUSTOMER_ID}`;
    }
    stats.sourceDeleted = true;
    console.log(`✓ Deleted source customer: ${sourceCustomer[0].name}`);
  } else {
    console.log("  Skipped (use --delete-source to remove)");
  }

  // Summary
  console.log("\n=== Summary ===");
  console.log(`HubSpot ID updated: ${stats.hubspotIdUpdated}`);
  console.log(`Meetings moved: ${stats.meetingsMoved}`);
  console.log(`Extracts moved: ${stats.extractsMoved}`);
  console.log(`Source customer deleted: ${stats.sourceDeleted}`);

  if (dryRun) {
    console.log("\n*** Run without --dry-run to apply changes ***");
  }

  return stats;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const deleteSource = args.includes("--delete-source");

  await consolidateCorpusChristi(dryRun, deleteSource);
}

main().catch(console.error);
