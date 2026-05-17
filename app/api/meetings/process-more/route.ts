import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { users, meetings } from "@/lib/db";
import { autoProcessAndExtract } from "@/lib/meetings";

/** Maximum duration for this serverless function (seconds) - Vercel Pro allows up to 300s */
export const maxDuration = 300;

/** Maximum number of meetings to auto-process per batch */
const MAX_PROCESS_BATCH = 5;

/**
 * GET: Check how many synced meetings don't have extracts
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const unprocessedCount = await meetings.getUnprocessedMeetingsCount();

    return NextResponse.json({
      unprocessedCount,
      hasMore: unprocessedCount > 0,
    });
  } catch (error) {
    console.error("Error checking unprocessed meetings:", error);
    return NextResponse.json(
      { error: "Failed to check unprocessed meetings" },
      { status: 500 }
    );
  }
}

/**
 * POST: Process the next batch of unprocessed meetings
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await users.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get unprocessed meetings (most recent first)
    const unprocessedMeetings = await meetings.getUnprocessedMeetings(MAX_PROCESS_BATCH);

    if (unprocessedMeetings.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No unprocessed meetings found",
        remainingCount: 0,
      });
    }

    // Process the meetings
    let processedCount = 0;
    const processPromises = unprocessedMeetings.map((meeting) =>
      autoProcessAndExtract(meeting.id, user.id)
        .then((result) => {
          if (result.extracted) {
            processedCount++;
          }
          console.log(`[ProcessMore] Result for ${meeting.id}:`, result);
        })
        .catch((err) => {
          console.error(`[ProcessMore] Failed for ${meeting.id}:`, err);
        })
    );

    await Promise.all(processPromises);

    // Check how many remain
    const remainingCount = await meetings.getUnprocessedMeetingsCount();

    return NextResponse.json({
      success: true,
      processed: processedCount,
      message: `Processed ${processedCount} meeting${processedCount !== 1 ? "s" : ""}`,
      remainingCount,
      hasMore: remainingCount > 0,
    });
  } catch (error) {
    console.error("Error processing meetings:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to process meetings", details: message },
      { status: 500 }
    );
  }
}
