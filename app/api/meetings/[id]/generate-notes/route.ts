import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { meetings, extracts, customers, users } from "@/lib/db";
import { generateMeetingNotesSummary } from "@/lib/gemini";
import { sendNotesReadyNotification } from "@/lib/email";

// Extend timeout for Gemini processing (requires Vercel Pro)
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: meetingId } = await params;

    // Parse request body for additional instructions
    let additionalInstructions: string | null = null;
    try {
      const body = await request.json();
      additionalInstructions = body.additionalInstructions || null;
    } catch {
      // No body provided, that's fine
    }

    // Get user for custom prompt templates
    const user = await users.getUserByEmail(session.user.email);
    let customNotesPrompt: string | null = null;
    if (user) {
      const templates = await users.getUserPromptTemplates(user.id);
      customNotesPrompt = templates.notes_prompt_template;
    }

    // Fetch meeting
    const meeting = await meetings.getMeetingById(meetingId);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Fetch extracts for this meeting
    const meetingExtracts = await extracts.getExtractsByMeetingId(meetingId);

    if (meetingExtracts.length === 0) {
      return NextResponse.json(
        { error: "No extracts found. Extract insights first before generating notes." },
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

    // Generate the notes summary with custom prompt if available
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

    // Update the meeting's user_notes field
    // If existing notes, append the generated notes with a separator
    let updatedNotes = notesSummary;
    if (meeting.user_notes && meeting.user_notes.trim()) {
      updatedNotes = `${meeting.user_notes}\n\n---\n\n## AI-Generated Summary (${new Date().toLocaleDateString()})\n\n${notesSummary}`;
    }

    await meetings.updateMeeting(meetingId, {
      user_notes: updatedNotes,
    });

    // Send notification if user has enabled it
    if (user) {
      const notificationPrefs = await users.getUserNotificationPrefs(user.id);
      if (notificationPrefs.notify_on_notes_created) {
        const notificationEmail = notificationPrefs.notification_email || session.user.email;
        // Send notification in background (don't await)
        sendNotesReadyNotification(notificationEmail, meeting, customer, notesSummary).catch(
          (err) => console.error("Failed to send notes notification:", err)
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        notes: notesSummary,
        message: "Notes generated and added to meeting"
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error generating meeting notes:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate notes: ${message}` },
      { status: 500 }
    );
  }
}
