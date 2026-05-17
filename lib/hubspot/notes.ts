import { hubspotRequest, isHubSpotConfigured } from "./client";
import type { GeneratedCRMNote } from "@/lib/gemini/email-generation";

interface HubSpotNoteResult {
  id: string;
}

export interface CreateNoteOptions {
  companyId?: string;
  dealId?: string;
  contactIds?: string[];
}

/**
 * Create a note in HubSpot associated with a company, deal, or contacts
 */
export async function createHubSpotNote(
  noteBody: string,
  options: CreateNoteOptions = {}
): Promise<HubSpotNoteResult | null> {
  if (!isHubSpotConfigured()) {
    console.warn("HubSpot is not configured");
    return null;
  }

  const { companyId, dealId, contactIds = [] } = options;

  // Build associations
  const associations: Array<{
    to: { id: string };
    types: Array<{ associationCategory: string; associationTypeId: number }>;
  }> = [];

  // Associate with company (association type 190 for note to company)
  if (companyId) {
    associations.push({
      to: { id: companyId },
      types: [
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: 190, // Note to company
        },
      ],
    });
  }

  // Associate with deal (association type 214 for note to deal)
  if (dealId) {
    associations.push({
      to: { id: dealId },
      types: [
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: 214, // Note to deal
        },
      ],
    });
  }

  // Associate with contacts (association type 202 for note to contact)
  for (const contactId of contactIds) {
    associations.push({
      to: { id: contactId },
      types: [
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: 202, // Note to contact
        },
      ],
    });
  }

  try {
    const result = await hubspotRequest<HubSpotNoteResult>(
      "/crm/v3/objects/notes",
      {
        method: "POST",
        body: {
          properties: {
            hs_note_body: noteBody,
            hs_timestamp: new Date().toISOString(),
          },
          associations: associations.length > 0 ? associations : undefined,
        },
      }
    );

    return result;
  } catch (error) {
    console.error("Error creating HubSpot note:", error);
    return null;
  }
}

/**
 * Format CRM notes into a HubSpot-compatible note body
 */
export function formatCRMNotesForHubSpot(
  crmNotes: GeneratedCRMNote,
  meetingName: string,
  meetingDate: string
): string {
  const parts: string[] = [
    `📅 Meeting: ${meetingName}`,
    `📆 Date: ${meetingDate}`,
    "",
    "---",
    "",
    `📝 Summary`,
    crmNotes.summary || "No summary available",
    "",
  ];

  const sections = crmNotes.sections;

  // Relationship Context
  if (sections.relationshipContext) {
    parts.push(
      "👤 Relationship Context",
      sections.relationshipContext,
      ""
    );
  }

  // Professional Context
  if (sections.professionalContext) {
    parts.push(
      "💼 Professional Context",
      sections.professionalContext,
      ""
    );
  }

  // Success Metrics
  if (sections.successMetrics && sections.successMetrics.length > 0) {
    parts.push(
      "📊 Success Metrics",
      ...sections.successMetrics.map((m) => `• ${m}`),
      ""
    );
  }

  // Platform Feedback
  if (sections.platformFeedback) {
    const feedback = sections.platformFeedback;

    if (feedback.positive && feedback.positive.length > 0) {
      parts.push(
        "✅ Positive Feedback",
        ...feedback.positive.map((f) => `• ${f}`),
        ""
      );
    }

    if (feedback.negative && feedback.negative.length > 0) {
      parts.push(
        "⚠️ Negative Feedback / Pain Points",
        ...feedback.negative.map((f) => `• ${f}`),
        ""
      );
    }

    if (feedback.neutral && feedback.neutral.length > 0) {
      parts.push(
        "ℹ️ Observations",
        ...feedback.neutral.map((f) => `• ${f}`),
        ""
      );
    }
  }

  // Feature Requests
  if (sections.featureRequests && sections.featureRequests.length > 0) {
    parts.push(
      "💡 Feature Requests",
      ...sections.featureRequests.map(
        (fr) => `• [${fr.priority}] ${fr.title}: ${fr.description}`
      ),
      ""
    );
  }

  // Bugs and Issues
  if (sections.bugsAndIssues && sections.bugsAndIssues.length > 0) {
    parts.push(
      "🐛 Bugs/Issues Reported",
      ...sections.bugsAndIssues.map(
        (bug) => `• [${bug.severity}] ${bug.title}: ${bug.issue}`
      ),
      ""
    );
  }

  // Missing Assessments
  if (sections.missingAssessments && sections.missingAssessments.length > 0) {
    parts.push(
      "📋 Missing Assessments",
      ...sections.missingAssessments.map((a) => `• ${a}`),
      ""
    );
  }

  // Competitor Mentions
  if (sections.competitorMentions && sections.competitorMentions.length > 0) {
    parts.push(
      "🏢 Competitor Mentions",
      ...sections.competitorMentions.map((c) => `• ${c}`),
      ""
    );
  }

  // Contract and Budget
  if (sections.contractAndBudget) {
    parts.push(
      "💰 Contract & Budget",
      sections.contractAndBudget,
      ""
    );
  }

  // Key Users and Influencers
  if (sections.keyUsersAndInfluencers && sections.keyUsersAndInfluencers.length > 0) {
    parts.push(
      "👥 Key Users & Influencers",
      ...sections.keyUsersAndInfluencers.map((u) => `• ${u}`),
      ""
    );
  }

  // Action Items
  if (sections.actionItems && sections.actionItems.length > 0) {
    parts.push(
      "✅ Action Items",
      ...sections.actionItems.map(
        (item) =>
          `• [${item.status}] ${item.owner}: ${item.action}${item.dueDate ? ` (Due: ${item.dueDate})` : ""}`
      ),
      ""
    );
  }

  // Next Meeting
  if (sections.nextMeeting) {
    parts.push(
      "📅 Next Meeting",
      sections.nextMeeting,
      ""
    );
  }

  return parts.join("\n");
}

/**
 * Write meeting CRM notes to HubSpot
 */
export async function writeMeetingNotesToHubSpot(
  crmNotes: GeneratedCRMNote,
  meetingName: string,
  meetingDate: string,
  options: CreateNoteOptions = {}
): Promise<HubSpotNoteResult | null> {
  const noteBody = formatCRMNotesForHubSpot(crmNotes, meetingName, meetingDate);
  return createHubSpotNote(noteBody, options);
}
