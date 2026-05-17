import { google } from "googleapis";
import { users } from "@/lib/db";

// Create OAuth2 client
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );
}

// Get authenticated OAuth2 client for a user
export async function getAuthenticatedClient(userId: string) {
  const user = await users.getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (!user.google_access_token) {
    throw new Error("User has no Google access token");
  }

  const oauth2Client = createOAuth2Client();

  oauth2Client.setCredentials({
    access_token: user.google_access_token,
    refresh_token: user.google_refresh_token,
  });

  // Set up token refresh handler
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await users.updateUserGoogleTokens(
        userId,
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000)
      );
    }
  });

  return oauth2Client;
}

// Get authenticated client by email
export async function getAuthenticatedClientByEmail(email: string) {
  const user = await users.getUserByEmail(email);
  if (!user) {
    throw new Error("User not found");
  }
  return getAuthenticatedClient(user.id);
}

// Get Calendar API client
export async function getCalendarClient(userId: string) {
  const auth = await getAuthenticatedClient(userId);
  return google.calendar({ version: "v3", auth });
}

// Get Drive API client
export async function getDriveClient(userId: string) {
  const auth = await getAuthenticatedClient(userId);
  return google.drive({ version: "v3", auth });
}
