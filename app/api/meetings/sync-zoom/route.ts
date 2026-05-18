import { NextRequest, NextResponse } from "next/server";
import { requireAccountContext } from "@/lib/account-context";
import { users } from "@/lib/db";
import {
  getUserZoomMeetingsForSync,
  syncUserZoomMeetingToDatabase,
  getZoomMeetingParticipants,
  ZoomReauthRequiredError,
} from "@/lib/zoom";
import { isInternalMeeting, ensureCompaniesAreSynced } from "@/lib/meetings";

/** Maximum duration for this serverless function (seconds) - Vercel Pro allows up to 300s */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { accountId, userId } = await requireAccountContext();
    const user = await users.getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has Zoom connected
    const hasZoom = await users.hasZoomConnected(user.id);
    if (!hasZoom) {
      return NextResponse.json(
        { error: "Zoom is not connected. Please connect Zoom in Settings." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { days = 14, skipExternalIds = [] } = body as {
      days?: number;
      skipExternalIds?: string[];
    };

    const skipSet = new Set<string>(skipExternalIds);

    const companySyncResult = await ensureCompaniesAreSynced(accountId, 1);

    const zoomMeetings = await getUserZoomMeetingsForSync(accountId, user.id, days);

    // Filter out already synced and skipped meetings
    const toSync = zoomMeetings.filter(
      (m) => !m.alreadySynced && !skipSet.has(m.externalId)
    );

    const results = {
      synced: [] as Array<{ id: string; name: string; date: Date }>,
      skipped: 0,
      internalSkipped: 0,
      alreadyExists: 0,
      errors: [] as Array<{ meeting: string; error: string }>,
      unmatchedMeetings: [] as Array<{
        id: string;
        name: string;
        date: string | null;
        domains: string[];
      }>,
      transcriptDownloadFailed: 0,
    };

    results.alreadyExists = zoomMeetings.filter((m) => m.alreadySynced).length;
    results.skipped = skipSet.size;

    for (const zoomMeeting of toSync) {
      try {
        // Fetch participants to check if meeting is internal
        let participantEmails: string[] = [];
        try {
          const participants = await getZoomMeetingParticipants(user.id, zoomMeeting.uuid);
          participantEmails = participants
            .filter((p) => p.user_email)
            .map((p) => p.user_email);
        } catch {
          // Participant fetch may fail for various reasons, continue with host email only
        }

        // Include host email in internal check
        const allEmails = zoomMeeting.hostEmail
          ? [...participantEmails, zoomMeeting.hostEmail]
          : participantEmails;

        // Check if this is an internal meeting (for tracking and marking)
        const isInternal = isInternalMeeting(allEmails);

        const syncResult = await syncUserZoomMeetingToDatabase(accountId, user.id, zoomMeeting);

        // Track transcript download failures
        if (syncResult.transcriptFailed) {
          results.transcriptDownloadFailed++;
          console.error(`[Zoom Sync] Transcript download failed for "${zoomMeeting.topic}" - had URL but download failed`);
        }

        if (isInternal && syncResult.isNew) {
          const { meetings } = await import("@/lib/db");
          await meetings.updateMeeting(accountId, syncResult.meeting.id, { is_internal: true });
          results.internalSkipped++;
        }

        results.synced.push({
          id: syncResult.meeting.id,
          name: syncResult.meeting.name || zoomMeeting.topic,
          date: zoomMeeting.startTime,
        });

        // Track unmatched meetings for user notification (only for non-internal)
        if (syncResult.isNew && !isInternal && syncResult.unmatchedDomains.length > 0) {
          results.unmatchedMeetings.push({
            id: syncResult.meeting.id,
            name: syncResult.meeting.name || zoomMeeting.topic,
            date: zoomMeeting.startTime.toISOString(),
            domains: syncResult.unmatchedDomains,
          });
        }

      } catch (error) {
        results.errors.push({
          meeting: zoomMeeting.topic,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Build message
    let message = `Synced ${results.synced.length} Zoom meeting(s)`;
    if (results.internalSkipped > 0) {
      message += ` (${results.internalSkipped} internal)`;
    }
    if (results.transcriptDownloadFailed > 0) {
      message += ` (${results.transcriptDownloadFailed} transcript download failed)`;
    }

    return NextResponse.json({
      success: true,
      message,
      ...results,
      companySyncPerformed: companySyncResult.performed,
      companiesSynced: companySyncResult.result?.synced || 0,
    });
  } catch (error) {
    console.error("Zoom sync error:", error);
    if (error instanceof ZoomReauthRequiredError) {
      return NextResponse.json(
        {
          error: error.message,
          requiresReauth: true,
        },
        { status: 401 }
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to sync Zoom meetings",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { accountId, userId } = await requireAccountContext();
    const user = await users.getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has Zoom connected
    const hasZoom = await users.hasZoomConnected(user.id);
    if (!hasZoom) {
      return NextResponse.json(
        { error: "Zoom is not connected", connected: false },
        { status: 400 }
      );
    }

    const meetings = await getUserZoomMeetingsForSync(accountId, user.id, 14);

    return NextResponse.json({
      connected: true,
      meetings: meetings.map((m) => ({
        externalId: m.externalId,
        topic: m.topic,
        startTime: m.startTime,
        duration: m.duration,
        hasTranscript: !!m.transcriptUrl,
        hasVideo: !!m.videoUrl,
        alreadySynced: m.alreadySynced,
      })),
    });
  } catch (error) {
    console.error("Zoom preview error:", error);
    if (error instanceof ZoomReauthRequiredError) {
      return NextResponse.json(
        {
          error: error.message,
          requiresReauth: true,
          connected: false,
        },
        { status: 401 }
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch Zoom meetings",
      },
      { status: 500 }
    );
  }
}
