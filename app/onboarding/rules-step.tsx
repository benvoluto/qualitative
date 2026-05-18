"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DefaultRule } from "@/lib/onboarding/default-rules";
import { seedDefaultRulesAction } from "./actions";

interface RulesStepProps {
  rules: DefaultRule[];
}

export function RulesStep({ rules }: RulesStepProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(rules.map((r) => r.key))
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  }

  function handleContinue() {
    startTransition(async () => {
      await seedDefaultRulesAction(Array.from(selected));
      router.push("/onboarding?step=templates");
    });
  }

  function handleSkip() {
    router.push("/onboarding?step=templates");
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Pick your starting extract rules
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        These rules tell the AI what kinds of insights to pull out of meeting transcripts.
        You can edit, add, or remove rules anytime from the Extract Rules page.
      </p>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        You can add unlimited rules of your own later — these are just a starting point.
      </p>

      <ul className="mt-6 space-y-3">
        {rules.map((rule) => {
          const isChecked = selected.has(rule.key);
          const isOpen = expanded === rule.key;
          return (
            <li
              key={rule.key}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              <div className="flex items-start gap-3 p-4">
                <input
                  type="checkbox"
                  id={`rule-${rule.key}`}
                  checked={isChecked}
                  onChange={() => toggle(rule.key)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor={`rule-${rule.key}`}
                    className="font-medium text-gray-900 dark:text-white cursor-pointer"
                  >
                    {rule.name}
                  </label>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {rule.summary}
                  </p>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : rule.key)}
                    className="mt-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    {isOpen ? "Hide examples" : `Show ${rule.quotes.length} example quotes`}
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="bg-gray-50 dark:bg-gray-900/40 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                  <ul className="space-y-1.5">
                    {rule.quotes.map((q, i) => (
                      <li
                        key={i}
                        className="text-sm text-gray-700 dark:text-gray-300 italic"
                      >
                        &ldquo;{q}&rdquo;
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex justify-between items-center">
        <button
          type="button"
          onClick={handleSkip}
          disabled={isPending}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={isPending}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
        >
          {isPending
            ? "Saving..."
            : selected.size === 0
              ? "Continue →"
              : `Create ${selected.size} rule${selected.size === 1 ? "" : "s"} →`}
        </button>
      </div>
    </div>
  );
}
