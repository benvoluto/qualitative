import {
  getLinearClient,
  getDefaultTeamId,
  getTeamLabels,
  getOrCreateLabel,
  isLinearConfigured,
} from "./client";
import type { FeatureRequestData, BugReportData } from "@/lib/gemini/email-generation";

export interface CreatedTicket {
  id: string;
  identifier: string;
  title: string;
  url: string;
}

export interface TicketCreationResult {
  success: boolean;
  ticket?: CreatedTicket;
  error?: string;
}

// Priority mapping from our format to Linear priority (1-4, where 1 is urgent)
const PRIORITY_MAP: Record<string, number> = {
  P0: 1, // Urgent
  P1: 2, // High
  P2: 3, // Medium
  P3: 4, // Low
};

// Severity to priority mapping for bugs
const SEVERITY_TO_PRIORITY: Record<string, number> = {
  Critical: 1,
  High: 2,
  Medium: 3,
  Low: 4,
};

/**
 * Create a feature request ticket in Linear
 */
export async function createFeatureRequestTicket(
  data: FeatureRequestData,
  hubspotLink?: string
): Promise<TicketCreationResult> {
  if (!isLinearConfigured()) {
    return {
      success: false,
      error: "Linear is not configured. Set LINEAR_API_KEY environment variable.",
    };
  }

  try {
    const client = getLinearClient();
    const teamId = await getDefaultTeamId();

    if (!teamId) {
      return {
        success: false,
        error: "No Linear team found. Set LINEAR_TEAM_ID or ensure at least one team exists.",
      };
    }

    // Build the description
    const descriptionParts = [
      `**Request:** ${data.description}`,
      "",
      `**Context:** ${data.context}`,
      "",
      `**Use Case:** ${data.description}`,
    ];

    if (data.userQuote) {
      descriptionParts.push("", `**Customer Quote:** "${data.userQuote}"`);
    }

    descriptionParts.push(
      "",
      "---",
      "",
      "**Source:**",
      `- Customer: ${data.customerName}`,
      `- Contact: ${data.contactName}`,
      `- Meeting Date: ${data.meetingDate}`
    );

    if (hubspotLink) {
      descriptionParts.push(`- HubSpot: ${hubspotLink}`);
    }

    const description = descriptionParts.join("\n");

    // Get labels
    const labelMap = await getTeamLabels(teamId);
    const labelIds: string[] = [];

    // Add "feature-request" label if available
    const featureRequestLabelId = await getOrCreateLabel(teamId, "feature-request", labelMap);
    if (featureRequestLabelId) {
      labelIds.push(featureRequestLabelId);
    }

    // Add custom labels from the data
    for (const labelName of data.labels) {
      const labelId = await getOrCreateLabel(teamId, labelName, labelMap);
      if (labelId) {
        labelIds.push(labelId);
      }
    }

    // Create the issue
    const result = await client.createIssue({
      teamId,
      title: `[Feature Request] ${data.title}`,
      description,
      priority: PRIORITY_MAP[data.priority] || 3,
      labelIds: labelIds.length > 0 ? labelIds : undefined,
    });

    const issue = await result.issue;
    if (!issue) {
      return {
        success: false,
        error: "Failed to create issue - no issue returned",
      };
    }

    return {
      success: true,
      ticket: {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        url: issue.url,
      },
    };
  } catch (error) {
    console.error("Error creating feature request ticket:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error creating ticket",
    };
  }
}

/**
 * Create a bug report ticket in Linear
 */
export async function createBugReportTicket(
  data: BugReportData,
  hubspotLink?: string
): Promise<TicketCreationResult> {
  if (!isLinearConfigured()) {
    return {
      success: false,
      error: "Linear is not configured. Set LINEAR_API_KEY environment variable.",
    };
  }

  try {
    const client = getLinearClient();
    const teamId = await getDefaultTeamId();

    if (!teamId) {
      return {
        success: false,
        error: "No Linear team found. Set LINEAR_TEAM_ID or ensure at least one team exists.",
      };
    }

    // Build the description
    const descriptionParts = [
      `**Issue:** ${data.issue}`,
      "",
      `**Expected:** ${data.expected}`,
    ];

    if (data.stepsToReproduce && data.stepsToReproduce.length > 0) {
      descriptionParts.push(
        "",
        "**Steps to Reproduce:**",
        ...data.stepsToReproduce.map((step, i) => `${i + 1}. ${step}`)
      );
    }

    if (data.workaround) {
      descriptionParts.push("", `**Workaround:** ${data.workaround}`);
    }

    descriptionParts.push(
      "",
      "---",
      "",
      "**Source:**",
      `- Customer: ${data.customerName}`,
      `- Reporter: ${data.reporterName}`,
      `- Report Date: ${data.reportDate}`
    );

    if (hubspotLink) {
      descriptionParts.push(`- HubSpot: ${hubspotLink}`);
    }

    const description = descriptionParts.join("\n");

    // Get labels
    const labelMap = await getTeamLabels(teamId);
    const labelIds: string[] = [];

    // Add "bug" label if available
    const bugLabelId = await getOrCreateLabel(teamId, "bug", labelMap);
    if (bugLabelId) {
      labelIds.push(bugLabelId);
    }

    // Create the issue
    const result = await client.createIssue({
      teamId,
      title: `[Bug] ${data.title}`,
      description,
      priority: SEVERITY_TO_PRIORITY[data.severity] || 3,
      labelIds: labelIds.length > 0 ? labelIds : undefined,
    });

    const issue = await result.issue;
    if (!issue) {
      return {
        success: false,
        error: "Failed to create issue - no issue returned",
      };
    }

    return {
      success: true,
      ticket: {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        url: issue.url,
      },
    };
  } catch (error) {
    console.error("Error creating bug report ticket:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error creating ticket",
    };
  }
}

/**
 * Create multiple feature request tickets
 */
export async function createFeatureRequestTickets(
  requests: FeatureRequestData[],
  hubspotLink?: string
): Promise<TicketCreationResult[]> {
  const results: TicketCreationResult[] = [];

  for (const request of requests) {
    const result = await createFeatureRequestTicket(request, hubspotLink);
    results.push(result);
  }

  return results;
}

/**
 * Create multiple bug report tickets
 */
export async function createBugReportTickets(
  bugs: BugReportData[],
  hubspotLink?: string
): Promise<TicketCreationResult[]> {
  const results: TicketCreationResult[] = [];

  for (const bug of bugs) {
    const result = await createBugReportTicket(bug, hubspotLink);
    results.push(result);
  }

  return results;
}
