import { meetings, extracts, customers, emailDrafts, personnel, users } from "@/lib/db";
import {
  generateFollowUpEmail,
  generateActionItemsEmail,
  generateMeetingNotesEmail,
  CustomEmailPrompts,
} from "@/lib/gemini/email-generation";
import { EmailDraft, EmailDraftType, ParticipationStatus } from "@/lib/db/types";
import { getParticipantsFromHubSpotFallback } from "@/lib/hubspot/meetings";

export interface EmailWorkflowResult {
  success: boolean;
  drafts: EmailDraft[];
  errors: string[];
}

/**
 * Run the email workflow for a meeting
 * Generates email drafts based on the meeting extracts
 * @param meetingId - The meeting to generate drafts for
 * @param draftTypes - Types of drafts to generate
 * @param userId - Optional user ID to fetch custom prompt templates
 * @param additionalInstructions - Optional additional instructions for generation
 */
export async function runEmailWorkflow(
  accountId: string,
  meetingId: string,
  draftTypes: EmailDraftType[] = ["follow_up"],
  userId?: string,
  additionalInstructions?: string | null
): Promise<EmailWorkflowResult> {
  const result: EmailWorkflowResult = {
    success: true,
    drafts: [],
    errors: [],
  };

  try {
    let customPrompts: CustomEmailPrompts | undefined;
    if (userId) {
      const templates = await users.getUserPromptTemplates(userId);
      customPrompts = {
        dealEmailPrompt: templates.deal_email_prompt_template,
        customerEmailPrompt: templates.customer_email_prompt_template,
      };
    }

    const meeting = await meetings.getMeetingById(accountId, meetingId);
    if (!meeting) {
      result.success = false;
      result.errors.push(`Meeting not found: ${meetingId}`);
      return result;
    }

    const meetingExtracts = await extracts.getExtractsByMeetingId(accountId, meetingId);

    let customer = null;
    if (meeting.customer_id) {
      customer = await customers.getCustomerById(accountId, meeting.customer_id);
    }

    const hostEmail = meeting.host_email?.toLowerCase();

    const participants = new Map<string, { name: string; email: string; status: ParticipationStatus }>();

    const meetingParticipants = await meetings.getMeetingParticipantsWithDetails(accountId, meetingId);
    for (const participant of meetingParticipants) {
      if (participant.email) {
        const email = participant.email.toLowerCase();
        if (hostEmail && email === hostEmail) continue;
        if (!participants.has(email)) {
          participants.set(email, {
            name: participant.name,
            email: participant.email,
            status: participant.participation_status,
          });
        }
      }
    }

    for (const extract of meetingExtracts) {
      if (extract.participant_email) {
        const email = extract.participant_email.toLowerCase();
        if (hostEmail && email === hostEmail) continue;
        if (!participants.has(email)) {
          participants.set(email, {
            name: extract.participant_name || "Unknown",
            email: extract.participant_email,
            status: "participated",
          });
        }
      }
    }

    if (participants.size === 0) {
      try {
        const hubspotEmails = await getParticipantsFromHubSpotFallback(accountId, meetingId);
        for (const email of hubspotEmails) {
          const emailLower = email.toLowerCase();
          if (hostEmail && emailLower === hostEmail) continue;
          if (!participants.has(emailLower)) {
            const personnelRecord = await personnel.getPersonnelByEmail(accountId, email);
            participants.set(emailLower, {
              name: personnelRecord?.name || email.split("@")[0],
              email: email,
              status: "n/a",
            });
          }
        }
      } catch (error) {
        console.error("HubSpot fallback for participants failed:", error);
      }
    }

    // Get all recipients (combine emails and names)
    let recipientEmail: string | null = null;
    let recipientName: string | null = null;
    const participantsList = Array.from(participants.values());
    if (participantsList.length > 0) {
      recipientEmail = participantsList.map((p) => p.email).join(", ");
      recipientName = participantsList.map((p) => p.name).join(", ");
    }

    // Convert participants to MeetingParticipantInfo format for generation functions
    const meetingParticipantInfoList = participantsList.map((p) => ({
      name: p.name,
      email: p.email,
      participation_status: p.status,
    }));

    // Generate requested draft types
    for (const draftType of draftTypes) {
      try {
        let generatedEmail;

        switch (draftType) {
          case "follow_up":
            generatedEmail = await generateFollowUpEmail(
              meeting,
              meetingExtracts,
              customer,
              meeting.host_name || undefined,
              meetingParticipantInfoList,
              customPrompts,
              additionalInstructions
            );
            break;
          case "action_items":
            generatedEmail = await generateActionItemsEmail(
              meeting,
              meetingExtracts,
              customer,
              meetingParticipantInfoList
            );
            break;
          case "meeting_notes":
            generatedEmail = await generateMeetingNotesEmail(
              meeting,
              meetingExtracts,
              customer,
              meetingParticipantInfoList
            );
            break;
          default:
            result.errors.push(`Unknown draft type: ${draftType}`);
            continue;
        }

        const draft = await emailDrafts.createEmailDraft(accountId, {
          meeting_id: meetingId,
          draft_type: draftType,
          subject: generatedEmail.subject,
          body: generatedEmail.body,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          status: "draft",
        });

        result.drafts.push(draft);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to generate ${draftType}: ${errorMessage}`);
      }
    }

    if (result.drafts.length === 0 && result.errors.length > 0) {
      result.success = false;
    }
  } catch (error) {
    result.success = false;
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    result.errors.push(`Workflow error: ${errorMessage}`);
  }

  return result;
}

/**
 * Generate a specific type of email draft for a meeting
 */
export async function generateEmailDraft(
  accountId: string,
  meetingId: string,
  draftType: EmailDraftType,
  userId?: string,
  additionalInstructions?: string | null
): Promise<EmailDraft> {
  const result = await runEmailWorkflow(accountId, meetingId, [draftType], userId, additionalInstructions);
  if (!result.success || result.drafts.length === 0) {
    throw new Error(result.errors.join(", ") || "Failed to generate email draft");
  }
  return result.drafts[0];
}

export async function regenerateEmailDraft(
  accountId: string,
  draftId: string,
  userId?: string,
  additionalInstructions?: string | null
): Promise<EmailDraft> {
  const existingDraft = await emailDrafts.getEmailDraftById(accountId, draftId);
  if (!existingDraft) {
    throw new Error(`Draft not found: ${draftId}`);
  }
  const result = await runEmailWorkflow(
    accountId,
    existingDraft.meeting_id,
    [existingDraft.draft_type],
    userId,
    additionalInstructions
  );
  if (!result.success || result.drafts.length === 0) {
    throw new Error(result.errors.join(", ") || "Failed to regenerate email draft");
  }
  await emailDrafts.deleteEmailDraft(accountId, draftId);
  return result.drafts[0];
}
