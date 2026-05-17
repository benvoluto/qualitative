import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { emailDrafts } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const draft = await emailDrafts.markEmailDraftAsSent(id);

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    console.error("Error marking email draft as sent:", error);
    return NextResponse.json(
      { error: "Failed to mark email draft as sent" },
      { status: 500 }
    );
  }
}
