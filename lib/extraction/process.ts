import { extractInsightsFromTranscript, analyzeTranscriptParticipation, CompanyInfo } from "@/lib/gemini";
import { meetings, extracts, tags, customers, extractRules } from "@/lib/db";
import { Customer, ParticipationStatus } from "@/lib/db/types";

interface ProcessingResult {
  success: boolean;
  extractsCreated: number;
  actionItems: number;
  customerId?: string | null;
  error?: string;
}

// Process a meeting's transcript to extract insights
export async function processMeetingExtracts(
  meetingId: string
): Promise<ProcessingResult> {
  const meeting = await meetings.getMeetingById(meetingId);

  if (!meeting) {
    return { success: false, extractsCreated: 0, actionItems: 0, error: "Meeting not found" };
  }

  if (!meeting.transcript) {
    return { success: false, extractsCreated: 0, actionItems: 0, error: "Meeting has no transcript" };
  }

  try {
    // Fetch all customers for Gemini context (helps identify company mentions in transcript)
    const allCustomers = await customers.getCustomers();
    const companyInfoList: CompanyInfo[] = allCustomers.map((c: Customer) => ({
      name: c.name,
      id: c.id,
    }));

    // Use the meeting's existing customer_id (set during sync via email domain matching)
    // We no longer do fuzzy name matching here as it was unreliable
    const customerId = meeting.customer_id;

    // Extract insights using Gemini, passing company list
    const insights = await extractInsightsFromTranscript(meeting.transcript, companyInfoList);

    // Build a map of rule names to IDs for quick lookup
    const allRules = await extractRules.getExtractRules();
    const ruleNameToId = new Map<string, string>();
    for (const rule of allRules) {
      // Store both exact name and lowercase for matching
      ruleNameToId.set(rule.name, rule.id);
      ruleNameToId.set(rule.name.toLowerCase(), rule.id);
    }

    let extractsCreated = 0;
    let actionItems = 0;

    for (const insight of insights) {
      // Look up the rule ID by matched_rule name
      let extractRuleId: string | null = null;
      if (insight.matched_rule) {
        extractRuleId = ruleNameToId.get(insight.matched_rule) ||
                        ruleNameToId.get(insight.matched_rule.toLowerCase()) ||
                        null;
      }

      // Always use the meeting's customer_id for extracts
      // Do NOT allow Gemini to override - extracts belong to the meeting's company
      const extractCustomerId = customerId;

      // Create the extract with participant data
      const extract = await extracts.createExtract({
        meeting_id: meetingId,
        customer_id: extractCustomerId,
        extract_rule_id: extractRuleId,
        extract_date: meeting.meeting_date,
        summary: insight.summary,
        quotes: insight.quotes,
        is_action_item: insight.is_action_item,
        action_item_status: insight.is_action_item ? "pending" : null,
        participant_name: insight.participant_name,
        participant_email: insight.participant_email,
      });

      // Add tags
      for (const tagName of insight.tags) {
        const tag = await tags.getOrCreateTag(tagName, "extracted");
        await extracts.addExtractTag(extract.id, tag.id);
      }

      extractsCreated++;
      if (insight.is_action_item) {
        actionItems++;
      }
    }

    // Update meeting status if extracts were created
    if (extractsCreated > 0) {
      await meetings.updateMeetingStatus(meetingId, "completed");
    }

    // Analyze participation from transcript and update meeting participants
    await analyzeAndUpdateParticipation(meetingId, meeting.transcript);

    return { success: true, extractsCreated, actionItems, customerId };
  } catch (error) {
    console.error("Error processing meeting extracts:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, extractsCreated: 0, actionItems: 0, error: message };
  }
}

// Process all meetings that have transcripts but no extracts
export async function processAllPendingMeetings(): Promise<{
  processed: number;
  failed: number;
  errors: string[];
}> {
  const allMeetings = await meetings.getMeetings();

  // Filter to meetings with transcripts that might need processing
  const pendingMeetings = allMeetings.filter(
    (m) => m.transcript && m.workflow_status === "transcribed"
  );

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const meeting of pendingMeetings) {
    // Check if meeting already has extracts
    const existingExtracts = await extracts.getExtractsByMeetingId(meeting.id);
    if (existingExtracts.length > 0) {
      continue; // Already processed
    }

    const result = await processMeetingExtracts(meeting.id);
    if (result.success) {
      processed++;
    } else {
      failed++;
      errors.push(`Meeting ${meeting.id}: ${result.error}`);
    }
  }

  return { processed, failed, errors };
}

// Get extraction stats for a meeting
export async function getMeetingExtractionStats(meetingId: string) {
  const meetingExtracts = await extracts.getExtractsByMeetingId(meetingId);

  return {
    total: meetingExtracts.length,
    actionItems: meetingExtracts.filter((e) => e.is_action_item).length,
    pendingActionItems: meetingExtracts.filter(
      (e) => e.is_action_item && e.action_item_status === "pending"
    ).length,
  };
}

/**
 * Analyze meeting transcript to determine participant involvement
 * and update the meeting_participants table with participation status
 */
async function analyzeAndUpdateParticipation(
  meetingId: string,
  transcript: string
): Promise<void> {
  try {
    const participants = await meetings.getMeetingParticipantsWithDetails(meetingId);
    if (participants.length === 0) {
      console.log(`[Participation] No participants found for meeting ${meetingId}`);
      return;
    }
    const participantInfo = participants.map((p) => ({
      name: p.name,
      email: p.email,
    }));
    console.log(`[Participation] Analyzing ${participants.length} participants for meeting ${meetingId}`);
    const analysis = await analyzeTranscriptParticipation(transcript, participantInfo);
    let participatedCount = 0;
    let invitedCount = 0;
    for (const analyzed of analysis.participants) {
      const status: ParticipationStatus = analyzed.participated ? "participated" : "invited";
      if (analyzed.participated) {
        participatedCount++;
      } else {
        invitedCount++;
      }
      if (analyzed.email) {
        await meetings.updateParticipantStatusByEmail(meetingId, analyzed.email, status);
      } else {
        await meetings.updateParticipantStatusByName(meetingId, analyzed.name, status);
      }
    }
    console.log(
      `[Participation] Meeting ${meetingId}: ${participatedCount} participated, ${invitedCount} invited only`
    );
  } catch (error) {
    console.error(`[Participation] Error analyzing participation for meeting ${meetingId}:`, error);
  }
}

/**
 * Re-analyze participation for a meeting (can be called separately from extraction)
 */
export async function reanalyzeParticipation(meetingId: string): Promise<{
  success: boolean;
  participatedCount: number;
  invitedCount: number;
  error?: string;
}> {
  const meeting = await meetings.getMeetingById(meetingId);
  if (!meeting) {
    return { success: false, participatedCount: 0, invitedCount: 0, error: "Meeting not found" };
  }
  if (!meeting.transcript) {
    return { success: false, participatedCount: 0, invitedCount: 0, error: "Meeting has no transcript" };
  }
  try {
    const participants = await meetings.getMeetingParticipantsWithDetails(meetingId);
    if (participants.length === 0) {
      return { success: true, participatedCount: 0, invitedCount: 0 };
    }
    const participantInfo = participants.map((p) => ({
      name: p.name,
      email: p.email,
    }));
    const analysis = await analyzeTranscriptParticipation(meeting.transcript, participantInfo);
    let participatedCount = 0;
    let invitedCount = 0;
    for (const analyzed of analysis.participants) {
      const status: ParticipationStatus = analyzed.participated ? "participated" : "invited";
      if (analyzed.participated) {
        participatedCount++;
      } else {
        invitedCount++;
      }
      if (analyzed.email) {
        await meetings.updateParticipantStatusByEmail(meetingId, analyzed.email, status);
      } else {
        await meetings.updateParticipantStatusByName(meetingId, analyzed.name, status);
      }
    }
    return { success: true, participatedCount, invitedCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, participatedCount: 0, invitedCount: 0, error: message };
  }
}
