import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { users } from "@/lib/db";
import { fetchUserZoomRecordings } from "@/lib/zoom/meetings";
import { getDb } from "@/lib/db/client";
import { ZoomReauthRequiredError } from "@/lib/zoom";

/** Maximum duration for this serverless function (seconds) */
export const maxDuration = 300;

interface BackfillResult {
  updated: number;
  skipped: number;
  noPasscode: number;
  errors: string[];
}

/**
 * POST /api/meetings/backfill-passcodes
 * Backfills recording_passcode and updates recording_url with ?pwd= for existing Zoom meetings.
 * Fetches recording_play_passcode from the Zoom API and matches to DB meetings by external_id.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await users.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hasZoom = await users.hasZoomConnected(user.id);
    if (!hasZoom) {
      return NextResponse.json(
        { error: "Zoom is not connected. Please connect Zoom in Settings." },
        { status: 400 }
      );
    }

    const sql = getDb();

    // Fetch Zoom meetings for a wide window to cover existing data
    const zoomMeetings = await fetchUserZoomRecordings(user.id, 90);

    const result: BackfillResult = {
      updated: 0,
      skipped: 0,
      noPasscode: 0,
      errors: [],
    };

    for (const meeting of zoomMeetings) {
      const externalId = `zoom_${meeting.uuid}`;

      try {
        // Find the existing DB meeting
        const existing = await sql`
          SELECT id, recording_url, recording_passcode
          FROM meetings
          WHERE external_id = ${externalId}
        `;

        if (existing.length === 0) {
          result.skipped++;
          continue;
        }

        const dbMeeting = existing[0] as {
          id: string;
          recording_url: string | null;
          recording_passcode: string | null;
        };

        // Skip if already has a passcode set
        if (dbMeeting.recording_passcode) {
          result.skipped++;
          continue;
        }

        if (!meeting.password) {
          result.noPasscode++;
          continue;
        }

        // Build updated recording URL with ?pwd= if applicable
        let updatedUrl = dbMeeting.recording_url;
        if (updatedUrl && !updatedUrl.includes("pwd=") && !updatedUrl.startsWith("drive:")) {
          updatedUrl = `${updatedUrl}?pwd=${meeting.password}`;
        }

        await sql`
          UPDATE meetings
          SET recording_passcode = ${meeting.password},
              recording_url = ${updatedUrl},
              updated_at = NOW()
          WHERE id = ${dbMeeting.id}
        `;

        result.updated++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`${meeting.topic}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Backfilled ${result.updated} meeting(s). ${result.skipped} skipped (already had passcode or not in DB). ${result.noPasscode} had no passcode in Zoom.`,
      ...result,
    });
  } catch (error) {
    console.error("Backfill passcodes error:", error);
    if (error instanceof ZoomReauthRequiredError) {
      return NextResponse.json(
        { error: error.message, requiresReauth: true },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to backfill passcodes" },
      { status: 500 }
    );
  }
}
