import { NextRequest, NextResponse } from "next/server";
import { requireAccountContext } from "@/lib/account-context";
import { processMeetingExtracts } from "@/lib/extraction";
import { extracts, meetings, customers, users } from "@/lib/db";
import { generateMeetingNotesSummary } from "@/lib/gemini";
import { generateEmailDraft } from "@/lib/workflows/email-workflow";
import { trackEvent } from "@/lib/analytics";
import { assertWithinUsage, UsageLimitError } from "@/lib/billing/usage";

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { accountId, userId } = await requireAccountContext();
    const { id } = await params;

    await assertWithinUsage(accountId);

    let reprocess = false;
    try {
      const body = await request.json();
      reprocess = body.reprocess === true;
    } catch {
      // No body or invalid JSON
    }

    let deletedCount = 0;
    if (reprocess) {
      const existingExtracts = await extracts.getExtractsByMeetingId(accountId, id);
      for (const extract of existingExtracts) {
        await extracts.removeAllExtractTags(accountId, extract.id);
        await extracts.deleteExtract(accountId, extract.id);
        deletedCount++;
      }
    }

    const result = await processMeetingExtracts(accountId, id);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    await trackEvent("meeting_extracted", {
      extracts_created: result.extractsCreated,
      action_items: result.actionItems,
      reprocess,
    });

    let notesGenerated = false;
    let emailGenerated = false;
    const autoGenErrors: string[] = [];

    const meetingExtracts = await extracts.getExtractsByMeetingId(accountId, id);
    const meeting = await meetings.getMeetingById(accountId, id);

    if (meeting && meetingExtracts.length > 0) {
      try {
        const customer = meeting.customer_id
          ? await customers.getCustomerById(accountId, meeting.customer_id)
          : null;
        const meetingParticipants = await meetings.getMeetingParticipantsWithDetails(accountId, id);
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
        await meetings.updateMeeting(accountId, id, { user_notes: updatedNotes });
        notesGenerated = true;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        autoGenErrors.push(`Notes: ${errMsg}`);
      }

      try {
        await generateEmailDraft(accountId, id, "follow_up", userId);
        emailGenerated = true;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        autoGenErrors.push(`Email: ${errMsg}`);
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
    if (error instanceof UsageLimitError) {
      return NextResponse.json({ error: error.message, code: "usage_limit" }, { status: 402 });
    }
    console.error("Extraction error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to extract insights", details: message }, { status: 500 });
  }
}
