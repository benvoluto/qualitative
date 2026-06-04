import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { extracts, customers } from "@/lib/db";

interface CreateExtractBody {
  customer_id?: unknown;
  summary?: unknown;
}

/**
 * Create a blank extract owned by an organization. Used by the affinity-map
 * "+ New sticky" button. company_id is derived from the customer when present.
 */
export async function POST(request: NextRequest) {
  try {
    const accountId = await requireAccountId();
    const body = (await request.json()) as CreateExtractBody;
    const customerId =
      typeof body.customer_id === "string" ? body.customer_id : null;
    if (!customerId) {
      return NextResponse.json({ error: "customer_id required" }, { status: 400 });
    }
    const customer = await customers.getCustomerById(accountId, customerId);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    const summary =
      typeof body.summary === "string" ? body.summary : null;
    const extract = await extracts.createExtract(accountId, {
      meeting_id: null,
      customer_id: customerId,
      company_id: customer.company_id,
      summary,
      quotes: [],
      is_action_item: false,
    });
    return NextResponse.json({ extract }, { status: 201 });
  } catch (error) {
    console.error("Error creating extract:", error);
    return NextResponse.json({ error: "Failed to create extract" }, { status: 500 });
  }
}
