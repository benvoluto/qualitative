import { getGeminiClient, GEMINI_MODEL } from "./client";
import { extractRules, tags } from "@/lib/db";

// Prompt for generating extraction rules from transcript + notes pairs
const GENERATE_RULES_PROMPT = `You are a knowledge engineer working to learn how to extract useful insights from customer calls and meetings.

Given the following meeting transcript and human-written notes, analyze them to create extraction rules that can be used to automatically extract similar insights from future meetings.

For each insight in the notes, find the corresponding quote in the transcript and create a rule.

## Rules to Follow:
1. Every rule must be based on actual content from the transcript
2. Focus on business processes, software discussions, reactions, and opinions
3. Each rule should have a clear, concise summary (under 256 characters)
4. Identify if the extract represents an action item

## Output Format:
Return a JSON array of extraction rules with this structure:
{
  "rules": [
    {
      "name": "Short name for the rule type",
      "summary": "Brief description of what this rule extracts",
      "example_quotes": ["Exact quote from transcript that matches this rule"],
      "tags": ["relevant_tag_1", "relevant_tag_2"],
      "is_action_item": false
    }
  ]
}

## Available Tags:
feature_request, user_confusion, document_tracking_issues, reporting, user_interface_issue, login_issues, missing_data, search_issues, help_desk_tickets, template_needs, organizational_structure, deployment_strategy, billing_issues, positive_feedback, negative_feedback, user_support, parse_accuracy, data_accuracy, troubleshooting, onboarding, integration_issues, reporting_process, policy_enforcement, workflow_process, best_practices, client_management, workflow_changes, deal_timeframes, deployment_issues, deployment_timeframe, product_feedback, bug_reports, training_requests, app_performance_issues

---

## Transcript:
{transcript}

---

## Human Notes:
{notes}

---

Generate the extraction rules based on the above. Return only valid JSON.`;

// Prompt for extracting insights from a transcript using existing rules
const EXTRACT_INSIGHTS_PROMPT = `You are analyzing a meeting transcript to extract insights based on established extraction rules.

## Extraction Rules:
{rules}

## Available Tags (use ONLY these exact tag names):
{available_tags}

## Known Companies/Organizations:
{companies}

## Transcript:
{transcript}

---

For each relevant insight found in the transcript, create an extract. Focus on:
- Feature requests and product feedback (what they want, use case, current workaround)
- Bug reports (issue description, affected user, assessment type, steps to reproduce)
- User reactions, feedback, and opinions (capture direct quotes when sentiment is strong)
- Action items and next steps (with specific dates and owners when available)
- Issues, confusion, or pain points
- Professional background (career history, years in role, education)
- Personal details that humanize the relationship (family, hobbies, life events)
- Competitor/vendor mentions (product name, usage, sentiment, specific feedback)
- District connections and referral opportunities
- Contract approval process and procurement requirements
- Staffing challenges (vacancies, retention, talent quality)
- Upcoming events (conferences, trainings, team meetings)
- Budget details and timeline

## Extraction Best Practices:
- Capture direct quotes when sentiment is strong - use quotation marks
- Note uncertainty with qualifiers: "mentioned", "suggested", "seemed to indicate"
- For bug reports: include user name, assessment type, and reproduction steps if available
- For feature requests: include the use case and current workaround
- Cross-reference mentions of other districts/contacts for connection opportunities
- Distinguish between confirmed facts and impressions/interpretations

## Key Phrases to Listen For:
- Career: "years in role", "used to be", "before this", "started as", "background in"
- Budget: "budget", "funding", "can afford", "allocated", "fiscal year"
- Approval: "board approval", "procurement", "threshold", "sign off"
- Connections: "knows", "connected to", "can introduce", "you should talk to"
- Competitors: "also using", "tried", "compared to", "switched from"
- Events: "conference", "training", "team meeting", "coming up"
- Features: "would be nice if", "wish it could", "can you add", "we need"

IMPORTANT RULES:
1. "matched_rule" must be the EXACT rule name from the Extraction Rules list above (e.g., "Feature Request", "Workflow Process")
2. "tags" must contain 1-4 tags from the Available Tags list above - use the exact snake_case format (e.g., "feature_request", "workflow_process")
3. Do NOT use rule names as tags - they are different concepts
4. For each extract, identify the participant who made the statement:
   - "participant_name" should be the person's name from the transcript (if identifiable)
   - "participant_email" should be their email if mentioned in the transcript
5. If a company/organization from the Known Companies list is mentioned or associated with this insight, include it in "company_name"

## Output Format:
Return a JSON array of extracts:
{
  "extracts": [
    {
      "summary": "Brief summary of the insight (under 256 characters)",
      "quotes": ["Exact quote from transcript"],
      "tags": ["snake_case_tag_1", "snake_case_tag_2"],
      "matched_rule": "Exact Rule Name From List",
      "is_action_item": false,
      "participant_name": "Speaker Name or null",
      "participant_email": "email@example.com or null",
      "company_name": "Company Name from Known Companies list or null"
    }
  ]
}

Return only valid JSON.`;

interface GeneratedRule {
  name: string;
  summary: string;
  example_quotes: string[];
  tags: string[];
  is_action_item: boolean;
}

export interface GeneratedExtract {
  summary: string;
  quotes: string[];
  tags: string[];
  matched_rule: string | null;
  is_action_item: boolean;
  participant_name: string | null;
  participant_email: string | null;
  company_name: string | null;
}

// Generate extraction rules from a transcript + notes pair
export async function generateExtractionRules(
  transcript: string,
  notes: string
): Promise<GeneratedRule[]> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = GENERATE_RULES_PROMPT
    .replace("{transcript}", transcript)
    .replace("{notes}", notes);

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse extraction rules response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.rules || [];
}

// Save generated rules to database
export async function saveGeneratedRules(accountId: string, rules: GeneratedRule[]): Promise<string[]> {
  const savedIds: string[] = [];

  for (const rule of rules) {
    const savedRule = await extractRules.createExtractRule(accountId, {
      name: rule.name,
      summary: rule.summary,
      quotes: rule.example_quotes,
      action_items: rule.is_action_item ? ["Action item identified"] : [],
      is_active: true,
    });

    for (const tagName of rule.tags) {
      const tag = await tags.getOrCreateTag(accountId, tagName, "system");
      await extractRules.addExtractRuleTag(accountId, savedRule.id, tag.id);
    }

    savedIds.push(savedRule.id);
  }

  return savedIds;
}

export interface CompanyInfo {
  name: string;
  id: string;
}

// Extract insights from a transcript using existing rules
export async function extractInsightsFromTranscript(
  accountId: string,
  transcript: string,
  companies: CompanyInfo[] = []
): Promise<GeneratedExtract[]> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const activeRules = await extractRules.getActiveExtractRules(accountId);

  if (activeRules.length === 0) {
    return extractWithDefaultRules(transcript, companies);
  }

  const allTags = await tags.getTags(accountId);
  const tagNames = allTags.map((t) => t.name).join(", ");

  // Format rules for prompt
  const rulesText = activeRules
    .map((r) => `- ${r.name}: ${r.summary}`)
    .join("\n");

  // Format companies for prompt
  const companiesText = companies.length > 0
    ? companies.map((c) => `- ${c.name}`).join("\n")
    : "No known companies provided";

  const prompt = EXTRACT_INSIGHTS_PROMPT
    .replace("{rules}", rulesText)
    .replace("{available_tags}", tagNames)
    .replace("{companies}", companiesText)
    .replace("{transcript}", transcript);

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse extraction response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.extracts || [];
}

// Default extraction when no rules exist
async function extractWithDefaultRules(transcript: string, companies: CompanyInfo[] = []): Promise<GeneratedExtract[]> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const companiesText = companies.length > 0
    ? companies.map((c) => `- ${c.name}`).join("\n")
    : "No known companies provided";

  const prompt = `Analyze this meeting transcript and extract key insights.

## Known Companies/Organizations:
${companiesText}

## Transcript:
${transcript}

---

Extract insights focusing on:
- Feature requests and product feedback
- User issues, confusion, or pain points
- Action items and next steps
- Positive and negative feedback
- Process discussions

For each extract, identify:
- The participant who made the statement (name and email if available)
- The company from the Known Companies list if mentioned or associated

## Output Format:
Return a JSON array:
{
  "extracts": [
    {
      "summary": "Brief summary (under 256 chars)",
      "quotes": ["Exact quote from transcript"],
      "tags": ["relevant_tag"],
      "is_action_item": false,
      "participant_name": "Speaker Name or null",
      "participant_email": "email@example.com or null",
      "company_name": "Company Name from Known Companies list or null"
    }
  ]
}

Available tags: feature_request, user_confusion, positive_feedback, negative_feedback, bug_reports, action_item, process_discussion, product_feedback

Return only valid JSON.`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return [];
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.extracts || [];
}
