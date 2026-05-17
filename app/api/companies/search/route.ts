import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { companies } from "@/lib/db";

/**
 * Search companies by name or domain.
 * GET /api/companies/search?q=search_term
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query || query.trim().length < 1) {
      // Return all companies if no query
      const allCompanies = await companies.getCompanies();
      return NextResponse.json({
        success: true,
        companies: allCompanies,
        total: allCompanies.length,
      });
    }

    const results = await companies.searchCompanies(query);

    return NextResponse.json({
      success: true,
      companies: results,
      total: results.length,
    });
  } catch (error) {
    console.error("Company search error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to search companies", details: message },
      { status: 500 }
    );
  }
}
