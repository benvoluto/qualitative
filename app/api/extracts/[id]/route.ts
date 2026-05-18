import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { extracts } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = await requireAccountId();
    const { id } = await params;
    const body = await request.json();

    const extract = await extracts.updateExtract(accountId, id, body);

    if (!extract) {
      return NextResponse.json({ error: "Extract not found" }, { status: 404 });
    }

    return NextResponse.json({ extract });
  } catch (error) {
    console.error("Error updating extract:", error);
    return NextResponse.json({ error: "Failed to update extract" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = await requireAccountId();
    const { id } = await params;

    await extracts.removeAllExtractTags(accountId, id);
    const deleted = await extracts.deleteExtract(accountId, id);

    if (!deleted) {
      return NextResponse.json({ error: "Extract not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting extract:", error);
    return NextResponse.json({ error: "Failed to delete extract" }, { status: 500 });
  }
}
