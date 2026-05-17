-- Add full-text search capability to extracts table
-- Uses tsvector for efficient text searching across summary and quotes

-- Add the search vector column
ALTER TABLE extracts ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create a function to generate the search vector from summary and quotes
CREATE OR REPLACE FUNCTION extracts_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(
      ARRAY(SELECT jsonb_array_elements_text(NEW.quotes::jsonb)), ' '
    ), '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search_vector on insert/update
DROP TRIGGER IF EXISTS extracts_search_vector_trigger ON extracts;
CREATE TRIGGER extracts_search_vector_trigger
  BEFORE INSERT OR UPDATE OF summary, quotes ON extracts
  FOR EACH ROW
  EXECUTE FUNCTION extracts_search_vector_update();

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_extracts_search_vector ON extracts USING GIN(search_vector);

-- Backfill existing records
UPDATE extracts SET
  search_vector =
    setweight(to_tsvector('english', COALESCE(summary, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(
      ARRAY(SELECT jsonb_array_elements_text(quotes::jsonb)), ' '
    ), '')), 'B');

-- Add index for cursor-based pagination (created_at + id for stable ordering)
CREATE INDEX IF NOT EXISTS idx_extracts_cursor ON extracts(created_at DESC, id DESC);
