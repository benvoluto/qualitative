import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { companies } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const accountId = await requireAccountId();

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query || query.trim().length < 1) {
      const allCompanies = await companies.getCompanies(accountId);
      return NextResponse.json({
        success: true,
        companies: allCompanies,
        total: allCompanies.length,
      });
    }

    const results = await companies.searchCompanies(accountId, query);

    return NextResponse.json({
      success: true,
      companies: results,
      total: results.length,
    });
  } catch (error) {
    console.error("Company search error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to search companies", details: message }, { status: 500 });
  }
}
