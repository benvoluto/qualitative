/* eslint-disable */
/**
 * Phase Zoom smoke test.
 *
 * What this checks (no user interaction needed):
 *  1. Env vars present
 *  2. OAuth authorization URL builds with the right scopes + redirect
 *  3. Database has the users.zoom_* columns and DB layer reads them
 *  4. Feature flag is on
 *  5. If any user has tokens persisted, exercise:
 *       - refresh flow (if expired)
 *       - /users/me  (needs user:read:user)
 *       - /users/me/recordings  (needs cloud_recording:* scopes)
 *       - /past_meetings/{uuid}/participants  (needs meeting:read:list_meeting_participants)
 */

import { neon } from "@neondatabase/serverless";
import { getZoomAuthUrl } from "@/lib/zoom/oauth";
import { features } from "@/lib/features";
import { hasZoomConnected, getUserZoomTokens, updateUserZoomTokens } from "@/lib/db/users";
import { refreshZoomToken, getZoomUserInfo } from "@/lib/zoom/oauth";
import { fetchUserZoomRecordings, getZoomMeetingParticipants } from "@/lib/zoom/meetings";

function pass(msg: string) { console.log(`  ✓ ${msg}`); }
function fail(msg: string): never { console.error(`  ✗ ${msg}`); process.exit(1); }
function info(msg: string) { console.log(`  · ${msg}`); }
function head(msg: string) { console.log(`\n${msg}`); }

const REQUIRED_SCOPES = [
  "user:read:user",
  "cloud_recording:read:list_user_recordings",
  "cloud_recording:read:list_recording_files",
  "cloud_recording:read:recording",
  "cloud_recording:read:meeting_transcript",
  "meeting:read:list_meeting_participants",
];

async function main() {
  head("1. Feature flag");
  if (!features.zoom) fail("features.zoom is false");
  pass("features.zoom = true");

  head("2. Env vars");
  for (const name of ["ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET", "ZOOM_REDIRECT_URI", "DATABASE_URL"]) {
    if (!process.env[name]) fail(`${name} missing`);
  }
  pass(`ZOOM_CLIENT_ID: ${process.env.ZOOM_CLIENT_ID!.slice(0, 8)}...`);
  pass(`ZOOM_REDIRECT_URI: ${process.env.ZOOM_REDIRECT_URI}`);

  head("3. OAuth URL builder");
  const url = getZoomAuthUrl("test-state");
  const parsed = new URL(url);
  if (parsed.origin + parsed.pathname !== "https://zoom.us/oauth/authorize") {
    fail(`Unexpected authorize URL: ${parsed.origin + parsed.pathname}`);
  }
  pass("Authorize URL: https://zoom.us/oauth/authorize");
  if (parsed.searchParams.get("client_id") !== process.env.ZOOM_CLIENT_ID) fail("client_id mismatch");
  pass(`client_id matches env`);
  if (parsed.searchParams.get("redirect_uri") !== process.env.ZOOM_REDIRECT_URI) fail("redirect_uri mismatch");
  pass(`redirect_uri matches env`);
  if (parsed.searchParams.get("state") !== "test-state") fail("state not forwarded");
  pass("state forwarded");
  if (parsed.searchParams.get("response_type") !== "code") fail("response_type != code");
  pass("response_type=code");
  const scope = parsed.searchParams.get("scope") || "";
  const askedScopes = scope.split(" ");
  for (const s of REQUIRED_SCOPES) {
    if (!askedScopes.includes(s)) fail(`Missing scope: ${s}`);
  }
  pass(`Asking for all ${REQUIRED_SCOPES.length} scopes`);

  head("4. Database connectivity & schema");
  const sql = neon(process.env.DATABASE_URL!);
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name IN ('zoom_access_token','zoom_refresh_token','zoom_token_expires_at','zoom_user_id')
    ORDER BY column_name
  ` as Array<{ column_name: string }>;
  if (cols.length !== 4) fail(`Expected 4 zoom_* columns, found ${cols.length}: ${cols.map(c => c.column_name).join(",")}`);
  pass(`users table has all 4 zoom_* columns`);

  head("5. Users with Zoom connected");
  const connected = await sql`
    SELECT id, email, zoom_user_id, zoom_token_expires_at,
      (zoom_access_token IS NOT NULL) AS has_token,
      (zoom_refresh_token IS NOT NULL) AS has_refresh
    FROM users
    WHERE zoom_access_token IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 5
  ` as Array<{ id: string; email: string; zoom_user_id: string | null; zoom_token_expires_at: Date | null; has_token: boolean; has_refresh: boolean }>;

  if (connected.length === 0) {
    info("No users have connected Zoom yet — live API checks skipped.");
    info("To exercise the live API tests, sign in to the app, open Settings → Zoom → Connect.");
    head("All Phase Zoom static checks passed.");
    return;
  }

  pass(`${connected.length} user(s) with Zoom connected:`);
  for (const u of connected) {
    info(`  ${u.email} (zoom_user_id=${u.zoom_user_id ?? "n/a"}, expires=${u.zoom_token_expires_at ? new Date(u.zoom_token_expires_at).toISOString() : "n/a"})`);
  }
  const target = connected[0];

  head("6. hasZoomConnected helper");
  if (!(await hasZoomConnected(target.id))) fail("hasZoomConnected returned false for a connected user");
  pass("hasZoomConnected returned true");

  head("7. Token freshness / refresh");
  let tokens = await getUserZoomTokens(target.id);
  if (!tokens) fail("getUserZoomTokens returned null for a connected user");
  const skewMs = tokens!.expiresAt.getTime() - Date.now();
  if (skewMs < 60_000) {
    info(`Token expires in ${Math.round(skewMs / 1000)}s — refreshing...`);
    try {
      const refreshed = await refreshZoomToken(tokens!.refreshToken);
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);
      await updateUserZoomTokens(target.id, refreshed.access_token, refreshed.refresh_token, newExpiry, tokens!.zoomUserId);
      tokens = await getUserZoomTokens(target.id);
      pass(`Refreshed — new expiry ${tokens!.expiresAt.toISOString()}`);
    } catch (err) {
      fail(`Refresh failed: ${err instanceof Error ? err.message : err}`);
    }
  } else {
    pass(`Access token valid for ${Math.round(skewMs / 1000 / 60)} more minute(s)`);
  }

  head("8. GET /users/me  (scope: user:read:user)");
  try {
    const me = await getZoomUserInfo(tokens!.accessToken);
    pass(`Zoom user: ${me.email} (id=${me.id}, account=${me.account_id})`);
  } catch (err) {
    fail(`getZoomUserInfo failed — likely missing user:read:user scope. Reconnect after adding it on Zoom. (${err instanceof Error ? err.message : err})`);
  }

  head("9. GET /users/me/recordings  (scope: cloud_recording:read:list_user_recordings)");
  let recordings: Awaited<ReturnType<typeof fetchUserZoomRecordings>>;
  try {
    recordings = await fetchUserZoomRecordings(target.id, 30);
    pass(`Found ${recordings.length} recording(s) in the last 30 days`);
    if (recordings.length > 0) {
      const r = recordings[0];
      info(`  Latest: "${r.topic}" on ${r.startTime.toISOString()}`);
      info(`  Transcript URL: ${r.transcriptUrl ? "present" : "(none — meeting may not have generated a transcript)"}`);
      info(`  Video URL: ${r.videoUrl ? "present" : "(none)"}`);
    }
  } catch (err) {
    fail(`fetchUserZoomRecordings failed: ${err instanceof Error ? err.message : err}`);
  }

  head("10. GET /past_meetings/{uuid}/participants  (scope: meeting:read:list_meeting_participants)");
  if (recordings.length === 0) {
    info("No recordings to test the participants endpoint against — skipped.");
  } else {
    const r = recordings[0];
    try {
      const participants = await getZoomMeetingParticipants(target.id, r.uuid);
      pass(`Fetched ${participants.length} participant(s) for "${r.topic}"`);
      for (const p of participants.slice(0, 5)) {
        info(`  ${p.name}${p.user_email ? ` <${p.user_email}>` : ""}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 4711 is Zoom's "scope not enabled" code, 4711 wrapped in our error string.
      if (msg.includes("4711") || msg.includes("403")) {
        fail(`Participants call failed with scope error. Add 'meeting:read:list_meeting_participants' in Zoom Marketplace and reconnect. (${msg})`);
      }
      fail(`Participants call failed: ${msg}`);
    }
  }

  head("All Phase Zoom checks passed.");
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
