import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { meetings, users } from "@/lib/db";
import { features } from "@/lib/features";
import { verifyZoomWebhookSignature, buildZoomUrlValidationResponse } from "@/lib/zoom/webhook";
import { fetchUserZoomRecordings, syncUserZoomMeetingToDatabase, ZoomReauthRequiredError } from "@/lib/zoom";
import { matchMeetingToCompanyByEmails } from "@/lib/meetings";

/**
 * Zoom event subscription webhook.
 *
 * Configure in Zoom Marketplace:
 *   Event Subscription URL: https://YOUR_DOMAIN/api/webhooks/zoom
 *   Events:                  recording.transcript_completed
 *                            (optionally recording.completed if you also want
 *                             notification when the video is ready)
 *
 * Auth:
 *   Zoom signs each request with x-zm-signature using your Secret Token.
 *   Set ZOOM_SECRET_TOKEN in env (Zoom shows it on the Event Subscriptions page).
 *
 * Behavior on receiving a recording.transcript_completed event:
 *   1. Look up the user by payload.object.host_email.
 *   2. Re-fetch their recent recordings to get the full meeting + transcript
 *      details (the webhook payload alone doesn't always include everything).
 *   3. Sync the meeting into our DB with the transcript attached.
 *   4. If the user has the app open, the dashboard's auto-sync picks up the new
 *      transcribed meeting on its next tick. They can then click Process &
 *      Extract to run the durable workflow.
 *
 * We respond 200 quickly even when the work fails — Zoom retries on any non-2xx
 * for up to 24 hours, which is more noise than signal for us.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.ZOOM_SECRET_TOKEN;
  if (!secret) {
    console.error("[zoom webhook] ZOOM_SECRET_TOKEN not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  let payload: ZoomEvent;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // URL validation handshake — fired when you save the endpoint URL in Zoom.
  // Does not include the standard signature headers.
  if (payload.event === "endpoint.url_validation") {
    const plainToken = (payload.payload as { plainToken?: string })?.plainToken;
    if (!plainToken) {
      return NextResponse.json({ error: "Missing plainToken" }, { status: 400 });
    }
    return NextResponse.json(buildZoomUrlValidationResponse(plainToken, secret));
  }

  // Every other event must carry a valid signature.
  const timestamp = request.headers.get("x-zm-request-timestamp");
  const signature = request.headers.get("x-zm-signature");
  if (!verifyZoomWebhookSignature(rawBody, timestamp, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!features.zoom) {
    // Zoom integration disabled — acknowledge so Zoom doesn't retry.
    return NextResponse.json({ received: true, skipped: "feature_disabled" });
  }

  try {
    switch (payload.event) {
      case "recording.transcript_completed":
      case "recording.completed":
        await handleRecordingEvent(payload.payload?.object);
        break;
      default:
        // Unhandled event types — accept silently so Zoom stops retrying.
        break;
    }
  } catch (err) {
    // Log but still 200 — Zoom retries on non-2xx and the meeting will pick
    // up on the next manual or scheduled sync anyway.
    console.error(`[zoom webhook] handler for ${payload.event} failed:`, err);
  }

  return NextResponse.json({ received: true });
}

interface ZoomEvent {
  event: string;
  payload?: {
    object?: ZoomRecordingObject;
  } & Record<string, unknown>;
}

interface ZoomRecordingObject {
  uuid?: string;
  id?: number;
  host_id?: string;
  host_email?: string;
  topic?: string;
}

async function handleRecordingEvent(object?: ZoomRecordingObject): Promise<void> {
  if (!object?.host_email || !object.uuid) {
    console.warn("[zoom webhook] recording event missing host_email or uuid");
    return;
  }

  // Look up the local user by Zoom host email. Case-insensitive — Zoom may
  // send a different case than what's in our DB.
  const sql = getDb();
  const userRows = await sql`
    SELECT id, account_id FROM users
    WHERE LOWER(email) = LOWER(${object.host_email})
       OR LOWER(zoom_user_id) = LOWER(${object.host_id ?? ""})
    LIMIT 1
  ` as Array<{ id: string; account_id: string }>;

  const userRow = userRows[0];
  if (!userRow) {
    // Not our user — silently drop. This is normal if a user disconnected
    // Zoom but the marketplace app subscription is still on their account.
    console.log(`[zoom webhook] no local user for host_email=${object.host_email}`);
    return;
  }

  // Skip the rest if the user has since disconnected Zoom.
  const userTokens = await users.getUserZoomTokens(userRow.id);
  if (!userTokens) {
    console.log(`[zoom webhook] user ${userRow.id} has no Zoom tokens — skipping`);
    return;
  }

  // Already synced? Just touch validation timestamp and return.
  const externalId = `zoom_${object.uuid}`;
  const existing = await meetings.getMeetingByExternalId(userRow.account_id, externalId);

  try {
    // Re-fetch the user's recent recordings to get the full transcript URL.
    // The webhook payload may not include all the fields syncUserZoomMeetingToDatabase
    // expects (download URLs, etc.), so a fresh fetch is more reliable.
    const recordings = await fetchUserZoomRecordings(userRow.id, 7);
    const match = recordings.find((r) => r.uuid === object.uuid);
    if (!match) {
      console.warn(`[zoom webhook] uuid ${object.uuid} not in user ${userRow.id}'s recent recordings`);
      return;
    }

    if (existing && existing.transcript) {
      // Already fully synced. Nothing to do.
      return;
    }

    const result = await syncUserZoomMeetingToDatabase(
      userRow.account_id,
      userRow.id,
      match
    );

    // Match to a company by participant domains — done by syncUser… for new
    // meetings, but if we updated an existing one (rare path), do it here too.
    if (result.isNew && match.hostEmail) {
      await matchMeetingToCompanyByEmails(userRow.account_id, result.meeting.id, [match.hostEmail]);
    }
    console.log(
      `[zoom webhook] synced "${match.topic}" (${match.uuid}) for user ${userRow.id} — workflow_status=${result.meeting.workflow_status}`
    );
  } catch (err) {
    if (err instanceof ZoomReauthRequiredError) {
      console.log(`[zoom webhook] user ${userRow.id} needs Zoom reauth — skipping`);
      return;
    }
    throw err;
  }
}
