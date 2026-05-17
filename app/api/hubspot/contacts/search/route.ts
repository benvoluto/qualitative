import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchHubSpotContacts, isHubSpotConfigured } from "@/lib/hubspot";

/**
 * Search HubSpot contacts by name or email.
 * GET /api/hubspot/contacts/search?q=search_term
 */
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters" },
        { status: 400 }
      );
    }

    const contacts = await searchHubSpotContacts(query);

    return NextResponse.json({
      success: true,
      contacts,
      total: contacts.length,
    });
  } catch (error) {
    console.error("HubSpot contact search error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to search contacts", details: message },
      { status: 500 }
    );
  }
}
