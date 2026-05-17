import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extractRules } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const rule = await extractRules.getExtractRuleById(id);

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const tagIds = await extractRules.getExtractRuleTagIds(id);

    return NextResponse.json({ rule, tagIds });
  } catch (error) {
    console.error("Error fetching extract rule:", error);
    return NextResponse.json(
      { error: "Failed to fetch extract rule" },
      { status: 500 }
    );
  }
}

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

    const rule = await extractRules.updateExtractRule(id, {
      name: body.name,
      summary: body.summary,
      quotes: body.quotes,
      action_items: body.action_items,
      is_active: body.is_active,
    });

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    // Update tags if provided (even if empty array, to allow clearing tags)
    if (body.tagIds !== undefined && Array.isArray(body.tagIds)) {
      await extractRules.setExtractRuleTags(id, body.tagIds);
    }

    // Return rule with updated tags
    const ruleWithTags = await extractRules.getExtractRuleWithTags(id);

    return NextResponse.json({ rule: ruleWithTags });
  } catch (error) {
    console.error("Error updating extract rule:", error);
    return NextResponse.json(
      { error: "Failed to update extract rule" },
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
    const deleted = await extractRules.deleteExtractRule(id);

    if (!deleted) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting extract rule:", error);
    return NextResponse.json(
      { error: "Failed to delete extract rule" },
      { status: 500 }
    );
  }
}
