import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { customers } from "@/lib/db";
import { CustomerType } from "@/lib/db/types";

interface CreateCustomerBody {
  name?: unknown;
  customer_type?: unknown;
  domain?: unknown;
  address?: unknown;
}

function isCustomerType(value: unknown): value is CustomerType {
  return value === "customer" || value === "deal";
}

export async function POST(request: NextRequest) {
  const accountId = await requireAccountId();
  const body = (await request.json()) as CreateCustomerBody;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const customerType: CustomerType = isCustomerType(body.customer_type)
    ? body.customer_type
    : "customer";
  const domain = typeof body.domain === "string" ? body.domain.trim() || null : null;
  const address = typeof body.address === "string" ? body.address.trim() || null : null;

  const customer = await customers.createCustomer(accountId, {
    name,
    customer_type: customerType,
    domain,
    address,
  });

  return NextResponse.json({ customer }, { status: 201 });
}
