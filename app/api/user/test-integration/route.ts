import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { users } from "@/lib/db";
import { getCalendarClient } from "@/lib/google/client";
import { graphRequest } from "@/lib/teams/client";
import { hubspotRequest, isHubSpotConfigured } from "@/lib/hubspot";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await users.getUserByEmail(session.user.email);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const type = request.nextUrl.searchParams.get("type");

    if (!type || !["googleMeet", "teams", "hubspot"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid integration type" },
        { status: 400 }
      );
    }

    switch (type) {
      case "googleMeet": {
        if (!user.google_access_token) {
          return NextResponse.json(
            { success: false, error: "Google Meet not connected" },
            { status: 200 }
          );
        }

        try {
          // Test by listing calendar list
          const calendar = await getCalendarClient(user.id);
          await calendar.calendarList.list({ maxResults: 1 });
          return NextResponse.json({ success: true });
        } catch (error) {
          console.error("Google Meet test failed:", error);
          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Connection failed",
          });
        }
      }

      case "teams": {
        if (!user.ms_access_token) {
          return NextResponse.json(
            { success: false, error: "Microsoft Teams not connected" },
            { status: 200 }
          );
        }

        try {
          // Test by fetching user profile
          await graphRequest(user.id, "/me");
          return NextResponse.json({ success: true });
        } catch (error) {
          console.error("Teams test failed:", error);
          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Connection failed",
          });
        }
      }

      case "hubspot": {
        if (!isHubSpotConfigured()) {
          return NextResponse.json(
            { success: false, error: "HubSpot not configured" },
            { status: 200 }
          );
        }

        try {
          // Test by fetching account info
          await hubspotRequest("/crm/v3/objects/contacts", {
            params: { limit: "1" },
          });
          return NextResponse.json({ success: true });
        } catch (error) {
          console.error("HubSpot test failed:", error);
          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Connection failed",
          });
        }
      }

      default:
        return NextResponse.json(
          { error: "Unknown integration type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error testing integration:", error);
    return NextResponse.json(
      { error: "Failed to test integration" },
      { status: 500 }
    );
  }
}
