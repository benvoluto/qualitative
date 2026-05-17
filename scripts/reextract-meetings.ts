import * as dotenv from "dotenv";
dotenv.config({ path: ".env.development.local" });
import { neon } from "@neondatabase/serverless";
import { extractInsightsFromTranscript } from "../lib/gemini/extraction";

const sql = neon(process.env.DATABASE_URL!);

async function reextractMeetings() {
  console.log("Re-extracting all meetings with proper rule linking and tags...\n");

  // Get all meetings with transcripts
  const meetings = await sql`
    SELECT id, name, meeting_date, customer_id, transcript
    FROM meetings
    WHERE transcript IS NOT NULL
    ORDER BY meeting_date DESC
  `;

  console.log(`Found ${meetings.length} meetings with transcripts\n`);

  // Get all extract rules for mapping
  const rules = await sql`SELECT id, name FROM extract_rules`;
  const ruleNameToId = new Map<string, string>();
  for (const rule of rules) {
    ruleNameToId.set(rule.name, rule.id);
    ruleNameToId.set(rule.name.toLowerCase(), rule.id);
  }
  console.log(`Loaded ${rules.length} extraction rules\n`);

  // Get all tags for reference
  const allTags = await sql`SELECT id, name FROM tags`;
  const tagNameToId = new Map<string, string>();
  for (const tag of allTags) {
    tagNameToId.set(tag.name, tag.id);
    tagNameToId.set(tag.name.toLowerCase(), tag.id);
  }
  console.log(`Loaded ${allTags.length} tags\n`);

  let totalExtracts = 0;
  let totalActionItems = 0;

  for (const meeting of meetings) {
    console.log(`\nProcessing: ${meeting.name || "Untitled"}...`);

    try {
      // Extract insights using Gemini
      const insights = await extractInsightsFromTranscript(meeting.transcript);
      console.log(`  Found ${insights.length} insights`);

      for (const insight of insights) {
        // Look up the rule ID by matched_rule name
        let extractRuleId: string | null = null;
        if (insight.matched_rule) {
          extractRuleId =
            ruleNameToId.get(insight.matched_rule) ||
            ruleNameToId.get(insight.matched_rule.toLowerCase()) ||
            null;
        }

        // Create the extract
        const extractResult = await sql`
          INSERT INTO extracts (
            meeting_id, customer_id, extract_rule_id, extract_date,
            summary, quotes, is_action_item, action_item_status
          )
          VALUES (
            ${meeting.id},
            ${meeting.customer_id},
            ${extractRuleId},
            ${meeting.meeting_date},
            ${insight.summary},
            ${JSON.stringify(insight.quotes)},
            ${insight.is_action_item},
            ${insight.is_action_item ? "pending" : null}
          )
          RETURNING id
        `;

        const extractId = extractResult[0].id;

        // Add tags - look up each tag and link it
        for (const tagName of insight.tags) {
          let tagId = tagNameToId.get(tagName) || tagNameToId.get(tagName.toLowerCase());

          if (!tagId) {
            // Create the tag if it doesn't exist
            const newTag = await sql`
              INSERT INTO tags (name, type)
              VALUES (${tagName}, 'extracted')
              RETURNING id
            `;
            tagId = (newTag[0] as { id: string }).id;
            tagNameToId.set(tagName, tagId);
            console.log(`    Created new tag: ${tagName}`);
          }

          await sql`
            INSERT INTO extract_tags (extract_id, tag_id)
            VALUES (${extractId}, ${tagId})
            ON CONFLICT DO NOTHING
          `;
        }

        totalExtracts++;
        if (insight.is_action_item) {
          totalActionItems++;
        }

        const ruleInfo = extractRuleId ? `[Rule: ${insight.matched_rule}]` : "[No rule]";
        const tagInfo = insight.tags.length > 0 ? `[Tags: ${insight.tags.join(", ")}]` : "[No tags]";
        console.log(`    ✓ ${insight.summary.slice(0, 60)}... ${ruleInfo} ${tagInfo}`);
      }

      // Update meeting status to completed
      await sql`UPDATE meetings SET workflow_status = 'completed' WHERE id = ${meeting.id}`;

    } catch (error) {
      console.error(`  ✗ Error processing meeting: ${error}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`Re-extraction complete!`);
  console.log(`  Total extracts created: ${totalExtracts}`);
  console.log(`  Total action items: ${totalActionItems}`);
  console.log(`========================================`);
}

reextractMeetings().catch(console.error);
