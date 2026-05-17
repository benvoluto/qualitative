/**
 * Microsoft Teams / Graph API Client
 * Uses User OAuth via NextAuth for per-user access
 */

import { users } from "@/lib/db";

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";
const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

export function isMicrosoftConfigured(): boolean {
  return !!(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET);
}

/**
 * Check if a user has Microsoft tokens stored
 */
export async function userHasMicrosoftTokens(userId: string): Promise<boolean> {
  const user = await users.getUserById(userId);
  return !!(user?.ms_access_token);
}

/**
 * Refresh Microsoft access token using refresh token
 */
async function refreshMicrosoftToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Microsoft is not configured");
  }

  const response = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Microsoft token refresh failed: ${response.status} - ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // May return new refresh token
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Get Microsoft access token for a user
 * Automatically refreshes if expired
 */
export async function getMicrosoftAccessToken(userId: string): Promise<string> {
  const user = await users.getUserById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.ms_access_token || !user.ms_refresh_token) {
    throw new Error("User has not connected Microsoft account");
  }

  // Check if token is expired (with 5 minute buffer)
  const isExpired =
    !user.ms_token_expires_at ||
    new Date(user.ms_token_expires_at).getTime() < Date.now() + 5 * 60 * 1000;

  if (!isExpired) {
    return user.ms_access_token;
  }

  // Refresh the token
  const newTokens = await refreshMicrosoftToken(user.ms_refresh_token);

  // Update in database
  await users.updateUserMicrosoftTokens(
    userId,
    newTokens.accessToken,
    newTokens.refreshToken,
    newTokens.expiresAt
  );

  return newTokens.accessToken;
}

/**
 * Make an authenticated request to Microsoft Graph API
 */
export async function graphRequest<T>(
  userId: string,
  endpoint: string,
  options: {
    method?: string;
    params?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<T> {
  const { method = "GET", params, body } = options;

  const token = await getMicrosoftAccessToken(userId);

  let url = `${GRAPH_API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Microsoft Graph API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Download content from Microsoft Graph (for transcripts/files)
 */
export async function graphDownload(
  userId: string,
  url: string
): Promise<string> {
  const token = await getMicrosoftAccessToken(userId);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Microsoft Graph download failed: ${response.status}`);
  }

  return response.text();
}
