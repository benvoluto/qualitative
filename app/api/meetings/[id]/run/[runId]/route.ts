import { NextRequest, NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { requireAccountContext } from "@/lib/account-context";
import { meetings } from "@/lib/db";

/**
 * Status endpoint for a meeting-processing run. The client polls this to know
 * when the durable workflow finishes. We return both the workflow status and the
 * meeting's current workflow_status so the UI can show progress without waiting
 * for the workflow to fully complete.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const { accountId } = await requireAccountContext();
    const { id, runId } = await params;

    const meeting = await meetings.getMeetingById(accountId, id);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const run = getRun(runId);
    const status = await run.status;

    let result: unknown = undefined;
    if (status === "completed") {
      try {
        result = await run.returnValue;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({
          status,
          meetingStatus: meeting.workflow_status,
          error: message,
        });
      }
    }

    return NextResponse.json({
      status,
      meetingStatus: meeting.workflow_status,
      result,
    });
  } catch (error) {
    console.error("Run status error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to get run status", details: message }, { status: 500 });
  }
}
