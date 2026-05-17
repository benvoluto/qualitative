import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extractRules } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rules = await extractRules.getExtractRules();
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Error fetching extract rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch extract rules" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, summary, quotes, action_items, is_active, tagIds } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const rule = await extractRules.createExtractRule({
      name,
      summary,
      quotes: quotes || [],
      action_items: action_items || [],
      is_active: is_active ?? true,
    });

    // Set tags if provided
    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
      await extractRules.setExtractRuleTags(rule.id, tagIds);
    }

    // Return rule with tags
    const ruleWithTags = await extractRules.getExtractRuleWithTags(rule.id);

    return NextResponse.json({ rule: ruleWithTags }, { status: 201 });
  } catch (error) {
    console.error("Error creating extract rule:", error);
    return NextResponse.json(
      { error: "Failed to create extract rule" },
      { status: 500 }
    );
  }
}
