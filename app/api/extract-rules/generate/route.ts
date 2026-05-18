import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { generateExtractionRules, saveGeneratedRules } from "@/lib/gemini";

// Extend timeout for Gemini processing (requires Vercel Pro)
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const accountId = await requireAccountId();

    const body = await request.json();
    const { transcript, notes } = body;

    if (!transcript || !notes) {
      return NextResponse.json(
        { error: "Both transcript and notes are required" },
        { status: 400 }
      );
    }

    // Generate rules using Gemini
    const generatedRules = await generateExtractionRules(transcript, notes);

    if (generatedRules.length === 0) {
      return NextResponse.json(
        { error: "No extraction rules could be generated from the provided content" },
        { status: 400 }
      );
    }

    const savedIds = await saveGeneratedRules(accountId, generatedRules);

    return NextResponse.json({
      success: true,
      rulesCreated: savedIds.length,
      rules: generatedRules,
    });
  } catch (error) {
    console.error("Error generating extraction rules:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate extraction rules", details: message },
      { status: 500 }
    );
  }
}
