-- Add host_email field to meetings table
ALTER TABLE meetings
ADD COLUMN host_email VARCHAR(255);

-- Create index for faster lookups by host
CREATE INDEX idx_meetings_host_email ON meetings(host_email) WHERE host_email IS NOT NULL;
