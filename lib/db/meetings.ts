import { getDb } from "./client";
import { Meeting, CreateMeeting, UpdateMeeting, WorkflowStatus, MeetingSource, ParticipationStatus } from "./types";

export async function getMeetings(): Promise<Meeting[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM meetings ORDER BY meeting_date DESC`;
  return result as Meeting[];
}

/**
 * Gets all meetings that occurred in the past (meeting_date <= now)
 * Meetings without a date are excluded
 */
export async function getPastMeetings(): Promise<Meeting[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM meetings
    WHERE meeting_date IS NOT NULL AND meeting_date <= NOW()
    ORDER BY meeting_date DESC
  `;
  return result as Meeting[];
}

export async function getMeetingById(id: string): Promise<Meeting | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM meetings WHERE id = ${id}`;
  return (result[0] as Meeting) || null;
}

export async function getMeetingByExternalId(externalId: string): Promise<Meeting | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM meetings WHERE external_id = ${externalId}`;
  return (result[0] as Meeting) || null;
}

export async function getMeetingsByCustomerId(customerId: string): Promise<Meeting[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM meetings WHERE customer_id = ${customerId} ORDER BY meeting_date DESC
  `;
  return result as Meeting[];
}

export async function getMeetingsByCompanyId(companyId: string): Promise<Meeting[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM meetings WHERE company_id = ${companyId} ORDER BY meeting_date DESC
  `;
  return result as Meeting[];
}

export async function getMeetingsByStatus(status: WorkflowStatus): Promise<Meeting[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM meetings WHERE workflow_status = ${status} ORDER BY meeting_date DESC
  `;
  return result as Meeting[];
}

export async function getMeetingsInDateRange(startDate: Date, endDate: Date): Promise<Meeting[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM meetings
    WHERE meeting_date >= ${startDate} AND meeting_date <= ${endDate}
    ORDER BY meeting_date DESC
  `;
  return result as Meeting[];
}

export async function getRecentMeetings(days: number = 7): Promise<Meeting[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM meetings
    WHERE meeting_date >= NOW() - INTERVAL '1 day' * ${days}
    ORDER BY meeting_date DESC
  `;
  return result as Meeting[];
}

export async function createMeeting(data: CreateMeeting): Promise<Meeting> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO meetings (
      external_id, name, meeting_date, customer_id, company_id, transcript,
      user_notes, workflow_status, source, recording_url, meeting_url, transcript_source,
      host_name, host_email, is_internal, recording_passcode
    )
    VALUES (
      ${data.external_id ?? null},
      ${data.name ?? null},
      ${data.meeting_date ?? null},
      ${data.customer_id ?? null},
      ${data.company_id ?? null},
      ${data.transcript ?? null},
      ${data.user_notes ?? null},
      ${data.workflow_status ?? "pending"},
      ${data.source ?? null},
      ${data.recording_url ?? null},
      ${data.meeting_url ?? null},
      ${data.transcript_source ?? null},
      ${data.host_name ?? null},
      ${data.host_email ?? null},
      ${data.is_internal ?? false},
      ${data.recording_passcode ?? null}
    )
    RETURNING *
  `;
  return result[0] as Meeting;
}

export async function updateMeeting(id: string, data: UpdateMeeting): Promise<Meeting | null> {
  const sql = getDb();

  // Build SET clauses dynamically based on what fields were provided
  // This avoids the Neon SQL template issue with nested queries
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.meeting_date !== undefined) {
    setClauses.push(`meeting_date = $${paramIndex++}`);
    values.push(data.meeting_date);
  }
  if (data.customer_id !== undefined) {
    setClauses.push(`customer_id = $${paramIndex++}`);
    values.push(data.customer_id);
  }
  if (data.company_id !== undefined) {
    setClauses.push(`company_id = $${paramIndex++}`);
    values.push(data.company_id);
  }
  if (data.transcript !== undefined) {
    setClauses.push(`transcript = $${paramIndex++}`);
    values.push(data.transcript);
  }
  if (data.user_notes !== undefined) {
    setClauses.push(`user_notes = $${paramIndex++}`);
    values.push(data.user_notes);
  }
  if (data.workflow_status !== undefined) {
    setClauses.push(`workflow_status = $${paramIndex++}`);
    values.push(data.workflow_status);
  }
  if (data.recording_url !== undefined) {
    setClauses.push(`recording_url = $${paramIndex++}`);
    values.push(data.recording_url);
  }
  if (data.meeting_url !== undefined) {
    setClauses.push(`meeting_url = $${paramIndex++}`);
    values.push(data.meeting_url);
  }
  if (data.transcript_source !== undefined) {
    setClauses.push(`transcript_source = $${paramIndex++}`);
    values.push(data.transcript_source);
  }
  if (data.host_name !== undefined) {
    setClauses.push(`host_name = $${paramIndex++}`);
    values.push(data.host_name);
  }
  if (data.host_email !== undefined) {
    setClauses.push(`host_email = $${paramIndex++}`);
    values.push(data.host_email);
  }
  if (data.is_internal !== undefined) {
    setClauses.push(`is_internal = $${paramIndex++}`);
    values.push(data.is_internal);
  }
  if (data.recording_passcode !== undefined) {
    setClauses.push(`recording_passcode = $${paramIndex++}`);
    values.push(data.recording_passcode);
  }

  // If no updates, just return the existing meeting
  if (setClauses.length === 0) {
    return getMeetingById(id);
  }

  // Add updated_at
  setClauses.push(`updated_at = NOW()`);

  // Build and execute the query using raw query syntax
  values.push(id);
  const query = `
    UPDATE meetings SET ${setClauses.join(", ")}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  // Use the sql function with query string and values array
  const result = await sql(query, values);
  return (result[0] as Meeting) || null;
}

export async function updateMeetingStatus(id: string, status: WorkflowStatus): Promise<Meeting | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE meetings SET workflow_status = ${status}
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as Meeting) || null;
}

/**
 * Atomically acquire a processing lock on a meeting.
 * Only succeeds if the meeting is not already being processed.
 * Returns the meeting if lock acquired, null if already locked or not found.
 */
export async function acquireProcessingLock(id: string): Promise<Meeting | null> {
  const sql = getDb();
  // Atomically update status to 'processing' only if not already processing
  // This prevents concurrent processing of the same meeting
  const result = await sql`
    UPDATE meetings
    SET workflow_status = 'processing', updated_at = NOW()
    WHERE id = ${id} AND workflow_status != 'processing'
    RETURNING *
  `;
  if (result.length > 0) {
    console.log(`[Meeting Lock] Acquired processing lock for meeting ${id}`);
    return result[0] as Meeting;
  }
  console.log(`[Meeting Lock] Failed to acquire lock for meeting ${id} - already processing or not found`);
  return null;
}

/**
 * Release the processing lock on a meeting by setting status to the given workflow status.
 */
export async function releaseProcessingLock(
  id: string,
  status: "transcribed" | "completed" | "failed" | "pending"
): Promise<Meeting | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE meetings
    SET workflow_status = ${status}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  console.log(`[Meeting Lock] Released lock for meeting ${id} with status: ${status}`);
  return (result[0] as Meeting) || null;
}

export async function updateMeetingTranscript(
  id: string,
  transcript: string,
  source: "google_meet" | "gemini" | "manual"
): Promise<Meeting | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE meetings SET transcript = ${transcript}, transcript_source = ${source}
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as Meeting) || null;
}

export async function deleteMeeting(id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM meetings WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

// Participant management
export async function addMeetingParticipant(
  meetingId: string,
  personnelId: string,
  participationStatus: ParticipationStatus = "n/a"
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO meeting_participants (meeting_id, personnel_id, participation_status)
    VALUES (${meetingId}, ${personnelId}, ${participationStatus})
    ON CONFLICT (meeting_id, personnel_id) DO UPDATE SET participation_status = ${participationStatus}
  `;
}

export async function removeMeetingParticipant(meetingId: string, personnelId: string): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM meeting_participants
    WHERE meeting_id = ${meetingId} AND personnel_id = ${personnelId}
  `;
}

export async function getMeetingParticipantIds(meetingId: string): Promise<string[]> {
  const sql = getDb();
  const result = await sql`
    SELECT personnel_id FROM meeting_participants WHERE meeting_id = ${meetingId}
  `;
  return (result as Array<{ personnel_id: string }>).map((r) => r.personnel_id);
}

export interface MeetingParticipantDetails {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  customer_id: string | null;
  participation_status: ParticipationStatus;
}

export async function getMeetingParticipantsWithDetails(meetingId: string): Promise<MeetingParticipantDetails[]> {
  const sql = getDb();
  const result = await sql`
    SELECT p.id, p.name, p.email, p.title, p.customer_id, mp.participation_status
    FROM meeting_participants mp
    JOIN personnel p ON mp.personnel_id = p.id
    WHERE mp.meeting_id = ${meetingId}
  `;
  return result as MeetingParticipantDetails[];
}

/**
 * Update participation status for a meeting participant
 */
export async function updateParticipantStatus(
  meetingId: string,
  personnelId: string,
  status: ParticipationStatus
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE meeting_participants
    SET participation_status = ${status}
    WHERE meeting_id = ${meetingId} AND personnel_id = ${personnelId}
  `;
}

/**
 * Bulk update participation status for multiple participants by email
 */
export async function updateParticipantStatusByEmail(
  meetingId: string,
  email: string,
  status: ParticipationStatus
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE meeting_participants mp
    SET participation_status = ${status}
    FROM personnel p
    WHERE mp.personnel_id = p.id
      AND mp.meeting_id = ${meetingId}
      AND LOWER(p.email) = ${email.toLowerCase()}
  `;
}

/**
 * Bulk update participation status for participants by name (case-insensitive)
 */
export async function updateParticipantStatusByName(
  meetingId: string,
  name: string,
  status: ParticipationStatus
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE meeting_participants mp
    SET participation_status = ${status}
    FROM personnel p
    WHERE mp.personnel_id = p.id
      AND mp.meeting_id = ${meetingId}
      AND LOWER(p.name) LIKE ${`%${name.toLowerCase()}%`}
  `;
}

export async function searchMeetings(query: string): Promise<Meeting[]> {
  const sql = getDb();
  const searchPattern = `%${query}%`;
  const result = await sql`
    SELECT * FROM meetings
    WHERE name ILIKE ${searchPattern} OR transcript ILIKE ${searchPattern} OR user_notes ILIKE ${searchPattern}
    ORDER BY meeting_date DESC
  `;
  return result as Meeting[];
}

// Find meetings that occur within a time window of a given date (for duplicate detection)
export async function findMeetingsNearDate(date: Date, windowMinutes: number = 30): Promise<Meeting[]> {
  const sql = getDb();
  const startTime = new Date(date.getTime() - windowMinutes * 60 * 1000);
  const endTime = new Date(date.getTime() + windowMinutes * 60 * 1000);

  const result = await sql`
    SELECT * FROM meetings
    WHERE meeting_date >= ${startTime} AND meeting_date <= ${endTime}
    ORDER BY meeting_date DESC
  `;
  return result as Meeting[];
}

/**
 * Represents a meeting that may be a duplicate of another meeting
 */
export interface DuplicateCandidate {
  id: string;
  name: string | null;
  meeting_date: Date | null;
  host_email: string | null;
  source: MeetingSource | null;
}

/**
 * Result of the deduplication process
 */
export interface DeduplicationResult {
  duplicatesFound: number;
  hubspotMeetingsDeleted: number;
  deletedMeetingIds: string[];
  extractsTransferred: number;
  draftsTransferred: number;
}

/**
 * Finds meetings that are potential duplicates within a 5-minute window
 * Duplicates must match on: date (within 5 min), title (case-insensitive), and host_email
 */
export async function findDuplicateCandidates(days: number = 30): Promise<DuplicateCandidate[]> {
  const sql = getDb();
  const result = await sql`
    SELECT m1.id, m1.name, m1.meeting_date, m1.host_email, m1.source
    FROM meetings m1
    WHERE m1.meeting_date >= NOW() - INTERVAL '1 day' * ${days}
      AND m1.source IN ('google_meet', 'zoom', 'hubspot')
      AND m1.name IS NOT NULL
      AND m1.host_email IS NOT NULL
      AND m1.meeting_date IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM meetings m2
        WHERE m2.id != m1.id
          AND m2.source != m1.source
          AND m2.name IS NOT NULL
          AND m2.host_email IS NOT NULL
          AND m2.meeting_date IS NOT NULL
          AND ABS(EXTRACT(EPOCH FROM (m1.meeting_date - m2.meeting_date))) < 300
          AND LOWER(TRIM(m1.name)) = LOWER(TRIM(m2.name))
          AND LOWER(m1.host_email) = LOWER(m2.host_email)
      )
    ORDER BY m1.meeting_date, m1.name, m1.host_email
  `;
  return result as DuplicateCandidate[];
}

/**
 * Groups meetings by their normalized duplicate key (date bucket, normalized name, normalized host email)
 */
function groupDuplicateMeetings(candidates: DuplicateCandidate[]): Map<string, DuplicateCandidate[]> {
  const groups = new Map<string, DuplicateCandidate[]>();
  for (const candidate of candidates) {
    if (!candidate.meeting_date || !candidate.name || !candidate.host_email) {
      continue;
    }
    const dateBucket = Math.floor(new Date(candidate.meeting_date).getTime() / (5 * 60 * 1000));
    const normalizedName = candidate.name.trim().toLowerCase();
    const normalizedEmail = candidate.host_email.toLowerCase();
    const key = `${dateBucket}_${normalizedName}_${normalizedEmail}`;
    const existing = groups.get(key) || [];
    existing.push(candidate);
    groups.set(key, existing);
  }
  return groups;
}

/**
 * Deduplicates meetings by removing HubSpot meetings when a matching Google Meet or Zoom meeting exists.
 * Before deletion, transfers any extracts and email drafts to the kept meeting.
 * Includes verification to ensure extracts are properly transferred before deletion.
 *
 * @param days Number of days to look back for duplicates (default: 30)
 * @param transferExtracts Function to transfer extracts from one meeting to another
 * @param transferDrafts Function to transfer email drafts from one meeting to another
 * @param getExtractCount Optional function to get extract count for verification
 * @returns Summary of deduplication actions taken
 */
export async function deduplicateMeetings(
  days: number = 30,
  transferExtracts?: (fromMeetingId: string, toMeetingId: string) => Promise<number>,
  transferDrafts?: (fromMeetingId: string, toMeetingId: string) => Promise<number>,
  getExtractCount?: (meetingId: string) => Promise<number>
): Promise<DeduplicationResult> {
  const result: DeduplicationResult = {
    duplicatesFound: 0,
    hubspotMeetingsDeleted: 0,
    deletedMeetingIds: [],
    extractsTransferred: 0,
    draftsTransferred: 0,
  };
  const candidates = await findDuplicateCandidates(days);
  if (candidates.length === 0) {
    console.log("[Deduplication] No duplicate candidates found");
    return result;
  }
  console.log(`[Deduplication] Found ${candidates.length} potential duplicate candidates`);
  const groups = groupDuplicateMeetings(candidates);
  for (const [key, meetings] of groups) {
    if (meetings.length < 2) {
      continue;
    }
    const hubspotMeetings = meetings.filter((m) => m.source === "hubspot");
    const otherMeetings = meetings.filter((m) => m.source !== "hubspot");
    if (hubspotMeetings.length === 0 || otherMeetings.length === 0) {
      continue;
    }
    result.duplicatesFound += hubspotMeetings.length;
    const keeper = otherMeetings[0];
    console.log(`[Deduplication] Processing group ${key}: keeping ${keeper.source} meeting ${keeper.id}, removing ${hubspotMeetings.length} HubSpot meeting(s)`);

    for (const hubspotMeeting of hubspotMeetings) {
      // Get initial extract count for verification
      let initialExtractCount = 0;
      if (getExtractCount) {
        initialExtractCount = await getExtractCount(hubspotMeeting.id);
      }

      // Transfer extracts
      let transferredExtracts = 0;
      if (transferExtracts) {
        transferredExtracts = await transferExtracts(hubspotMeeting.id, keeper.id);
        result.extractsTransferred += transferredExtracts;
        console.log(`[Deduplication] Transferred ${transferredExtracts} extracts from ${hubspotMeeting.id} to ${keeper.id}`);
      }

      // Verify extracts were transferred (if we had any)
      if (getExtractCount && initialExtractCount > 0) {
        const remainingExtracts = await getExtractCount(hubspotMeeting.id);
        if (remainingExtracts > 0) {
          console.error(`[Deduplication] WARNING: ${remainingExtracts} extracts still remain on meeting ${hubspotMeeting.id} after transfer!`);
          // Don't delete the meeting if extracts weren't transferred
          continue;
        }
      }

      // Transfer drafts
      if (transferDrafts) {
        const draftCount = await transferDrafts(hubspotMeeting.id, keeper.id);
        result.draftsTransferred += draftCount;
        console.log(`[Deduplication] Transferred ${draftCount} drafts from ${hubspotMeeting.id} to ${keeper.id}`);
      }

      // Only delete after successful transfer
      const deleted = await deleteMeeting(hubspotMeeting.id);
      if (deleted) {
        result.hubspotMeetingsDeleted++;
        result.deletedMeetingIds.push(hubspotMeeting.id);
        console.log(
          `[Deduplication] SUCCESS: Deleted HubSpot meeting ${hubspotMeeting.id} (${hubspotMeeting.name}), kept ${keeper.source} meeting ${keeper.id}`
        );
      } else {
        console.error(`[Deduplication] FAILED: Could not delete HubSpot meeting ${hubspotMeeting.id}`);
      }
    }
  }
  console.log(`[Deduplication] Complete: ${result.hubspotMeetingsDeleted} meetings deleted, ${result.extractsTransferred} extracts transferred`);
  return result;
}

/**
 * Gets the count of meetings that have been synced but don't have any extracts yet.
 * Only counts meetings that have a transcript (needed for extraction).
 */
export async function getUnprocessedMeetingsCount(): Promise<number> {
  const sql = getDb();
  const result = await sql`
    SELECT COUNT(DISTINCT m.id)::int as count
    FROM meetings m
    LEFT JOIN extracts e ON e.meeting_id = m.id
    WHERE m.transcript IS NOT NULL
      AND m.transcript != ''
      AND m.is_internal IS NOT TRUE
      AND e.id IS NULL
  `;
  return result[0]?.count ?? 0;
}

/**
 * Gets meetings that have been synced but don't have any extracts yet.
 * Returns the most recent meetings first, limited by the specified count.
 * Only returns meetings that have a transcript (needed for extraction).
 */
export async function getUnprocessedMeetings(limit: number = 5): Promise<Meeting[]> {
  const sql = getDb();
  const result = await sql`
    SELECT DISTINCT m.*
    FROM meetings m
    LEFT JOIN extracts e ON e.meeting_id = m.id
    WHERE m.transcript IS NOT NULL
      AND m.transcript != ''
      AND m.is_internal IS NOT TRUE
      AND e.id IS NULL
    ORDER BY m.meeting_date DESC NULLS LAST
    LIMIT ${limit}
  `;
  return result as Meeting[];
}
