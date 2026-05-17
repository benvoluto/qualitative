import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function fixExtracts() {
  console.log("Starting extract data fix...\n");

  // Step 1: Delete all extract_tags associations
  console.log("Step 1: Deleting extract_tags associations...");
  const deletedExtractTags = await sql`DELETE FROM extract_tags RETURNING id`;
  console.log(`  Deleted ${deletedExtractTags.length} extract_tags records`);

  // Step 2: Delete all extracts
  console.log("\nStep 2: Deleting all extracts...");
  const deletedExtracts = await sql`DELETE FROM extracts RETURNING id`;
  console.log(`  Deleted ${deletedExtracts.length} extracts`);

  // Step 3: Identify and delete duplicate capitalized tags
  // These are tags whose names match rule names (Title Case)
  console.log("\nStep 3: Identifying duplicate capitalized tags...");
  const duplicateTags = await sql`
    SELECT t.id, t.name
    FROM tags t
    JOIN extract_rules er ON LOWER(t.name) = LOWER(er.name)
  `;
  console.log(`  Found ${duplicateTags.length} duplicate tags:`);
  duplicateTags.forEach((t) => console.log(`    - ${t.name}`));

  // First remove these tags from extract_rule_tags
  console.log("\n  Removing duplicates from extract_rule_tags...");
  for (const tag of duplicateTags) {
    await sql`DELETE FROM extract_rule_tags WHERE tag_id = ${tag.id}`;
  }

  // Then delete the tags
  console.log("  Deleting duplicate tags...");
  for (const tag of duplicateTags) {
    await sql`DELETE FROM tags WHERE id = ${tag.id}`;
  }
  console.log(`  Deleted ${duplicateTags.length} duplicate tags`);

  // Step 4: Show remaining tags
  console.log("\nRemaining tags:");
  const remainingTags = await sql`SELECT name FROM tags ORDER BY name`;
  remainingTags.forEach((t) => console.log(`  - ${t.name}`));

  // Step 5: Show meetings that can be re-extracted
  console.log("\nMeetings available for re-extraction:");
  const meetingsWithTranscripts = await sql`
    SELECT id, name, meeting_date
    FROM meetings
    WHERE transcript IS NOT NULL
    ORDER BY meeting_date DESC
  `;
  meetingsWithTranscripts.forEach((m) =>
    console.log(`  - ${m.name || "Untitled"} (${m.meeting_date || "no date"})`)
  );

  console.log(`\n✓ Data cleanup complete. ${meetingsWithTranscripts.length} meetings ready for re-extraction.`);
  console.log("\nTo re-extract, you can use the UI or call the extract API for each meeting.");
}

fixExtracts().catch(console.error);
