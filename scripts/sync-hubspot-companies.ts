import * as dotenv from "dotenv";
dotenv.config({ path: ".env.development.local" });

import { isHubSpotConfigured, getCompaniesWithRecentMeetings, getBestDealStageForCompany } from "../lib/hubspot";
import { customers, companies } from "../lib/db";
import { CustomerType } from "../lib/db/types";

async function syncCustomers() {
  if (!isHubSpotConfigured()) {
    console.log("HubSpot is not configured");
    return;
  }

  console.log("Fetching companies with recent meetings from HubSpot...");
  const hubspotCompanies = await getCompaniesWithRecentMeetings(180);
  console.log("Found", hubspotCompanies.length, "companies with recent meetings");

  let synced = 0;
  let updated = 0;
  let skipped = 0;
  let companiesSynced = 0;

  for (const hsCompany of hubspotCompanies) {
    if (!hsCompany.name) {
      skipped++;
      continue;
    }

    console.log("Processing:", hsCompany.name);

    // Get deal stage for this company
    const { dealStage, isWon } = await getBestDealStageForCompany(hsCompany.id);

    // Upsert to companies table with full address fields and waitlist data
    const company = await companies.upsertCompanyByHubSpotId(hsCompany.id, {
      name: hsCompany.name,
      domain: hsCompany.domain,
      address: hsCompany.address,
      city: hsCompany.city,
      state: hsCompany.state,
      zip: hsCompany.zip,
      country: hsCompany.country,
      waitlist: hsCompany.waitlist,
      waitlist_date: hsCompany.waitlistDate,
      waitlist_followup: hsCompany.waitlistFollowup,
      waitlist_source: hsCompany.waitlistSource,
      deal_stage: dealStage,
      hubspot_synced_at: new Date(),
    });
    companiesSynced++;
    console.log("  Company synced:", company.id);
    if (hsCompany.city || hsCompany.state || hsCompany.zip) {
      console.log("  Address:", [hsCompany.address, hsCompany.city, hsCompany.state, hsCompany.zip, hsCompany.country].filter(Boolean).join(", "));
    }
    if (hsCompany.waitlist) {
      console.log("  Waitlist: YES, Date:", hsCompany.waitlistDate, "Source:", hsCompany.waitlistSource);
    }

    const customerType: CustomerType = isWon ? "customer" : "deal";

    console.log("  Deal stage:", dealStage, "| Type:", customerType);

    // Build legacy address string for customers table
    const addressString = [hsCompany.address, hsCompany.city, hsCompany.state, hsCompany.zip, hsCompany.country]
      .filter(Boolean)
      .join(", ");

    // Check if customer already exists
    let existingCustomer = await customers.getCustomerByHubSpotCompanyId(hsCompany.id);
    if (!existingCustomer) {
      const existingCustomers = await customers.searchCustomers(hsCompany.name);
      existingCustomer = existingCustomers.find(
        (c) => c.name.toLowerCase() === hsCompany.name?.toLowerCase()
      ) || null;
    }

    if (existingCustomer) {
      await customers.updateCustomer(existingCustomer.id, {
        address: addressString || existingCustomer.address,
        domain: hsCompany.domain || existingCustomer.domain,
        hubspot_company_id: hsCompany.id,
        deal_stage: dealStage,
        customer_type: customerType,
        company_id: company.id,
        hubspot_synced_at: new Date(),
      });
      updated++;
      console.log("  Updated existing customer");
    } else {
      await customers.createCustomer({
        name: hsCompany.name,
        address: addressString || null,
        domain: hsCompany.domain,
        hubspot_company_id: hsCompany.id,
        deal_stage: dealStage,
        customer_type: customerType,
        company_id: company.id,
        hubspot_synced_at: new Date(),
      });
      synced++;
      console.log("  Created new customer");
    }
  }

  console.log("\n=== Summary ===");
  console.log("Companies synced:", companiesSynced);
  console.log("Customers synced:", synced);
  console.log("Customers updated:", updated);
  console.log("Skipped:", skipped);
  console.log("Total:", hubspotCompanies.length);
}

syncCustomers().catch(console.error);
