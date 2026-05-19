import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { extracts, meetings } from "@/lib/db";

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
  const list = await extracts.getExtractsWithTagsByMeetingId(accountId, id);
  return NextResponse.json({
    extracts: list,
    meetingStatus: meeting.workflow_status,
  });
}
