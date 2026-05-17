import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { meetings, extracts, emailDrafts } from "@/lib/db";

/**
 * POST /api/meetings/deduplicate
 * Manually triggers meeting deduplication process.
 * Removes HubSpot meetings when a matching Google Meet or Zoom meeting exists.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let days = 30;
    try {
      const body = await request.json();
      if (body.days && typeof body.days === "number") {
        days = Math.min(Math.max(body.days, 1), 90);
      }
    } catch {
      // Use defaults
    }

    const result = await meetings.deduplicateMeetings(
      days,
      extracts.transferExtractsToMeeting,
      emailDrafts.transferEmailDraftsToMeeting,
      extracts.getExtractCountByMeetingId
    );

    return NextResponse.json({
      success: true,
      message: result.hubspotMeetingsDeleted > 0
        ? `Removed ${result.hubspotMeetingsDeleted} duplicate HubSpot meeting(s)`
        : "No duplicate meetings found",
      ...result,
    });
  } catch (error) {
    console.error("Deduplication error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to deduplicate meetings", details: message },
      { status: 500 }
    );
  }
}
