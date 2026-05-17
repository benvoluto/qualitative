import { getGeminiClient, GEMINI_MODEL_FAST } from "./client";
import { Meeting, Extract, Customer } from "@/lib/db/types";

interface ExtractWithTags extends Extract {
  tags?: Array<{ id: string; name: string }>;
}

export interface MeetingParticipantInfo {
  name: string;
  email: string | null;
}

export interface GeneratedTicket {
  type: "feature_request" | "bug";
  title: string;
  description: string;
  priority: string;
  labels: string[];
  customerName: string;
  contactName: string;
  userQuote?: string;
}

export interface GeneratedTickets {
  featureRequests: GeneratedTicket[];
  bugs: GeneratedTicket[];
}

const TICKET_GENERATION_PROMPT = `Analyze the following meeting extracts and identify any feature requests or bug reports mentioned.

## Meeting Information:
Meeting Name: {meeting_name}
Meeting Date: {meeting_date}
Customer/Company: {customer_name}

## Meeting Participants:
{participants}

## Extracts from the Meeting:
{extracts}

---

Based on the extracts, identify:
1. **Feature Requests**: New functionality or improvements users are asking for
2. **Bug Reports**: Issues, problems, or things that aren't working as expected

For each feature request, provide:
- title: A concise title (under 80 chars)
- description: Detailed description of what the user wants
- priority: P0 (critical), P1 (high), P2 (medium), or P3 (low)
- labels: Relevant labels like ["enhancement", "ux", "reporting", "integrations", etc.]
- userQuote: A direct quote from the user if available
- contactName: Name of the person who requested it (if known)

For each bug, provide:
- title: A concise title describing the issue
- description: What's happening vs what should happen
- severity: Critical, High, Medium, or Low
- stepsToReproduce: Steps to reproduce if mentioned
- workaround: Any workaround mentioned
- reporterName: Name of the person who reported it (if known)

Return a JSON object:
{
  "featureRequests": [
    {
      "title": "...",
      "description": "...",
      "priority": "P2",
      "labels": ["enhancement"],
      "userQuote": "...",
      "contactName": "..."
    }
  ],
  "bugs": [
    {
      "title": "...",
      "description": "...",
      "severity": "Medium",
      "stepsToReproduce": ["..."],
      "workaround": "...",
      "reporterName": "..."
    }
  ]
}

If there are no feature requests or bugs, return empty arrays.
Return only valid JSON.`;

/**
 * Analyze extracts to determine if there are potential feature requests or bugs
 * This is a quick check based on extract content and tags
 */
export function hasTicketableContent(extracts: ExtractWithTags[]): {
  hasFeatureRequests: boolean;
  hasBugs: boolean;
} {
  const featureKeywords = [
    "feature", "request", "would be nice", "wish", "could you add",
    "would love", "suggestion", "enhance", "improvement", "want to be able",
    "need to be able", "missing", "add support for"
  ];

  const bugKeywords = [
    "bug", "issue", "problem", "broken", "doesn't work", "not working",
    "error", "crash", "failed", "wrong", "incorrect", "fix", "glitch"
  ];

  let hasFeatureRequests = false;
  let hasBugs = false;

  for (const extract of extracts) {
    const text = (extract.summary || "").toLowerCase();
    const quotes = (extract.quotes || []).join(" ").toLowerCase();
    const combined = `${text} ${quotes}`;

    // Check tags
    const tagNames = (extract.tags || []).map(t => t.name.toLowerCase());
    if (tagNames.some(t => t.includes("feature") || t.includes("request") || t.includes("enhancement"))) {
      hasFeatureRequests = true;
    }
    if (tagNames.some(t => t.includes("bug") || t.includes("issue") || t.includes("problem"))) {
      hasBugs = true;
    }

    // Check content
    if (featureKeywords.some(kw => combined.includes(kw))) {
      hasFeatureRequests = true;
    }
    if (bugKeywords.some(kw => combined.includes(kw))) {
      hasBugs = true;
    }

    if (hasFeatureRequests && hasBugs) break;
  }

  return { hasFeatureRequests, hasBugs };
}

/**
 * Generate ticket text from meeting extracts using Gemini
 */
export async function generateTicketText(
  meeting: Meeting,
  extracts: ExtractWithTags[],
  customer: Customer | null,
  meetingParticipants?: MeetingParticipantInfo[]
): Promise<GeneratedTickets> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_FAST });

  // Format extracts
  const extractsText = extracts
    .map((e) => {
      let text = `- ${e.summary}`;
      if (e.participant_name) {
        text += ` (from ${e.participant_name})`;
      }
      if (e.quotes && e.quotes.length > 0) {
        text += `\n  Quotes: ${e.quotes.map(q => `"${q}"`).join(", ")}`;
      }
      if (e.tags && e.tags.length > 0) {
        text += `\n  Tags: ${e.tags.map(t => t.name).join(", ")}`;
      }
      return text;
    })
    .join("\n\n");

  // Collect participants from multiple sources (excluding meeting host)
  const hostEmail = meeting.host_email?.toLowerCase();
  const participantsSet = new Map<string, { name: string; email: string | null }>();

  // 1. Add participants from meeting_participants table (primary source)
  if (meetingParticipants) {
    for (const participant of meetingParticipants) {
      if (participant.email) {
        const email = participant.email.toLowerCase();
        if (hostEmail && email === hostEmail) continue;
        if (!participantsSet.has(email)) {
          participantsSet.set(email, { name: participant.name, email: participant.email });
        }
      } else if (participant.name) {
        const key = participant.name.toLowerCase();
        if (!participantsSet.has(key)) {
          participantsSet.set(key, { name: participant.name, email: null });
        }
      }
    }
  }

  // 2. Add participants from extracts (secondary source)
  for (const extract of extracts) {
    if (extract.participant_email) {
      const email = extract.participant_email.toLowerCase();
      if (hostEmail && email === hostEmail) continue;
      if (!participantsSet.has(email)) {
        participantsSet.set(email, {
          name: extract.participant_name || "Unknown",
          email: extract.participant_email,
        });
      }
    }
  }

  const participantsText = participantsSet.size > 0
    ? Array.from(participantsSet.values())
        .map((p) => p.email ? `- ${p.name} <${p.email}>` : `- ${p.name}`)
        .join("\n")
    : "Participants not specified";

  const filledPrompt = TICKET_GENERATION_PROMPT
    .replace("{meeting_name}", meeting.name || "Meeting")
    .replace("{meeting_date}", meeting.meeting_date?.toLocaleDateString() || "Recent")
    .replace("{customer_name}", customer?.name || "Not specified")
    .replace("{participants}", participantsText)
    .replace("{extracts}", extractsText);

  try {
    const result = await model.generateContent(filledPrompt);
    const response = result.response.text();

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { featureRequests: [], bugs: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Transform to our GeneratedTicket format
    const featureRequests: GeneratedTicket[] = (parsed.featureRequests || []).map((fr: Record<string, unknown>) => ({
      type: "feature_request" as const,
      title: fr.title as string || "Untitled Feature Request",
      description: fr.description as string || "",
      priority: fr.priority as string || "P2",
      labels: (fr.labels as string[]) || ["enhancement"],
      customerName: customer?.name || "Unknown",
      contactName: fr.contactName as string || "Unknown",
      userQuote: fr.userQuote as string,
    }));

    const bugs: GeneratedTicket[] = (parsed.bugs || []).map((bug: Record<string, unknown>) => ({
      type: "bug" as const,
      title: bug.title as string || "Untitled Bug Report",
      description: `${bug.description || ""}\n\n${
        (bug.stepsToReproduce as string[])?.length
          ? `**Steps to Reproduce:**\n${(bug.stepsToReproduce as string[]).map((s, i) => `${i + 1}. ${s}`).join("\n")}`
          : ""
      }${bug.workaround ? `\n\n**Workaround:** ${bug.workaround}` : ""}`,
      priority: bug.severity as string || "Medium",
      labels: ["bug"],
      customerName: customer?.name || "Unknown",
      contactName: bug.reporterName as string || "Unknown",
    }));

    return { featureRequests, bugs };
  } catch (error) {
    console.error("Error generating ticket text:", error);
    return { featureRequests: [], bugs: [] };
  }
}

/**
 * Format tickets as readable text for display
 */
export function formatTicketsAsText(tickets: GeneratedTickets): string {
  const lines: string[] = [];

  if (tickets.featureRequests.length > 0) {
    lines.push("## Feature Requests\n");
    tickets.featureRequests.forEach((fr, i) => {
      lines.push(`### ${i + 1}. ${fr.title}`);
      lines.push(`**Priority:** ${fr.priority}`);
      lines.push(`**Labels:** ${fr.labels.join(", ")}`);
      lines.push(`**Customer:** ${fr.customerName}`);
      lines.push(`**Requested by:** ${fr.contactName}`);
      lines.push("");
      lines.push(fr.description);
      if (fr.userQuote) {
        lines.push("");
        lines.push(`> "${fr.userQuote}"`);
      }
      lines.push("\n---\n");
    });
  }

  if (tickets.bugs.length > 0) {
    lines.push("## Bug Reports\n");
    tickets.bugs.forEach((bug, i) => {
      lines.push(`### ${i + 1}. ${bug.title}`);
      lines.push(`**Severity:** ${bug.priority}`);
      lines.push(`**Customer:** ${bug.customerName}`);
      lines.push(`**Reported by:** ${bug.contactName}`);
      lines.push("");
      lines.push(bug.description);
      lines.push("\n---\n");
    });
  }

  if (lines.length === 0) {
    return "No feature requests or bugs identified in this meeting.";
  }

  return lines.join("\n");
}
