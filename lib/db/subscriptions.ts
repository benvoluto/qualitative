import { getDb } from "./client";
import { Subscription, SubscriptionPlan, SubscriptionStatus } from "./types";

export async function getSubscriptionByAccountId(accountId: string): Promise<Subscription | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM subscriptions WHERE account_id = ${accountId}`;
  return (result[0] as Subscription) || null;
}

export async function getSubscriptionByStripeCustomerId(
  stripeCustomerId: string
): Promise<Subscription | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM subscriptions WHERE stripe_customer_id = ${stripeCustomerId}
  `;
  return (result[0] as Subscription) || null;
}

/**
 * Ensure an account has a subscription row. Creates a free-tier row if missing.
 * Idempotent — safe to call on every account-context resolve.
 */
export async function ensureSubscription(accountId: string): Promise<Subscription> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO subscriptions (account_id, plan, status)
    VALUES (${accountId}, 'free', 'active')
    ON CONFLICT (account_id) DO UPDATE SET account_id = EXCLUDED.account_id
    RETURNING *
  `;
  return result[0] as Subscription;
}

export async function upsertStripeSubscription(data: {
  accountId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
}): Promise<Subscription> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO subscriptions (
      account_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end
    )
    VALUES (
      ${data.accountId},
      ${data.stripeCustomerId},
      ${data.stripeSubscriptionId},
      ${data.plan},
      ${data.status},
      ${data.currentPeriodEnd}
    )
    ON CONFLICT (account_id) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      plan = EXCLUDED.plan,
      status = EXCLUDED.status,
      current_period_end = EXCLUDED.current_period_end,
      updated_at = NOW()
    RETURNING *
  `;
  return result[0] as Subscription;
}

export async function updateSubscriptionStatus(
  stripeCustomerId: string,
  data: {
    status: SubscriptionStatus;
    plan?: SubscriptionPlan;
    currentPeriodEnd?: Date | null;
    stripeSubscriptionId?: string;
  }
): Promise<Subscription | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE subscriptions SET
      status = ${data.status},
      plan = COALESCE(${data.plan ?? null}, plan),
      current_period_end = COALESCE(${data.currentPeriodEnd ?? null}, current_period_end),
      stripe_subscription_id = COALESCE(${data.stripeSubscriptionId ?? null}, stripe_subscription_id),
      updated_at = NOW()
    WHERE stripe_customer_id = ${stripeCustomerId}
    RETURNING *
  `;
  return (result[0] as Subscription) || null;
}

export async function setStripeCustomerId(
  accountId: string,
  stripeCustomerId: string
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE subscriptions
    SET stripe_customer_id = ${stripeCustomerId}, updated_at = NOW()
    WHERE account_id = ${accountId}
  `;
}

/**
 * Admin-only: toggle the comped flag for an account. Independent of Stripe state —
 * an account that already has a Pro Stripe subscription stays Pro either way; this
 * only matters for accounts whose Stripe plan is free.
 */
export async function setComped(accountId: string, comped: boolean): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE subscriptions
    SET comped = ${comped}, updated_at = NOW()
    WHERE account_id = ${accountId}
  `;
}
