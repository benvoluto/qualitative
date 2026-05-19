import { getGeminiClient, GEMINI_MODEL_FAST } from "./client";
import { Meeting, Extract, Customer } from "@/lib/db/types";

const ACTIVITY_SUMMARY_PROMPT = `You are generating a concise activity summary for a time period of meetings.

## Meeting Type: {meeting_type}

## Meetings and Extracts:
{meetings_data}

---

Generate a single concise paragraph (2-4 sentences) that:
1. Mentions ALL companies/organizations met with (for customers/deals) or meeting topics (for internal)
2. Highlights key positive findings or wins
3. Notes any concerns, issues, or lowlights

IMPORTANT: For each company name or meeting topic mentioned, wrap it in double brackets like this: [[Company Name|meeting_id]] or [[Meeting Topic|meeting_id]]
This allows us to create links. Use the exact meeting_id provided in the data.

Example output:
"Met with [[Acme Corp|abc123]] and [[Beta Inc|def456]]. Positive feedback on the new dashboard features from Acme, while Beta reported ongoing integration issues."

Return ONLY the summary paragraph, no additional formatting or explanation.`;

const ACTIVITY_SUMMARY_WITH_ITEMS_PROMPT = `You are generating a concise activity summary for a time period of meetings.

## Meeting Type: {meeting_type}

## Meetings and Extracts:
{meetings_data}

---

Generate TWO parts:

**PART 1 - Summary Paragraph (2-4 sentences):**
1. Mentions ALL companies met with — OR, for meetings without a linked company, refer to the meeting by its topic/name
2. Highlights key positive findings or wins
3. Notes any concerns, issues, or lowlights

**PART 2 - Action Items & Feature Requests:**
List ALL action items and feature requests extracted from the meetings.
- IMPORTANT: Start each line with the COMPANY NAME (or meeting topic if no company is linked) followed by the item description
- Prefix each item with [ACTION] or [REQUEST] to indicate the type
- SORT items in REVERSE CHRONOLOGICAL ORDER (most recent meeting date first)
- Each item should be concise (one line) and linked to its source meeting

IMPORTANT for Summary Paragraph: For each company name (or topic) mentioned, wrap it in double brackets like this: [[Company Name|meeting_id]] or [[Meeting Topic|meeting_id]]

IMPORTANT for Action Items/Requests: Include BOTH the meeting_id AND the extract_id using this format: [[Company Name|meeting_id|extract_id]] (or [[Meeting Topic|meeting_id|extract_id]] when no company is linked)
This allows us to link to the meeting AND update the status of the specific extract. Use the exact IDs provided in the data.

Format your response EXACTLY like this (include the "---" separator):
[Summary paragraph here]

---

• [ACTION] [[Company Name|meeting_id|extract_id]]: Action item description
• [REQUEST] [[Company Name|meeting_id|extract_id]]: Feature request description

Example output (note: most recent dates first):
Met with [[Acme Corp|abc123]] and [[Beta Inc|def456]]. Positive feedback on the new dashboard features from Acme, while Beta reported ongoing integration issues.

---

• [REQUEST] [[Beta Inc|def456|ext789]]: Add CSV export to reports
• [ACTION] [[Beta Inc|def456|ext012]]: Fix API timeout issues
• [ACTION] [[Acme Corp|abc123|ext345]]: Schedule follow-up demo

Return ONLY the formatted output as shown above, no additional text.`;

interface MeetingSummaryData {
  meetingId: string;
  meetingName: string;
  meetingDate: string;
  companyName: string | null;
  extracts: {
    extractId: string;
    summary: string;
    isActionItem: boolean;
    isRequest: boolean;
    quotes: string[];
  }[];
}

interface ActivitySummary {
  type: "deals" | "customers" | "internal";
  summary: string;
  meetingLinks: { name: string; meetingId: string }[];
}

export async function generateActivitySummary(
  type: "deals" | "customers" | "internal",
  meetings: Meeting[],
  extractsByMeetingId: Map<string, Extract[]>,
  customersById: Map<string, Customer>
): Promise<ActivitySummary | null> {
  if (meetings.length === 0) {
    return null;
  }

  // Sort meetings by date (most recent first) for reverse chronological order
  const sortedMeetings = [...meetings].sort((a, b) => {
    const dateA = a.meeting_date ? new Date(a.meeting_date).getTime() : 0;
    const dateB = b.meeting_date ? new Date(b.meeting_date).getTime() : 0;
    return dateB - dateA;
  });

  // Build meetings data for the prompt
  const meetingsData: MeetingSummaryData[] = sortedMeetings.map((meeting) => {
    const meetingExtracts = extractsByMeetingId.get(meeting.id) || [];
    const customer = meeting.customer_id ? customersById.get(meeting.customer_id) : null;

    return {
      meetingId: meeting.id,
      meetingName: meeting.name || "Untitled Meeting",
      meetingDate: meeting.meeting_date
        ? new Date(meeting.meeting_date).toLocaleDateString()
        : "Unknown date",
      companyName: customer?.name || null,
      extracts: meetingExtracts
        .filter((e) => e.summary)
        .map((e) => ({
          extractId: e.id,
          summary: e.summary!,
          isActionItem: e.is_action_item || false,
          isRequest: e.request_status !== undefined,
          quotes: e.quotes || [],
        })),
    };
  });

  // Format meetings data for prompt
  const formattedMeetingsData = meetingsData
    .map((m) => {
      const extractsText = m.extracts.length > 0
        ? m.extracts
            .map((e) => `  - (Extract ID: ${e.extractId}) ${e.summary}${e.isActionItem ? " [ACTION ITEM]" : ""}`)
            .join("\n")
        : "  (No extracts)";

      return `Meeting: ${m.meetingName} (ID: ${m.meetingId})
Date: ${m.meetingDate}
${m.companyName ? `Company: ${m.companyName}` : "Topic: " + m.meetingName}
Extracts:
${extractsText}`;
    })
    .join("\n\n");

  const meetingTypeLabel =
    type === "deals"
      ? "Deal Meetings"
      : type === "customers"
        ? "Customer Meetings"
        : "Other Meetings (no linked company — may be internal team meetings, research interviews, or unassigned uploads)";

  // All three buckets use the action-items prompt so requests / action items
  // surface uniformly. Meetings without a company name are described by topic.
  const basePrompt = ACTIVITY_SUMMARY_WITH_ITEMS_PROMPT;

  const prompt = basePrompt
    .replace("{meeting_type}", meetingTypeLabel)
    .replace("{meetings_data}", formattedMeetingsData);

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_FAST });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const summaryText = response.text().trim();

    // Extract meeting links from the summary (deduplicated by meetingId)
    const linkPattern = /\[\[([^\]|]+)\|([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    const meetingLinksMap = new Map<string, { name: string; meetingId: string }>();
    let match;

    while ((match = linkPattern.exec(summaryText)) !== null) {
      const meetingId = match[2];
      // Only add if we haven't seen this meeting ID before
      if (!meetingLinksMap.has(meetingId)) {
        meetingLinksMap.set(meetingId, {
          name: match[1],
          meetingId,
        });
      }
    }
    const meetingLinks = Array.from(meetingLinksMap.values());

    return {
      type,
      summary: summaryText,
      meetingLinks,
    };
  } catch (error) {
    console.error(`Error generating ${type} activity summary:`, error);
    return null;
  }
}

export async function generateAllActivitySummaries(
  meetings: Meeting[],
  extractsByMeetingId: Map<string, Extract[]>,
  customersById: Map<string, Customer>
): Promise<ActivitySummary[]> {
  // Separate meetings by type
  const dealMeetings: Meeting[] = [];
  const customerMeetings: Meeting[] = [];
  const internalMeetings: Meeting[] = [];

  for (const meeting of meetings) {
    if (meeting.is_internal) {
      internalMeetings.push(meeting);
    } else if (meeting.customer_id) {
      const customer = customersById.get(meeting.customer_id);
      if (customer?.customer_type === "deal") {
        dealMeetings.push(meeting);
      } else if (customer?.customer_type === "customer") {
        customerMeetings.push(meeting);
      }
    }
  }

  // Generate summaries in parallel
  const [dealsSummary, customersSummary, internalSummary] = await Promise.all([
    generateActivitySummary("deals", dealMeetings, extractsByMeetingId, customersById),
    generateActivitySummary("customers", customerMeetings, extractsByMeetingId, customersById),
    generateActivitySummary("internal", internalMeetings, extractsByMeetingId, customersById),
  ]);

  const summaries: ActivitySummary[] = [];
  if (dealsSummary) summaries.push(dealsSummary);
  if (customersSummary) summaries.push(customersSummary);
  if (internalSummary) summaries.push(internalSummary);

  return summaries;
}
