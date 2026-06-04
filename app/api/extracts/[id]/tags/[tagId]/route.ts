import { NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { extracts } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  try {
    const accountId = await requireAccountId();
    const { id: extractId, tagId } = await params;
    await extracts.removeExtractTag(accountId, extractId, tagId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error detaching tag from extract:", error);
    return NextResponse.json({ error: "Failed to detach tag" }, { status: 500 });
  }
}
