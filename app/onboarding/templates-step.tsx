"use client";

import { useState, useTransition } from "react";
import { savePromptTemplateAction, completeOnboardingAction } from "./actions";

type TemplateType = "deal_email" | "customer_email" | "notes";

interface TemplateState {
  custom: string | null;
  default: string;
}

interface TemplatesStepProps {
  templates: Record<TemplateType, TemplateState>;
}

const TEMPLATE_LABELS: Record<TemplateType, string> = {
  deal_email: "Secondary follow-up email",
  customer_email: "Primary follow-up email",
  notes: "Meeting notes summary",
};

const TEMPLATE_DESCRIPTIONS: Record<TemplateType, string> = {
  deal_email:
    "Used when generating follow-up emails for meetings with a Secondary organization.",
  customer_email:
    "Used when generating follow-up emails for meetings with a Primary organization.",
  notes: "Used when generating the meeting notes summary attached to each meeting.",
};

export function TemplatesStep({ templates }: TemplatesStepProps) {
  const [expanded, setExpanded] = useState<TemplateType | null>(null);
  const [editing, setEditing] = useState<TemplateType | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<TemplateType, string>>>({});
  const [state, setState] = useState(templates);
  const [savingType, setSavingType] = useState<TemplateType | null>(null);
  const [isCompleting, startCompleting] = useTransition();

  async function handleSave(type: TemplateType) {
    const draft = drafts[type] ?? "";
    setSavingType(type);
    try {
      await savePromptTemplateAction(type, draft);
      setState((s) => ({
        ...s,
        [type]: { ...s[type], custom: draft.trim() || null },
      }));
      setEditing(null);
    } finally {
      setSavingType(null);
    }
  }

  function handleEdit(type: TemplateType) {
    setDrafts((d) => ({ ...d, [type]: state[type].custom ?? state[type].default }));
    setEditing(type);
    setExpanded(type);
  }

  function handleFinish() {
    startCompleting(async () => {
      await completeOnboardingAction();
    });
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Review your prompt templates
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        These prompts steer the AI when it generates emails and notes from your meetings.
        You can leave the defaults as-is and customize them later, or tweak any of them now.
      </p>

      <ul className="mt-6 space-y-3">
        {(Object.keys(TEMPLATE_LABELS) as TemplateType[]).map((type) => {
          const t = state[type];
          const isOpen = expanded === type;
          const isEditing = editing === type;
          const isCustomized = t.custom !== null;
          const value = t.custom ?? t.default;
          return (
            <li
              key={type}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : type)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
              >
                <div className="flex items-center gap-3 text-left">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {TEMPLATE_LABELS[type]}
                  </span>
                  {isCustomized && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      Customized
                    </span>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isOpen && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {TEMPLATE_DESCRIPTIONS[type]}
                  </p>
                  {isEditing ? (
                    <>
                      <textarea
                        value={drafts[type] ?? ""}
                        onChange={(e) => setDrafts((d) => ({ ...d, [type]: e.target.value }))}
                        rows={20}
                        className="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-gray-900 dark:text-white resize-y"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSave(type)}
                          disabled={savingType === type}
                          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md"
                        >
                          {savingType === type ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <pre className="bg-gray-50 dark:bg-gray-900/40 rounded-md p-3 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                        {value}
                      </pre>
                      <button
                        type="button"
                        onClick={() => handleEdit(type)}
                        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md"
                      >
                        {isCustomized ? "Edit" : "Customize"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex justify-end items-center">
        <button
          type="button"
          onClick={handleFinish}
          disabled={isCompleting}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
        >
          {isCompleting ? "Finishing..." : "Finish setup"}
        </button>
      </div>
    </div>
  );
}
