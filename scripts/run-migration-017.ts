import { getDb } from "@/lib/db/client";

async function runMigration() {
  try {
    const sql = getDb();

    console.log("Applying migration 017: Full-text search for extracts...");

    // Add the search vector column
    await sql`ALTER TABLE extracts ADD COLUMN IF NOT EXISTS search_vector tsvector`;
    console.log("Added search_vector column");

    // Create the trigger function
    await sql`
      CREATE OR REPLACE FUNCTION extracts_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(array_to_string(
            ARRAY(SELECT jsonb_array_elements_text(NEW.quotes::jsonb)), ' '
          ), '')), 'B');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;
    console.log("Created search vector update function");

    // Drop existing trigger if it exists and create new one
    await sql`DROP TRIGGER IF EXISTS extracts_search_vector_trigger ON extracts`;
    await sql`
      CREATE TRIGGER extracts_search_vector_trigger
        BEFORE INSERT OR UPDATE OF summary, quotes ON extracts
        FOR EACH ROW
        EXECUTE FUNCTION extracts_search_vector_update()
    `;
    console.log("Created search vector trigger");

    // Create GIN index
    await sql`CREATE INDEX IF NOT EXISTS idx_extracts_search_vector ON extracts USING GIN(search_vector)`;
    console.log("Created GIN index for search_vector");

    // Backfill existing records
    console.log("Backfilling search vectors for existing records...");
    const updateResult = await sql`
      UPDATE extracts SET
        search_vector =
          setweight(to_tsvector('english', COALESCE(summary, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(array_to_string(
            ARRAY(SELECT jsonb_array_elements_text(quotes::jsonb)), ' '
          ), '')), 'B')
      WHERE search_vector IS NULL OR summary IS NOT NULL
    `;
    console.log(`Backfilled ${updateResult.length} records`);

    // Create cursor pagination index
    await sql`CREATE INDEX IF NOT EXISTS idx_extracts_cursor ON extracts(created_at DESC, id DESC)`;
    console.log("Created cursor pagination index");

    console.log("Migration 017 completed successfully");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
