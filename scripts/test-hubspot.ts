import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { isHubSpotConfigured, hubspotRequest } from "../lib/hubspot/client";
import { fetchHubSpotMeetingsLastDays } from "../lib/hubspot/meetings";

async function testHubSpot() {
  console.log("Testing HubSpot API connection...\n");

  // Check if configured
  console.log("1. Checking configuration...");
  const configured = isHubSpotConfigured();
  console.log(`   HubSpot configured: ${configured}`);

  if (!configured) {
    console.log("   ERROR: HubSpot is not configured. Set HUBSPOT_ACCESS_TOKEN.");
    return;
  }

  // Test basic API call - get account info
  console.log("\n2. Testing basic API access...");
  try {
    const accountInfo = await hubspotRequest<{ portalId: number }>("/account-info/v3/details");
    console.log(`   SUCCESS: Connected to HubSpot portal ID: ${accountInfo.portalId}`);
  } catch (error) {
    console.log(`   ERROR: ${error instanceof Error ? error.message : error}`);
  }

  // Test meetings API
  console.log("\n3. Testing Meetings API (list endpoint)...");
  try {
    const response = await hubspotRequest<{ results: unknown[]; total?: number }>(
      "/crm/v3/objects/meetings",
      { params: { limit: "1" } }
    );
    console.log(`   SUCCESS: Meetings API accessible. Found ${response.results?.length ?? 0} meeting(s) in sample.`);
  } catch (error) {
    console.log(`   ERROR: ${error instanceof Error ? error.message : error}`);
  }

  // Test meetings search API
  console.log("\n4. Testing Meetings Search API...");
  try {
    const meetings = await fetchHubSpotMeetingsLastDays(7);
    console.log(`   SUCCESS: Found ${meetings.length} meeting(s) in the last 7 days.`);
    if (meetings.length > 0) {
      console.log("\n   Sample meetings:");
      meetings.slice(0, 3).forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.title || "Untitled"} - ${m.startTime?.toLocaleDateString() || "No date"}`);
      });
    }
  } catch (error) {
    console.log(`   ERROR: ${error instanceof Error ? error.message : error}`);
  }

  console.log("\nTest complete");
}

testHubSpot().catch(console.error);
