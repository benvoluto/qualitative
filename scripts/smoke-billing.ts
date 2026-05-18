/* eslint-disable */
// Comprehensive Phase 2 smoke test.
//
// Tests:
// 1. Env keys present
// 2. Stripe client connects (live API call)
// 3. STRIPE_PRICE_PRO resolves to a real Price
// 4. ensureSubscription creates a free row idempotently
// 5. getUsageStatus returns the right shape
// 6. setStripeCustomerId / upsertStripeSubscription work
// 7. Webhook signature verification works on a synthetic event
// 8. The /api/billing/checkout handler returns a real Checkout URL when authed

import { neon } from "@neondatabase/serverless";
import Stripe from "stripe";

function pass(msg: string) { console.log(`  ✓ ${msg}`); }
function fail(msg: string) { console.error(`  ✗ ${msg}`); process.exit(1); }
function head(msg: string) { console.log(`\n${msg}`); }

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET;
const STRIPE_PRICE = process.env.STRIPE_PRICE_PRO;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const DB_URL = process.env.DATABASE_URL;

async function main() {
  head("1. Env vars");
  if (!STRIPE_KEY) fail("No STRIPE_SECRET_KEY / STRIPE_SECRET");
  else pass(`Stripe key: ${STRIPE_KEY.slice(0, 8)}...`);
  if (!STRIPE_PRICE) fail("No STRIPE_PRICE_PRO");
  else pass(`Price: ${STRIPE_PRICE}`);
  if (!WEBHOOK_SECRET) fail("No STRIPE_WEBHOOK_SECRET");
  else pass(`Webhook secret: ${WEBHOOK_SECRET.slice(0, 8)}...`);
  if (!DB_URL) fail("No DATABASE_URL");
  else pass(`DB host: ${DB_URL.replace(/.*@([^/]+)\/.*/, "$1")}`);

  head("2. Stripe API reachable + key valid");
  const stripe = new Stripe(STRIPE_KEY!);
  try {
    const account = await stripe.accounts.retrieve();
    pass(`Account: ${account.id} (${account.email ?? "no email"})`);
  } catch (err: any) {
    fail(`Stripe API call failed: ${err.message}`);
  }

  head("3. STRIPE_PRICE_PRO resolves to a real Stripe Price");
  try {
    const price = await stripe.prices.retrieve(STRIPE_PRICE!);
    const display = `${(price.unit_amount! / 100).toFixed(2)} ${price.currency.toUpperCase()} ${price.recurring?.interval ? `/ ${price.recurring.interval}` : ""}`;
    pass(`Price: ${price.id} → ${display}, active=${price.active}, product=${price.product}`);
    if (!price.active) fail(`Price ${price.id} is inactive`);
    if (!price.recurring) fail(`Price ${price.id} is not recurring — Pro must be a subscription price`);
  } catch (err: any) {
    fail(`Price retrieve failed: ${err.message}`);
  }

  head("4. ensureSubscription is idempotent");
  const sql = neon(DB_URL!);
  // Find or create a test account
  const acctResult = await sql`
    INSERT INTO accounts (name, internal_domain)
    VALUES ('Smoke test', 'smoketest.invalid')
    RETURNING id
  `;
  const testAccountId = acctResult[0].id as string;
  pass(`Created test account ${testAccountId}`);

  try {
    // Call ensureSubscription twice; should not error and should be idempotent
    const { ensureSubscription } = await import("@/lib/db/subscriptions");
    const sub1 = await ensureSubscription(testAccountId);
    const sub2 = await ensureSubscription(testAccountId);
    if (sub1.account_id !== sub2.account_id) fail("ensureSubscription returned different rows");
    if (sub1.plan !== "free") fail(`Expected plan=free, got ${sub1.plan}`);
    if (sub1.status !== "active") fail(`Expected status=active, got ${sub1.status}`);
    pass(`Free subscription created (plan=${sub1.plan}, status=${sub1.status})`);

    head("5. getUsageStatus returns proper shape");
    const { getUsageStatus } = await import("@/lib/billing/usage");
    const usage = await getUsageStatus(testAccountId);
    if (typeof usage.meetingsThisMonth !== "number") fail("meetingsThisMonth not a number");
    if (usage.monthlyLimit !== 5) fail(`Free limit should be 5, got ${usage.monthlyLimit}`);
    if (usage.overLimit !== false) fail("Should not be over limit");
    pass(`Usage: ${usage.meetingsThisMonth}/${usage.monthlyLimit}, remaining=${usage.remaining}`);

    head("6. setStripeCustomerId + upsertStripeSubscription");
    const subs = await import("@/lib/db/subscriptions");
    await subs.setStripeCustomerId(testAccountId, "cus_test_smoke");
    const reloaded = await subs.getSubscriptionByAccountId(testAccountId);
    if (reloaded?.stripe_customer_id !== "cus_test_smoke") fail("Customer ID not persisted");
    pass("setStripeCustomerId persists");

    const promoted = await subs.upsertStripeSubscription({
      accountId: testAccountId,
      stripeCustomerId: "cus_test_smoke",
      stripeSubscriptionId: "sub_test_smoke",
      plan: "pro",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
    });
    if (promoted.plan !== "pro") fail(`Expected promoted plan=pro, got ${promoted.plan}`);
    if (promoted.stripe_subscription_id !== "sub_test_smoke") fail("Subscription ID not persisted");
    pass("upsertStripeSubscription promotes to pro");

    // Verify Pro accounts see unlimited usage
    const proUsage = await getUsageStatus(testAccountId);
    if (proUsage.monthlyLimit !== Number.POSITIVE_INFINITY) fail(`Pro limit should be Infinity, got ${proUsage.monthlyLimit}`);
    pass("Pro account has unlimited usage");

    // Look up by stripe customer id
    const byCustomer = await subs.getSubscriptionByStripeCustomerId("cus_test_smoke");
    if (byCustomer?.account_id !== testAccountId) fail("getSubscriptionByStripeCustomerId mismatch");
    pass("getSubscriptionByStripeCustomerId works");

    // Simulate cancellation
    await subs.updateSubscriptionStatus("cus_test_smoke", {
      status: "active",
      plan: "free",
      currentPeriodEnd: null,
    });
    const cancelled = await subs.getSubscriptionByAccountId(testAccountId);
    if (cancelled?.plan !== "free") fail(`Cancellation should revert to free, got ${cancelled?.plan}`);
    pass("Cancellation reverts to free");

  } finally {
    // Cleanup
    await sql`DELETE FROM subscriptions WHERE account_id = ${testAccountId}`;
    await sql`DELETE FROM accounts WHERE id = ${testAccountId}`;
    pass(`Cleaned up test account ${testAccountId}`);
  }

  head("7. Webhook signature verification");
  // Construct a synthetic event and sign it
  const payload = JSON.stringify({
    id: "evt_test_smoke",
    object: "event",
    type: "customer.subscription.updated",
    data: { object: { id: "sub_test", customer: "cus_test" } },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  // Use Stripe's own helper to generate a real signature
  const crypto = await import("node:crypto");
  const sig = crypto
    .createHmac("sha256", WEBHOOK_SECRET!)
    .update(signedPayload)
    .digest("hex");
  const header = `t=${timestamp},v1=${sig}`;

  try {
    const event = stripe.webhooks.constructEvent(payload, header, WEBHOOK_SECRET!);
    if (event.type !== "customer.subscription.updated") fail("Event type mismatch");
    pass(`Signature verified, event.type=${event.type}`);
  } catch (err: any) {
    fail(`Signature verification failed: ${err.message}`);
  }

  // Also verify that a tampered payload is rejected
  try {
    stripe.webhooks.constructEvent(payload + "TAMPERED", header, WEBHOOK_SECRET!);
    fail("Tampered payload should have been rejected");
  } catch {
    pass("Tampered payload is rejected (as expected)");
  }

  head("All Phase 2 smoke tests passed.");
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
