import { redirect } from "next/navigation";
import { requireAccountContext } from "@/lib/account-context";
import { accounts } from "@/lib/db";
import {
  DEFAULT_DEAL_EMAIL_PROMPT,
  DEFAULT_CUSTOMER_EMAIL_PROMPT,
  DEFAULT_NOTES_PROMPT,
} from "@/lib/gemini/email-generation";
import { DEFAULT_RULES } from "@/lib/onboarding/default-rules";
import { WorkspaceStep } from "./workspace-step";
import { RulesStep } from "./rules-step";
import { TemplatesStep } from "./templates-step";

export const dynamic = "force-dynamic";

const STEPS = ["workspace", "rules", "templates"] as const;
type Step = (typeof STEPS)[number];

function parseStep(value: string | string[] | undefined): Step {
  const s = Array.isArray(value) ? value[0] : value;
  return (STEPS as readonly string[]).includes(s ?? "") ? (s as Step) : "workspace";
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const ctx = await requireAccountContext();
  const account = await accounts.getAccountById(ctx.accountId);

  if (!account) {
    // Shouldn't happen — every user has an account. Surface the error.
    redirect("/login");
  }

  const params = await searchParams;
  const step = parseStep(params.step);
  const defaultDomain = ctx.email.split("@")[1]?.toLowerCase() ?? "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Welcome to Qualitative
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            A few quick steps to get your workspace set up.
          </p>
          <StepIndicator current={step} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {step === "workspace" && (
          <WorkspaceStep
            initialName={account.name}
            initialDomain={account.internal_domain || defaultDomain}
            initialAliases={account.internal_domain_aliases}
          />
        )}
        {step === "rules" && <RulesStep rules={DEFAULT_RULES} />}
        {step === "templates" && (
          <TemplatesStep
            templates={{
              deal_email: {
                custom: account.deal_email_prompt_template,
                default: DEFAULT_DEAL_EMAIL_PROMPT,
              },
              customer_email: {
                custom: account.customer_email_prompt_template,
                default: DEFAULT_CUSTOMER_EMAIL_PROMPT,
              },
              notes: {
                custom: account.notes_prompt_template,
                default: DEFAULT_NOTES_PROMPT,
              },
            }}
          />
        )}
      </main>
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const labels: Record<Step, string> = {
    workspace: "Workspace",
    rules: "Extract Rules",
    templates: "Templates",
  };
  return (
    <ol className="mt-6 flex items-center gap-2 text-sm">
      {STEPS.map((s, i) => {
        const isCurrent = s === current;
        const isPast = STEPS.indexOf(current) > i;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                isCurrent
                  ? "bg-blue-600 text-white"
                  : isPast
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={
                isCurrent
                  ? "font-medium text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400"
              }
            >
              {labels[s]}
            </span>
            {i < STEPS.length - 1 && <span className="text-gray-300 dark:text-gray-600 mx-1">→</span>}
          </li>
        );
      })}
    </ol>
  );
}
