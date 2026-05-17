import { LinearClient } from "@linear/sdk";

let linearClient: LinearClient | null = null;

export function getLinearClient(): LinearClient {
  if (!linearClient) {
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) {
      throw new Error("LINEAR_API_KEY environment variable is not set");
    }
    linearClient = new LinearClient({ apiKey });
  }
  return linearClient;
}

// Check if Linear is configured
export function isLinearConfigured(): boolean {
  return !!process.env.LINEAR_API_KEY;
}

// Get the default team ID for creating issues
export async function getDefaultTeamId(): Promise<string | null> {
  const teamId = process.env.LINEAR_TEAM_ID;
  if (teamId) {
    return teamId;
  }

  // If no team ID is configured, try to get the first team
  try {
    const client = getLinearClient();
    const teams = await client.teams();
    if (teams.nodes.length > 0) {
      return teams.nodes[0].id;
    }
  } catch (error) {
    console.error("Error fetching Linear teams:", error);
  }

  return null;
}

// Get available labels for the team
export async function getTeamLabels(teamId: string): Promise<Map<string, string>> {
  const client = getLinearClient();
  const labelMap = new Map<string, string>();

  try {
    const team = await client.team(teamId);
    const labels = await team.labels();

    for (const label of labels.nodes) {
      labelMap.set(label.name.toLowerCase(), label.id);
    }
  } catch (error) {
    console.error("Error fetching Linear labels:", error);
  }

  return labelMap;
}

// Get or create a label
export async function getOrCreateLabel(
  teamId: string,
  labelName: string,
  labelMap: Map<string, string>
): Promise<string | null> {
  const normalizedName = labelName.toLowerCase();

  // Check if label already exists
  if (labelMap.has(normalizedName)) {
    return labelMap.get(normalizedName) || null;
  }

  // Create the label
  try {
    const client = getLinearClient();
    const result = await client.createIssueLabel({
      teamId,
      name: labelName,
    });

    const label = await result.issueLabel;
    if (label) {
      labelMap.set(normalizedName, label.id);
      return label.id;
    }
  } catch (error) {
    console.error(`Error creating Linear label "${labelName}":`, error);
  }

  return null;
}
