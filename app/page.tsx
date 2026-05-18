import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PLANS } from "@/lib/billing/plans";
import { isStripeConfigured } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  // Authenticated users skip the marketing page and go straight to the app.
  // We tolerate a stale/invalid session cookie here (e.g. after NEXTAUTH_SECRET
  // rotation) — in that case treat the visitor as logged out and render the
  // landing. The middleware on protected routes will guide them to sign in again.
  let isAuthed = false;
  try {
    const session = await auth();
    isAuthed = !!session?.user;
  } catch {
    isAuthed = false;
  }
  if (isAuthed) {
    redirect("/app");
  }

  const stripeReady = isStripeConfigured() && PLANS.pro.stripePriceId !== null;

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-gray-900 dark:text-white">
            Qualitative
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 text-center">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Insights from every customer conversation
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-gray-600 dark:text-gray-400">
            Qualitative reads your meeting transcripts, pulls out the feature requests,
            bug reports, and action items that matter, and drafts the follow-up emails — so
            you can stop taking notes and start listening.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-base font-medium rounded-md transition-colors"
            >
              Sign up with Google
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center justify-center px-6 py-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-base font-medium"
            >
              See how it works ↓
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Free for your first {PLANS.free.meetingsPerMonth} meetings each month. No card required.
          </p>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <h2 className="text-3xl font-semibold text-gray-900 dark:text-white text-center">
              How it works
            </h2>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              <Feature
                step="1"
                title="Connect"
                body="Sign in with Google. We pull meetings + transcripts from your Calendar and Drive."
              />
              <Feature
                step="2"
                title="Configure"
                body="Pick the kinds of insights you care about — feature requests, bug reports, competitive mentions, action items. The AI uses these as guardrails."
              />
              <Feature
                step="3"
                title="Read the receipts"
                body="Every meeting gets a structured summary, tagged extracts, action items, and a draft follow-up email. Search across everything."
              />
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="border-t border-gray-200 dark:border-gray-800">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <h2 className="text-3xl font-semibold text-gray-900 dark:text-white text-center">
              Simple pricing
            </h2>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
              <PlanCard
                name={PLANS.free.label}
                price="Free"
                description={PLANS.free.description}
                features={[
                  `${PLANS.free.meetingsPerMonth} meetings per month`,
                  "All AI extraction and email drafts",
                  "Single workspace",
                ]}
                cta={{ label: "Get started", href: "/login" }}
              />
              <PlanCard
                name={PLANS.pro.label}
                price="$3/mo"
                description={PLANS.pro.description}
                highlighted
                features={[
                  "Unlimited meetings",
                  "All integrations",
                  "Priority support",
                ]}
                cta={{
                  label: stripeReady ? "Upgrade after sign-up" : "Coming soon",
                  href: "/login",
                  disabled: !stripeReady,
                }}
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400">
          <p>© {new Date().getFullYear()} Qualitative.</p>
          <nav className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-900 dark:hover:text-white">Terms</Link>
            <Link href="/dpa" className="hover:text-gray-900 dark:hover:text-white">DPA</Link>
            <Link href="/login" className="hover:text-gray-900 dark:hover:text-white">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

interface FeatureProps {
  step: string;
  title: string;
  body: string;
}

function Feature({ step, title, body }: FeatureProps) {
  return (
    <div>
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-medium">
        {step}
      </div>
      <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{body}</p>
    </div>
  );
}

interface PlanCardProps {
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: { label: string; href: string; disabled?: boolean };
  highlighted?: boolean;
}

function PlanCard({ name, price, description, features, cta, highlighted }: PlanCardProps) {
  return (
    <div
      className={`rounded-lg p-6 ${
        highlighted
          ? "bg-white dark:bg-gray-800 border-2 border-blue-600 shadow-lg"
          : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
      }`}
    >
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{name}</h3>
      <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{price}</p>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      <ul className="mt-6 space-y-2 text-sm text-gray-700 dark:text-gray-300">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <Link
        href={cta.disabled ? "#" : cta.href}
        className={`mt-6 inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          cta.disabled
            ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
            : highlighted
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
        }`}
        aria-disabled={cta.disabled}
      >
        {cta.label}
      </Link>
    </div>
  );
}
