import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isHubSpotConfigured, getLatestHubSpotCompanyModifiedDate } from "@/lib/hubspot";
import { companies } from "@/lib/db";

export const maxDuration = 300;

/**
 * Check whether local company data is stale compared to HubSpot.
 * Returns { needsSync, localLastSync, hubspotLastModified }.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isHubSpotConfigured()) {
      return NextResponse.json({ needsSync: false, reason: "HubSpot not configured" });
    }
    const localLastSync = await companies.getLastCompanySyncTime();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const isCooldownActive = localLastSync !== null &&
      (Date.now() - localLastSync.getTime()) < TWENTY_FOUR_HOURS_MS;
    if (isCooldownActive) {
      return NextResponse.json({
        needsSync: false,
        localLastSync: localLastSync.toISOString(),
        hubspotLastModified: null,
        reason: "Last sync was less than 24 hours ago",
      });
    }
    const hubspotLastModified = await getLatestHubSpotCompanyModifiedDate();
    const needsSync = hubspotLastModified !== null &&
      (localLastSync === null || hubspotLastModified > localLastSync);
    return NextResponse.json({
      needsSync,
      localLastSync: localLastSync?.toISOString() ?? null,
      hubspotLastModified: hubspotLastModified?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Company sync check error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to check company sync status", details: message },
      { status: 500 }
    );
  }
}
