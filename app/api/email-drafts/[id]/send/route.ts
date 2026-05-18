import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { emailDrafts } from "@/lib/db";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = await requireAccountId();
    const { id } = await params;
    const draft = await emailDrafts.markEmailDraftAsSent(accountId, id);

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    console.error("Error marking email draft as sent:", error);
    return NextResponse.json({ error: "Failed to mark email draft as sent" }, { status: 500 });
  }
}
