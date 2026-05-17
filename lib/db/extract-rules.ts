import { getDb } from "./client";
import { ExtractRule, CreateExtractRule, UpdateExtractRule } from "./types";

export async function getExtractRules(): Promise<ExtractRule[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM extract_rules ORDER BY name`;
  return result as ExtractRule[];
}

export async function getActiveExtractRules(): Promise<ExtractRule[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extract_rules WHERE is_active = true ORDER BY name
  `;
  return result as ExtractRule[];
}

export async function getExtractRuleById(id: string): Promise<ExtractRule | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM extract_rules WHERE id = ${id}`;
  return (result[0] as ExtractRule) || null;
}

export async function createExtractRule(data: CreateExtractRule): Promise<ExtractRule> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO extract_rules (name, summary, quotes, action_items, is_active)
    VALUES (
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

export async function updateExtractRule(id: string, data: UpdateExtractRule): Promise<ExtractRule | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE extract_rules SET
      name = COALESCE(${data.name ?? null}, name),
      summary = COALESCE(${data.summary ?? null}, summary),
      quotes = COALESCE(${data.quotes ? JSON.stringify(data.quotes) : null}, quotes),
      action_items = COALESCE(${data.action_items ? JSON.stringify(data.action_items) : null}, action_items),
      is_active = COALESCE(${data.is_active ?? null}, is_active)
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as ExtractRule) || null;
}

export async function deleteExtractRule(id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM extract_rules WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

export async function toggleExtractRuleActive(id: string): Promise<ExtractRule | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE extract_rules SET is_active = NOT is_active
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as ExtractRule) || null;
}

// Tag management for extract rules
export async function addExtractRuleTag(extractRuleId: string, tagId: string): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO extract_rule_tags (extract_rule_id, tag_id)
    VALUES (${extractRuleId}, ${tagId})
    ON CONFLICT (extract_rule_id, tag_id) DO NOTHING
  `;
}

export async function removeExtractRuleTag(extractRuleId: string, tagId: string): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM extract_rule_tags WHERE extract_rule_id = ${extractRuleId} AND tag_id = ${tagId}
  `;
}

export async function getExtractRuleTagIds(extractRuleId: string): Promise<string[]> {
  const sql = getDb();
  const result = await sql`
    SELECT tag_id FROM extract_rule_tags WHERE extract_rule_id = ${extractRuleId}
  `;
  return (result as Array<{ tag_id: string }>).map((r) => r.tag_id);
}

export async function setExtractRuleTags(extractRuleId: string, tagIds: string[]): Promise<void> {
  const sql = getDb();
  // Remove existing tags
  await sql`DELETE FROM extract_rule_tags WHERE extract_rule_id = ${extractRuleId}`;
  // Add new tags
  for (const tagId of tagIds) {
    await addExtractRuleTag(extractRuleId, tagId);
  }
}

export interface ExtractRuleWithTags extends ExtractRule {
  tags: Array<{ id: string; name: string; color: string | null }>;
}

export async function getExtractRulesWithTags(): Promise<ExtractRuleWithTags[]> {
  const sql = getDb();

  const rulesResult = await sql`SELECT * FROM extract_rules ORDER BY name`;
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

export async function getExtractRuleWithTags(ruleId: string): Promise<ExtractRuleWithTags | null> {
  const sql = getDb();

  const ruleResult = await sql`SELECT * FROM extract_rules WHERE id = ${ruleId}`;
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
