import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { meetings, extracts, customers } from "@/lib/db";
import { generateCRMNotes } from "@/lib/gemini";
import { writeMeetingNotesToHubSpot, isHubSpotConfigured } from "@/lib/hubspot";

export async function POST(request: NextRequest) {
  try {
    const accountId = await requireAccountId();
    if (!isHubSpotConfigured()) {
      return NextResponse.json(
        { error: "HubSpot is not configured. Set HUBSPOT_ACCESS_TOKEN environment variable." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { meetingId } = body;

    if (!meetingId) {
      return NextResponse.json(
        { error: "Meeting ID is required" },
        { status: 400 }
      );
    }

    const meeting = await meetings.getMeetingById(accountId, meetingId);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const meetingExtracts = await extracts.getExtractsWithTagsByMeetingId(accountId, meetingId);
    if (meetingExtracts.length === 0) {
      return NextResponse.json(
        { error: "No extracts found for this meeting. Extract insights first." },
        { status: 400 }
      );
    }

    let customer = null;
    if (meeting.customer_id) {
      customer = await customers.getCustomerById(accountId, meeting.customer_id);
    }

    // Generate CRM notes
    const crmNotes = await generateCRMNotes(meeting, meetingExtracts, customer);

    // Prepare HubSpot options
    const hubspotOptions: { companyId?: string; dealId?: string } = {};

    // Link to company or deal based on customer type
    if (customer) {
      if (customer.hubspot_company_id) {
        hubspotOptions.companyId = customer.hubspot_company_id;
      }
      if (customer.hubspot_deal_id) {
        hubspotOptions.dealId = customer.hubspot_deal_id;
      }
    }

    // Write notes to HubSpot
    const result = await writeMeetingNotesToHubSpot(
      crmNotes,
      meeting.name || "Meeting",
      meeting.meeting_date?.toLocaleDateString() || "Unknown date",
      hubspotOptions
    );

    if (!result) {
      return NextResponse.json(
        { error: "Failed to write notes to HubSpot" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      noteId: result.id,
      message: "Notes written to HubSpot successfully",
      crmNotes: {
        summary: crmNotes.summary,
        hasFeatureRequests: (crmNotes.sections.featureRequests?.length || 0) > 0,
        hasBugs: (crmNotes.sections.bugsAndIssues?.length || 0) > 0,
        actionItemCount: crmNotes.sections.actionItems?.length || 0,
      },
    });
  } catch (error) {
    console.error("Error writing notes to HubSpot:", error);
    return NextResponse.json(
      { error: "Failed to write notes to HubSpot" },
      { status: 500 }
    );
  }
}
