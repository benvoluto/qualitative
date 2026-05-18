import { NextRequest, NextResponse } from "next/server";
import { requireAccountContext } from "@/lib/account-context";
import { processMeetingTranscript } from "@/lib/google";
import { transcribeMeetingRecording } from "@/lib/gemini";
import { processZoomMeetingTranscript } from "@/lib/zoom";
import { processTeamsMeetingTranscript } from "@/lib/teams";
import { users, meetings } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { assertWithinUsage, UsageLimitError } from "@/lib/billing/usage";

export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let lockAcquired = false;
  let accountId: string | null = null;

  try {
    const ctx = await requireAccountContext();
    accountId = ctx.accountId;

    await assertWithinUsage(accountId);

    const user = await users.getUserById(ctx.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const meeting = await meetings.acquireProcessingLock(accountId, id);
    if (!meeting) {
      const existingMeeting = await meetings.getMeetingById(accountId, id);
      if (!existingMeeting) {
        return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Meeting is already being processed", status: existingMeeting.workflow_status },
        { status: 409 }
      );
    }
    lockAcquired = true;

    const source = meeting.source;

    if (source === "zoom") {
      const result = await processZoomMeetingTranscript(accountId, id);

      if (result.transcript) {
        await meetings.releaseProcessingLock(accountId, id, "transcribed");
        await trackEvent("meeting_processed", { source: "zoom", transcript_source: result.source });
        return NextResponse.json({
          success: true,
          source: result.source,
          message: "Transcript retrieved from Zoom",
        });
      }

      if (meeting.recording_url) {
        await meetings.releaseProcessingLock(accountId, id, "failed");
        return NextResponse.json({
          success: false,
          needsGemini: true,
          error: "No transcript available from Zoom. Recording exists but Gemini transcription for external URLs is not yet supported.",
        }, { status: 400 });
      }

      await meetings.releaseProcessingLock(accountId, id, "failed");
      return NextResponse.json(
        { success: false, error: "No transcript or recording available" },
        { status: 400 }
      );
    }

    if (source === "teams") {
      if (!user.ms_access_token) {
        await meetings.releaseProcessingLock(accountId, id, "pending");
        return NextResponse.json({ error: "Microsoft account not connected" }, { status: 400 });
      }

      const result = await processTeamsMeetingTranscript(accountId, user.id, id);

      if (result.transcript) {
        await meetings.releaseProcessingLock(accountId, id, "transcribed");
        await trackEvent("meeting_processed", { source: "teams", transcript_source: result.source });
        return NextResponse.json({
          success: true,
          source: result.source,
          message: "Transcript retrieved from Teams",
        });
      }

      await meetings.releaseProcessingLock(accountId, id, "failed");
      return NextResponse.json({
        success: false,
        error: "No transcript available from Teams. Meeting may not have been recorded or transcribed.",
      }, { status: 400 });
    }

    if (!user.google_access_token) {
      await meetings.releaseProcessingLock(accountId, id, "pending");
      return NextResponse.json({ error: "Google account not connected" }, { status: 400 });
    }

    if (meeting?.recording_url?.startsWith("drive:") && !meeting.transcript) {
      const geminiResult = await transcribeMeetingRecording(accountId, user.id, id);

      if (geminiResult.success) {
        await meetings.releaseProcessingLock(accountId, id, "transcribed");
        await trackEvent("meeting_processed", { source: "google_meet", transcript_source: "gemini" });
        return NextResponse.json({
          success: true,
          source: "gemini",
          message: "Transcript generated via Gemini AI",
        });
      } else {
        await meetings.releaseProcessingLock(accountId, id, "failed");
        return NextResponse.json({ success: false, error: geminiResult.error }, { status: 400 });
      }
    }

    const result = await processMeetingTranscript(accountId, user.id, id);

    if (result.success) {
      if (result.source === "pending_gemini") {
        const geminiResult = await transcribeMeetingRecording(accountId, user.id, id);

        if (geminiResult.success) {
          await meetings.releaseProcessingLock(accountId, id, "transcribed");
          await trackEvent("meeting_processed", { source: "google_meet", transcript_source: "gemini" });
          return NextResponse.json({
            success: true,
            source: "gemini",
            message: "Transcript generated via Gemini AI",
          });
        } else {
          await meetings.releaseProcessingLock(accountId, id, "failed");
          return NextResponse.json({ success: false, error: geminiResult.error }, { status: 400 });
        }
      }

      await meetings.releaseProcessingLock(accountId, id, "transcribed");
      await trackEvent("meeting_processed", { source: "google_meet", transcript_source: result.source });
      return NextResponse.json({
        success: true,
        source: result.source,
        message: "Transcript retrieved successfully",
      });
    } else {
      await meetings.releaseProcessingLock(accountId, id, "failed");
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return NextResponse.json({ error: error.message, code: "usage_limit" }, { status: 402 });
    }
    console.error(`[Process] Error processing meeting ${id}:`, error);
    const message = error instanceof Error ? error.message : "Unknown error";

    if (lockAcquired && accountId) {
      await meetings.releaseProcessingLock(accountId, id, "failed");
    }

    return NextResponse.json(
      { error: "Failed to process meeting", details: message },
      { status: 500 }
    );
  }
}
