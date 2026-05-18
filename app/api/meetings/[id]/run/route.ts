import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { requireAccountContext } from "@/lib/account-context";
import { meetings } from "@/lib/db";
import { assertWithinUsage, UsageLimitError } from "@/lib/billing/usage";
import { processMeetingWorkflow } from "@/lib/workflows/process-meeting";

/**
 * Start the durable processing workflow for a meeting.
 * Returns 202 with a runId immediately — the work continues in the background.
 *
 * Replaces the synchronous /process + /extract two-button flow.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { accountId, userId } = await requireAccountContext();
    await assertWithinUsage(accountId);

    const { id } = await params;
    const meeting = await meetings.getMeetingById(accountId, id);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const run = await start(processMeetingWorkflow, [accountId, userId, id]);

    return NextResponse.json({ runId: run.runId, status: "queued" }, { status: 202 });
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return NextResponse.json({ error: error.message, code: "usage_limit" }, { status: 402 });
    }
    console.error("Run start error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to start processing", details: message }, { status: 500 });
  }
}
