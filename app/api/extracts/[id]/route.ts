import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extracts } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const extract = await extracts.updateExtract(id, body);

    if (!extract) {
      return NextResponse.json({ error: "Extract not found" }, { status: 404 });
    }

    return NextResponse.json({ extract });
  } catch (error) {
    console.error("Error updating extract:", error);
    return NextResponse.json(
      { error: "Failed to update extract" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // First delete associated tags
    await extracts.removeAllExtractTags(id);

    // Then delete the extract
    const deleted = await extracts.deleteExtract(id);

    if (!deleted) {
      return NextResponse.json({ error: "Extract not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting extract:", error);
    return NextResponse.json(
      { error: "Failed to delete extract" },
      { status: 500 }
    );
  }
}
