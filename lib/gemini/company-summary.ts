import { getGeminiClient, GEMINI_MODEL_FAST } from "./client";
import { Meeting, Extract } from "@/lib/db/types";

const COMPANY_SUMMARY_PROMPT = `You are generating a concise summary of recent interactions with a company.

## Company: {company_name}
## Company Type: {company_type}

## Meetings and Extracts from the last 6 months:
{meetings_data}

---

Generate TWO parts:

**PART 1 - Summary Paragraph (2-4 sentences):**
1. Summarize the overall relationship and key themes from interactions
2. Highlight positive developments or wins
3. Note any concerns, issues, or challenges raised

**PART 2 - Key Items:**
List the most important action items, feature requests, or follow-ups from these meetings. Each item should be concise (one line) and linked to its source meeting. Prefix each item with [ACTION] or [REQUEST] to indicate the type.

IMPORTANT: For each meeting reference, wrap it in double brackets like this: [[Meeting Name|meeting_id]]
This allows us to create links. Use the exact meeting_id provided in the data.

Format your response EXACTLY like this (include the "---" separator):
[Summary paragraph here]

---

• [ACTION] [[Action item description|meeting_id]]
• [REQUEST] [[Feature request description|meeting_id]]

Example output:
Overall engagement with this customer has been positive over the past 6 months. They've provided valuable feedback on the reporting features in [[Q3 Review|abc123]] and expressed interest in expanded API access during [[Technical Discussion|def456]]. Main concern is around data export capabilities.

---

• [REQUEST] [[Add bulk export feature|abc123]]
• [ACTION] [[Schedule API workshop|def456]]
• [ACTION] [[Follow up on pricing discussion|abc123]]

If there are no action items or feature requests, omit the "---" and bullet list entirely.

Return ONLY the formatted output as shown above, no additional text.`;

interface MeetingSummaryData {
  meetingId: string;
  meetingName: string;
  meetingDate: string;
  extracts: {
    summary: string;
    isActionItem: boolean;
    quotes: string[];
  }[];
}

export interface CompanySummary {
  summary: string;
  meetingLinks: { name: string; meetingId: string }[];
}

export async function generateCompanySummary(
  companyName: string,
  companyType: "deal" | "customer",
  meetings: Meeting[],
  extractsByMeetingId: Map<string, Extract[]>
): Promise<CompanySummary | null> {
  if (meetings.length === 0) {
    return null;
  }

  // Build meetings data for the prompt
  const meetingsData: MeetingSummaryData[] = meetings.map((meeting) => {
    const meetingExtracts = extractsByMeetingId.get(meeting.id) || [];

    return {
      meetingId: meeting.id,
      meetingName: meeting.name || "Untitled Meeting",
      meetingDate: meeting.meeting_date
        ? new Date(meeting.meeting_date).toLocaleDateString()
        : "Unknown date",
      extracts: meetingExtracts
        .filter((e) => e.summary)
        .map((e) => ({
          summary: e.summary!,
          isActionItem: e.is_action_item || false,
          quotes: e.quotes || [],
        })),
    };
  });

  // Format meetings data for prompt
  const formattedMeetingsData = meetingsData
    .map((m) => {
      const extractsText = m.extracts.length > 0
        ? m.extracts
            .map((e) => `  - ${e.summary}${e.isActionItem ? " [ACTION ITEM]" : ""}`)
            .join("\n")
        : "  (No extracts)";

      return `Meeting: ${m.meetingName} (ID: ${m.meetingId})
Date: ${m.meetingDate}
Extracts:
${extractsText}`;
    })
    .join("\n\n");

  const companyTypeLabel = companyType === "deal" ? "Deal/Prospect" : "Existing Customer";

  const prompt = COMPANY_SUMMARY_PROMPT
    .replace("{company_name}", companyName)
    .replace("{company_type}", companyTypeLabel)
    .replace("{meetings_data}", formattedMeetingsData);

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_FAST });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const summaryText = response.text().trim();

    // Extract meeting links from the summary
    const linkPattern = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;
    const meetingLinks: { name: string; meetingId: string }[] = [];
    let match;

    while ((match = linkPattern.exec(summaryText)) !== null) {
      meetingLinks.push({
        name: match[1],
        meetingId: match[2],
      });
    }

    return {
      summary: summaryText,
      meetingLinks,
    };
  } catch (error) {
    console.error(`Error generating company summary for ${companyName}:`, error);
    return null;
  }
}
