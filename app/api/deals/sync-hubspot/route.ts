import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { customers } from "@/lib/db";
import {
  fetchAllHubSpotDeals,
  getHubSpotDealCompanies,
  isHubSpotConfigured,
  fetchHubSpotCompanyById,
} from "@/lib/hubspot";

export const maxDuration = 300;

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isHubSpotConfigured()) {
      return NextResponse.json(
        { error: "HubSpot is not configured" },
        { status: 400 }
      );
    }

    // Fetch all deals from HubSpot
    const hubspotDeals = await fetchAllHubSpotDeals();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const deal of hubspotDeals) {
      try {
        // Check if we already have this deal
        const existing = await customers.getCustomerByHubSpotDealId(deal.id);

        // Get associated companies for this deal
        const companyIds = await getHubSpotDealCompanies(deal.id);
        const hubspotCompanyId = companyIds.length > 0 ? companyIds[0] : null;

        // Fetch company details to get domain
        let domain: string | null = null;
        if (hubspotCompanyId) {
          const company = await fetchHubSpotCompanyById(hubspotCompanyId);
          domain = company?.domain || null;
        }

        if (existing) {
          // Update existing customer (include domain if we have it)
          await customers.updateCustomer(existing.id, {
            name: deal.name || existing.name,
            customer_type: "deal",
            hubspot_company_id: hubspotCompanyId || existing.hubspot_company_id,
            domain: domain || existing.domain,
          });
          updated++;
        } else {
          if (!deal.name) {
            skipped++;
            continue;
          }

          // Create new customer as a deal
          await customers.createCustomer({
            name: deal.name,
            customer_type: "deal",
            hubspot_deal_id: deal.id,
            hubspot_company_id: hubspotCompanyId,
            domain,
          });
          created++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Deal ${deal.id}: ${message}`);
      }
    }

    return NextResponse.json({
      success: true,
      totalDeals: hubspotDeals.length,
      created,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error syncing HubSpot deals:", error);
    return NextResponse.json(
      { error: "Failed to sync HubSpot deals" },
      { status: 500 }
    );
  }
}
