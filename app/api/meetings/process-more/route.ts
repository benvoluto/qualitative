import { NextResponse } from "next/server";
import { requireAccountContext } from "@/lib/account-context";
import { users, meetings } from "@/lib/db";
import { autoProcessAndExtract } from "@/lib/meetings";

export const maxDuration = 300;

const MAX_PROCESS_BATCH = 5;

export async function GET() {
  try {
    const { accountId } = await requireAccountContext();
    const unprocessedCount = await meetings.getUnprocessedMeetingsCount(accountId);

    return NextResponse.json({
      unprocessedCount,
      hasMore: unprocessedCount > 0,
    });
  } catch (error) {
    console.error("Error checking unprocessed meetings:", error);
    return NextResponse.json({ error: "Failed to check unprocessed meetings" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const { accountId, userId } = await requireAccountContext();

    const user = await users.getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const unprocessedMeetings = await meetings.getUnprocessedMeetings(accountId, MAX_PROCESS_BATCH);

    if (unprocessedMeetings.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No unprocessed meetings found",
        remainingCount: 0,
      });
    }

    let processedCount = 0;
    const processPromises = unprocessedMeetings.map((meeting) =>
      autoProcessAndExtract(accountId, meeting.id, user.id)
        .then((result) => {
          if (result.extracted) processedCount++;
        })
        .catch((err) => {
          console.error(`[ProcessMore] Failed for ${meeting.id}:`, err);
        })
    );

    await Promise.all(processPromises);

    const remainingCount = await meetings.getUnprocessedMeetingsCount(accountId);

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
    return NextResponse.json({ error: "Failed to process meetings", details: message }, { status: 500 });
  }
}
