/**
 * Script to update the deal stage for all customers/deals associated with a company.
 *
 * Usage: npx tsx scripts/update-deal-stage-for-company.ts "Company Name" "new_stage"
 *
 * Example: npx tsx scripts/update-deal-stage-for-company.ts "Corpus Christi ISD" "closedwon"
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.development.local" });

import { getDb } from "../lib/db/client";
import { customers } from "../lib/db";
import { Customer } from "../lib/db/types";

interface MeetingWithCustomer {
  meeting_id: string;
  meeting_name: string;
  meeting_date: Date | null;
  customer_id: string;
  customer_name: string;
  customer_type: string;
  current_deal_stage: string | null;
}

async function getMeetingsForCompany(companyName: string): Promise<MeetingWithCustomer[]> {
  const sql = getDb();
  const searchPattern = `%${companyName}%`;
  const result = await sql`
    SELECT
      m.id as meeting_id,
      m.name as meeting_name,
      m.meeting_date,
      c.id as customer_id,
      c.name as customer_name,
      c.customer_type,
      c.deal_stage as current_deal_stage
    FROM meetings m
    JOIN customers c ON m.customer_id = c.id
    WHERE c.name ILIKE ${searchPattern}
    ORDER BY c.name, m.meeting_date DESC
  `;
  return result as MeetingWithCustomer[];
}

async function getCustomersForCompany(companyName: string): Promise<Customer[]> {
  const sql = getDb();
  const searchPattern = `%${companyName}%`;
  const result = await sql`
    SELECT * FROM customers
    WHERE name ILIKE ${searchPattern}
    ORDER BY name
  `;
  return result as Customer[];
}

async function updateDealStageForCompany(companyName: string, newDealStage: string): Promise<void> {
  console.log(`\n=== Updating Deal Stage for "${companyName}" ===\n`);
  console.log(`New deal stage: ${newDealStage}\n`);

  const matchingCustomers = await getCustomersForCompany(companyName);

  if (matchingCustomers.length === 0) {
    console.log(`No customers found matching "${companyName}"`);
    return;
  }

  console.log(`Found ${matchingCustomers.length} customer(s) matching "${companyName}":\n`);

  for (const customer of matchingCustomers) {
    console.log(`  - ${customer.name}`);
    console.log(`    ID: ${customer.id}`);
    console.log(`    Type: ${customer.customer_type}`);
    console.log(`    Current stage: ${customer.deal_stage || "(none)"}`);
  }

  const meetings = await getMeetingsForCompany(companyName);
  console.log(`\nAssociated meetings: ${meetings.length}`);

  for (const meeting of meetings) {
    const dateStr = meeting.meeting_date
      ? meeting.meeting_date.toLocaleDateString()
      : "No date";
    console.log(`  - ${meeting.meeting_name || "(unnamed)"} (${dateStr})`);
    console.log(`    Customer: ${meeting.customer_name} (${meeting.customer_type})`);
  }

  console.log("\n--- Updating deal stages ---\n");

  let updated = 0;
  let errors = 0;

  for (const customer of matchingCustomers) {
    try {
      const oldStage = customer.deal_stage || "(none)";
      await customers.updateCustomer(customer.id, {
        deal_stage: newDealStage,
      });
      console.log(`✓ ${customer.name}: ${oldStage} → ${newDealStage}`);
      updated++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.log(`✗ ${customer.name}: Error - ${message}`);
      errors++;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total meetings affected: ${meetings.length}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Usage: npx tsx scripts/update-deal-stage-for-company.ts <company_name> <new_stage>");
    console.log("");
    console.log("Examples:");
    console.log('  npx tsx scripts/update-deal-stage-for-company.ts "Corpus Christi ISD" "closedwon"');
    console.log('  npx tsx scripts/update-deal-stage-for-company.ts "Corpus Christi ISD" "negotiation"');
    process.exit(1);
  }

  const [companyName, newDealStage] = args;
  await updateDealStageForCompany(companyName, newDealStage);
}

main().catch(console.error);
