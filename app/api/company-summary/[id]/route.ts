import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { meetings, extracts, customers, companySummaries } from "@/lib/db";
import { Extract } from "@/lib/db/types";
import { generateCompanySummary } from "@/lib/gemini/company-summary";

// Extend timeout for Gemini processing (requires Vercel Pro)
export const maxDuration = 300;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: customerId } = await params;
    const forceRegenerate = request.nextUrl.searchParams.get("regenerate") === "true";

    // Get the customer
    const customer = await customers.getCustomerById(customerId);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Calculate date range (last 6 months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    // Get meetings for this customer in the date range
    const allMeetings = await meetings.getMeetingsByCustomerId(customerId);
    const recentMeetings = allMeetings.filter((m) => {
      if (!m.meeting_date) return false;
      const meetingDate = new Date(m.meeting_date);
      return meetingDate >= startDate && meetingDate <= endDate;
    });

    if (recentMeetings.length === 0) {
      return NextResponse.json({ summary: null });
    }

    // Get all extracts for these meetings
    const extractsByMeetingId = new Map<string, Extract[]>();
    const allExtractIds: string[] = [];

    for (const meeting of recentMeetings) {
      const meetingExtracts = await extracts.getExtractsByMeetingId(meeting.id);
      extractsByMeetingId.set(meeting.id, meetingExtracts);
      allExtractIds.push(...meetingExtracts.map((e) => e.id));
    }

    // Generate hash from extract IDs (or meeting IDs if no extracts)
    const hashInput = allExtractIds.length > 0 ? allExtractIds : recentMeetings.map((m) => m.id);
    const hash = companySummaries.generateExtractIdsHash(hashInput);

    // Check for cached summary (skip if forcing regenerate)
    if (!forceRegenerate) {
      const cached = await companySummaries.getCompanySummaryByHash(customerId, hash);
      if (cached) {
        return NextResponse.json({
          summary: {
            text: cached.summary_text,
            meetingLinks: cached.meeting_links,
          },
        });
      }
    }

    // Generate new summary
    const generated = await generateCompanySummary(
      customer.name,
      customer.customer_type as "deal" | "customer",
      recentMeetings,
      extractsByMeetingId
    );

    if (!generated) {
      return NextResponse.json({ summary: null });
    }

    // Cache the summary
    await companySummaries.upsertCompanySummary({
      customer_id: customerId,
      extract_ids_hash: hash,
      summary_text: generated.summary,
      meeting_links: generated.meetingLinks,
    });

    return NextResponse.json({
      summary: {
        text: generated.summary,
        meetingLinks: generated.meetingLinks,
      },
    });
  } catch (error) {
    console.error("Error generating company summary:", error);
    return NextResponse.json(
      { error: "Failed to generate company summary" },
      { status: 500 }
    );
  }
}
