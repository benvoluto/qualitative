import { requireAccountId } from "@/lib/account-context";
import { subscriptions } from "@/lib/db";
import { getUsageStatus } from "@/lib/billing/usage";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { PLANS } from "@/lib/billing/plans";
import { LogoMenu } from "@/components/logo-menu";
import { CheckoutButton, PortalButton } from "./buttons";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const accountId = await requireAccountId();
  const subscription = await subscriptions.ensureSubscription(accountId);
  const usage = await getUsageStatus(accountId);
  const stripeReady = isStripeConfigured() && PLANS.pro.stripePriceId !== null;

  const params = await searchParams;
  const statusBanner =
    params.status === "success"
      ? { kind: "success" as const, text: "Subscription active. Welcome to Pro." }
      : params.status === "cancelled"
        ? { kind: "info" as const, text: "Checkout cancelled — you're still on the Free plan." }
        : null;

  const planLimits = PLANS[subscription.plan];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <LogoMenu />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Billing</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {statusBanner && (
          <div
            className={`rounded-md p-3 text-sm ${
              statusBanner.kind === "success"
                ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
                : "bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
            }`}
          >
            {statusBanner.text}
          </div>
        )}

        {/* Current plan + usage */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Current Plan
              </h2>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                {planLimits.label}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{planLimits.description}</p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                subscription.status === "active" || subscription.status === "trialing"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
              }`}
            >
              {subscription.status}
            </span>
          </div>

          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-5">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Meetings this month
            </h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-gray-900 dark:text-white">
                {usage.meetingsThisMonth}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                / {Number.isFinite(usage.monthlyLimit) ? usage.monthlyLimit : "∞"}
              </span>
            </div>
            {Number.isFinite(usage.monthlyLimit) && (
              <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full ${
                    usage.overLimit ? "bg-red-500" : "bg-blue-600"
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      (usage.meetingsThisMonth / usage.monthlyLimit) * 100
                    )}%`,
                  }}
                />
              </div>
            )}
            {usage.overLimit && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                You&apos;ve reached your monthly limit. Upgrade to Pro to keep processing meetings.
              </p>
            )}
          </div>

          {subscription.current_period_end && (
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Current period ends {new Date(subscription.current_period_end).toLocaleDateString()}
            </p>
          )}

          {subscription.plan !== "free" && stripeReady && (
            <div className="mt-6">
              <PortalButton />
            </div>
          )}
        </section>

        {/* Upgrade card (only shown on free) */}
        {subscription.plan === "free" && (
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upgrade to Pro</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{PLANS.pro.description}</p>
            <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-center gap-2">
                <CheckIcon className="text-green-600 dark:text-green-400" />
                Unlimited meetings per month
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="text-green-600 dark:text-green-400" />
                All integrations
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="text-green-600 dark:text-green-400" />
                Priority support
              </li>
            </ul>
            <div className="mt-6">
              {stripeReady ? (
                <CheckoutButton plan="pro" />
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Billing is not yet configured. Set <code>STRIPE_SECRET_KEY</code> and{" "}
                  <code>STRIPE_PRICE_PRO</code> to enable upgrades.
                </p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`w-4 h-4 ${className}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
