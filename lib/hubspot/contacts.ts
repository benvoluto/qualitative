// HubSpot Contacts API

import { hubspotRequest, isHubSpotConfigured } from "./client";

interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    company?: string;
    jobtitle?: string;
  };
}

export interface HubSpotContactData {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
}

const CONTACT_PROPERTIES = [
  "email",
  "firstname",
  "lastname",
  "phone",
  "company",
  "jobtitle",
];

function parseHubSpotContact(contact: HubSpotContact): HubSpotContactData {
  const props = contact.properties;
  const firstName = props.firstname || null;
  const lastName = props.lastname || null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || null;

  return {
    id: contact.id,
    email: props.email || null,
    firstName,
    lastName,
    fullName,
    phone: props.phone || null,
    company: props.company || null,
    jobTitle: props.jobtitle || null,
  };
}

/**
 * Fetch a single contact by ID
 */
export async function fetchHubSpotContactById(contactId: string): Promise<HubSpotContactData | null> {
  if (!isHubSpotConfigured()) {
    return null;
  }

  try {
    const contact = await hubspotRequest<HubSpotContact>(
      `/crm/v3/objects/contacts/${contactId}`,
      {
        params: {
          properties: CONTACT_PROPERTIES.join(","),
        },
      }
    );

    return parseHubSpotContact(contact);
  } catch (error) {
    console.error(`Failed to fetch HubSpot contact ${contactId}:`, error);
    return null;
  }
}

/**
 * Fetch multiple contacts by IDs
 */
export async function fetchHubSpotContactsByIds(contactIds: string[]): Promise<HubSpotContactData[]> {
  if (!isHubSpotConfigured() || contactIds.length === 0) {
    return [];
  }

  const contacts: HubSpotContactData[] = [];

  // Fetch contacts in parallel (batch of 10 to avoid rate limits)
  const batchSize = 10;
  for (let i = 0; i < contactIds.length; i += batchSize) {
    const batch = contactIds.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((id) => fetchHubSpotContactById(id))
    );
    contacts.push(...results.filter((c): c is HubSpotContactData => c !== null));
  }

  return contacts;
}

interface HubSpotSearchResponse {
  total: number;
  results: HubSpotContact[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

/**
 * Search contacts by name or email using HubSpot search API.
 * The query searches across firstname, lastname, and email fields.
 */
export async function searchHubSpotContacts(query: string): Promise<HubSpotContactData[]> {
  if (!isHubSpotConfigured()) {
    return [];
  }

  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    // Use the search API with a query string that searches default searchable properties
    // Default searchable properties for contacts: firstname, lastname, email, phone, company, hs_object_id
    const response = await hubspotRequest<HubSpotSearchResponse>(
      "/crm/v3/objects/contacts/search",
      {
        method: "POST",
        body: {
          query: query.trim(),
          properties: CONTACT_PROPERTIES,
          limit: 25,
        },
      }
    );

    return response.results.map(parseHubSpotContact);
  } catch (error) {
    console.error("Failed to search HubSpot contacts:", error);
    return [];
  }
}

/**
 * Get a contact by email using HubSpot's idProperty feature.
 * More reliable than search for exact email lookups.
 */
export async function getHubSpotContactByEmail(email: string): Promise<HubSpotContactData | null> {
  if (!isHubSpotConfigured()) {
    return null;
  }

  try {
    const contact = await hubspotRequest<HubSpotContact>(
      `/crm/v3/objects/contacts/${encodeURIComponent(email)}`,
      {
        params: {
          idProperty: "email",
          properties: CONTACT_PROPERTIES.join(","),
        },
      }
    );

    return parseHubSpotContact(contact);
  } catch {
    // Contact not found is expected, don't log as error
    return null;
  }
}
