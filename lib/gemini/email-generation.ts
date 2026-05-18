import { getGeminiClient, GEMINI_MODEL_FAST } from "./client";
import { Meeting, Extract, Customer, CustomerType, ParticipationStatus } from "@/lib/db/types";

// Extended Extract type that includes joined tags (can be full Tag or partial)
interface ExtractWithTags extends Extract {
  tags?: Array<{ id: string; name: string }>;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

export interface GeneratedCRMNote {
  summary: string;
  sections: {
    relationshipContext?: string;
    professionalContext?: string;
    successMetrics?: string[];
    platformFeedback?: {
      positive: string[];
      negative: string[];
      neutral: string[];
    };
    featureRequests?: FeatureRequestData[];
    bugsAndIssues?: BugReportData[];
    missingAssessments?: string[];
    competitorMentions?: string[];
    contractAndBudget?: string;
    keyUsersAndInfluencers?: string[];
    actionItems?: ActionItemData[];
    nextMeeting?: string;
  };
}

export interface FeatureRequestData {
  title: string;
  description: string;
  context: string;
  userQuote?: string;
  priority: "P0" | "P1" | "P2" | "P3";
  labels: string[];
  customerName: string;
  contactName: string;
  meetingDate: string;
}

export interface BugReportData {
  title: string;
  issue: string;
  expected: string;
  stepsToReproduce?: string[];
  workaround?: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  customerName: string;
  reporterName: string;
  reportDate: string;
}

export interface ActionItemData {
  owner: string;
  action: string;
  dueDate?: string;
  status: "pending" | "in_progress" | "completed";
}

/**
 * Format a single participant with their status for display in prompts
 */
function formatParticipantWithStatus(
  name: string,
  email: string | null,
  status: ParticipationStatus
): string {
  const statusLabel = status === "participated" ? "[spoke]" : status === "invited" ? "[invited only]" : "";
  if (email) {
    return statusLabel ? `${name} <${email}> ${statusLabel}` : `${name} <${email}>`;
  }
  return statusLabel ? `${name} ${statusLabel}` : name;
}

/**
 * Build a formatted participants list from meeting participants and extracts
 * Includes participation status for each participant
 */
function formatParticipantsList(
  meeting: Meeting,
  meetingParticipants?: MeetingParticipantInfo[],
  extractsList?: Extract[]
): string {
  const hostEmail = meeting.host_email?.toLowerCase();
  const participantsSet = new Map<string, { name: string; email: string | null; status: ParticipationStatus }>();
  if (meetingParticipants) {
    for (const participant of meetingParticipants) {
      if (participant.email) {
        const email = participant.email.toLowerCase();
        if (hostEmail && email === hostEmail) continue;
        if (!participantsSet.has(email)) {
          participantsSet.set(email, {
            name: participant.name,
            email: participant.email,
            status: participant.participation_status || "n/a",
          });
        }
      } else if (participant.name) {
        const key = participant.name.toLowerCase();
        if (!participantsSet.has(key)) {
          participantsSet.set(key, {
            name: participant.name,
            email: null,
            status: participant.participation_status || "n/a",
          });
        }
      }
    }
  }
  if (extractsList) {
    for (const extract of extractsList) {
      if (extract.participant_email) {
        const email = extract.participant_email.toLowerCase();
        if (hostEmail && email === hostEmail) continue;
        if (!participantsSet.has(email)) {
          participantsSet.set(email, {
            name: extract.participant_name || "Unknown",
            email: extract.participant_email,
            status: "participated",
          });
        }
      }
    }
  }
  if (participantsSet.size === 0) {
    return "Participants not specified";
  }
  return Array.from(participantsSet.values())
    .map((p) => formatParticipantWithStatus(p.name, p.email, p.status))
    .join("\n");
}

// Detailed prompt for deal follow-up emails based on project plan template
const DEAL_EMAIL_PROMPT = `You are drafting a warm and friendly follow-up email after a sales meeting with a prospective customer.

## Meeting Information:
Meeting Name: {meeting_name}
Meeting Date: {meeting_date}
Prospect Name: {customer_name}
Meeting Owner: {meeting_owner}

## Key Insights from the Meeting:
{extracts}

## Action Items:
{action_items}

## Participants (with emails and participation status):
{participants}

Note: Participation status indicates whether each person actively spoke during the meeting:
- "participated" = Spoke during the meeting
- "invited" = Was on the invite but did not speak
- "n/a" = Status not determined

---

Generate a follow-up email using this structure:

1. **Subject Line**: Keep brief, reference the meeting or next step (e.g., "Great connecting - recap and next steps")

2. **Greeting**: Use first names ("Hi [names]!")

3. **Opening**:
   - Reference when you spoke ("It was great speaking to you today/yesterday")
   - Add a personalized detail from the conversation if mentioned

4. **Recap Section** (bullet points): Summarize the key topics, pain points, and value points discussed.

5. **Next Steps Section** (bullet points):
   - What you (the meeting owner) will do next
   - What the prospect will do next — always include at least one prospect action item to maintain momentum

6. **Closing**:
   - "Please let me know if you have any questions"
   - "Looking forward to connecting again [timeframe]"
   - First-name signature

## Output Format:
Return a JSON object:
{
  "subject": "Email subject line",
  "body": "Full email body text (use \\n for line breaks, use bullet points with - for lists)"
}

Guidelines:
- Warm, enthusiastic, professional, but not overly formal
- Reference specific details from the meeting to show you were listening
- Keep it concise and scannable
- Always include at least one prospect action item

Return only valid JSON.`;

// Detailed prompt for customer follow-up emails based on project plan template
const CUSTOMER_EMAIL_PROMPT = `You are drafting a warm and friendly follow-up email after a meeting with an existing customer.

## Meeting Information:
Meeting Name: {meeting_name}
Meeting Date: {meeting_date}
Customer Name: {customer_name}
Meeting Owner: {meeting_owner}

## Key Insights from the Meeting:
{extracts}

## Action Items:
{action_items}

## Participants (with emails and participation status):
{participants}

Note: Participation status indicates whether each person actively spoke during the meeting:
- "participated" = Spoke during the meeting
- "invited" = Was on the invite but did not speak
- "n/a" = Status not determined

---

Generate a follow-up email using this structure:

1. **Subject Line**: Reference the meeting type (e.g., "Great connecting - check-in recap")

2. **Greeting**: Use first names ("Hi [names]!")

3. **Opening**: Reference when you connected and add a personalized detail if any was shared.

4. **Summary Section**:
   - "I wanted to recap what we discussed and outline next steps:"
   - Brief summary of key discussion points

5. **Feedback Acknowledgment** (if applicable): Acknowledge specific feedback and what you'll do with it.

6. **Action Items Section**:
   - What your team will do
   - What the customer team will do

7. **Closing**:
   - "Looking forward to our next check-in"
   - "Please don't hesitate to reach out if anything comes up"
   - First-name signature

## Output Format:
Return a JSON object:
{
  "subject": "Email subject line",
  "body": "Full email body text (use \\n for line breaks, use bullet points with - for lists)"
}

Guidelines:
- Thank them for their continued partnership
- Acknowledge feedback professionally
- Be specific about commitments and ownership
- Reinforce the relationship and availability

Return only valid JSON.`;

// Prompt for generating CRM meeting notes
const CRM_NOTES_PROMPT = `You are generating structured CRM meeting notes from a customer success meeting.

## Meeting Information:
Meeting Name: {meeting_name}
Meeting Date: {meeting_date}
Customer/District Name: {customer_name}
Meeting Owner: {meeting_owner}

## Meeting Transcript/Extracts:
{extracts}

## Participants (with participation status):
{participants}

Note: Participation status indicates whether each person actively spoke during the meeting:
- "participated" = Spoke during the meeting
- "invited" = Was on the invite but did not speak
- "n/a" = Status not determined

---

Generate comprehensive CRM meeting notes with these sections:

1. **Meeting Summary** (required):
   Format: "[date] call with [attendees] = [internal attendees]. [key_outcome_summary]. Next meeting [date]"

2. **Relationship Context** (optional):
   Personal details shared - hobbies, family, interests that help build authentic relationships

3. **Professional Context** (optional):
   Role, background, tenure, reporting structure, decision authority

4. **Success Metrics** (if discussed):
   What outcomes matter to this customer - time savings, retention, burnout reduction, etc.

5. **Platform Feedback**:
   - Positive: What they love about the product
   - Negative: Pain points and issues
   - Neutral: General observations about usage

6. **Feature Requests** (if any):
   Each with: request description, context, priority (P0-P3)

7. **Bugs and Issues** (if any):
   Each with: issue description, user who reported, status, workaround if known

8. **Missing Assessments** (if mentioned):
   Assessments they need that aren't currently supported

9. **Competitor Mentions** (if any):
   Any competing products mentioned with context and sentiment

10. **Contract and Budget** (if discussed):
    Renewal timeline, budget constraints, approval process

11. **Key Users and Influencers**:
    Important individuals - name, influence level, sentiment (champion/neutral/skeptic)

12. **Action Items**:
    Each with: owner, action, due date if known, status

13. **Next Meeting**:
    Date and purpose if scheduled

## Output Format:
Return a JSON object:
{
  "summary": "One-paragraph meeting summary",
  "sections": {
    "relationshipContext": "Personal details if shared",
    "professionalContext": "Role and background info",
    "successMetrics": ["metric1", "metric2"],
    "platformFeedback": {
      "positive": ["item1", "item2"],
      "negative": ["item1", "item2"],
      "neutral": ["item1", "item2"]
    },
    "featureRequests": [
      {
        "title": "Brief title",
        "description": "What they want",
        "context": "Why they need it",
        "userQuote": "Direct quote if available",
        "priority": "P0|P1|P2|P3",
        "labels": ["label1", "label2"]
      }
    ],
    "bugsAndIssues": [
      {
        "title": "Brief title",
        "issue": "What happened",
        "expected": "What should happen",
        "stepsToReproduce": ["step1", "step2"],
        "workaround": "Temporary fix if available",
        "severity": "Critical|High|Medium|Low"
      }
    ],
    "missingAssessments": ["assessment1", "assessment2"],
    "competitorMentions": ["Competitor - context and sentiment"],
    "contractAndBudget": "Budget and timeline info",
    "keyUsersAndInfluencers": ["Name - role - sentiment"],
    "actionItems": [
      {
        "owner": "Name",
        "action": "What needs to be done",
        "dueDate": "Date if known",
        "status": "pending|in_progress|completed"
      }
    ],
    "nextMeeting": "Date and purpose"
  }
}

Priority guidance:
- P0: Blocking adoption or causing churn risk
- P1: Requested by multiple customers or key accounts
- P2: Would improve experience for specific use cases
- P3: Nice to have, single customer request

Severity guidance:
- Critical: Platform unusable, data loss, or security issue
- High: Major feature broken, no workaround
- Medium: Feature impaired but workaround exists
- Low: Minor issue, cosmetic, or edge case

Return only valid JSON.`;

export interface CustomEmailPrompts {
  dealEmailPrompt?: string | null;
  customerEmailPrompt?: string | null;
}

export async function generateFollowUpEmail(
  meeting: Meeting,
  extracts: Extract[],
  customer: Customer | null,
  meetingOwner?: string,
  meetingParticipants?: MeetingParticipantInfo[],
  customPrompts?: CustomEmailPrompts,
  additionalInstructions?: string | null
): Promise<GeneratedEmail> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_FAST });

  // Format extracts for prompt
  const extractsText = extracts.length > 0
    ? extracts
        .filter((e) => !e.is_action_item)
        .map((e) => {
          let text = `- ${e.summary}`;
          if (e.participant_name) {
            text += ` (from ${e.participant_name})`;
          }
          if (e.quotes && e.quotes.length > 0) {
            text += `\n  Quote: "${e.quotes[0]}"`;
          }
          return text;
        })
        .join("\n")
    : "No specific insights recorded";

  // Format action items with participant info
  const actionItemsText = extracts.length > 0
    ? extracts
        .filter((e) => e.is_action_item)
        .map((e) => {
          let text = `- ${e.summary}`;
          if (e.participant_name) {
            text += ` (assigned to: ${e.participant_name})`;
          }
          return text;
        })
        .join("\n") || "No action items identified"
    : "No action items identified";

  // Build participants list with participation status
  const participants = formatParticipantsList(meeting, meetingParticipants, extracts);

  // Determine customer type and use appropriate prompt (custom or default)
  const customerType: CustomerType = customer?.customer_type || "customer";
  let prompt: string;
  if (customerType === "deal") {
    prompt = customPrompts?.dealEmailPrompt || DEAL_EMAIL_PROMPT;
  } else {
    prompt = customPrompts?.customerEmailPrompt || CUSTOMER_EMAIL_PROMPT;
  }

  let filledPrompt = prompt
    .replace("{meeting_name}", meeting.name || "Meeting")
    .replace("{meeting_date}", meeting.meeting_date?.toLocaleDateString() || "Recent")
    .replace("{customer_name}", customer?.name || "the team")
    .replace("{meeting_owner}", meetingOwner || "the team")
    .replace("{extracts}", extractsText)
    .replace("{action_items}", actionItemsText)
    .replace("{participants}", participants);
  if (additionalInstructions && additionalInstructions.trim()) {
    filledPrompt += `\n\n## Additional Instructions from User:\n${additionalInstructions.trim()}`;
  }
  const result = await model.generateContent(filledPrompt);
  const response = result.response.text();
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse email generation response");
  }
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    subject: parsed.subject || "Follow-up from our meeting",
    body: parsed.body || "",
  };
}

// Generate email summarizing action items
export async function generateActionItemsEmail(
  meeting: Meeting,
  extracts: Extract[],
  customer: Customer | null,
  meetingParticipants?: MeetingParticipantInfo[]
): Promise<GeneratedEmail> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_FAST });

  const actionItems = extracts.filter((e) => e.is_action_item);

  if (actionItems.length === 0) {
    return {
      subject: `Action Items - ${meeting.name || "Meeting"}`,
      body: "No action items were identified from this meeting.",
    };
  }

  const actionItemsText = actionItems
    .map((e, i) => {
      let text = `${i + 1}. ${e.summary}`;
      if (e.participant_name) {
        text += ` (Owner: ${e.participant_name})`;
      }
      return text;
    })
    .join("\n");

  // Build participants list from meeting record
  const participantsText = meetingParticipants && meetingParticipants.length > 0
    ? meetingParticipants
        .map((p) => p.email ? `${p.name} <${p.email}>` : p.name)
        .join(", ")
    : "Not specified";

  const prompt = `Generate a professional email summarizing the action items from a meeting.

Meeting: ${meeting.name || "Meeting"}
Date: ${meeting.meeting_date?.toLocaleDateString() || "Recent"}
Customer: ${customer?.name || "the team"}
Participants: ${participantsText}

Action Items:
${actionItemsText}

Generate a clear, organized email that:
1. Lists all action items with their owners
2. Groups by owner if multiple owners
3. Includes any deadlines if mentioned
4. Address the email to the participants by name
5. Ends with a note about follow-up

Return JSON format:
{
  "subject": "Email subject",
  "body": "Email body with \\n for line breaks"
}

Return only valid JSON.`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse action items email response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    subject: parsed.subject || `Action Items - ${meeting.name || "Meeting"}`,
    body: parsed.body || "",
  };
}

// Generate meeting notes summary email
export async function generateMeetingNotesEmail(
  meeting: Meeting,
  extracts: Extract[],
  customer: Customer | null,
  meetingParticipants?: MeetingParticipantInfo[]
): Promise<GeneratedEmail> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_FAST });

  const insightsText = extracts.length > 0
    ? extracts.map((e) => {
        let text = `- ${e.summary}`;
        if (e.participant_name) {
          text += ` (${e.participant_name})`;
        }
        return text;
      }).join("\n")
    : "No specific insights recorded";

  // Build participants list from meeting record
  const participantsText = meetingParticipants && meetingParticipants.length > 0
    ? meetingParticipants
        .map((p) => p.email ? `${p.name} <${p.email}>` : p.name)
        .join(", ")
    : "Not specified";

  const prompt = `Generate a professional email summarizing the key points from a meeting.

Meeting: ${meeting.name || "Meeting"}
Date: ${meeting.meeting_date?.toLocaleDateString() || "Recent"}
Customer: ${customer?.name || "the team"}
Participants: ${participantsText}

Key Points Discussed:
${insightsText}

Generate a clear, organized summary email that:
1. Captures the essence of the discussion
2. Groups related topics together
3. Highlights any decisions made
4. Notes any open questions
5. Address the email to the participants by name

Return JSON format:
{
  "subject": "Email subject",
  "body": "Email body with \\n for line breaks"
}

Return only valid JSON.`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse meeting notes email response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    subject: parsed.subject || `Meeting Notes - ${meeting.name || "Meeting"}`,
    body: parsed.body || "",
  };
}

// Generate CRM meeting notes for existing customers
export async function generateCRMNotes(
  meeting: Meeting,
  extracts: ExtractWithTags[],
  customer: Customer | null,
  meetingOwner?: string,
  meetingParticipants?: MeetingParticipantInfo[]
): Promise<GeneratedCRMNote> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_FAST });

  // Format extracts with all available info
  const extractsText = extracts.length > 0
    ? extracts.map((e) => {
        let text = `- ${e.summary}`;
        if (e.participant_name) {
          text += ` (${e.participant_name})`;
        }
        if (e.quotes && e.quotes.length > 0) {
          text += `\n  Quotes: ${e.quotes.map(q => `"${q}"`).join("; ")}`;
        }
        if (e.tags && e.tags.length > 0) {
          text += `\n  Tags: ${e.tags.map(t => t.name).join(", ")}`;
        }
        if (e.is_action_item) {
          text += "\n  [ACTION ITEM]";
        }
        return text;
      }).join("\n\n")
    : "No extracts available";

  // Build participants list with participation status
  const participants = formatParticipantsList(meeting, meetingParticipants, extracts);

  const filledPrompt = CRM_NOTES_PROMPT
    .replace("{meeting_name}", meeting.name || "Meeting")
    .replace("{meeting_date}", meeting.meeting_date?.toLocaleDateString() || "Recent")
    .replace("{customer_name}", customer?.name || "Customer")
    .replace("{meeting_owner}", meetingOwner || "Team")
    .replace("{extracts}", extractsText)
    .replace("{participants}", participants);

  const result = await model.generateContent(filledPrompt);
  const response = result.response.text();

  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse CRM notes response");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Add customer and meeting context to feature requests and bugs
  const customerName = customer?.name || "Unknown Customer";
  const meetingDate = meeting.meeting_date?.toLocaleDateString() || "Unknown Date";

  if (parsed.sections?.featureRequests) {
    parsed.sections.featureRequests = parsed.sections.featureRequests.map((fr: Partial<FeatureRequestData>) => ({
      ...fr,
      customerName,
      meetingDate,
      contactName: fr.contactName || "Unknown",
    }));
  }

  if (parsed.sections?.bugsAndIssues) {
    parsed.sections.bugsAndIssues = parsed.sections.bugsAndIssues.map((bug: Partial<BugReportData>) => ({
      ...bug,
      customerName,
      reportDate: meetingDate,
      reporterName: bug.reporterName || "Unknown",
    }));
  }

  return {
    summary: parsed.summary || "",
    sections: parsed.sections || {},
  };
}

// Extract feature requests from CRM notes for Linear ticket creation
export function extractFeatureRequests(crmNotes: GeneratedCRMNote): FeatureRequestData[] {
  return crmNotes.sections.featureRequests || [];
}

// Extract bug reports from CRM notes for Linear ticket creation
export function extractBugReports(crmNotes: GeneratedCRMNote): BugReportData[] {
  return crmNotes.sections.bugsAndIssues || [];
}

// Prompt for generating meeting notes summary (for user_notes field, not email)
const MEETING_NOTES_SUMMARY_PROMPT = `Generate a concise meeting notes summary based on the extracted insights from this meeting.

## Meeting Information:
Meeting Name: {meeting_name}
Meeting Date: {meeting_date}
Meeting Link: {meeting_url}
Customer/Company: {customer_name}
Meeting Host: {meeting_owner}

## Participants (with participation status):
{participants}

Note: Participation status indicates whether each person actively spoke during the meeting:
- "participated" = Spoke during the meeting
- "invited" = Was on the invite but did not speak
- "n/a" = Status not determined

## Key Insights and Extracts:
{extracts}

## Action Items:
{action_items}

---

Generate a clean, well-organized meeting notes summary that includes:

1. **Summary** (1-2 sentences describing the purpose and outcome of the meeting)

2. **Attendees** (list of participants with their emails and participation status - note who actually spoke vs who was only invited)

3. **Key Discussion Points** (bullet points of main topics covered)

4. **Decisions Made** (any agreements or decisions reached)

5. **Action Items** (numbered list with owner if known)

6. **Next Steps** (what happens next, including any follow-up meetings scheduled)

Format the output as plain text with clear section headers. Use markdown-style headers (##) and bullet points (-) for readability.

Return ONLY the meeting notes text, no JSON wrapping.`;

// Export default prompts for user customization
export const DEFAULT_DEAL_EMAIL_PROMPT = DEAL_EMAIL_PROMPT;
export const DEFAULT_CUSTOMER_EMAIL_PROMPT = CUSTOMER_EMAIL_PROMPT;
export const DEFAULT_NOTES_PROMPT = MEETING_NOTES_SUMMARY_PROMPT;

export interface MeetingParticipantInfo {
  name: string;
  email: string | null;
  participation_status?: ParticipationStatus;
}

/**
 * Generate meeting notes summary to add to the meeting's user_notes field
 * This is different from email generation - it produces plain text notes
 */
export async function generateMeetingNotesSummary(
  meeting: Meeting,
  extracts: Extract[],
  customer: Customer | null,
  meetingOwner?: string,
  meetingParticipants?: MeetingParticipantInfo[],
  customNotesPrompt?: string | null,
  additionalInstructions?: string | null
): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_FAST });

  // Format extracts (non-action items)
  const extractsText = extracts.length > 0
    ? extracts
        .filter((e) => !e.is_action_item)
        .map((e) => {
          let text = `- ${e.summary}`;
          if (e.participant_name) {
            text += ` (from ${e.participant_name})`;
          }
          if (e.quotes && e.quotes.length > 0) {
            text += `\n  Quote: "${e.quotes[0]}"`;
          }
          return text;
        })
        .join("\n")
    : "No specific insights recorded";

  // Format action items
  const actionItemsText = extracts.length > 0
    ? extracts
        .filter((e) => e.is_action_item)
        .map((e, i) => {
          let text = `${i + 1}. ${e.summary}`;
          if (e.participant_name) {
            text += ` (Owner: ${e.participant_name})`;
          }
          return text;
        })
        .join("\n") || "No action items identified"
    : "No action items identified";

  // Build participants list with participation status
  const participantsText = formatParticipantsList(meeting, meetingParticipants, extracts)
    .split("\n")
    .map((line) => line.startsWith("-") ? line : `- ${line}`)
    .join("\n") || "No external participants identified";

  // Use custom prompt if provided, otherwise use default
  const promptTemplate = customNotesPrompt || MEETING_NOTES_SUMMARY_PROMPT;
  let filledPrompt = promptTemplate
    .replace("{meeting_name}", meeting.name || "Meeting")
    .replace("{meeting_date}", meeting.meeting_date?.toLocaleDateString() || "Recent")
    .replace("{meeting_url}", meeting.meeting_url || meeting.recording_url || "Not available")
    .replace("{customer_name}", customer?.name || "Not specified")
    .replace("{meeting_owner}", meetingOwner || meeting.host_name || "Not specified")
    .replace("{participants}", participantsText)
    .replace("{extracts}", extractsText)
    .replace("{action_items}", actionItemsText);
  if (additionalInstructions && additionalInstructions.trim()) {
    filledPrompt += `\n\n## Additional Instructions from User:\n${additionalInstructions.trim()}`;
  }
  const result = await model.generateContent(filledPrompt);
  const response = result.response.text();
  return response.trim();
}
