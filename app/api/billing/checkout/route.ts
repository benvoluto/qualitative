import { NextRequest, NextResponse } from "next/server";
import { requireAccountContext } from "@/lib/account-context";
import { accounts, subscriptions } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import { PLANS } from "@/lib/billing/plans";
import { SubscriptionPlan } from "@/lib/db/types";

/**
 * Create a Stripe Checkout session for the requested plan.
 * POST body: { plan: "pro" }
 */
export async function POST(request: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
    }

    const { accountId, email } = await requireAccountContext();

    const body = await request.json().catch(() => ({}));
    const plan = body.plan as SubscriptionPlan | undefined;

    if (plan !== "pro") {
      return NextResponse.json({ error: "Only the 'pro' plan can be purchased" }, { status: 400 });
    }

    const priceId = PLANS.pro.stripePriceId;
    if (!priceId) {
      return NextResponse.json(
        { error: "STRIPE_PRICE_PRO is not configured" },
        { status: 503 }
      );
    }

    const account = await accounts.getAccountById(accountId);
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const subscription = await subscriptions.ensureSubscription(accountId);
    const stripe = getStripe();

    // Reuse the existing Stripe Customer if we have one; otherwise create.
    let customerId = subscription.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: account.name,
        metadata: { account_id: accountId },
      });
      customerId = customer.id;
      await subscriptions.setStripeCustomerId(accountId, customerId);
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?status=success`,
      cancel_url: `${origin}/billing?status=cancelled`,
      // account_id mirrored on the subscription so the webhook can route updates.
      subscription_data: {
        metadata: { account_id: accountId },
      },
      client_reference_id: accountId,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to start checkout", details: message }, { status: 500 });
  }
}
