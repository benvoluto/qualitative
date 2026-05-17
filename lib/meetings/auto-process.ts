/**
 * Auto-process and extract for newly synced meetings
 * This runs in the background after a meeting is synced
 */

import { meetings, extracts, customers, users, emailDrafts } from "@/lib/db";
import { processMeetingExtracts } from "@/lib/extraction";
import { generateMeetingNotesSummary } from "@/lib/gemini";
import { generateEmailDraft } from "@/lib/workflows/email-workflow";
import { sendNotesReadyNotification, sendDraftReadyNotification } from "@/lib/email";

export interface AutoProcessResult {
  meetingId: string;
  processed: boolean;
  extracted: boolean;
  notesGenerated: boolean;
  emailGenerated: boolean;
  error?: string;
  skippedReason?: string;
}

/**
 * Automatically process and extract insights from a meeting after sync
 * This is called after a meeting is successfully synced with a transcript
 */
export async function autoProcessAndExtract(
  meetingId: string,
  userId?: string
): Promise<AutoProcessResult> {
  const result: AutoProcessResult = {
    meetingId,
    processed: false,
    extracted: false,
    notesGenerated: false,
    emailGenerated: false,
  };

  try {
    const meeting = await meetings.getMeetingById(meetingId);
    if (!meeting) {
      result.error = "Meeting not found";
      return result;
    }

    // Skip if meeting already has extracts
    const existingExtracts = await extracts.getExtractsByMeetingId(meetingId);
    if (existingExtracts.length > 0) {
      console.log(`[AutoProcess] Meeting ${meetingId} already has extracts, skipping`);
      result.extracted = true;
      result.skippedReason = "already_has_extracts";
      return result;
    }

    // Check if meeting has transcript
    if (!meeting.transcript) {
      console.log(`[AutoProcess] Meeting ${meetingId} has no transcript, skipping auto-extract`);
      result.skippedReason = "no_transcript";
      return result;
    }

    result.processed = true;
    console.log(`[AutoProcess] Starting extraction for meeting ${meetingId}`);

    // Extract insights
    const extractResult = await processMeetingExtracts(meetingId);
    if (!extractResult.success) {
      result.error = extractResult.error || "Extraction failed";
      console.error(`[AutoProcess] Extraction failed for meeting ${meetingId}: ${result.error}`);
      return result;
    }

    result.extracted = true;
    console.log(`[AutoProcess] Extracted ${extractResult.extractsCreated} insights from meeting ${meetingId}`);

    // Get fresh data for notes and email generation
    const meetingExtracts = await extracts.getExtractsByMeetingId(meetingId);
    const freshMeeting = await meetings.getMeetingById(meetingId);

    if (!freshMeeting || meetingExtracts.length === 0) {
      return result;
    }

    // Get customer and user for notes/email generation and notifications
    const customer = freshMeeting.customer_id
      ? await customers.getCustomerById(freshMeeting.customer_id)
      : null;
    let notificationPrefs: { notification_email: string | null; notify_on_notes_created: boolean; notify_on_draft_created: boolean } | null = null;
    let userEmail: string | null = null;
    console.log(`[AutoProcess] userId passed: ${userId || "none"}`);
    if (userId) {
      const user = await users.getUserById(userId);
      if (user) {
        notificationPrefs = await users.getUserNotificationPrefs(userId);
        userEmail = user.email;
        console.log(`[AutoProcess] User email: ${userEmail}`);
        console.log(`[AutoProcess] Notification prefs:`, notificationPrefs);
      } else {
        console.log(`[AutoProcess] User not found for userId: ${userId}`);
      }
    }

    // Auto-generate notes
    let notesSummary: string | null = null;
    try {
      const meetingParticipants = await meetings.getMeetingParticipantsWithDetails(meetingId);
      let customNotesPrompt: string | null = null;
      if (userId) {
        const templates = await users.getUserPromptTemplates(userId);
        customNotesPrompt = templates.notes_prompt_template;
      }
      notesSummary = await generateMeetingNotesSummary(
        freshMeeting,
        meetingExtracts,
        customer,
        freshMeeting.host_name || undefined,
        meetingParticipants.map((p) => ({
          name: p.name,
          email: p.email,
          participation_status: p.participation_status,
        })),
        customNotesPrompt
      );
      await meetings.updateMeeting(meetingId, { user_notes: notesSummary });
      result.notesGenerated = true;
      console.log(`[AutoProcess] Generated notes for meeting ${meetingId}`);

      // Send notes notification if enabled
      console.log(`[AutoProcess] Checking notes notification: prefs=${!!notificationPrefs}, notify_on_notes_created=${notificationPrefs?.notify_on_notes_created}, notesSummary=${!!notesSummary}`);
      if (notificationPrefs?.notify_on_notes_created && notesSummary) {
        const notificationEmail = notificationPrefs.notification_email || userEmail;
        console.log(`[AutoProcess] Sending notes notification to: ${notificationEmail}`);
        if (notificationEmail) {
          sendNotesReadyNotification(notificationEmail, freshMeeting, customer, notesSummary)
            .then((result) => console.log(`[AutoProcess] Notes notification result:`, result))
            .catch((err) => console.error(`[AutoProcess] Failed to send notes notification for ${meetingId}:`, err));
        }
      } else {
        console.log(`[AutoProcess] Skipping notes notification`);
      }
    } catch (err) {
      console.error(`[AutoProcess] Failed to generate notes for meeting ${meetingId}:`, err);
    }

    // Auto-generate email draft
    try {
      await generateEmailDraft(meetingId, "follow_up", userId);
      result.emailGenerated = true;
      console.log(`[AutoProcess] Generated email draft for meeting ${meetingId}`);

      // Send draft notification if enabled
      if (notificationPrefs?.notify_on_draft_created) {
        const notificationEmail = notificationPrefs.notification_email || userEmail;
        if (notificationEmail) {
          const drafts = await emailDrafts.getEmailDraftsByMeetingId(meetingId);
          if (drafts.length > 0) {
            sendDraftReadyNotification(notificationEmail, freshMeeting, customer, drafts).catch(
              (err) => console.error(`[AutoProcess] Failed to send draft notification for ${meetingId}:`, err)
            );
          }
        }
      }
    } catch (err) {
      console.error(`[AutoProcess] Failed to generate email for meeting ${meetingId}:`, err);
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error";
    console.error(`[AutoProcess] Error processing meeting ${meetingId}:`, error);
    return result;
  }
}

/**
 * Queue multiple meetings for auto-processing
 * Processes in parallel with a concurrency limit
 */
export async function autoProcessMeetings(
  meetingIds: string[],
  userId?: string,
  concurrency: number = 2
): Promise<AutoProcessResult[]> {
  const results: AutoProcessResult[] = [];

  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < meetingIds.length; i += concurrency) {
    const batch = meetingIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((id) => autoProcessAndExtract(id, userId))
    );
    results.push(...batchResults);
  }

  return results;
}
