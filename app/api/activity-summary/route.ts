import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { meetings, extracts, customers, activitySummaries } from "@/lib/db";
import { generateActivitySummary } from "@/lib/gemini/activity-summary";
import { Customer, Meeting } from "@/lib/db/types";

// Extend timeout for Gemini processing (requires Vercel Pro)
export const maxDuration = 300;

interface SummaryResponse {
  type: "deals" | "customers" | "internal";
  summary: string;
  meetingLinks: { name: string; meetingId: string }[];
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get period from query params (default to "week")
    const period = request.nextUrl.searchParams.get("period") || "week";
    const forceRegenerate = request.nextUrl.searchParams.get("regenerate") === "true";

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case "month":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "quarter":
        startDate.setDate(startDate.getDate() - 90);
        break;
      case "week":
      default:
        startDate.setDate(startDate.getDate() - 7);
        break;
    }

    const recentMeetings = await meetings.getMeetingsInDateRange(startDate, endDate);

    if (recentMeetings.length === 0) {
      return NextResponse.json({ summaries: [] });
    }

    // Get all extracts for these meetings in a single batch query
    const meetingIds = recentMeetings.map((m) => m.id);
    const extractsByMeetingId = await extracts.getExtractsByMeetingIds(meetingIds);

    // Get all customers for lookup
    const allCustomers = await customers.getCustomers();
    const customersById = new Map<string, Customer>(
      allCustomers.map((c) => [c.id, c])
    );

    // Separate meetings by type
    const dealMeetings: Meeting[] = [];
    const customerMeetings: Meeting[] = [];
    const internalMeetings: Meeting[] = [];

    for (const meeting of recentMeetings) {
      if (meeting.is_internal) {
        internalMeetings.push(meeting);
      } else if (meeting.customer_id) {
        const customer = customersById.get(meeting.customer_id);
        if (customer?.customer_type === "deal") {
          dealMeetings.push(meeting);
        } else if (customer?.customer_type === "customer") {
          customerMeetings.push(meeting);
        }
      }
    }

    // Helper function to get or create a summary for a meeting type
    async function getOrCreateSummary(
      type: "deals" | "customers" | "internal",
      typeMeetings: Meeting[]
    ): Promise<SummaryResponse | null> {
      if (typeMeetings.length === 0) {
        return null;
      }

      // Collect all extract IDs for this type
      const extractIds: string[] = [];
      for (const meeting of typeMeetings) {
        const meetingExtracts = extractsByMeetingId.get(meeting.id) || [];
        extractIds.push(...meetingExtracts.map((e) => e.id));
      }

      // If no extracts, still generate based on meeting IDs
      const hashInput = extractIds.length > 0 ? extractIds : typeMeetings.map((m) => m.id);
      const hash = activitySummaries.generateExtractIdsHash(hashInput);

      // Check for cached summary (skip if forcing regenerate)
      if (!forceRegenerate) {
        // First try exact hash match (fresh within 3 hours)
        const cached = await activitySummaries.getActivitySummaryByHash(type, hash);
        if (cached) {
          return {
            type,
            summary: cached.summary_text,
            meetingLinks: cached.meeting_links,
          };
        }

        // If no exact match, try any recent summary for this type (within 24 hours)
        // This avoids regeneration when only minor changes occurred
        const recentCached = await activitySummaries.getRecentActivitySummaryByType(type, 24);
        if (recentCached) {
          console.log(`Using recent cached summary for ${type} (hash mismatch but within 24h)`);
          return {
            type,
            summary: recentCached.summary_text,
            meetingLinks: recentCached.meeting_links,
          };
        }
      }

      // Generate new summary
      let generated = null;
      try {
        generated = await generateActivitySummary(
          type,
          typeMeetings,
          extractsByMeetingId,
          customersById
        );
      } catch (error) {
        console.error(`Error generating ${type} summary:`, error);
      }

      if (generated) {
        // Cache the new summary
        await activitySummaries.upsertActivitySummary({
          summary_type: type,
          extract_ids_hash: hash,
          summary_text: generated.summary,
          meeting_links: generated.meetingLinks,
        });
        return generated;
      }

      // Generation failed - try to use any existing cached summary as fallback
      console.log(`Generation failed for ${type}, trying fallback cache...`);
      const fallback = await activitySummaries.getLatestActivitySummaryByType(type);
      if (fallback) {
        console.log(`Using fallback cache for ${type} (from ${fallback.updated_at})`);
        return {
          type,
          summary: fallback.summary_text,
          meetingLinks: fallback.meeting_links,
        };
      }

      console.log(`No fallback cache available for ${type}`);
      return null;
    }

    // Get or create summaries for each type in parallel
    const [dealsSummary, customersSummary, internalSummary] = await Promise.all([
      getOrCreateSummary("deals", dealMeetings),
      getOrCreateSummary("customers", customerMeetings),
      getOrCreateSummary("internal", internalMeetings),
    ]);

    const summaries: SummaryResponse[] = [];
    if (dealsSummary) summaries.push(dealsSummary);
    if (customersSummary) summaries.push(customersSummary);
    if (internalSummary) summaries.push(internalSummary);

    return NextResponse.json({ summaries });
  } catch (error) {
    console.error("Error generating activity summaries:", error);
    return NextResponse.json(
      { error: "Failed to generate activity summaries" },
      { status: 500 }
    );
  }
}
