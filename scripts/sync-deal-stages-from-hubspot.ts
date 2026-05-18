/**
 * Script to sync deal stages from HubSpot for all customers that have meetings.
 *
 * This script:
 * 1. Finds all customers that have at least one meeting
 * 2. For each customer with a HubSpot company ID, fetches the current deal stage
 * 3. Updates the customer's deal_stage and customer_type based on HubSpot data
 *
 * Usage: npx tsx scripts/sync-deal-stages-from-hubspot.ts [--dry-run]
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getDb } from "../lib/db/client";
import { customers } from "../lib/db";
import { Customer, CustomerType } from "../lib/db/types";
import { isHubSpotConfigured, getBestDealStageForCompany } from "../lib/hubspot";

interface CustomerWithMeetingCount extends Customer {
  meeting_count: number;
}

async function getCustomersWithMeetings(): Promise<CustomerWithMeetingCount[]> {
  const sql = getDb();
  const result = await sql`
    SELECT c.*, COUNT(m.id)::int as meeting_count
    FROM customers c
    INNER JOIN meetings m ON m.customer_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `;
  return result as CustomerWithMeetingCount[];
}

async function syncDealStagesFromHubSpot(dryRun: boolean = false): Promise<void> {
  console.log("=== Syncing Deal Stages from HubSpot ===\n");

  if (dryRun) {
    console.log("*** DRY RUN MODE - No changes will be made ***\n");
  }

  if (!isHubSpotConfigured()) {
    console.error("Error: HubSpot is not configured. Please set HUBSPOT_ACCESS_TOKEN.");
    process.exit(1);
  }

  const customersWithMeetings = await getCustomersWithMeetings();
  console.log(`Found ${customersWithMeetings.length} customers with meetings\n`);

  const withHubSpotId = customersWithMeetings.filter((c) => c.hubspot_company_id);
  const withoutHubSpotId = customersWithMeetings.filter((c) => !c.hubspot_company_id);

  console.log(`  With HubSpot ID: ${withHubSpotId.length}`);
  console.log(`  Without HubSpot ID: ${withoutHubSpotId.length}\n`);

  if (withoutHubSpotId.length > 0) {
    console.log("--- Customers without HubSpot ID (skipped) ---\n");
    for (const customer of withoutHubSpotId) {
      console.log(`  - ${customer.name} (${customer.meeting_count} meetings)`);
    }
    console.log("");
  }

  console.log("--- Syncing customers with HubSpot IDs ---\n");

  let updated = 0;
  let unchanged = 0;
  let errors = 0;
  let noDeals = 0;

  for (const customer of withHubSpotId) {
    try {
      const { dealStage, isWon } = await getBestDealStageForCompany(customer.hubspot_company_id!);
      const newType: CustomerType = isWon ? "customer" : "deal";

      if (dealStage === null) {
        console.log(`  ○ ${customer.name}: No deals found in HubSpot`);
        noDeals++;
        continue;
      }

      const stageChanged = customer.deal_stage !== dealStage;
      const typeChanged = customer.customer_type !== newType;

      if (stageChanged || typeChanged) {
        const oldStage = customer.deal_stage || "(none)";
        const changes: string[] = [];

        if (stageChanged) {
          changes.push(`stage: ${oldStage} → ${dealStage}`);
        }
        if (typeChanged) {
          changes.push(`type: ${customer.customer_type} → ${newType}`);
        }

        if (!dryRun) {
          await customers.updateCustomer(customer.id, {
            deal_stage: dealStage,
            customer_type: newType,
            hubspot_synced_at: new Date(),
          });
        }

        console.log(`  ✓ ${customer.name}: ${changes.join(", ")}`);
        updated++;
      } else {
        unchanged++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.log(`  ✗ ${customer.name}: Error - ${message}`);
      errors++;
    }

    // Rate limit to avoid hitting HubSpot API limits
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log("\n=== Summary ===");
  console.log(`Total customers with meetings: ${customersWithMeetings.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`No deals in HubSpot: ${noDeals}`);
  console.log(`Errors: ${errors}`);
  console.log(`Skipped (no HubSpot ID): ${withoutHubSpotId.length}`);

  if (dryRun && updated > 0) {
    console.log("\n*** Run without --dry-run to apply changes ***");
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  await syncDealStagesFromHubSpot(dryRun);
}

main().catch(console.error);
