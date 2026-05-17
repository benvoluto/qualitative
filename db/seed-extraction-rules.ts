import { neon } from "@neondatabase/serverless";
import extractionData from "../EXTRACTION_RULES_1.json";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const sql = neon(DATABASE_URL);

interface ExtractFromJson {
  quote: string;
  summary: string;
  keywords: string[];
  isActionItem: boolean;
  tags: string[];
}

interface MeetingFromJson {
  meeting_uuid: string;
  organization: string;
  group: string;
  participants: string;
  roles: string;
  date: string;
  extracts: ExtractFromJson[];
}

// Group extracts by their primary tag to create meaningful rules
function groupExtractsByPrimaryTag(meetings: MeetingFromJson[]): Map<string, ExtractFromJson[]> {
  const tagGroups = new Map<string, ExtractFromJson[]>();

  for (const meeting of meetings) {
    for (const extract of meeting.extracts) {
      // Use the first tag as the primary tag
      const primaryTag = extract.tags[0] || "general";

      if (!tagGroups.has(primaryTag)) {
        tagGroups.set(primaryTag, []);
      }
      tagGroups.get(primaryTag)!.push(extract);
    }
  }

  return tagGroups;
}

// Convert tag name to a readable rule name
function tagToRuleName(tag: string): string {
  return tag
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Generate a summary for a rule based on its extracts
function generateRuleSummary(tag: string, extracts: ExtractFromJson[]): string {
  const sampleSummaries = extracts.slice(0, 3).map((e) => e.summary);
  const keywords = new Set<string>();
  extracts.slice(0, 5).forEach((e) => e.keywords.slice(0, 3).forEach((k) => keywords.add(k)));

  return `Extract insights related to ${tagToRuleName(tag).toLowerCase()}. Common themes include: ${Array.from(keywords).slice(0, 5).join(", ")}. Examples: ${sampleSummaries.join("; ")}`;
}

async function seedExtractionRules() {
  console.log("Starting extraction rules seeding...\n");

  const meetings = extractionData as MeetingFromJson[];
  const tagGroups = groupExtractsByPrimaryTag(meetings);

  console.log(`Found ${tagGroups.size} unique primary tags to create rules for:\n`);

  let rulesCreated = 0;

  for (const [tag, extracts] of tagGroups) {
    const ruleName = tagToRuleName(tag);
    const summary = generateRuleSummary(tag, extracts);

    // Get unique quotes (limit to 10 examples per rule)
    const quotes = [...new Set(extracts.map((e) => e.quote))].slice(0, 10);

    // Get action items (extracts marked as action items)
    const actionItems = extracts
      .filter((e) => e.isActionItem)
      .map((e) => e.summary)
      .slice(0, 5);

    console.log(`Creating rule: "${ruleName}"`);
    console.log(`  - ${extracts.length} extracts, ${quotes.length} example quotes`);
    console.log(`  - ${actionItems.length} action item examples`);

    try {
      // Check if rule already exists
      const existing = await sql`
        SELECT id FROM extract_rules WHERE name = ${ruleName}
      `;

      if (existing.length > 0) {
        console.log(`  - Rule already exists, updating...\n`);
        await sql`
          UPDATE extract_rules SET
            summary = ${summary},
            quotes = ${JSON.stringify(quotes)},
            action_items = ${JSON.stringify(actionItems)},
            is_active = true
          WHERE name = ${ruleName}
        `;
      } else {
        await sql`
          INSERT INTO extract_rules (name, summary, quotes, action_items, is_active)
          VALUES (${ruleName}, ${summary}, ${JSON.stringify(quotes)}, ${JSON.stringify(actionItems)}, true)
        `;
        console.log(`  - Created successfully\n`);
      }

      rulesCreated++;
    } catch (error) {
      console.error(`  - Error creating rule: ${error}\n`);
    }
  }

  console.log(`\nSeeding complete! Created/updated ${rulesCreated} extraction rules.`);

  // Print summary of all rules
  const allRules = await sql`SELECT name, is_active FROM extract_rules ORDER BY name`;
  console.log(`\nAll extraction rules in database (${allRules.length} total):`);
  allRules.forEach((rule) => {
    console.log(`  - ${rule.name} (${rule.is_active ? "active" : "inactive"})`);
  });
}

seedExtractionRules().catch(console.error);
