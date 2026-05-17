import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { meetings, personnel } from "@/lib/db";
import { processMeetingExtracts } from "@/lib/extraction";

// Extend timeout for Gemini processing when transcript is provided
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const days = searchParams.get("days");
    const customerId = searchParams.get("customerId");

    let meetingList;

    if (status) {
      meetingList = await meetings.getMeetingsByStatus(
        status as "pending" | "processing" | "transcribed" | "completed" | "failed"
      );
    } else if (days) {
      meetingList = await meetings.getRecentMeetings(parseInt(days, 10));
    } else if (customerId) {
      meetingList = await meetings.getMeetingsByCustomerId(customerId);
    } else {
      meetingList = await meetings.getMeetings();
    }

    return NextResponse.json({ meetings: meetingList });
  } catch (error) {
    console.error("Error fetching meetings:", error);
    return NextResponse.json(
      { error: "Failed to fetch meetings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      meeting_date,
      transcript,
      host_name,
      host_email,
      customer_id,
      participants, // Array of { name: string, email?: string }
    } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Meeting name is required" },
        { status: 400 }
      );
    }

    // Create the meeting
    const meeting = await meetings.createMeeting({
      name: name.trim(),
      meeting_date: meeting_date ? new Date(meeting_date) : null,
      transcript: transcript?.trim() || null,
      host_name: host_name?.trim() || null,
      host_email: host_email?.trim() || null,
      customer_id: customer_id || null,
      source: "manual",
      workflow_status: transcript?.trim() ? "transcribed" : "pending",
      transcript_source: transcript?.trim() ? "manual" : null,
    });

    // Add participants if provided
    if (participants && Array.isArray(participants)) {
      for (const participant of participants) {
        if (!participant.name && !participant.email) continue;

        try {
          // Find or create personnel record
          let personnelRecord = participant.email
            ? await personnel.getPersonnelByEmail(participant.email)
            : null;

          if (!personnelRecord) {
            personnelRecord = await personnel.createPersonnel({
              name: participant.name || participant.email?.split("@")[0] || "Unknown",
              email: participant.email || null,
            });
          }

          // Add as meeting participant
          await meetings.addMeetingParticipant(meeting.id, personnelRecord.id);
        } catch (error) {
          console.error(`Failed to add participant:`, error);
        }
      }
    }

    // Automatically extract insights if transcript is provided
    let extractionResult = null;
    if (transcript?.trim()) {
      try {
        console.log(`Auto-extracting insights for manual meeting ${meeting.id}`);
        extractionResult = await processMeetingExtracts(meeting.id);
        if (extractionResult.success) {
          console.log(`Extracted ${extractionResult.extractsCreated} insights from meeting ${meeting.id}`);
        } else {
          console.error(`Extraction failed for meeting ${meeting.id}:`, extractionResult.error);
        }
      } catch (error) {
        console.error(`Failed to auto-extract insights for meeting ${meeting.id}:`, error);
      }
    }

    return NextResponse.json({
      meeting,
      extraction: extractionResult ? {
        success: extractionResult.success,
        extractsCreated: extractionResult.extractsCreated,
        actionItems: extractionResult.actionItems,
      } : null,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating meeting:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create meeting", details: message },
      { status: 500 }
    );
  }
}
