-- Activity summaries cache table
-- Stores generated summaries with a hash of the extract IDs used to create them

CREATE TABLE IF NOT EXISTS activity_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_type VARCHAR(50) NOT NULL,  -- 'deals', 'customers', 'internal'
    extract_ids_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash of sorted extract IDs
    summary_text TEXT NOT NULL,
    meeting_links JSONB DEFAULT '[]',  -- Array of {name, meetingId} objects
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookup by type and hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_summaries_type_hash
ON activity_summaries(summary_type, extract_ids_hash);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_activity_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_activity_summaries_updated_at ON activity_summaries;
CREATE TRIGGER update_activity_summaries_updated_at
    BEFORE UPDATE ON activity_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_activity_summaries_updated_at();
