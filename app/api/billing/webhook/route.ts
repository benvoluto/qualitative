import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import { subscriptions } from "@/lib/db";
import { PLANS } from "@/lib/billing/plans";
import { SubscriptionPlan, SubscriptionStatus } from "@/lib/db/types";

/**
 * Stripe webhook receiver.
 *
 * Listens for subscription lifecycle events and mirrors them into our
 * subscriptions table. Signature is verified against STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not set" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe webhook] signature verification failed:", message);
    return NextResponse.json({ error: `Signature verification failed: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(stripe, session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
      }
      default:
        // Unhandled — fine to ignore.
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[stripe webhook] handler for ${event.type} failed:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<void> {
  const accountId = session.client_reference_id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  if (!accountId || !customerId || !subscriptionId) {
    console.error("[stripe webhook] checkout.session.completed missing required fields", {
      accountId,
      customerId,
      subscriptionId,
    });
    return;
  }

  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
  const plan = planFromStripeSubscription(stripeSub);

  await subscriptions.upsertStripeSubscription({
    accountId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    plan,
    status: stripeSub.status as SubscriptionStatus,
    currentPeriodEnd: currentPeriodEnd(stripeSub),
  });
}

async function handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  // 'canceled' subscriptions revert the account to the free tier.
  const isCanceled = subscription.status === "canceled";
  const plan: SubscriptionPlan = isCanceled ? "free" : planFromStripeSubscription(subscription);
  const status: SubscriptionStatus = isCanceled
    ? "active" // free tier is "active"
    : (subscription.status as SubscriptionStatus);

  await subscriptions.updateSubscriptionStatus(customerId, {
    status,
    plan,
    currentPeriodEnd: isCanceled ? null : currentPeriodEnd(subscription),
    stripeSubscriptionId: subscription.id,
  });
}

function planFromStripeSubscription(subscription: Stripe.Subscription): SubscriptionPlan {
  const priceId = subscription.items.data[0]?.price.id;
  if (PLANS.pro.stripePriceId && priceId === PLANS.pro.stripePriceId) return "pro";
  return "free";
}

function currentPeriodEnd(subscription: Stripe.Subscription): Date | null {
  // Stripe types changed between API versions — fall back through the available shapes.
  const sub = subscription as unknown as { current_period_end?: number };
  if (typeof sub.current_period_end === "number") {
    return new Date(sub.current_period_end * 1000);
  }
  return null;
}
