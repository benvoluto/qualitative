import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processMeetingTranscript } from "@/lib/google";
import { transcribeMeetingRecording } from "@/lib/gemini";
import { processZoomMeetingTranscript } from "@/lib/zoom";
import { processTeamsMeetingTranscript } from "@/lib/teams";
import { users, meetings } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";

// Extend timeout for transcript processing (requires Vercel Pro)
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let lockAcquired = false;

  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await users.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Atomically acquire processing lock to prevent concurrent processing
    const meeting = await meetings.acquireProcessingLock(id);
    if (!meeting) {
      // Check if meeting exists but is already being processed
      const existingMeeting = await meetings.getMeetingById(id);
      if (!existingMeeting) {
        return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Meeting is already being processed", status: existingMeeting.workflow_status },
        { status: 409 }
      );
    }
    lockAcquired = true;
    console.log(`[Process] Starting transcript processing for meeting ${id} (${meeting.name})`);


    // Route based on meeting source
    const source = meeting.source;

    // Handle Zoom meetings
    if (source === "zoom") {
      console.log(`[Process] Processing Zoom meeting ${id}`);
      const result = await processZoomMeetingTranscript(id);

      if (result.transcript) {
        console.log(`[Process] SUCCESS: Zoom transcript retrieved for meeting ${id}, source: ${result.source}`);
        await meetings.releaseProcessingLock(id, "transcribed");
        await trackEvent("meeting_processed", { source: "zoom", transcript_source: result.source });
        return NextResponse.json({
          success: true,
          source: result.source,
          message: "Transcript retrieved from Zoom",
        });
      }

      // No transcript available - use Gemini if recording exists
      if (meeting.recording_url) {
        console.log(`[Process] FAILED: No Zoom transcript for meeting ${id}, recording exists but Gemini not supported`);
        await meetings.releaseProcessingLock(id, "failed");
        return NextResponse.json({
          success: false,
          needsGemini: true,
          error: "No transcript available from Zoom. Recording exists but Gemini transcription for external URLs is not yet supported.",
        }, { status: 400 });
      }

      console.log(`[Process] FAILED: No transcript or recording for Zoom meeting ${id}`);
      await meetings.releaseProcessingLock(id, "failed");
      return NextResponse.json(
        { success: false, error: "No transcript or recording available" },
        { status: 400 }
      );
    }

    // Handle Teams meetings
    if (source === "teams") {
      if (!user.ms_access_token) {
        await meetings.releaseProcessingLock(id, "pending");
        return NextResponse.json(
          { error: "Microsoft account not connected" },
          { status: 400 }
        );
      }

      console.log(`[Process] Processing Teams meeting ${id}`);
      const result = await processTeamsMeetingTranscript(user.id, id);

      if (result.transcript) {
        console.log(`[Process] SUCCESS: Teams transcript retrieved for meeting ${id}, source: ${result.source}`);
        await meetings.releaseProcessingLock(id, "transcribed");
        await trackEvent("meeting_processed", { source: "teams", transcript_source: result.source });
        return NextResponse.json({
          success: true,
          source: result.source,
          message: "Transcript retrieved from Teams",
        });
      }

      // No transcript available
      console.log(`[Process] FAILED: No Teams transcript for meeting ${id}`);
      await meetings.releaseProcessingLock(id, "failed");
      return NextResponse.json({
        success: false,
        error: "No transcript available from Teams. Meeting may not have been recorded or transcribed.",
      }, { status: 400 });
    }

    // Handle Google Meet / HubSpot / manual meetings (existing logic)
    if (!user.google_access_token) {
      await meetings.releaseProcessingLock(id, "pending");
      return NextResponse.json(
        { error: "Google account not connected" },
        { status: 400 }
      );
    }

    // Check if meeting already has a recording URL pending Gemini transcription
    if (meeting?.recording_url?.startsWith("drive:") && !meeting.transcript) {
      console.log(`[Process] Processing Google Meet recording via Gemini for meeting ${id}`);
      // Use Gemini to transcribe the recording
      const geminiResult = await transcribeMeetingRecording(user.id, id);

      if (geminiResult.success) {
        console.log(`[Process] SUCCESS: Gemini transcript generated for meeting ${id}`);
        await meetings.releaseProcessingLock(id, "transcribed");
        await trackEvent("meeting_processed", { source: "google_meet", transcript_source: "gemini" });
        return NextResponse.json({
          success: true,
          source: "gemini",
          message: "Transcript generated via Gemini AI",
        });
      } else {
        console.log(`[Process] FAILED: Gemini transcription failed for meeting ${id}: ${geminiResult.error}`);
        await meetings.releaseProcessingLock(id, "failed");
        return NextResponse.json(
          { success: false, error: geminiResult.error },
          { status: 400 }
        );
      }
    }

    // Try to get transcript from Google Drive
    console.log(`[Process] Searching for Google Drive transcript for meeting ${id} (${meeting.name})`);
    const result = await processMeetingTranscript(user.id, id);

    if (result.success) {
      // If we found a recording but no transcript, trigger Gemini transcription
      if (result.source === "pending_gemini") {
        console.log(`[Process] Found recording, triggering Gemini transcription for meeting ${id}`);
        const geminiResult = await transcribeMeetingRecording(user.id, id);

        if (geminiResult.success) {
          console.log(`[Process] SUCCESS: Gemini transcript generated for meeting ${id}`);
          await meetings.releaseProcessingLock(id, "transcribed");
          await trackEvent("meeting_processed", { source: "google_meet", transcript_source: "gemini" });
          return NextResponse.json({
            success: true,
            source: "gemini",
            message: "Transcript generated via Gemini AI",
          });
        } else {
          console.log(`[Process] FAILED: Gemini transcription failed for meeting ${id}: ${geminiResult.error}`);
          await meetings.releaseProcessingLock(id, "failed");
          return NextResponse.json(
            { success: false, error: geminiResult.error },
            { status: 400 }
          );
        }
      }

      console.log(`[Process] SUCCESS: Google Drive transcript retrieved for meeting ${id}, source: ${result.source}`);
      await meetings.releaseProcessingLock(id, "transcribed");
      await trackEvent("meeting_processed", { source: "google_meet", transcript_source: result.source });
      return NextResponse.json({
        success: true,
        source: result.source,
        message: "Transcript retrieved successfully",
      });
    } else {
      console.log(`[Process] FAILED: No transcript found for meeting ${id}: ${result.error}`);
      await meetings.releaseProcessingLock(id, "failed");
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error(`[Process] Error processing meeting ${id}:`, error);
    const message = error instanceof Error ? error.message : "Unknown error";

    // Release lock with failed status if we acquired it
    if (lockAcquired) {
      await meetings.releaseProcessingLock(id, "failed");
    }

    return NextResponse.json(
      { error: "Failed to process meeting", details: message },
      { status: 500 }
    );
  }
}
