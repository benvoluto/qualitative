import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { personnel } from "@/lib/db";

/**
 * Search personnel by name or email.
 * GET /api/personnel?q=search_term
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
      // Return all personnel if no query
      const allPersonnel = await personnel.getPersonnel();
      return NextResponse.json({
        success: true,
        personnel: allPersonnel,
        total: allPersonnel.length,
      });
    }

    const results = await personnel.searchPersonnel(query);

    return NextResponse.json({
      success: true,
      personnel: results,
      total: results.length,
    });
  } catch (error) {
    console.error("Personnel search error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to search personnel", details: message },
      { status: 500 }
    );
  }
}

interface CreatePersonnelBody {
  name: string;
  email?: string;
  title?: string;
  hubspot_contact_id?: string;
  company_id?: string;
  customer_id?: string;
}

/**
 * Create a new personnel record.
 * POST /api/personnel
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreatePersonnelBody = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // If hubspot_contact_id is provided, use upsert to avoid duplicates
    if (body.hubspot_contact_id) {
      const newPersonnel = await personnel.upsertPersonnelByHubSpotContactId(
        body.hubspot_contact_id,
        {
          name: body.name,
          email: body.email,
          title: body.title,
          company_id: body.company_id,
          customer_id: body.customer_id,
        }
      );

      return NextResponse.json({
        success: true,
        personnel: newPersonnel,
        created: true,
      });
    }

    // Check if personnel with this email already exists
    if (body.email) {
      const existing = await personnel.getPersonnelByEmail(body.email);
      if (existing) {
        return NextResponse.json({
          success: true,
          personnel: existing,
          created: false,
        });
      }
    }

    // Create new personnel
    const newPersonnel = await personnel.createPersonnel({
      name: body.name,
      email: body.email,
      title: body.title,
      company_id: body.company_id,
      customer_id: body.customer_id,
    });

    return NextResponse.json({
      success: true,
      personnel: newPersonnel,
      created: true,
    });
  } catch (error) {
    console.error("Personnel creation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create personnel", details: message },
      { status: 500 }
    );
  }
}
