/**
 * Zoom OAuth 2.0 helpers for per-user authentication
 */

const ZOOM_AUTH_URL = "https://zoom.us/oauth/authorize";
const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";
const ZOOM_API_BASE = "https://api.zoom.us/v2";

export interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

export interface ZoomUserInfo {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  type: number;
  account_id: string;
}

/**
 * Check if Zoom OAuth is configured (client credentials exist)
 */
export function isZoomOAuthConfigured(): boolean {
  return !!(
    process.env.ZOOM_CLIENT_ID &&
    process.env.ZOOM_CLIENT_SECRET &&
    process.env.ZOOM_REDIRECT_URI
  );
}

/**
 * Required OAuth scopes for Zoom integration (granular scopes)
 * - cloud_recording:read:list_user_recordings - List user's recordings
 * - cloud_recording:read:list_recording_files - List recording files
 * - cloud_recording:read:recording - View/download recordings
 * - cloud_recording:read:meeting_transcript - Read meeting transcripts
 */
const ZOOM_OAUTH_SCOPES = [
  "cloud_recording:read:list_user_recordings",
  "cloud_recording:read:list_recording_files",
  "cloud_recording:read:recording",
  "cloud_recording:read:meeting_transcript",
].join(" ");

/**
 * Build the Zoom OAuth authorization URL
 * User will be redirected here to authorize the app
 */
export function getZoomAuthUrl(state: string): string {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const redirectUri = process.env.ZOOM_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("Zoom OAuth not configured. Set ZOOM_CLIENT_ID and ZOOM_REDIRECT_URI.");
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state,
    scope: ZOOM_OAUTH_SCOPES,
  });

  return `${ZOOM_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access and refresh tokens
 */
export async function exchangeZoomCode(code: string): Promise<ZoomTokenResponse> {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  const redirectUri = process.env.ZOOM_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Zoom OAuth not configured.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(ZOOM_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zoom OAuth token exchange failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Refresh an expired access token using the refresh token
 */
export async function refreshZoomToken(refreshToken: string): Promise<ZoomTokenResponse> {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Zoom OAuth not configured.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(ZOOM_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zoom OAuth token refresh failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Get user info from Zoom using an access token
 */
export async function getZoomUserInfo(accessToken: string): Promise<ZoomUserInfo> {
  const response = await fetch(`${ZOOM_API_BASE}/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Zoom user info: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Revoke a Zoom access token (for disconnecting)
 */
export async function revokeZoomToken(accessToken: string): Promise<void> {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return; // Can't revoke without credentials
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    await fetch("https://zoom.us/oauth/revoke", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token: accessToken,
      }),
    });
  } catch {
    // Ignore revocation errors - user will be disconnected anyway
  }
}
