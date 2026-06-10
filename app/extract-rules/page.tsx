import { extractRules, tags, customers } from "@/lib/db";
import { requireAccountId } from "@/lib/account-context";
import { RulesList } from "./rules-list";
import { GenerateRulesForm } from "./generate-rules-form";
import { AddRuleButton } from "./add-rule-button";
import { TagsSection } from "./tags-section";
import { TAG_COLORS } from "@/lib/constants/colors";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function ExtractRulesPage() {
  const accountId = await requireAccountId();
  const rules = await extractRules.getExtractRulesWithTags(accountId);
  const [allTags, usedColors, allCustomers] = await Promise.all([
    tags.getTags(accountId),
    tags.getUsedColors(accountId),
    customers.getCustomers(accountId),
  ]);
  const usedColorSet = new Set(usedColors);
  const availableColors = TAG_COLORS.filter((c) => !usedColorSet.has(c));
  const customerOptions = allCustomers.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      <PageHeader title="Extract Rules" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Add/Generate rules forms */}
          <div className="lg:col-span-1 space-y-6">
            {/* Add Rule action renders into the floating bar */}
            <AddRuleButton tags={allTags} customers={customerOptions} />

            {/* Generate Rules Form */}
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-x-auto p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Generate Rules
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Upload a transcript and your notes to automatically generate extraction rules.
              </p>
              <GenerateRulesForm />
            </div>

            {/* Tags Management */}
            <TagsSection
              tags={allTags}
              availableColors={availableColors}
              allColors={[...TAG_COLORS]}
            />
          </div>

          {/* Right column - Rules list */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-x-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Extraction Rules ({rules.length})
                </h2>
              </div>

              {rules.length === 0 ? (
                <div className="text-center py-8">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <p className="mt-4 text-gray-500 dark:text-gray-400">
                    No extraction rules yet. Generate some by uploading a transcript and notes.
                  </p>
                </div>
              ) : (
                <RulesList rules={rules} allTags={allTags} customers={customerOptions} />
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
