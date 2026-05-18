import { NextRequest, NextResponse } from "next/server";
import { requireAccountContext } from "@/lib/account-context";
import { meetings, personnel } from "@/lib/db";
import { processMeetingExtracts } from "@/lib/extraction";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const { accountId } = await requireAccountContext();

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const days = searchParams.get("days");
    const customerId = searchParams.get("customerId");

    let meetingList;

    if (status) {
      meetingList = await meetings.getMeetingsByStatus(
        accountId,
        status as "pending" | "processing" | "transcribed" | "completed" | "failed"
      );
    } else if (days) {
      meetingList = await meetings.getRecentMeetings(accountId, parseInt(days, 10));
    } else if (customerId) {
      meetingList = await meetings.getMeetingsByCustomerId(accountId, customerId);
    } else {
      meetingList = await meetings.getMeetings(accountId);
    }

    return NextResponse.json({ meetings: meetingList });
  } catch (error) {
    console.error("Error fetching meetings:", error);
    return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await requireAccountContext();

    const body = await request.json();
    const {
      name,
      meeting_date,
      transcript,
      host_name,
      host_email,
      customer_id,
      participants,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Meeting name is required" }, { status: 400 });
    }

    const meeting = await meetings.createMeeting(accountId, {
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

    if (participants && Array.isArray(participants)) {
      for (const participant of participants) {
        if (!participant.name && !participant.email) continue;

        try {
          let personnelRecord = participant.email
            ? await personnel.getPersonnelByEmail(accountId, participant.email)
            : null;

          if (!personnelRecord) {
            personnelRecord = await personnel.createPersonnel(accountId, {
              name: participant.name || participant.email?.split("@")[0] || "Unknown",
              email: participant.email || null,
            });
          }

          await meetings.addMeetingParticipant(accountId, meeting.id, personnelRecord.id);
        } catch (error) {
          console.error(`Failed to add participant:`, error);
        }
      }
    }

    let extractionResult = null;
    if (transcript?.trim()) {
      try {
        extractionResult = await processMeetingExtracts(accountId, meeting.id);
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
    return NextResponse.json({ error: "Failed to create meeting", details: message }, { status: 500 });
  }
}
