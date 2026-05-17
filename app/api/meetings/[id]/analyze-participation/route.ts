import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { reanalyzeParticipation } from "@/lib/extraction/process";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: meetingId } = await params;
    const result = await reanalyzeParticipation(meetingId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      participatedCount: result.participatedCount,
      invitedCount: result.invitedCount,
      message: `Analyzed participation: ${result.participatedCount} participated, ${result.invitedCount} invited only`,
    });
  } catch (error) {
    console.error("Error analyzing participation:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to analyze participation: ${message}` },
      { status: 500 }
    );
  }
}
