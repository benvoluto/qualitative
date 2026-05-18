import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { meetings, extracts, customers, companySummaries } from "@/lib/db";
import { Extract } from "@/lib/db/types";
import { generateCompanySummary } from "@/lib/gemini/company-summary";

export const maxDuration = 300;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const accountId = await requireAccountId();
    const { id: customerId } = await params;
    const forceRegenerate = request.nextUrl.searchParams.get("regenerate") === "true";

    const customer = await customers.getCustomerById(accountId, customerId);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    const allMeetings = await meetings.getMeetingsByCustomerId(accountId, customerId);
    const recentMeetings = allMeetings.filter((m) => {
      if (!m.meeting_date) return false;
      const meetingDate = new Date(m.meeting_date);
      return meetingDate >= startDate && meetingDate <= endDate;
    });

    if (recentMeetings.length === 0) {
      return NextResponse.json({ summary: null });
    }

    const extractsByMeetingId = new Map<string, Extract[]>();
    const allExtractIds: string[] = [];

    for (const meeting of recentMeetings) {
      const meetingExtracts = await extracts.getExtractsByMeetingId(accountId, meeting.id);
      extractsByMeetingId.set(meeting.id, meetingExtracts);
      allExtractIds.push(...meetingExtracts.map((e) => e.id));
    }

    const hashInput = allExtractIds.length > 0 ? allExtractIds : recentMeetings.map((m) => m.id);
    const hash = companySummaries.generateExtractIdsHash(hashInput);

    if (!forceRegenerate) {
      const cached = await companySummaries.getCompanySummaryByHash(accountId, customerId, hash);
      if (cached) {
        return NextResponse.json({
          summary: {
            text: cached.summary_text,
            meetingLinks: cached.meeting_links,
          },
        });
      }
    }

    const generated = await generateCompanySummary(
      customer.name,
      customer.customer_type as "deal" | "customer",
      recentMeetings,
      extractsByMeetingId
    );

    if (!generated) {
      return NextResponse.json({ summary: null });
    }

    await companySummaries.upsertCompanySummary(accountId, {
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
    return NextResponse.json({ error: "Failed to generate company summary" }, { status: 500 });
  }
}
