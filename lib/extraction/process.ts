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

export async function processMeetingExtracts(
  accountId: string,
  meetingId: string
): Promise<ProcessingResult> {
  const meeting = await meetings.getMeetingById(accountId, meetingId);

  if (!meeting) {
    return { success: false, extractsCreated: 0, actionItems: 0, error: "Meeting not found" };
  }
  if (!meeting.transcript) {
    return { success: false, extractsCreated: 0, actionItems: 0, error: "Meeting has no transcript" };
  }

  try {
    const allCustomers = await customers.getCustomers(accountId);
    const companyInfoList: CompanyInfo[] = allCustomers.map((c: Customer) => ({
      name: c.name,
      id: c.id,
    }));

    const customerId = meeting.customer_id;

    const insights = await extractInsightsFromTranscript(accountId, meeting.transcript, companyInfoList);

    const allRules = await extractRules.getExtractRules(accountId);
    const ruleNameToId = new Map<string, string>();
    for (const rule of allRules) {
      ruleNameToId.set(rule.name, rule.id);
      ruleNameToId.set(rule.name.toLowerCase(), rule.id);
    }

    let extractsCreated = 0;
    let actionItems = 0;

    for (const insight of insights) {
      let extractRuleId: string | null = null;
      if (insight.matched_rule) {
        extractRuleId = ruleNameToId.get(insight.matched_rule) ||
                        ruleNameToId.get(insight.matched_rule.toLowerCase()) ||
                        null;
      }

      const extract = await extracts.createExtract(accountId, {
        meeting_id: meetingId,
        customer_id: customerId,
        extract_rule_id: extractRuleId,
        extract_date: meeting.meeting_date,
        summary: insight.summary,
        quotes: insight.quotes,
        is_action_item: insight.is_action_item,
        action_item_status: insight.is_action_item ? "pending" : null,
        participant_name: insight.participant_name,
        participant_email: insight.participant_email,
      });

      for (const tagName of insight.tags) {
        const tag = await tags.getOrCreateTag(accountId, tagName, "extracted");
        await extracts.addExtractTag(accountId, extract.id, tag.id);
      }

      extractsCreated++;
      if (insight.is_action_item) actionItems++;
    }

    if (extractsCreated > 0) {
      await meetings.updateMeetingStatus(accountId, meetingId, "completed");
    }

    await analyzeAndUpdateParticipation(accountId, meetingId, meeting.transcript);

    return { success: true, extractsCreated, actionItems, customerId };
  } catch (error) {
    console.error("Error processing meeting extracts:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, extractsCreated: 0, actionItems: 0, error: message };
  }
}

export async function processAllPendingMeetings(accountId: string): Promise<{
  processed: number;
  failed: number;
  errors: string[];
}> {
  const allMeetings = await meetings.getMeetings(accountId);
  const pendingMeetings = allMeetings.filter(
    (m) => m.transcript && m.workflow_status === "transcribed"
  );

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const meeting of pendingMeetings) {
    const existingExtracts = await extracts.getExtractsByMeetingId(accountId, meeting.id);
    if (existingExtracts.length > 0) continue;

    const result = await processMeetingExtracts(accountId, meeting.id);
    if (result.success) processed++;
    else {
      failed++;
      errors.push(`Meeting ${meeting.id}: ${result.error}`);
    }
  }

  return { processed, failed, errors };
}

export async function getMeetingExtractionStats(accountId: string, meetingId: string) {
  const meetingExtracts = await extracts.getExtractsByMeetingId(accountId, meetingId);
  return {
    total: meetingExtracts.length,
    actionItems: meetingExtracts.filter((e) => e.is_action_item).length,
    pendingActionItems: meetingExtracts.filter(
      (e) => e.is_action_item && e.action_item_status === "pending"
    ).length,
  };
}

async function analyzeAndUpdateParticipation(
  accountId: string,
  meetingId: string,
  transcript: string
): Promise<void> {
  try {
    const participants = await meetings.getMeetingParticipantsWithDetails(accountId, meetingId);
    if (participants.length === 0) return;
    const participantInfo = participants.map((p) => ({
      name: p.name,
      email: p.email,
    }));
    const analysis = await analyzeTranscriptParticipation(transcript, participantInfo);
    for (const analyzed of analysis.participants) {
      const status: ParticipationStatus = analyzed.participated ? "participated" : "invited";
      if (analyzed.email) {
        await meetings.updateParticipantStatusByEmail(accountId, meetingId, analyzed.email, status);
      } else {
        await meetings.updateParticipantStatusByName(accountId, meetingId, analyzed.name, status);
      }
    }
  } catch (error) {
    console.error(`[Participation] Error analyzing participation for meeting ${meetingId}:`, error);
  }
}

export async function reanalyzeParticipation(
  accountId: string,
  meetingId: string
): Promise<{
  success: boolean;
  participatedCount: number;
  invitedCount: number;
  error?: string;
}> {
  const meeting = await meetings.getMeetingById(accountId, meetingId);
  if (!meeting) {
    return { success: false, participatedCount: 0, invitedCount: 0, error: "Meeting not found" };
  }
  if (!meeting.transcript) {
    return { success: false, participatedCount: 0, invitedCount: 0, error: "Meeting has no transcript" };
  }
  try {
    const participants = await meetings.getMeetingParticipantsWithDetails(accountId, meetingId);
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
      if (analyzed.participated) participatedCount++;
      else invitedCount++;
      if (analyzed.email) {
        await meetings.updateParticipantStatusByEmail(accountId, meetingId, analyzed.email, status);
      } else {
        await meetings.updateParticipantStatusByName(accountId, meetingId, analyzed.name, status);
      }
    }
    return { success: true, participatedCount, invitedCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, participatedCount: 0, invitedCount: 0, error: message };
  }
}
