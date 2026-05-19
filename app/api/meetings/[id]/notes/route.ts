import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { meetings } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const accountId = await requireAccountId();
  const { id } = await params;
  const meeting = await meetings.getMeetingById(accountId, id);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }
  return NextResponse.json({
    notes: meeting.user_notes,
    meetingStatus: meeting.workflow_status,
  });
}
