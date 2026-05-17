/**
 * Script to update all customers with HubSpot company IDs to have the correct
 * customer_type based on their deal stage.
 *
 * This ensures existing meetings reflect the new deal/customer classification.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.development.local" });

import { isHubSpotConfigured, getBestDealStageForCompany } from "../lib/hubspot";
import { customers } from "../lib/db";
import { CustomerType } from "../lib/db/types";

async function updateCustomerTypes() {
  console.log("=== Updating Customer Types Based on Deal Stages ===\n");

  // Get all customers
  const allCustomers = await customers.getCustomers();
  console.log(`Found ${allCustomers.length} total customers in database\n`);

  // Separate customers by whether they have HubSpot company IDs
  const customersWithHubSpot = allCustomers.filter(c => c.hubspot_company_id);
  const customersWithoutHubSpot = allCustomers.filter(c => !c.hubspot_company_id);

  console.log(`Customers with HubSpot ID: ${customersWithHubSpot.length}`);
  console.log(`Customers without HubSpot ID: ${customersWithoutHubSpot.length}\n`);

  if (!isHubSpotConfigured()) {
    console.log("HubSpot is not configured - cannot fetch deal stages");
    return;
  }

  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  // Update customers with HubSpot IDs
  console.log("--- Updating customers with HubSpot IDs ---\n");

  for (const customer of customersWithHubSpot) {
    try {
      const { dealStage, isWon } = await getBestDealStageForCompany(customer.hubspot_company_id!);
      const newType: CustomerType = isWon ? "customer" : "deal";

      const changed = customer.customer_type !== newType || customer.deal_stage !== dealStage;

      if (changed) {
        await customers.updateCustomer(customer.id, {
          deal_stage: dealStage,
          customer_type: newType,
          hubspot_synced_at: new Date(),
        });
        console.log(`✓ ${customer.name}: ${customer.customer_type} → ${newType} (stage: ${dealStage})`);
        updated++;
      } else {
        unchanged++;
      }
    } catch (error) {
      console.log(`✗ ${customer.name}: Error - ${error instanceof Error ? error.message : "Unknown"}`);
      errors++;
    }
  }

  // List customers without HubSpot IDs (these can't be auto-classified)
  console.log("\n--- Customers without HubSpot IDs (manual classification needed) ---\n");

  for (const customer of customersWithoutHubSpot) {
    console.log(`  - ${customer.name} (current type: ${customer.customer_type})`);
  }

  console.log("\n=== Summary ===");
  console.log(`Updated: ${updated}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Errors: ${errors}`);
  console.log(`Without HubSpot ID: ${customersWithoutHubSpot.length}`);
}

updateCustomerTypes().catch(console.error);
