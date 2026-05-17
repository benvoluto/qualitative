-- Company summaries cache table
-- Stores generated summaries with a hash of the extract IDs used to create them

CREATE TABLE IF NOT EXISTS company_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    extract_ids_hash VARCHAR(64) NOT NULL,
    summary_text TEXT NOT NULL,
    meeting_links JSONB DEFAULT '[]',  -- Array of {name, meetingId} objects
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookup by customer and hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_summaries_customer_hash
ON company_summaries(customer_id, extract_ids_hash);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_company_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_company_summaries_updated_at ON company_summaries;
CREATE TRIGGER update_company_summaries_updated_at
    BEFORE UPDATE ON company_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_company_summaries_updated_at();
