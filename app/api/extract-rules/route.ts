import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { extractRules } from "@/lib/db";

export async function GET() {
  try {
    const accountId = await requireAccountId();
    const rules = await extractRules.getExtractRules(accountId);
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Error fetching extract rules:", error);
    return NextResponse.json({ error: "Failed to fetch extract rules" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const accountId = await requireAccountId();

    const body = await request.json();
    const { name, summary, quotes, action_items, is_active, customer_id, tagIds } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const rule = await extractRules.createExtractRule(accountId, {
      name,
      summary,
      quotes: quotes || [],
      action_items: action_items || [],
      is_active: is_active ?? true,
      customer_id: customer_id ?? null,
    });

    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
      await extractRules.setExtractRuleTags(accountId, rule.id, tagIds);
    }

    const ruleWithTags = await extractRules.getExtractRuleWithTags(accountId, rule.id);

    return NextResponse.json({ rule: ruleWithTags }, { status: 201 });
  } catch (error) {
    console.error("Error creating extract rule:", error);
    return NextResponse.json({ error: "Failed to create extract rule" }, { status: 500 });
  }
}
