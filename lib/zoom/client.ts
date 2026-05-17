/**
 * Zoom API Client
 * Supports both:
 * - Server-to-Server OAuth (account-level access via env vars)
 * - Per-user OAuth 2.0 (user-level access via stored tokens)
 */

import { users } from "@/lib/db";
import { refreshZoomToken } from "./oauth";

const ZOOM_API_BASE = "https://api.zoom.us/v2";
const ZOOM_AUTH_URL = "https://zoom.us/oauth/token";

// In-memory token cache for Server-to-Server OAuth
let cachedToken: { token: string; expiresAt: number } | null = null;

// In-memory token cache for per-user OAuth (keyed by userId)
const userTokenCache = new Map<string, { token: string; expiresAt: number }>();

export function isZoomConfigured(): boolean {
  return !!(
    process.env.ZOOM_ACCOUNT_ID &&
    process.env.ZOOM_CLIENT_ID &&
    process.env.ZOOM_CLIENT_SECRET
  );
}

/**
 * Get Zoom access token using Server-to-Server OAuth
 * Tokens are cached in memory until they expire
 */
export async function getZoomAccessToken(): Promise<string> {
  // Check cached token
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom is not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(ZOOM_AUTH_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "account_credentials",
      account_id: accountId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zoom OAuth error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Cache the token (expires_in is in seconds)
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

/**
 * Make an authenticated request to the Zoom API
 */
export async function zoomRequest<T>(
  endpoint: string,
  options: {
    method?: string;
    params?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<T> {
  const { method = "GET", params, body } = options;

  const token = await getZoomAccessToken();

  let url = `${ZOOM_API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const response = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zoom API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Download a Zoom recording file
 * Recording URLs require the access token as a query parameter
 */
export async function downloadZoomRecording(downloadUrl: string): Promise<Buffer> {
  const token = await getZoomAccessToken();

  // Zoom recording URLs need the token as a query param
  const url = new URL(downloadUrl);
  url.searchParams.set("access_token", token);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Failed to download Zoom recording: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Download a Zoom recording file as text (for transcripts)
 */
export async function downloadZoomRecordingText(downloadUrl: string): Promise<string> {
  const token = await getZoomAccessToken();

  const url = new URL(downloadUrl);
  url.searchParams.set("access_token", token);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Failed to download Zoom recording: ${response.status}`);
  }

  return response.text();
}

// ============================================================================
// Per-User OAuth 2.0 Functions
// ============================================================================

/**
 * Check if a specific user has Zoom connected via OAuth 2.0
 */
export async function isUserZoomConnected(userId: string): Promise<boolean> {
  return users.hasZoomConnected(userId);
}

/**
 * Custom error class for Zoom token refresh failures that require re-authentication
 */
export class ZoomReauthRequiredError extends Error {
  constructor(message: string = "Zoom connection expired. Please reconnect Zoom in Settings.") {
    super(message);
    this.name = "ZoomReauthRequiredError";
  }
}

/**
 * Get a valid access token for a specific user
 * Automatically refreshes if expired
 */
export async function getUserZoomAccessToken(userId: string): Promise<string> {
  // Check in-memory cache first
  const cached = userTokenCache.get(userId);
  if (cached && Date.now() < cached.expiresAt - 60000) {
    return cached.token;
  }

  // Get tokens from database
  const tokens = await users.getUserZoomTokens(userId);
  if (!tokens) {
    throw new ZoomReauthRequiredError("User has not connected Zoom. Please connect in Settings.");
  }

  // Check if token is still valid
  const now = Date.now();
  const expiresAt = tokens.expiresAt.getTime();

  if (now < expiresAt - 60000) {
    // Token is still valid, cache and return
    userTokenCache.set(userId, {
      token: tokens.accessToken,
      expiresAt: expiresAt,
    });
    return tokens.accessToken;
  }

  // Token expired, refresh it
  // IMPORTANT: Zoom refresh tokens are single-use. Once we call refreshZoomToken(),
  // the old refresh token is immediately invalidated. We MUST save the new tokens.
  try {
    const refreshed = await refreshZoomToken(tokens.refreshToken);

    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

    // Update database with new tokens - this MUST succeed or user will be locked out
    await users.updateUserZoomTokens(
      userId,
      refreshed.access_token,
      refreshed.refresh_token,
      newExpiresAt,
      tokens.zoomUserId
    );

    // Update cache
    userTokenCache.set(userId, {
      token: refreshed.access_token,
      expiresAt: newExpiresAt.getTime(),
    });

    return refreshed.access_token;
  } catch (error) {
    // Check if this is an invalid_grant error (refresh token expired/invalid)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("invalid_grant")) {
      // Clear the invalid tokens from database and cache
      await users.disconnectUserZoom(userId);
      clearUserZoomTokenCache(userId);
      throw new ZoomReauthRequiredError(
        "Zoom connection expired. Please reconnect Zoom in Settings."
      );
    }
    throw error;
  }
}

/**
 * Make an authenticated request to the Zoom API using a user's OAuth tokens
 * Automatically retries once on 401 errors by forcing a token refresh
 */
export async function userZoomRequest<T>(
  userId: string,
  endpoint: string,
  options: {
    method?: string;
    params?: Record<string, string>;
    body?: unknown;
  } = {},
  isRetry: boolean = false
): Promise<T> {
  const { method = "GET", params, body } = options;

  const token = await getUserZoomAccessToken(userId);

  let url = `${ZOOM_API_BASE}${endpoint}`;
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

    // On 401, clear cache and retry once with a fresh token
    if (response.status === 401 && !isRetry) {
      console.log("Zoom API returned 401, clearing cache and retrying...");
      clearUserZoomTokenCache(userId);
      return userZoomRequest<T>(userId, endpoint, options, true);
    }

    throw new Error(`Zoom API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Download a Zoom recording file using a user's OAuth token
 * Automatically retries once on 401 errors by forcing a token refresh
 */
export async function downloadUserZoomRecording(
  userId: string,
  downloadUrl: string,
  isRetry: boolean = false
): Promise<Buffer> {
  const token = await getUserZoomAccessToken(userId);

  const url = new URL(downloadUrl);
  url.searchParams.set("access_token", token);

  const response = await fetch(url.toString());

  if (!response.ok) {
    // On 401, clear cache and retry once with a fresh token
    if (response.status === 401 && !isRetry) {
      console.log("Zoom download returned 401, clearing cache and retrying...");
      clearUserZoomTokenCache(userId);
      return downloadUserZoomRecording(userId, downloadUrl, true);
    }
    throw new Error(`Failed to download Zoom recording: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Download a Zoom recording file as text using a user's OAuth token (for transcripts)
 * Automatically retries once on 401 errors by forcing a token refresh
 */
export async function downloadUserZoomRecordingText(
  userId: string,
  downloadUrl: string,
  isRetry: boolean = false
): Promise<string> {
  const token = await getUserZoomAccessToken(userId);

  const url = new URL(downloadUrl);
  url.searchParams.set("access_token", token);

  const response = await fetch(url.toString());

  if (!response.ok) {
    // On 401, clear cache and retry once with a fresh token
    if (response.status === 401 && !isRetry) {
      console.log("Zoom text download returned 401, clearing cache and retrying...");
      clearUserZoomTokenCache(userId);
      return downloadUserZoomRecordingText(userId, downloadUrl, true);
    }
    throw new Error(`Failed to download Zoom recording: ${response.status}`);
  }

  return response.text();
}

/**
 * Clear the token cache for a user (call when disconnecting)
 */
export function clearUserZoomTokenCache(userId: string): void {
  userTokenCache.delete(userId);
}
