-- Migration: Add "transcribed" workflow status
-- Previously "completed" meant "has transcript". Now:
--   "transcribed" = has transcript, awaiting extraction
--   "completed" = has extracts
--
-- Fix existing meetings marked "completed" that have no extracts

-- Meetings with transcript but no extracts → "transcribed"
UPDATE meetings m SET workflow_status = 'transcribed'
WHERE m.workflow_status = 'completed'
  AND m.transcript IS NOT NULL
  AND m.transcript != ''
  AND NOT EXISTS (SELECT 1 FROM extracts e WHERE e.meeting_id = m.id);

-- Meetings with no transcript and no extracts that were somehow "completed" → "pending"
UPDATE meetings SET workflow_status = 'pending'
WHERE workflow_status = 'completed'
  AND (transcript IS NULL OR transcript = '')
  AND NOT EXISTS (SELECT 1 FROM extracts e WHERE e.meeting_id = meetings.id);
