// HubSpot Meetings API integration

import { hubspotRequest, isHubSpotConfigured } from "./client";

// HubSpot meeting properties from the API
interface HubSpotMeetingProperties {
  hs_timestamp?: string;
  hs_meeting_title?: string;
  hs_meeting_body?: string;
  hs_internal_meeting_notes?: string;
  hs_meeting_external_url?: string;
  hs_meeting_location?: string;
  hs_meeting_start_time?: string;
  hs_meeting_end_time?: string;
  hs_meeting_outcome?: "SCHEDULED" | "COMPLETED" | "RESCHEDULED" | "NO_SHOW" | "CANCELED";
  hs_activity_type?: string;
  hs_createdate?: string;
  hs_lastmodifieddate?: string;
  hubspot_owner_id?: string;
}

interface HubSpotMeeting {
  id: string;
  properties: HubSpotMeetingProperties;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

interface HubSpotMeetingsResponse {
  results: HubSpotMeeting[];
  paging?: {
    next?: {
      after: string;
      link: string;
    };
  };
}

interface HubSpotSearchResponse {
  total: number;
  results: HubSpotMeeting[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

// Properties to request from the API
const MEETING_PROPERTIES = [
  "hs_timestamp",
  "hs_meeting_title",
  "hs_meeting_body",
  "hs_internal_meeting_notes",
  "hs_meeting_external_url",
  "hs_meeting_location",
  "hs_meeting_start_time",
  "hs_meeting_end_time",
  "hs_meeting_outcome",
  "hs_activity_type",
  "hs_createdate",
  "hs_lastmodifieddate",
  "hubspot_owner_id",
];

export interface HubSpotMeetingData {
  id: string;
  title: string | null;
  description: string | null;
  internalNotes: string | null;
  externalUrl: string | null;
  location: string | null;
  startTime: Date | null;
  endTime: Date | null;
  outcome: string | null;
  activityType: string | null;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string | null;
}

interface HubSpotOwner {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

function parseHubSpotMeeting(meeting: HubSpotMeeting): HubSpotMeetingData {
  const props = meeting.properties;

  return {
    id: meeting.id,
    title: props.hs_meeting_title || null,
    description: props.hs_meeting_body || null,
    internalNotes: props.hs_internal_meeting_notes || null,
    externalUrl: props.hs_meeting_external_url || null,
    location: props.hs_meeting_location || null,
    startTime: props.hs_meeting_start_time ? new Date(props.hs_meeting_start_time) : null,
    endTime: props.hs_meeting_end_time ? new Date(props.hs_meeting_end_time) : null,
    outcome: props.hs_meeting_outcome || null,
    activityType: props.hs_activity_type || null,
    createdAt: new Date(meeting.createdAt),
    updatedAt: new Date(meeting.updatedAt),
    ownerId: props.hubspot_owner_id || null,
  };
}

/**
 * Get owner details by ID
 */
export async function getHubSpotOwner(ownerId: string): Promise<HubSpotOwner | null> {
  if (!isHubSpotConfigured()) {
    return null;
  }

  try {
    const owner = await hubspotRequest<HubSpotOwner>(
      `/crm/v3/owners/${ownerId}`
    );
    return owner;
  } catch (error) {
    console.error(`Failed to fetch HubSpot owner ${ownerId}:`, error);
    return null;
  }
}

/**
 * Fetch all meetings from HubSpot (paginated)
 */
export async function fetchAllHubSpotMeetings(): Promise<HubSpotMeetingData[]> {
  if (!isHubSpotConfigured()) {
    throw new Error("HubSpot is not configured");
  }

  const allMeetings: HubSpotMeeting[] = [];
  let after: string | undefined;

  do {
    const params: Record<string, string> = {
      limit: "100",
      properties: MEETING_PROPERTIES.join(","),
    };

    if (after) {
      params.after = after;
    }

    const response = await hubspotRequest<HubSpotMeetingsResponse>(
      "/crm/v3/objects/meetings",
      { params }
    );

    allMeetings.push(...response.results);
    after = response.paging?.next?.after;
  } while (after);

  return allMeetings.map(parseHubSpotMeeting);
}

/**
 * Fetch meetings from HubSpot within the last N days
 */
export async function fetchHubSpotMeetingsLastDays(days: number = 7): Promise<HubSpotMeetingData[]> {
  if (!isHubSpotConfigured()) {
    throw new Error("HubSpot is not configured");
  }

  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const allMeetings: HubSpotMeeting[] = [];
  let after: string | undefined;

  do {
    const searchBody = {
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
      sorts: [
        {
          propertyName: "hs_meeting_start_time",
          direction: "DESCENDING",
        },
      ],
      properties: MEETING_PROPERTIES,
      limit: 100,
      after: after || undefined,
    };

    const response = await hubspotRequest<HubSpotSearchResponse>(
      "/crm/v3/objects/meetings/search",
      {
        method: "POST",
        body: searchBody,
      }
    );

    allMeetings.push(...response.results);
    after = response.paging?.next?.after;
  } while (after);

  return allMeetings.map(parseHubSpotMeeting);
}

/**
 * Fetch a single meeting by ID
 */
export async function fetchHubSpotMeetingById(meetingId: string): Promise<HubSpotMeetingData | null> {
  if (!isHubSpotConfigured()) {
    throw new Error("HubSpot is not configured");
  }

  try {
    const meeting = await hubspotRequest<HubSpotMeeting>(
      `/crm/v3/objects/meetings/${meetingId}`,
      {
        params: {
          properties: MEETING_PROPERTIES.join(","),
        },
      }
    );

    return parseHubSpotMeeting(meeting);
  } catch (error) {
    console.error(`Failed to fetch HubSpot meeting ${meetingId}:`, error);
    return null;
  }
}

/**
 * Get associated contacts for a meeting
 */
export async function getHubSpotMeetingContacts(meetingId: string): Promise<string[]> {
  if (!isHubSpotConfigured()) {
    return [];
  }

  try {
    interface AssociationResponse {
      results: Array<{
        id: string;
        type: string;
      }>;
    }

    const response = await hubspotRequest<AssociationResponse>(
      `/crm/v3/objects/meetings/${meetingId}/associations/contacts`
    );

    return response.results.map((r) => r.id);
  } catch (error) {
    console.error(`Failed to fetch contacts for meeting ${meetingId}:`, error);
    return [];
  }
}

/**
 * Get associated companies for a meeting
 */
export async function getHubSpotMeetingCompanies(meetingId: string): Promise<string[]> {
  if (!isHubSpotConfigured()) {
    return [];
  }

  try {
    interface AssociationResponse {
      results: Array<{
        id: string;
        type: string;
      }>;
    }

    const response = await hubspotRequest<AssociationResponse>(
      `/crm/v3/objects/meetings/${meetingId}/associations/companies`
    );

    return response.results.map((r) => r.id);
  } catch (error) {
    console.error(`Failed to fetch companies for meeting ${meetingId}:`, error);
    return [];
  }
}

/**
 * Search for HubSpot meetings within a time window of a given date
 * Returns participant emails from matching meetings
 *
 * @param meetingDate - The date to search around
 * @param windowHours - Time window in hours (default 5 hours)
 * @param hubspotCompanyId - Optional HubSpot company ID to filter by
 */
export async function findHubSpotMeetingParticipants(
  meetingDate: Date,
  windowHours: number = 5,
  hubspotCompanyId?: string | null
): Promise<string[]> {
  if (!isHubSpotConfigured()) {
    return [];
  }

  const windowMs = windowHours * 60 * 60 * 1000;
  const startTime = new Date(meetingDate.getTime() - windowMs);
  const endTime = new Date(meetingDate.getTime() + windowMs);

  try {
    // Search for meetings within the time window
    const searchBody = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "hs_meeting_start_time",
              operator: "GTE",
              value: startTime.getTime().toString(),
            },
            {
              propertyName: "hs_meeting_start_time",
              operator: "LTE",
              value: endTime.getTime().toString(),
            },
          ],
        },
      ],
      properties: MEETING_PROPERTIES,
      limit: 50,
    };

    const response = await hubspotRequest<HubSpotSearchResponse>(
      "/crm/v3/objects/meetings/search",
      {
        method: "POST",
        body: searchBody,
      }
    );

    if (response.results.length === 0) {
      return [];
    }

    // Filter meetings by company if specified
    let matchingMeetings = response.results;
    if (hubspotCompanyId) {
      const meetingsWithMatchingCompany: HubSpotMeeting[] = [];

      for (const meeting of response.results) {
        const companyIds = await getHubSpotMeetingCompanies(meeting.id);
        if (companyIds.includes(hubspotCompanyId)) {
          meetingsWithMatchingCompany.push(meeting);
        }
      }

      matchingMeetings = meetingsWithMatchingCompany;
    }

    if (matchingMeetings.length === 0) {
      return [];
    }

    // Get contacts for all matching meetings
    const allContactIds = new Set<string>();

    for (const meeting of matchingMeetings) {
      const contactIds = await getHubSpotMeetingContacts(meeting.id);
      contactIds.forEach((id) => allContactIds.add(id));
    }

    if (allContactIds.size === 0) {
      return [];
    }

    // Fetch contact details to get emails
    const { fetchHubSpotContactsByIds } = await import("./contacts");
    const contacts = await fetchHubSpotContactsByIds(Array.from(allContactIds));

    // Return emails from contacts
    return contacts
      .filter((c) => c.email)
      .map((c) => c.email!);
  } catch (error) {
    console.error("Failed to search HubSpot meetings for participants:", error);
    return [];
  }
}

/**
 * Try to get participant emails from HubSpot for a meeting
 * This is a fallback when the original source doesn't have participant info
 *
 * @param meetingId - The meeting ID in our database
 */
export async function getParticipantsFromHubSpotFallback(
  meetingId: string
): Promise<string[]> {
  if (!isHubSpotConfigured()) {
    return [];
  }

  try {
    // Import meeting functions
    const { getMeetingById } = await import("../db/meetings");
    const { getCustomerById } = await import("../db/customers");

    const meeting = await getMeetingById(meetingId);
    if (!meeting || !meeting.meeting_date) {
      return [];
    }

    // Get HubSpot company ID if we have a linked customer
    let hubspotCompanyId: string | null = null;
    if (meeting.customer_id) {
      const customer = await getCustomerById(meeting.customer_id);
      if (customer?.hubspot_company_id) {
        hubspotCompanyId = customer.hubspot_company_id;
      }
    }

    // Search HubSpot for matching meetings
    return findHubSpotMeetingParticipants(
      meeting.meeting_date,
      5, // 5 hour window
      hubspotCompanyId
    );
  } catch (error) {
    console.error(`Failed to get HubSpot participants for meeting ${meetingId}:`, error);
    return [];
  }
}
