import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { extractRules } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = await requireAccountId();
    const { id } = await params;
    const rule = await extractRules.getExtractRuleById(accountId, id);

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const tagIds = await extractRules.getExtractRuleTagIds(accountId, id);

    return NextResponse.json({ rule, tagIds });
  } catch (error) {
    console.error("Error fetching extract rule:", error);
    return NextResponse.json({ error: "Failed to fetch extract rule" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = await requireAccountId();
    const { id } = await params;
    const body = await request.json();

    const rule = await extractRules.updateExtractRule(accountId, id, {
      name: body.name,
      summary: body.summary,
      quotes: body.quotes,
      action_items: body.action_items,
      is_active: body.is_active,
      customer_id: body.customer_id,
    });

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    if (body.tagIds !== undefined && Array.isArray(body.tagIds)) {
      await extractRules.setExtractRuleTags(accountId, id, body.tagIds);
    }

    const ruleWithTags = await extractRules.getExtractRuleWithTags(accountId, id);

    return NextResponse.json({ rule: ruleWithTags });
  } catch (error) {
    console.error("Error updating extract rule:", error);
    return NextResponse.json({ error: "Failed to update extract rule" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accountId = await requireAccountId();
    const { id } = await params;
    const deleted = await extractRules.deleteExtractRule(accountId, id);

    if (!deleted) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting extract rule:", error);
    return NextResponse.json({ error: "Failed to delete extract rule" }, { status: 500 });
  }
}
