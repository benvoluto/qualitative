import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function check() {
  // Check extracts and their rule_ids
  const extracts = await sql`SELECT id, summary, extract_rule_id FROM extracts LIMIT 5`;
  console.log("Sample extracts (with extract_rule_id):");
  console.log(extracts);

  // Check extract_tags table
  const extractTags = await sql`SELECT * FROM extract_tags LIMIT 10`;
  console.log("\nSample extract_tags:");
  console.log(extractTags);

  // Check what the tag IDs point to
  if (extractTags.length > 0) {
    const tagIds = extractTags.map((et) => et.tag_id);
    const tags = await sql`SELECT id, name FROM tags WHERE id = ANY(${tagIds})`;
    console.log("\nTags referenced by extract_tags:");
    console.log(tags);

    // Check if those IDs might be rule IDs instead
    const rules = await sql`SELECT id, name FROM extract_rules WHERE id = ANY(${tagIds})`;
    console.log("\nRules with same IDs (checking if tag_ids are actually rule IDs):");
    console.log(rules);
  }

  // Also check total counts
  const extractCount = await sql`SELECT COUNT(*) as count FROM extracts`;
  const extractTagCount = await sql`SELECT COUNT(*) as count FROM extract_tags`;
  console.log("\nTotal extracts:", extractCount[0].count);
  console.log("Total extract_tags entries:", extractTagCount[0].count);

}

check();
