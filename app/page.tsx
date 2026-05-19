import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PLANS } from "@/lib/billing/plans";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { Logo } from "@/components/logo";

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
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <Logo width={32} height={32} className="rounded-md" />
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
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 sm:pt-32 sm:pb-20 text-center">
          <Logo width={130} height={130} className="mx-auto" />
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-gray-900 dark:text-white max-w-[70%] mx-auto">
            Better & inexpensive qualitative insights from your user research interviews.
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-gray-600 dark:text-gray-400 max-w-[70%] mx-auto">
            Built by a user researcher for user researchers, Qualitative reads your meeting transcripts, breaks them down into short "sticky note"-length items, and exports everything easily so you can do your own analysis.
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
        <section className="">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-0">
            <figure className="relative">
              <div className="relative rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-6 sm:p-8 shadow-sm">
                <blockquote className="text-base sm:text-lg leading-relaxed text-gray-800 dark:text-gray-100 space-y-4">
                  <p>
                    Qualitative is better than using AI by itself to extract insights from your
                    research interviews. It uses a proprietary method of rules and extracts to make a set of "sticky notes" that import easily into Miro, FigJam, Google Sheets, or other tools so you can do your own anaylsis more easily.
                  </p>
                  <p>
                    I built this for myself, and I much prefer it to any other method, including
                    apps that cost a lot of money. I am offering it to the user research community
                    at cost because I want to give back, and I believe that the value of these
                    tools should be available to anyone.
                  </p>
                  <p>
                    I&apos;m very curious about your feedback on how well it works and would love
                    to hear from you!
                  </p>
                </blockquote>
              </div>

              <figcaption className="mt-6 ml-12 text-sm text-gray-600 dark:text-gray-400 pb-20">
                — Ben Clemens
              </figcaption>
            </figure>
          </div>
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
                body="Connect Google Meet and/or Zoom. We sync and extract meetings + transcripts."
              />
              <Feature
                step="2"
                title="Configure"
                body="Pick the kinds of insights you care about — feature requests, bug reports, competitive mentions, action items. The AI uses these as guardrails."
              />
              <Feature
                step="3"
                title="Read the receipts"
                body="Every meeting gets a structured summary, tagged extracts, action items, and a draft follow-up email. Search across everything. Export the extracts for use in your own workflows."
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
