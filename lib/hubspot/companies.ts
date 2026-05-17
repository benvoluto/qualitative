// HubSpot Companies API integration

import { hubspotRequest, isHubSpotConfigured } from "./client";

interface HubSpotCompanyProperties {
  name?: string;
  domain?: string;
  industry?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  description?: string;
  numberofemployees?: string;
  annualrevenue?: string;
  hs_object_id?: string;
  createdate?: string;
  hs_lastmodifieddate?: string;
  // Waitlist fields (custom properties)
  waitlist?: string;
  waitlist_date?: string;
  waitlist_followup?: string;
  waitlist_source?: string;
  // Deal stage from associated deals
  deal_stage?: string;
}

interface HubSpotCompany {
  id: string;
  properties: HubSpotCompanyProperties;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

interface HubSpotCompaniesResponse {
  results: HubSpotCompany[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

interface HubSpotSearchResponse {
  total: number;
  results: HubSpotCompany[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

// Properties to request from the API
const COMPANY_PROPERTIES = [
  "name",
  "domain",
  "industry",
  "address",
  "city",
  "state",
  "zip",
  "country",
  "phone",
  "description",
  "numberofemployees",
  "annualrevenue",
  "createdate",
  "hs_lastmodifieddate",
  // Waitlist fields (custom properties - adjust names to match your HubSpot setup)
  "waitlist",
  "waitlist_date",
  "waitlist_followup",
  "waitlist_source",
];

export interface HubSpotCompanyData {
  id: string;
  name: string | null;
  domain: string | null;
  industry: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  phone: string | null;
  description: string | null;
  employeeCount: number | null;
  annualRevenue: number | null;
  waitlist: boolean;
  waitlistDate: Date | null;
  waitlistFollowup: Date | null;
  waitlistSource: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function parseHubSpotCompany(company: HubSpotCompany): HubSpotCompanyData {
  const props = company.properties;

  // Parse waitlist boolean - HubSpot may return "true"/"false" string or boolean
  const waitlistValue = props.waitlist;
  const waitlist = waitlistValue === "true" || waitlistValue === "1" || waitlistValue === "yes";

  return {
    id: company.id,
    name: props.name || null,
    domain: props.domain || null,
    industry: props.industry || null,
    address: props.address || null,
    city: props.city || null,
    state: props.state || null,
    zip: props.zip || null,
    country: props.country || null,
    phone: props.phone || null,
    description: props.description || null,
    employeeCount: props.numberofemployees ? parseInt(props.numberofemployees, 10) : null,
    annualRevenue: props.annualrevenue ? parseFloat(props.annualrevenue) : null,
    waitlist,
    waitlistDate: props.waitlist_date ? new Date(props.waitlist_date) : null,
    waitlistFollowup: props.waitlist_followup ? new Date(props.waitlist_followup) : null,
    waitlistSource: props.waitlist_source || null,
    createdAt: new Date(company.createdAt),
    updatedAt: new Date(company.updatedAt),
  };
}

/**
 * Fetch all companies from HubSpot
 */
export async function fetchAllHubSpotCompanies(): Promise<HubSpotCompanyData[]> {
  if (!isHubSpotConfigured()) {
    throw new Error("HubSpot is not configured");
  }

  const allCompanies: HubSpotCompany[] = [];
  let after: string | undefined;

  do {
    const params: Record<string, string> = {
      limit: "100",
      properties: COMPANY_PROPERTIES.join(","),
    };

    if (after) {
      params.after = after;
    }

    const response = await hubspotRequest<HubSpotCompaniesResponse>(
      "/crm/v3/objects/companies",
      { params }
    );

    allCompanies.push(...response.results);
    after = response.paging?.next?.after;
  } while (after);

  return allCompanies.map(parseHubSpotCompany);
}

/**
 * Get companies associated with meetings from the last N days
 */
export async function getCompaniesWithRecentMeetings(days: number = 180): Promise<HubSpotCompanyData[]> {
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

  // Get unique company IDs from meeting associations
  const companyIds = new Set<string>();

  for (const meeting of meetingsResponse.results) {
    try {
      const associations = await hubspotRequest<{
        results: Array<{ id: string; type: string }>;
      }>(`/crm/v3/objects/meetings/${meeting.id}/associations/companies`);

      for (const assoc of associations.results) {
        companyIds.add(assoc.id);
      }
    } catch {
      // Skip meetings without company associations
    }
  }

  if (companyIds.size === 0) {
    return [];
  }

  // Batch fetch company details
  const companyIdArray = Array.from(companyIds);
  const companies: HubSpotCompanyData[] = [];

  // Batch in groups of 100
  for (let i = 0; i < companyIdArray.length; i += 100) {
    const batch = companyIdArray.slice(i, i + 100);

    const batchResponse = await hubspotRequest<HubSpotCompaniesResponse>(
      "/crm/v3/objects/companies/batch/read",
      {
        method: "POST",
        body: {
          inputs: batch.map((id) => ({ id })),
          properties: COMPANY_PROPERTIES,
        },
      }
    );

    companies.push(...batchResponse.results.map(parseHubSpotCompany));
  }

  return companies;
}

/**
 * Fetch a single company by ID
 */
export async function fetchHubSpotCompanyById(companyId: string): Promise<HubSpotCompanyData | null> {
  if (!isHubSpotConfigured()) {
    throw new Error("HubSpot is not configured");
  }

  try {
    const company = await hubspotRequest<HubSpotCompany>(
      `/crm/v3/objects/companies/${companyId}`,
      {
        params: {
          properties: COMPANY_PROPERTIES.join(","),
        },
      }
    );

    return parseHubSpotCompany(company);
  } catch (error) {
    console.error(`Failed to fetch HubSpot company ${companyId}:`, error);
    return null;
  }
}

/**
 * Get the most recently modified company's hs_lastmodifieddate from HubSpot.
 * Uses the search endpoint sorted descending by modified date, limit 1.
 */
export async function getLatestHubSpotCompanyModifiedDate(): Promise<Date | null> {
  if (!isHubSpotConfigured()) {
    throw new Error("HubSpot is not configured");
  }
  const response = await hubspotRequest<HubSpotSearchResponse>(
    "/crm/v3/objects/companies/search",
    {
      method: "POST",
      body: {
        filterGroups: [],
        sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
        properties: ["hs_lastmodifieddate"],
        limit: 1,
      },
    }
  );
  const lastModified = response.results[0]?.properties?.hs_lastmodifieddate;
  return lastModified ? new Date(lastModified) : null;
}

/**
 * Search companies by name
 */
export async function searchHubSpotCompanies(query: string): Promise<HubSpotCompanyData[]> {
  if (!isHubSpotConfigured()) {
    throw new Error("HubSpot is not configured");
  }

  const response = await hubspotRequest<HubSpotSearchResponse>(
    "/crm/v3/objects/companies/search",
    {
      method: "POST",
      body: {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "name",
                operator: "CONTAINS_TOKEN",
                value: query,
              },
            ],
          },
        ],
        properties: COMPANY_PROPERTIES,
        limit: 50,
      },
    }
  );

  return response.results.map(parseHubSpotCompany);
}
