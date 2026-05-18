import { NextRequest, NextResponse } from "next/server";
import { requireAccountContext } from "@/lib/account-context";
import { subscriptions } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";

/**
 * Create a Stripe Customer Portal session so the user can manage their subscription.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
    }

    const { accountId } = await requireAccountContext();
    const subscription = await subscriptions.getSubscriptionByAccountId(accountId);

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer on file. Start a subscription first." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Portal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to open portal", details: message }, { status: 500 });
  }
}
