import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { personnel } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const accountId = await requireAccountId();

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query || query.trim().length < 1) {
      const allPersonnel = await personnel.getPersonnel(accountId);
      return NextResponse.json({
        success: true,
        personnel: allPersonnel,
        total: allPersonnel.length,
      });
    }

    const results = await personnel.searchPersonnel(accountId, query);

    return NextResponse.json({
      success: true,
      personnel: results,
      total: results.length,
    });
  } catch (error) {
    console.error("Personnel search error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to search personnel", details: message }, { status: 500 });
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

export async function POST(request: NextRequest) {
  try {
    const accountId = await requireAccountId();

    const body: CreatePersonnelBody = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (body.hubspot_contact_id) {
      const newPersonnel = await personnel.upsertPersonnelByHubSpotContactId(
        accountId,
        body.hubspot_contact_id,
        {
          name: body.name,
          email: body.email,
          title: body.title,
          company_id: body.company_id,
          customer_id: body.customer_id,
        }
      );

      return NextResponse.json({ success: true, personnel: newPersonnel, created: true });
    }

    if (body.email) {
      const existing = await personnel.getPersonnelByEmail(accountId, body.email);
      if (existing) {
        return NextResponse.json({ success: true, personnel: existing, created: false });
      }
    }

    const newPersonnel = await personnel.createPersonnel(accountId, {
      name: body.name,
      email: body.email,
      title: body.title,
      company_id: body.company_id,
      customer_id: body.customer_id,
    });

    return NextResponse.json({ success: true, personnel: newPersonnel, created: true });
  } catch (error) {
    console.error("Personnel creation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to create personnel", details: message }, { status: 500 });
  }
}
