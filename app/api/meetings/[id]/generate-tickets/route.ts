import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { meetings, extracts, customers } from "@/lib/db";
import { generateTicketText, formatTicketsAsText } from "@/lib/gemini";

// Extend timeout for Gemini processing (requires Vercel Pro)
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: meetingId } = await params;

    // Fetch meeting
    const meeting = await meetings.getMeetingById(meetingId);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Fetch extracts with tags for this meeting
    const meetingExtracts = await extracts.getExtractsWithTagsByMeetingId(meetingId);

    if (meetingExtracts.length === 0) {
      return NextResponse.json(
        { error: "No extracts found. Extract insights first before generating tickets." },
        { status: 400 }
      );
    }

    // Fetch customer if associated
    let customer = null;
    if (meeting.customer_id) {
      customer = await customers.getCustomerById(meeting.customer_id);
    }

    // Fetch meeting participants from database
    const meetingParticipants = await meetings.getMeetingParticipantsWithDetails(meetingId);

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
