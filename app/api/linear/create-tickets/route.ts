import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { meetings, extracts, customers } from "@/lib/db";
import { generateCRMNotes, extractFeatureRequests, extractBugReports } from "@/lib/gemini";
import {
  createFeatureRequestTickets,
  createBugReportTickets,
  isLinearConfigured,
} from "@/lib/linear";

export async function POST(request: NextRequest) {
  try {
    const accountId = await requireAccountId();
    if (!isLinearConfigured()) {
      return NextResponse.json(
        { error: "Linear is not configured. Set LINEAR_API_KEY environment variable." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { meetingId, ticketType, hubspotLink } = body;

    if (!meetingId) {
      return NextResponse.json(
        { error: "Meeting ID is required" },
        { status: 400 }
      );
    }

    if (!ticketType || !["feature_requests", "bugs", "all"].includes(ticketType)) {
      return NextResponse.json(
        { error: "Ticket type must be 'feature_requests', 'bugs', or 'all'" },
        { status: 400 }
      );
    }

    const meeting = await meetings.getMeetingById(accountId, meetingId);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const meetingExtracts = await extracts.getExtractsWithTagsByMeetingId(accountId, meetingId);
    if (meetingExtracts.length === 0) {
      return NextResponse.json({ error: "No extracts found for this meeting" }, { status: 400 });
    }

    let customer = null;
    if (meeting.customer_id) {
      customer = await customers.getCustomerById(accountId, meeting.customer_id);
    }

    // Generate CRM notes to extract feature requests and bugs
    const crmNotes = await generateCRMNotes(meeting, meetingExtracts, customer);

    const results = {
      featureRequests: [] as Array<{ success: boolean; ticket?: { identifier: string; title: string; url: string }; error?: string }>,
      bugs: [] as Array<{ success: boolean; ticket?: { identifier: string; title: string; url: string }; error?: string }>,
    };

    // Create feature request tickets
    if (ticketType === "feature_requests" || ticketType === "all") {
      const featureRequests = extractFeatureRequests(crmNotes);
      if (featureRequests.length > 0) {
        const featureResults = await createFeatureRequestTickets(featureRequests, hubspotLink);
        results.featureRequests = featureResults;
      }
    }

    // Create bug report tickets
    if (ticketType === "bugs" || ticketType === "all") {
      const bugs = extractBugReports(crmNotes);
      if (bugs.length > 0) {
        const bugResults = await createBugReportTickets(bugs, hubspotLink);
        results.bugs = bugResults;
      }
    }

    const totalCreated =
      results.featureRequests.filter((r) => r.success).length +
      results.bugs.filter((r) => r.success).length;

    const totalFailed =
      results.featureRequests.filter((r) => !r.success).length +
      results.bugs.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Created ${totalCreated} ticket(s), ${totalFailed} failed`,
      results,
    });
  } catch (error) {
    console.error("Error creating Linear tickets:", error);
    return NextResponse.json(
      { error: "Failed to create Linear tickets" },
      { status: 500 }
    );
  }
}
