import { getDb } from "./client";
import { ExtractRule, CreateExtractRule, UpdateExtractRule } from "./types";

export async function getExtractRules(accountId: string): Promise<ExtractRule[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM extract_rules WHERE account_id = ${accountId} ORDER BY name`;
  return result as ExtractRule[];
}

export async function getActiveExtractRules(accountId: string): Promise<ExtractRule[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extract_rules WHERE account_id = ${accountId} AND is_active = true ORDER BY name
  `;
  return result as ExtractRule[];
}

export async function getExtractRuleById(accountId: string, id: string): Promise<ExtractRule | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM extract_rules WHERE id = ${id} AND account_id = ${accountId}`;
  return (result[0] as ExtractRule) || null;
}

export async function createExtractRule(accountId: string, data: CreateExtractRule): Promise<ExtractRule> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO extract_rules (account_id, name, summary, quotes, action_items, is_active)
    VALUES (
      ${accountId},
      ${data.name},
      ${data.summary ?? null},
      ${JSON.stringify(data.quotes ?? [])},
      ${JSON.stringify(data.action_items ?? [])},
      ${data.is_active ?? true}
    )
    RETURNING *
  `;
  return result[0] as ExtractRule;
}

export async function updateExtractRule(
  accountId: string,
  id: string,
  data: UpdateExtractRule
): Promise<ExtractRule | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE extract_rules SET
      name = COALESCE(${data.name ?? null}, name),
      summary = COALESCE(${data.summary ?? null}, summary),
      quotes = COALESCE(${data.quotes ? JSON.stringify(data.quotes) : null}, quotes),
      action_items = COALESCE(${data.action_items ? JSON.stringify(data.action_items) : null}, action_items),
      is_active = COALESCE(${data.is_active ?? null}, is_active)
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  return (result[0] as ExtractRule) || null;
}

export async function deleteExtractRule(accountId: string, id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`
    DELETE FROM extract_rules WHERE id = ${id} AND account_id = ${accountId} RETURNING id
  `;
  return result.length > 0;
}

export async function toggleExtractRuleActive(accountId: string, id: string): Promise<ExtractRule | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE extract_rules SET is_active = NOT is_active
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  return (result[0] as ExtractRule) || null;
}

// Junction tables (extract_rule_tags) — isolation inherited via the extract_rule_id FK.
// We still verify the parent rule belongs to the account before mutating.
export async function addExtractRuleTag(
  accountId: string,
  extractRuleId: string,
  tagId: string
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO extract_rule_tags (extract_rule_id, tag_id)
    SELECT ${extractRuleId}, ${tagId}
    WHERE EXISTS (SELECT 1 FROM extract_rules WHERE id = ${extractRuleId} AND account_id = ${accountId})
    ON CONFLICT (extract_rule_id, tag_id) DO NOTHING
  `;
}

export async function removeExtractRuleTag(
  accountId: string,
  extractRuleId: string,
  tagId: string
): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM extract_rule_tags
    WHERE extract_rule_id = ${extractRuleId} AND tag_id = ${tagId}
    AND EXISTS (SELECT 1 FROM extract_rules WHERE id = ${extractRuleId} AND account_id = ${accountId})
  `;
}

export async function getExtractRuleTagIds(accountId: string, extractRuleId: string): Promise<string[]> {
  const sql = getDb();
  const result = await sql`
    SELECT tag_id FROM extract_rule_tags ert
    JOIN extract_rules r ON r.id = ert.extract_rule_id
    WHERE ert.extract_rule_id = ${extractRuleId} AND r.account_id = ${accountId}
  `;
  return (result as Array<{ tag_id: string }>).map((r) => r.tag_id);
}

export async function setExtractRuleTags(
  accountId: string,
  extractRuleId: string,
  tagIds: string[]
): Promise<void> {
  const sql = getDb();
  // Confirm the rule belongs to the account before mutating.
  const owns = await sql`
    SELECT 1 FROM extract_rules WHERE id = ${extractRuleId} AND account_id = ${accountId}
  `;
  if (owns.length === 0) return;
  await sql`DELETE FROM extract_rule_tags WHERE extract_rule_id = ${extractRuleId}`;
  for (const tagId of tagIds) {
    await addExtractRuleTag(accountId, extractRuleId, tagId);
  }
}

export interface ExtractRuleWithTags extends ExtractRule {
  tags: Array<{ id: string; name: string; color: string | null }>;
}

export async function getExtractRulesWithTags(accountId: string): Promise<ExtractRuleWithTags[]> {
  const sql = getDb();
  const rulesResult = await sql`
    SELECT * FROM extract_rules WHERE account_id = ${accountId} ORDER BY name
  `;
  const rules = rulesResult as ExtractRule[];

  const rulesWithTags: ExtractRuleWithTags[] = await Promise.all(
    rules.map(async (rule) => {
      const tagsResult = await sql`
        SELECT t.id, t.name, t.color FROM tags t
        JOIN extract_rule_tags ert ON t.id = ert.tag_id
        WHERE ert.extract_rule_id = ${rule.id}
        ORDER BY t.name
      `;
      return {
        ...rule,
        tags: tagsResult as Array<{ id: string; name: string; color: string | null }>,
      };
    })
  );

  return rulesWithTags;
}

export async function getExtractRuleWithTags(
  accountId: string,
  ruleId: string
): Promise<ExtractRuleWithTags | null> {
  const sql = getDb();
  const ruleResult = await sql`
    SELECT * FROM extract_rules WHERE id = ${ruleId} AND account_id = ${accountId}
  `;
  if (ruleResult.length === 0) return null;

  const rule = ruleResult[0] as ExtractRule;
  const tagsResult = await sql`
    SELECT t.id, t.name, t.color FROM tags t
    JOIN extract_rule_tags ert ON t.id = ert.tag_id
    WHERE ert.extract_rule_id = ${rule.id}
    ORDER BY t.name
  `;

  return {
    ...rule,
    tags: tagsResult as Array<{ id: string; name: string; color: string | null }>,
  };
}
