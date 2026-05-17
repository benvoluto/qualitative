import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function check() {
  // All tags
  const tags = await sql`SELECT id, name, color FROM tags ORDER BY name`;
  console.log("All tags:");
  tags.forEach((t) => console.log(`  ${t.name} (${t.id.slice(0, 8)}...)`));

  // All extract rules
  const rules = await sql`SELECT id, name FROM extract_rules ORDER BY name`;
  console.log("\nAll extract rules:");
  rules.forEach((r) => console.log(`  ${r.name} (${r.id.slice(0, 8)}...)`));

  // Extract rule tags (which tags are linked to which rules)
  const ruleTagLinks = await sql`
    SELECT er.name as rule_name, t.name as tag_name
    FROM extract_rule_tags ert
    JOIN extract_rules er ON er.id = ert.extract_rule_id
    JOIN tags t ON t.id = ert.tag_id
    ORDER BY er.name, t.name
  `;
  console.log("\nRule -> Tag links:");
  ruleTagLinks.forEach((link) =>
    console.log(`  ${link.rule_name} -> ${link.tag_name}`)
  );

  // Check for tags that match rule names (the old system)
  console.log("\n\nTags that match rule names (capitalized):");
  const matchingTags = await sql`
    SELECT t.name as tag_name, er.name as rule_name
    FROM tags t
    JOIN extract_rules er ON LOWER(t.name) = LOWER(er.name)
  `;
  console.log(matchingTags);
}

check();
