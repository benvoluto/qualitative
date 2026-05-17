import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processMeetingExtracts } from "@/lib/extraction";
import { extracts, meetings, customers, users } from "@/lib/db";
import { generateMeetingNotesSummary } from "@/lib/gemini";
import { generateEmailDraft } from "@/lib/workflows/email-workflow";

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

    const { id } = await params;

    // Get user for custom prompts
    const user = await users.getUserByEmail(session.user.email);
    const userId = user?.id;

    // Check if reprocess flag is set
    let reprocess = false;
    try {
      const body = await request.json();
      reprocess = body.reprocess === true;
    } catch {
      // No body or invalid JSON, continue with default
    }

    // If reprocessing, delete existing extracts first
    let deletedCount = 0;
    if (reprocess) {
      const existingExtracts = await extracts.getExtractsByMeetingId(id);
      for (const extract of existingExtracts) {
        await extracts.removeAllExtractTags(extract.id);
        await extracts.deleteExtract(extract.id);
        deletedCount++;
      }
      console.log(`Deleted ${deletedCount} existing extracts for meeting ${id}`);
    }

    // Process the meeting to extract insights
    const result = await processMeetingExtracts(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Auto-generate notes and email draft after successful extraction
    let notesGenerated = false;
    let emailGenerated = false;
    const autoGenErrors: string[] = [];

    // Get fresh extracts and meeting data for generation
    const meetingExtracts = await extracts.getExtractsByMeetingId(id);
    const meeting = await meetings.getMeetingById(id);

    if (meeting && meetingExtracts.length > 0) {
      // Auto-generate meeting notes
      try {
        const customer = meeting.customer_id
          ? await customers.getCustomerById(meeting.customer_id)
          : null;
        const meetingParticipants = await meetings.getMeetingParticipantsWithDetails(id);
        let customNotesPrompt: string | null = null;
        if (userId) {
          const templates = await users.getUserPromptTemplates(userId);
          customNotesPrompt = templates.notes_prompt_template;
        }
        const notesSummary = await generateMeetingNotesSummary(
          meeting,
          meetingExtracts,
          customer,
          meeting.host_name || undefined,
          meetingParticipants.map((p) => ({ name: p.name, email: p.email })),
          customNotesPrompt
        );
        let updatedNotes = notesSummary;
        if (meeting.user_notes && meeting.user_notes.trim()) {
          updatedNotes = `${meeting.user_notes}\n\n---\n\n## AI-Generated Summary (${new Date().toLocaleDateString()})\n\n${notesSummary}`;
        }
        await meetings.updateMeeting(id, { user_notes: updatedNotes });
        notesGenerated = true;
        console.log(`Auto-generated notes for meeting ${id}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        autoGenErrors.push(`Notes: ${errMsg}`);
        console.error(`Failed to auto-generate notes for meeting ${id}:`, err);
      }

      // Auto-generate email draft
      try {
        await generateEmailDraft(id, "follow_up", userId);
        emailGenerated = true;
        console.log(`Auto-generated email draft for meeting ${id}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        autoGenErrors.push(`Email: ${errMsg}`);
        console.error(`Failed to auto-generate email for meeting ${id}:`, err);
      }
    }

    const message = reprocess
      ? `Reprocessed: deleted ${deletedCount} old extracts, created ${result.extractsCreated} new extracts (${result.actionItems} action items)`
      : `Created ${result.extractsCreated} extracts (${result.actionItems} action items)`;

    return NextResponse.json({
      success: true,
      extractsCreated: result.extractsCreated,
      actionItems: result.actionItems,
      deletedCount: reprocess ? deletedCount : 0,
      notesGenerated,
      emailGenerated,
      autoGenErrors: autoGenErrors.length > 0 ? autoGenErrors : undefined,
      message,
    });
  } catch (error) {
    console.error("Extraction error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to extract insights", details: message },
      { status: 500 }
    );
  }
}
