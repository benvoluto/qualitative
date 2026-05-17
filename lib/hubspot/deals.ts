// HubSpot Deals API integration

import { hubspotRequest, isHubSpotConfigured } from "./client";

interface HubSpotDealProperties {
  dealname?: string;
  dealstage?: string;
  pipeline?: string;
  amount?: string;
  closedate?: string;
  createdate?: string;
  hs_lastmodifieddate?: string;
  hs_object_id?: string;
  hubspot_owner_id?: string;
  description?: string;
  notes_last_updated?: string;
}

interface HubSpotDeal {
  id: string;
  properties: HubSpotDealProperties;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

interface HubSpotDealsResponse {
  results: HubSpotDeal[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

interface HubSpotSearchResponse {
  total: number;
  results: HubSpotDeal[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

// Properties to request from the API
const DEAL_PROPERTIES = [
  "dealname",
  "dealstage",
  "pipeline",
  "amount",
  "closedate",
  "createdate",
  "hs_lastmodifieddate",
  "hubspot_owner_id",
  "description",
  "notes_last_updated",
];

export interface HubSpotDealData {
  id: string;
  name: string | null;
  stage: string | null;
  pipeline: string | null;
  amount: number | null;
  closeDate: Date | null;
  description: string | null;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function parseHubSpotDeal(deal: HubSpotDeal): HubSpotDealData {
  const props = deal.properties;

  return {
    id: deal.id,
    name: props.dealname || null,
    stage: props.dealstage || null,
    pipeline: props.pipeline || null,
    amount: props.amount ? parseFloat(props.amount) : null,
    closeDate: props.closedate ? new Date(props.closedate) : null,
    description: props.description || null,
    ownerId: props.hubspot_owner_id || null,
    createdAt: new Date(deal.createdAt),
    updatedAt: new Date(deal.updatedAt),
  };
}

/**
 * Fetch all deals from HubSpot
 */
export async function fetchAllHubSpotDeals(): Promise<HubSpotDealData[]> {
  if (!isHubSpotConfigured()) {
    throw new Error("HubSpot is not configured");
  }

  const allDeals: HubSpotDeal[] = [];
  let after: string | undefined;

  do {
    const params: Record<string, string> = {
      limit: "100",
      properties: DEAL_PROPERTIES.join(","),
    };

    if (after) {
      params.after = after;
    }

    const response = await hubspotRequest<HubSpotDealsResponse>(
      "/crm/v3/objects/deals",
      { params }
    );

    allDeals.push(...response.results);
    after = response.paging?.next?.after;
  } while (after);

  return allDeals.map(parseHubSpotDeal);
}

/**
 * Fetch a single deal by ID
 */
export async function fetchHubSpotDealById(dealId: string): Promise<HubSpotDealData | null> {
  if (!isHubSpotConfigured()) {
    throw new Error("HubSpot is not configured");
  }

  try {
    const deal = await hubspotRequest<HubSpotDeal>(
      `/crm/v3/objects/deals/${dealId}`,
      {
        params: {
          properties: DEAL_PROPERTIES.join(","),
        },
      }
    );

    return parseHubSpotDeal(deal);
  } catch (error) {
    console.error(`Failed to fetch HubSpot deal ${dealId}:`, error);
    return null;
  }
}

/**
 * Get company IDs associated with a deal
 */
export async function getHubSpotDealCompanies(dealId: string): Promise<string[]> {
  if (!isHubSpotConfigured()) {
    throw new Error("HubSpot is not configured");
  }

  try {
    const associations = await hubspotRequest<{
      results: Array<{ id: string; type: string }>;
    }>(`/crm/v3/objects/deals/${dealId}/associations/companies`);

    return associations.results.map((a) => a.id);
  } catch {
    // Deal may not have company associations
    return [];
  }
}

/**
 * Get deals associated with meetings from the last N days
 */
export async function getDealsWithRecentMeetings(days: number = 180): Promise<HubSpotDealData[]> {
  if (!isHubSpotConfigured()) {
    throw new Error("HubSpot is not configured");
  }

  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // First, get all meetings from the time period
  const meetingsResponse = await hubspotRequest<{
    total: number;
    results: Array<{ id: string }>;
    paging?: { next?: { after: string } };
  }>("/crm/v3/objects/meetings/search", {
    method: "POST",
    body: {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "hs_meeting_start_time",
              operator: "GTE",
              value: startDate.getTime().toString(),
            },
          ],
        },
      ],
      limit: 100,
    },
  });

  if (meetingsResponse.results.length === 0) {
    return [];
  }

  // Get unique deal IDs from meeting associations
  const dealIds = new Set<string>();

  for (const meeting of meetingsResponse.results) {
    try {
      const associations = await hubspotRequest<{
        results: Array<{ id: string; type: string }>;
      }>(`/crm/v3/objects/meetings/${meeting.id}/associations/deals`);

      for (const assoc of associations.results) {
        dealIds.add(assoc.id);
      }
    } catch {
      // Skip meetings without deal associations
    }
  }

  if (dealIds.size === 0) {
    return [];
  }

  // Batch fetch deal details
  const dealIdArray = Array.from(dealIds);
  const deals: HubSpotDealData[] = [];

  // Batch in groups of 100
  for (let i = 0; i < dealIdArray.length; i += 100) {
    const batch = dealIdArray.slice(i, i + 100);

    const batchResponse = await hubspotRequest<HubSpotDealsResponse>(
      "/crm/v3/objects/deals/batch/read",
      {
        method: "POST",
        body: {
          inputs: batch.map((id) => ({ id })),
          properties: DEAL_PROPERTIES,
        },
      }
    );

    deals.push(...batchResponse.results.map(parseHubSpotDeal));
  }

  return deals;
}

/**
 * Search deals by name
 */
export async function searchHubSpotDeals(query: string): Promise<HubSpotDealData[]> {
  if (!isHubSpotConfigured()) {
    throw new Error("HubSpot is not configured");
  }

  const response = await hubspotRequest<HubSpotSearchResponse>(
    "/crm/v3/objects/deals/search",
    {
      method: "POST",
      body: {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "dealname",
                operator: "CONTAINS_TOKEN",
                value: query,
              },
            ],
          },
        ],
        properties: DEAL_PROPERTIES,
        limit: 50,
      },
    }
  );

  return response.results.map(parseHubSpotDeal);
}

/**
 * Get deals by pipeline stage (e.g., open deals, closed won)
 */
export async function getHubSpotDealsByStage(stage: string): Promise<HubSpotDealData[]> {
  if (!isHubSpotConfigured()) {
    throw new Error("HubSpot is not configured");
  }

  const response = await hubspotRequest<HubSpotSearchResponse>(
    "/crm/v3/objects/deals/search",
    {
      method: "POST",
      body: {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "dealstage",
                operator: "EQ",
                value: stage,
              },
            ],
          },
        ],
        properties: DEAL_PROPERTIES,
        limit: 100,
      },
    }
  );

  return response.results.map(parseHubSpotDeal);
}

/**
 * Get open (non-closed) deals
 */
export async function getOpenHubSpotDeals(): Promise<HubSpotDealData[]> {
  if (!isHubSpotConfigured()) {
    throw new Error("HubSpot is not configured");
  }

  // Get all deals and filter out closed ones
  // HubSpot deal stages vary by pipeline, but typically closed stages end with "won" or "lost"
  const allDeals = await fetchAllHubSpotDeals();

  return allDeals.filter((deal) => {
    const stage = deal.stage?.toLowerCase() || "";
    return !stage.includes("closedwon") && !stage.includes("closedlost") && !stage.includes("closed");
  });
}

/**
 * Get deals associated with a specific company
 */
export async function getHubSpotDealsForCompany(companyId: string): Promise<HubSpotDealData[]> {
  if (!isHubSpotConfigured()) {
    throw new Error("HubSpot is not configured");
  }

  try {
    // Get deal associations for the company
    const associations = await hubspotRequest<{
      results: Array<{ id: string; type: string }>;
    }>(`/crm/v3/objects/companies/${companyId}/associations/deals`);

    if (associations.results.length === 0) {
      return [];
    }

    // Batch fetch deal details
    const dealIds = associations.results.map((a) => a.id);
    const deals: HubSpotDealData[] = [];

    // Batch in groups of 100
    for (let i = 0; i < dealIds.length; i += 100) {
      const batch = dealIds.slice(i, i + 100);

      const batchResponse = await hubspotRequest<HubSpotDealsResponse>(
        "/crm/v3/objects/deals/batch/read",
        {
          method: "POST",
          body: {
            inputs: batch.map((id) => ({ id })),
            properties: DEAL_PROPERTIES,
          },
        }
      );

      deals.push(...batchResponse.results.map(parseHubSpotDeal));
    }

    return deals;
  } catch {
    // Company may not have deal associations
    return [];
  }
}

/**
 * Determine the "best" deal stage for a company based on its associated deals.
 * Priority: most recent deal with a stage containing "won", otherwise most recent deal's stage.
 * Returns the stage and whether it's a "won" stage.
 */
export async function getBestDealStageForCompany(companyId: string): Promise<{
  dealStage: string | null;
  isWon: boolean;
}> {
  const deals = await getHubSpotDealsForCompany(companyId);

  if (deals.length === 0) {
    return { dealStage: null, isWon: false };
  }

  // Sort deals by updatedAt descending (most recent first)
  const sortedDeals = deals.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  // Look for any deal with "won" in the stage
  const wonDeal = sortedDeals.find((deal) => {
    const stage = deal.stage?.toLowerCase() || "";
    return stage.includes("won");
  });

  if (wonDeal) {
    return { dealStage: wonDeal.stage, isWon: true };
  }

  // Return the most recent deal's stage
  const mostRecentDeal = sortedDeals[0];
  return { dealStage: mostRecentDeal.stage, isWon: false };
}
