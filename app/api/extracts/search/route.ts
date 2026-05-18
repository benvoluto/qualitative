import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { searchExtractsWithCursor, CursorSearchParams } from "@/lib/db/extracts";

/**
 * Search extracts with cursor-based pagination and full-text search
 * GET /api/extracts/search?search=query&cursor=timestamp_id&limit=50&customerId=...&ruleId=...&tagId=...&isActionItem=true&type=customer
 */
export async function GET(request: NextRequest) {
  try {
    const accountId = await requireAccountId();

    const searchParams = request.nextUrl.searchParams;
    const params: CursorSearchParams = {
      search: searchParams.get("search") || undefined,
      cursor: searchParams.get("cursor") || undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
      filters: {},
    };

    // Parse filter parameters
    const customerId = searchParams.get("customerId");
    const ruleId = searchParams.get("ruleId");
    const tagId = searchParams.get("tagId");
    const isActionItem = searchParams.get("isActionItem");
    const type = searchParams.get("type");

    if (customerId) {
      params.filters!.customerId = customerId;
    }
    if (ruleId) {
      params.filters!.ruleId = ruleId;
    }
    if (tagId) {
      params.filters!.tagId = tagId;
    }
    if (isActionItem !== null) {
      params.filters!.isActionItem = isActionItem === "true";
    }
    if (type && (type === "customer" || type === "deal" || type === "internal")) {
      params.filters!.type = type;
    }

    const result = await searchExtractsWithCursor(accountId, params);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error searching extracts:", error);
    return NextResponse.json(
      { error: "Failed to search extracts" },
      { status: 500 }
    );
  }
}
