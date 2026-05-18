import { NextRequest, NextResponse } from "next/server";
import { requireAccountContext } from "@/lib/account-context";
import { meetings, extracts, customers, users } from "@/lib/db";
import { generateMeetingNotesSummary } from "@/lib/gemini";
import { sendNotesReadyNotification } from "@/lib/email";

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { accountId, userId, email } = await requireAccountContext();
    const { id: meetingId } = await params;

    let additionalInstructions: string | null = null;
    try {
      const body = await request.json();
      additionalInstructions = body.additionalInstructions || null;
    } catch {
      // No body
    }

    const user = await users.getUserById(userId);
    let customNotesPrompt: string | null = null;
    if (user) {
      const templates = await users.getUserPromptTemplates(user.id);
      customNotesPrompt = templates.notes_prompt_template;
    }

    const meeting = await meetings.getMeetingById(accountId, meetingId);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const meetingExtracts = await extracts.getExtractsByMeetingId(accountId, meetingId);

    if (meetingExtracts.length === 0) {
      return NextResponse.json(
        { error: "No extracts found. Extract insights first before generating notes." },
        { status: 400 }
      );
    }

    let customer = null;
    if (meeting.customer_id) {
      customer = await customers.getCustomerById(accountId, meeting.customer_id);
    }

    const meetingParticipants = await meetings.getMeetingParticipantsWithDetails(accountId, meetingId);

    const notesSummary = await generateMeetingNotesSummary(
      meeting,
      meetingExtracts,
      customer,
      meeting.host_name || undefined,
      meetingParticipants.map((p) => ({
        name: p.name,
        email: p.email,
        participation_status: p.participation_status,
      })),
      customNotesPrompt,
      additionalInstructions
    );

    let updatedNotes = notesSummary;
    if (meeting.user_notes && meeting.user_notes.trim()) {
      updatedNotes = `${meeting.user_notes}\n\n---\n\n## AI-Generated Summary (${new Date().toLocaleDateString()})\n\n${notesSummary}`;
    }

    await meetings.updateMeeting(accountId, meetingId, {
      user_notes: updatedNotes,
    });

    if (user) {
      const notificationPrefs = await users.getUserNotificationPrefs(user.id);
      if (notificationPrefs.notify_on_notes_created) {
        const notificationEmail = notificationPrefs.notification_email || email;
        sendNotesReadyNotification(notificationEmail, meeting, customer, notesSummary).catch(
          (err) => console.error("Failed to send notes notification:", err)
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        notes: notesSummary,
        message: "Notes generated and added to meeting",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error generating meeting notes:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to generate notes: ${message}` }, { status: 500 });
  }
}
