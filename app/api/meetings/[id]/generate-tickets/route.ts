import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { meetings, extracts, customers } from "@/lib/db";
import { generateTicketText, formatTicketsAsText } from "@/lib/gemini";

// Extend timeout for Gemini processing (requires Vercel Pro)
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = await requireAccountId();
    const { id: meetingId } = await params;

    const meeting = await meetings.getMeetingById(accountId, meetingId);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const meetingExtracts = await extracts.getExtractsWithTagsByMeetingId(accountId, meetingId);

    if (meetingExtracts.length === 0) {
      return NextResponse.json(
        { error: "No extracts found. Extract insights first before generating tickets." },
        { status: 400 }
      );
    }

    let customer = null;
    if (meeting.customer_id) {
      customer = await customers.getCustomerById(accountId, meeting.customer_id);
    }

    const meetingParticipants = await meetings.getMeetingParticipantsWithDetails(accountId, meetingId);

    // Generate ticket text using Gemini with participant info
    const tickets = await generateTicketText(
      meeting,
      meetingExtracts,
      customer,
      meetingParticipants.map((p) => ({ name: p.name, email: p.email }))
    );

    // Format as readable text
    const formattedText = formatTicketsAsText(tickets);

    return NextResponse.json({
      success: true,
      tickets,
      formattedText,
      counts: {
        featureRequests: tickets.featureRequests.length,
        bugs: tickets.bugs.length,
      },
    });
  } catch (error) {
    console.error("Error generating tickets:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate tickets: ${message}` },
      { status: 500 }
    );
  }
}
