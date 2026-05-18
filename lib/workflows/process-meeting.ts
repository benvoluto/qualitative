/**
 * Durable meeting-processing workflow.
 *
 * Replaces the two synchronous "Process" + "Extract" button flows with a single
 * background workflow. The HTTP endpoint that triggers this returns a runId
 * immediately and the work continues even if the user closes the tab. Each step
 * is automatically retried on transient failure.
 *
 * Step 1 — transcribeStep: fetch transcript from Google/Zoom/Teams/Gemini.
 * Step 2 — extractStep:   pull structured insights, then auto-generate notes
 *                          and a follow-up email draft.
 */

import { FatalError } from "workflow";
import { meetings, users, extracts, customers } from "@/lib/db";
import { processMeetingTranscript } from "@/lib/google";
import { transcribeMeetingRecording } from "@/lib/gemini";
import { processZoomMeetingTranscript } from "@/lib/zoom";
import { processTeamsMeetingTranscript } from "@/lib/teams";
import { processMeetingExtracts } from "@/lib/extraction";
import { generateMeetingNotesSummary } from "@/lib/gemini";
import { generateEmailDraft } from "@/lib/workflows/email-workflow";
import { trackEvent } from "@/lib/analytics";

export interface ProcessMeetingResult {
  transcriptSource: string | null;
  extractsCreated: number;
  actionItems: number;
  notesGenerated: boolean;
  emailGenerated: boolean;
  skipped?: string;
}

async function transcribeStep(
  accountId: string,
  userId: string,
  meetingId: string
): Promise<{ source: string | null; skipped?: string }> {
  "use step";

  const meeting = await meetings.acquireProcessingLock(accountId, meetingId);
  if (!meeting) {
    const existing = await meetings.getMeetingById(accountId, meetingId);
    if (!existing) throw new FatalError(`Meeting ${meetingId} not found`);
    if (existing.transcript) return { source: existing.transcript_source ?? "existing", skipped: "already_transcribed" };
    throw new FatalError("Meeting is already being processed");
  }

  const user = await users.getUserById(userId);
  if (!user) throw new FatalError(`User ${userId} not found`);

  try {
    // Source-specific routing matches the existing /process endpoint.
    if (meeting.source === "zoom") {
      const result = await processZoomMeetingTranscript(accountId, meetingId);
      if (result.transcript) {
        await meetings.releaseProcessingLock(accountId, meetingId, "transcribed");
        await trackEvent("meeting_processed", { source: "zoom", transcript_source: result.source });
        return { source: result.source };
      }
      await meetings.releaseProcessingLock(accountId, meetingId, "failed");
      throw new FatalError("No transcript available from Zoom");
    }

    if (meeting.source === "teams") {
      if (!user.ms_access_token) {
        await meetings.releaseProcessingLock(accountId, meetingId, "pending");
        throw new FatalError("Microsoft account not connected");
      }
      const result = await processTeamsMeetingTranscript(accountId, user.id, meetingId);
      if (result.transcript) {
        await meetings.releaseProcessingLock(accountId, meetingId, "transcribed");
        await trackEvent("meeting_processed", { source: "teams", transcript_source: result.source });
        return { source: result.source };
      }
      await meetings.releaseProcessingLock(accountId, meetingId, "failed");
      throw new FatalError("No transcript available from Teams");
    }

    if (!user.google_access_token) {
      await meetings.releaseProcessingLock(accountId, meetingId, "pending");
      throw new FatalError("Google account not connected");
    }

    // Google Meet path. Drive transcript → fallback to Gemini on recording.
    if (meeting.recording_url?.startsWith("drive:") && !meeting.transcript) {
      const geminiResult = await transcribeMeetingRecording(accountId, user.id, meetingId);
      if (!geminiResult.success) {
        await meetings.releaseProcessingLock(accountId, meetingId, "failed");
        throw new Error(geminiResult.error ?? "Gemini transcription failed");
      }
      await meetings.releaseProcessingLock(accountId, meetingId, "transcribed");
      await trackEvent("meeting_processed", { source: "google_meet", transcript_source: "gemini" });
      return { source: "gemini" };
    }

    const result = await processMeetingTranscript(accountId, user.id, meetingId);
    if (!result.success) {
      await meetings.releaseProcessingLock(accountId, meetingId, "failed");
      throw new Error(result.error ?? "Transcript retrieval failed");
    }

    if (result.source === "pending_gemini") {
      const geminiResult = await transcribeMeetingRecording(accountId, user.id, meetingId);
      if (!geminiResult.success) {
        await meetings.releaseProcessingLock(accountId, meetingId, "failed");
        throw new Error(geminiResult.error ?? "Gemini transcription failed");
      }
      await meetings.releaseProcessingLock(accountId, meetingId, "transcribed");
      await trackEvent("meeting_processed", { source: "google_meet", transcript_source: "gemini" });
      return { source: "gemini" };
    }

    await meetings.releaseProcessingLock(accountId, meetingId, "transcribed");
    await trackEvent("meeting_processed", { source: "google_meet", transcript_source: result.source ?? null });
    return { source: result.source ?? null };
  } catch (err) {
    // Make sure the lock is released even if something unexpected happens.
    await meetings.releaseProcessingLock(accountId, meetingId, "failed").catch(() => {});
    throw err;
  }
}

async function extractStep(
  accountId: string,
  userId: string,
  meetingId: string
): Promise<{ extractsCreated: number; actionItems: number; notesGenerated: boolean; emailGenerated: boolean }> {
  "use step";

  // Idempotency: skip if extracts already exist. Re-running on a finished meeting
  // would otherwise double-up. Use the dedicated /extract endpoint with
  // reprocess=true to deliberately re-extract.
  const existing = await extracts.getExtractsByMeetingId(accountId, meetingId);
  if (existing.length > 0) {
    return {
      extractsCreated: 0,
      actionItems: existing.filter((e) => e.is_action_item).length,
      notesGenerated: false,
      emailGenerated: false,
    };
  }

  const result = await processMeetingExtracts(accountId, meetingId);
  if (!result.success) {
    throw new Error(result.error ?? "Extraction failed");
  }
  await trackEvent("meeting_extracted", {
    extracts_created: result.extractsCreated,
    action_items: result.actionItems,
    reprocess: false,
  });

  let notesGenerated = false;
  let emailGenerated = false;

  const meetingExtracts = await extracts.getExtractsByMeetingId(accountId, meetingId);
  const meeting = await meetings.getMeetingById(accountId, meetingId);
  if (!meeting || meetingExtracts.length === 0) {
    return { extractsCreated: result.extractsCreated, actionItems: result.actionItems, notesGenerated, emailGenerated };
  }

  try {
    const customer = meeting.customer_id
      ? await customers.getCustomerById(accountId, meeting.customer_id)
      : null;
    const meetingParticipants = await meetings.getMeetingParticipantsWithDetails(accountId, meetingId);
    const templates = await users.getUserPromptTemplates(userId);
    const notesSummary = await generateMeetingNotesSummary(
      meeting,
      meetingExtracts,
      customer,
      meeting.host_name || undefined,
      meetingParticipants.map((p) => ({ name: p.name, email: p.email })),
      templates.notes_prompt_template
    );
    const updatedNotes = meeting.user_notes?.trim()
      ? `${meeting.user_notes}\n\n---\n\n## AI-Generated Summary (${new Date().toLocaleDateString()})\n\n${notesSummary}`
      : notesSummary;
    await meetings.updateMeeting(accountId, meetingId, { user_notes: updatedNotes });
    notesGenerated = true;
  } catch (err) {
    console.error(`[workflow] notes generation failed for ${meetingId}:`, err);
  }

  try {
    await generateEmailDraft(accountId, meetingId, "follow_up", userId);
    emailGenerated = true;
  } catch (err) {
    console.error(`[workflow] email generation failed for ${meetingId}:`, err);
  }

  return { extractsCreated: result.extractsCreated, actionItems: result.actionItems, notesGenerated, emailGenerated };
}

export async function processMeetingWorkflow(
  accountId: string,
  userId: string,
  meetingId: string
): Promise<ProcessMeetingResult> {
  "use workflow";

  const transcribe = await transcribeStep(accountId, userId, meetingId);
  if (transcribe.skipped === "already_transcribed") {
    // The meeting already had a transcript — still run extract if no extracts exist yet.
  }

  const extract = await extractStep(accountId, userId, meetingId);

  return {
    transcriptSource: transcribe.source,
    extractsCreated: extract.extractsCreated,
    actionItems: extract.actionItems,
    notesGenerated: extract.notesGenerated,
    emailGenerated: extract.emailGenerated,
    skipped: transcribe.skipped,
  };
}
