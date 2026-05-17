// HubSpot API client configuration

const HUBSPOT_API_BASE = "https://api.hubapi.com";

// HubSpot supports two auth methods:
// 1. Private App Access Token (preferred) - uses Bearer auth
// 2. API Key (legacy) - uses hapikey query param
// We check for both, with typo fallback for HUPSPOT_API_KEY

export function getHubSpotCredentials(): { type: "access_token" | "api_key"; value: string } | null {
  // Check for access token first (preferred)
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (accessToken) {
    return { type: "access_token", value: accessToken };
  }

  // Fall back to API key (check both correct spelling and typo)
  const apiKey = process.env.HUBSPOT_API_KEY || process.env.HUPSPOT_API_KEY;
  if (apiKey) {
    return { type: "api_key", value: apiKey };
  }

  return null;
}

export function isHubSpotConfigured(): boolean {
  return !!getHubSpotCredentials();
}

interface HubSpotRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string>;
}

export async function hubspotRequest<T>(
  endpoint: string,
  options: HubSpotRequestOptions = {}
): Promise<T> {
  const credentials = getHubSpotCredentials();

  if (!credentials) {
    throw new Error("HubSpot credentials not configured. Set HUBSPOT_ACCESS_TOKEN or HUBSPOT_API_KEY in your environment.");
  }

  const { method = "GET", body, params = {} } = options;

  // If using API key auth, add it to params
  if (credentials.type === "api_key") {
    params.hapikey = credentials.value;
  }

  let url = `${HUBSPOT_API_BASE}${endpoint}`;

  if (Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // If using access token, add Bearer auth header
  if (credentials.type === "access_token") {
    headers.Authorization = `Bearer ${credentials.value}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HubSpot API error (${response.status}): ${errorText}`);
  }

  return response.json();
}
