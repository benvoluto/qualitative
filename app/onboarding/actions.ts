"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccountContext } from "@/lib/account-context";
import { accounts, extractRules, tags, users } from "@/lib/db";
import { DEFAULT_RULES } from "@/lib/onboarding/default-rules";

/**
 * Step 1: confirm workspace name + internal domain (+ aliases).
 */
export async function saveWorkspaceAction(formData: FormData): Promise<void> {
  const { accountId } = await requireAccountContext();

  const name = String(formData.get("name") ?? "").trim();
  const internalDomain = String(formData.get("internalDomain") ?? "").trim().toLowerCase();
  const aliasesRaw = String(formData.get("aliases") ?? "").trim();

  const internalDomainAliases = aliasesRaw
    .split(/[,\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  if (!name) throw new Error("Workspace name is required");

  await accounts.updateAccount(accountId, {
    name,
    internal_domain: internalDomain || null,
    internal_domain_aliases: internalDomainAliases,
  });

  revalidatePath("/onboarding");
}

/**
 * Step 2: seed selected default extract rules into the account.
 * `selectedKeys` are the keys from DEFAULT_RULES; unselected rules are skipped.
 */
export async function seedDefaultRulesAction(selectedKeys: string[]): Promise<void> {
  const { accountId } = await requireAccountContext();

  const selectedSet = new Set(selectedKeys);
  const toCreate = DEFAULT_RULES.filter((r) => selectedSet.has(r.key));

  for (const rule of toCreate) {
    const created = await extractRules.createExtractRule(accountId, {
      name: rule.name,
      summary: rule.summary,
      quotes: rule.quotes,
      action_items: [],
      is_active: true,
    });

    for (const tagName of rule.tags) {
      const tag = await tags.getOrCreateTag(accountId, tagName, "system");
      await extractRules.addExtractRuleTag(accountId, created.id, tag.id);
    }
  }

  revalidatePath("/onboarding");
}

/**
 * Step 3 (optional): customize one of the prompt templates.
 */
export async function savePromptTemplateAction(
  templateType: "deal_email" | "customer_email" | "notes",
  template: string
): Promise<void> {
  const { accountId } = await requireAccountContext();
  await accounts.updateAccountPromptTemplate(accountId, templateType, template.trim() || null);
  revalidatePath("/onboarding");
}

/**
 * Final step: mark the user as onboarded and redirect to the dashboard.
 */
export async function completeOnboardingAction(): Promise<never> {
  const { userId } = await requireAccountContext();
  await users.markUserOnboarded(userId);
  redirect("/app");
}
