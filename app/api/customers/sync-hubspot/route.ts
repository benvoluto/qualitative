import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isHubSpotConfigured, getCompaniesWithRecentMeetings, getBestDealStageForCompany } from "@/lib/hubspot";
import { customers, companies } from "@/lib/db";
import { CustomerType } from "@/lib/db/types";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isHubSpotConfigured()) {
      return NextResponse.json(
        { error: "HubSpot is not configured. Please add HUBSPOT_ACCESS_TOKEN to environment variables." },
        { status: 400 }
      );
    }

    // Get days parameter (default 180 = 6 months)
    const body = await request.json().catch(() => ({}));
    const days = body.days || 180;

    // Fetch companies that have had meetings in the last N days
    const hubspotCompanies = await getCompaniesWithRecentMeetings(days);

    let synced = 0;
    let updated = 0;
    let skipped = 0;
    let companiesSynced = 0;

    for (const hsCompany of hubspotCompanies) {
      if (!hsCompany.name) {
        skipped++;
        continue;
      }

      // Upsert to companies table with full address fields
      const company = await companies.upsertCompanyByHubSpotId(hsCompany.id, {
        name: hsCompany.name,
        domain: hsCompany.domain,
        address: hsCompany.address,
        city: hsCompany.city,
        state: hsCompany.state,
        zip: hsCompany.zip,
        country: hsCompany.country,
        hubspot_synced_at: new Date(),
      });
      companiesSynced++;

      // Get deal stage for this company
      const { dealStage, isWon } = await getBestDealStageForCompany(hsCompany.id);
      const customerType: CustomerType = isWon ? "customer" : "deal";

      // Build legacy address string for customers table
      const addressString = [hsCompany.address, hsCompany.city, hsCompany.state, hsCompany.zip, hsCompany.country]
        .filter(Boolean)
        .join(", ");

      // Check if customer already exists by name (case-insensitive) or HubSpot company ID
      let exactMatch = await customers.getCustomerByHubSpotCompanyId(hsCompany.id);
      if (!exactMatch) {
        const existingCustomers = await customers.searchCustomers(hsCompany.name);
        exactMatch = existingCustomers.find(
          (c) => c.name.toLowerCase() === hsCompany.name?.toLowerCase()
        ) || null;
      }

      if (exactMatch) {
        // Update existing customer with HubSpot data and link to company
        await customers.updateCustomer(exactMatch.id, {
          address: addressString || exactMatch.address,
          domain: hsCompany.domain || exactMatch.domain,
          hubspot_company_id: hsCompany.id,
          deal_stage: dealStage,
          customer_type: customerType,
          company_id: company.id,
          hubspot_synced_at: new Date(),
        });
        updated++;
      } else {
        // Create new customer linked to company
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
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${companiesSynced} companies, ${synced} new customers, updated ${updated}, skipped ${skipped}`,
      companiesSynced,
      synced,
      updated,
      skipped,
      total: hubspotCompanies.length,
    });
  } catch (error) {
    console.error("HubSpot customer sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to sync customers from HubSpot", details: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      configured: isHubSpotConfigured(),
    });
  } catch (error) {
    console.error("HubSpot status error:", error);
    return NextResponse.json(
      { error: "Failed to check HubSpot status" },
      { status: 500 }
    );
  }
}
