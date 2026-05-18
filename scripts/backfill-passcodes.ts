/**
 * Backfill Zoom recording passcodes for existing meetings.
 * Fetches recording_play_passcode from the Zoom API and updates DB meetings.
 *
 * Usage: npx tsx scripts/backfill-passcodes.ts
 * Requires: .env.local with DATABASE_URL
 */

import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import { config } from "dotenv";
import { resolve } from "path";

// Load env from .env.local
config({ path: resolve(__dirname, "../.env.local") });

const ZOOM_API_BASE = "https://api.zoom.us/v2";
const ZOOM_AUTH_URL = "https://zoom.us/oauth/token";

interface ZoomRecording {
  file_type: string;
  file_extension: string;
  play_url: string;
  recording_type: string;
}

interface ZoomMeetingResponse {
  uuid: string;
  id: number;
  host_email?: string;
  password?: string;
  recording_play_passcode?: string;
  topic: string;
  start_time: string;
  recording_files: ZoomRecording[];
}

interface ZoomRecordingsResponse {
  from: string;
  to: string;
  next_page_token: string;
  meetings: ZoomMeetingResponse[];
}

interface UserRow {
  id: string;
  email: string;
  zoom_access_token: string;
  zoom_refresh_token: string;
  zoom_token_expires_at: string | null;
}

interface MeetingRow {
  id: string;
  external_id: string;
  recording_url: string | null;
  recording_passcode: string | null;
}

async function refreshZoomToken(
  sql: NeonQueryFunction<false, false>,
  user: UserRow
): Promise<string> {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET required");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(ZOOM_AUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: user.zoom_refresh_token,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Zoom token for ${user.email}: ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  // Update tokens in DB
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await sql`
    UPDATE users
    SET zoom_access_token = ${data.access_token},
        zoom_refresh_token = COALESCE(${data.refresh_token ?? null}, zoom_refresh_token),
        zoom_token_expires_at = ${expiresAt}
    WHERE id = ${user.id}
  `;

  return data.access_token;
}

async function getAccessToken(
  sql: NeonQueryFunction<false, false>,
  user: UserRow
): Promise<string> {
  // Check if token is still valid (with 60s buffer)
  if (user.zoom_token_expires_at) {
    const expiresAt = new Date(user.zoom_token_expires_at).getTime();
    if (Date.now() < expiresAt - 60000) {
      return user.zoom_access_token;
    }
  }
  return refreshZoomToken(sql, user);
}

async function fetchZoomRecordings(
  token: string,
  days: number
): Promise<ZoomMeetingResponse[]> {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  const meetings: ZoomMeetingResponse[] = [];
  let nextPageToken = "";

  do {
    const params: Record<string, string> = {
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
      page_size: "100",
    };
    if (nextPageToken) {
      params.next_page_token = nextPageToken;
    }

    const searchParams = new URLSearchParams(params);
    const url = `${ZOOM_API_BASE}/users/me/recordings?${searchParams.toString()}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Zoom API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as ZoomRecordingsResponse;
    meetings.push(...data.meetings);
    nextPageToken = data.next_page_token || "";
  } while (nextPageToken);

  return meetings;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = neon(process.env.DATABASE_URL);

  // Find users with Zoom connected
  const zoomUsers = (await sql`
    SELECT id, email, zoom_access_token, zoom_refresh_token, zoom_token_expires_at
    FROM users
    WHERE zoom_access_token IS NOT NULL AND zoom_refresh_token IS NOT NULL
  `) as UserRow[];

  console.log(`Found ${zoomUsers.length} user(s) with Zoom connected`);

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalNoPasscode = 0;
  let totalErrors = 0;

  for (const user of zoomUsers) {
    console.log(`\nProcessing user: ${user.email}`);

    try {
      const token = await getAccessToken(sql, user);
      const zoomMeetings = await fetchZoomRecordings(token, 90);
      console.log(`  Fetched ${zoomMeetings.length} Zoom recording(s)`);

      for (const meeting of zoomMeetings) {
        const externalId = `zoom_${meeting.uuid}`;
        const passcode = meeting.recording_play_passcode || meeting.password || null;

        // Find existing DB meeting
        const existing = (await sql`
          SELECT id, external_id, recording_url, recording_passcode
          FROM meetings
          WHERE external_id = ${externalId}
        `) as MeetingRow[];

        if (existing.length === 0) {
          totalSkipped++;
          continue;
        }

        const dbMeeting = existing[0];

        // Skip if already has a passcode
        if (dbMeeting.recording_passcode) {
          totalSkipped++;
          continue;
        }

        if (!passcode) {
          totalNoPasscode++;
          continue;
        }

        // Build updated recording URL with ?pwd=
        let updatedUrl = dbMeeting.recording_url;
        if (updatedUrl && !updatedUrl.includes("pwd=") && !updatedUrl.startsWith("drive:")) {
          updatedUrl = `${updatedUrl}?pwd=${passcode}`;
        }

        await sql`
          UPDATE meetings
          SET recording_passcode = ${passcode},
              recording_url = ${updatedUrl},
              updated_at = NOW()
          WHERE id = ${dbMeeting.id}
        `;

        console.log(`  Updated: ${meeting.topic} (passcode: ${passcode.substring(0, 4)}...)`);
        totalUpdated++;
      }
    } catch (error) {
      console.error(`  Error for ${user.email}:`, error instanceof Error ? error.message : error);
      totalErrors++;
    }
  }

  console.log("\n--- Results ---");
  console.log(`Updated: ${totalUpdated}`);
  console.log(`Skipped (already had passcode or not in DB): ${totalSkipped}`);
  console.log(`No passcode in Zoom: ${totalNoPasscode}`);
  console.log(`Errors: ${totalErrors}`);
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
