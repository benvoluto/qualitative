import { getDb } from "./client";
import { Meeting, CreateMeeting, UpdateMeeting, WorkflowStatus, MeetingSource, ParticipationStatus } from "./types";

export async function getMeetings(accountId: string): Promise<Meeting[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM meetings WHERE account_id = ${accountId} ORDER BY meeting_date DESC`;
  return result as Meeting[];
}

/**
 * Returns every meeting on the account, ordered by effective date.
 * Manual uploads without a meeting_date fall back to created_at so they still
 * sort sensibly alongside dated meetings.
 */
export async function getMeetingsForList(accountId: string): Promise<Meeting[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM meetings
    WHERE account_id = ${accountId}
    ORDER BY COALESCE(meeting_date, created_at) DESC
  `;
  return result as Meeting[];
}

export async function getMeetingById(accountId: string, id: string): Promise<Meeting | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM meetings WHERE id = ${id} AND account_id = ${accountId}`;
  return (result[0] as Meeting) || null;
}

export async function getMeetingByExternalId(accountId: string, externalId: string): Promise<Meeting | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM meetings WHERE external_id = ${externalId} AND account_id = ${accountId}
  `;
  return (result[0] as Meeting) || null;
}

export async function getMeetingsByCustomerId(accountId: string, customerId: string): Promise<Meeting[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM meetings
    WHERE customer_id = ${customerId} AND account_id = ${accountId}
    ORDER BY meeting_date DESC
  `;
  return result as Meeting[];
}

export async function getMeetingsByCompanyId(accountId: string, companyId: string): Promise<Meeting[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM meetings
    WHERE company_id = ${companyId} AND account_id = ${accountId}
    ORDER BY meeting_date DESC
  `;
  return result as Meeting[];
}

export async function getMeetingsByStatus(accountId: string, status: WorkflowStatus): Promise<Meeting[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM meetings
    WHERE workflow_status = ${status} AND account_id = ${accountId}
    ORDER BY meeting_date DESC
  `;
  return result as Meeting[];
}

/**
 * Returns meetings whose effective date falls within the range. Manual
 * uploads without a meeting_date fall back to created_at — so they show up in
 * the activity summary in the period they were uploaded.
 */
export async function getMeetingsInDateRange(
  accountId: string,
  startDate: Date,
  endDate: Date
): Promise<Meeting[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM meetings
    WHERE account_id = ${accountId}
      AND COALESCE(meeting_date, created_at) >= ${startDate}
      AND COALESCE(meeting_date, created_at) <= ${endDate}
    ORDER BY COALESCE(meeting_date, created_at) DESC
  `;
  return result as Meeting[];
}

export async function getRecentMeetings(accountId: string, days: number = 7): Promise<Meeting[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM meetings
    WHERE account_id = ${accountId}
      AND meeting_date >= NOW() - INTERVAL '1 day' * ${days}
    ORDER BY meeting_date DESC
  `;
  return result as Meeting[];
}

export async function createMeeting(accountId: string, data: CreateMeeting): Promise<Meeting> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO meetings (
      account_id, external_id, name, meeting_date, customer_id, company_id, transcript,
      user_notes, workflow_status, source, recording_url, meeting_url, transcript_source,
      host_name, host_email, is_internal, recording_passcode
    )
    VALUES (
      ${accountId},
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

export async function updateMeeting(
  accountId: string,
  id: string,
  data: UpdateMeeting
): Promise<Meeting | null> {
  const sql = getDb();

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) { setClauses.push(`name = $${paramIndex++}`); values.push(data.name); }
  if (data.meeting_date !== undefined) { setClauses.push(`meeting_date = $${paramIndex++}`); values.push(data.meeting_date); }
  if (data.customer_id !== undefined) { setClauses.push(`customer_id = $${paramIndex++}`); values.push(data.customer_id); }
  if (data.company_id !== undefined) { setClauses.push(`company_id = $${paramIndex++}`); values.push(data.company_id); }
  if (data.transcript !== undefined) { setClauses.push(`transcript = $${paramIndex++}`); values.push(data.transcript); }
  if (data.user_notes !== undefined) { setClauses.push(`user_notes = $${paramIndex++}`); values.push(data.user_notes); }
  if (data.workflow_status !== undefined) { setClauses.push(`workflow_status = $${paramIndex++}`); values.push(data.workflow_status); }
  if (data.recording_url !== undefined) { setClauses.push(`recording_url = $${paramIndex++}`); values.push(data.recording_url); }
  if (data.meeting_url !== undefined) { setClauses.push(`meeting_url = $${paramIndex++}`); values.push(data.meeting_url); }
  if (data.transcript_source !== undefined) { setClauses.push(`transcript_source = $${paramIndex++}`); values.push(data.transcript_source); }
  if (data.host_name !== undefined) { setClauses.push(`host_name = $${paramIndex++}`); values.push(data.host_name); }
  if (data.host_email !== undefined) { setClauses.push(`host_email = $${paramIndex++}`); values.push(data.host_email); }
  if (data.is_internal !== undefined) { setClauses.push(`is_internal = $${paramIndex++}`); values.push(data.is_internal); }
  if (data.recording_passcode !== undefined) { setClauses.push(`recording_passcode = $${paramIndex++}`); values.push(data.recording_passcode); }

  if (setClauses.length === 0) return getMeetingById(accountId, id);

  setClauses.push(`updated_at = NOW()`);
  values.push(id);
  const idParam = paramIndex++;
  values.push(accountId);
  const acctParam = paramIndex;
  const query = `
    UPDATE meetings SET ${setClauses.join(", ")}
    WHERE id = $${idParam} AND account_id = $${acctParam}
    RETURNING *
  `;
  const result = await sql(query, values);
  return (result[0] as Meeting) || null;
}

export async function updateMeetingStatus(
  accountId: string,
  id: string,
  status: WorkflowStatus
): Promise<Meeting | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE meetings SET workflow_status = ${status}
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  return (result[0] as Meeting) || null;
}

/**
 * Atomically acquire a processing lock on a meeting.
 * Returns the meeting if lock acquired, null if already locked or not found.
 */
export async function acquireProcessingLock(accountId: string, id: string): Promise<Meeting | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE meetings
    SET workflow_status = 'processing', updated_at = NOW()
    WHERE id = ${id} AND account_id = ${accountId} AND workflow_status != 'processing'
    RETURNING *
  `;
  if (result.length > 0) {
    console.log(`[Meeting Lock] Acquired processing lock for meeting ${id}`);
    return result[0] as Meeting;
  }
  console.log(`[Meeting Lock] Failed to acquire lock for meeting ${id} - already processing or not found`);
  return null;
}

export async function releaseProcessingLock(
  accountId: string,
  id: string,
  status: "transcribed" | "completed" | "failed" | "pending"
): Promise<Meeting | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE meetings
    SET workflow_status = ${status}, updated_at = NOW()
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  console.log(`[Meeting Lock] Released lock for meeting ${id} with status: ${status}`);
  return (result[0] as Meeting) || null;
}

export async function updateMeetingTranscript(
  accountId: string,
  id: string,
  transcript: string,
  source: "google_meet" | "gemini" | "manual"
): Promise<Meeting | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE meetings SET transcript = ${transcript}, transcript_source = ${source}
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  return (result[0] as Meeting) || null;
}

export async function deleteMeeting(accountId: string, id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM meetings WHERE id = ${id} AND account_id = ${accountId} RETURNING id`;
  return result.length > 0;
}

// Participant management. Junction table — isolation via the meeting_id FK,
// which we verify belongs to the account before mutating.
export async function addMeetingParticipant(
  accountId: string,
  meetingId: string,
  personnelId: string,
  participationStatus: ParticipationStatus = "n/a"
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO meeting_participants (meeting_id, personnel_id, participation_status)
    SELECT ${meetingId}, ${personnelId}, ${participationStatus}
    WHERE EXISTS (SELECT 1 FROM meetings WHERE id = ${meetingId} AND account_id = ${accountId})
    ON CONFLICT (meeting_id, personnel_id) DO UPDATE SET participation_status = ${participationStatus}
  `;
}

export async function removeMeetingParticipant(
  accountId: string,
  meetingId: string,
  personnelId: string
): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM meeting_participants
    WHERE meeting_id = ${meetingId} AND personnel_id = ${personnelId}
      AND EXISTS (SELECT 1 FROM meetings WHERE id = ${meetingId} AND account_id = ${accountId})
  `;
}

export async function getMeetingParticipantIds(accountId: string, meetingId: string): Promise<string[]> {
  const sql = getDb();
  const result = await sql`
    SELECT personnel_id FROM meeting_participants mp
    JOIN meetings m ON m.id = mp.meeting_id
    WHERE mp.meeting_id = ${meetingId} AND m.account_id = ${accountId}
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

export async function getMeetingParticipantsWithDetails(
  accountId: string,
  meetingId: string
): Promise<MeetingParticipantDetails[]> {
  const sql = getDb();
  const result = await sql`
    SELECT p.id, p.name, p.email, p.title, p.customer_id, mp.participation_status
    FROM meeting_participants mp
    JOIN personnel p ON mp.personnel_id = p.id
    JOIN meetings m ON m.id = mp.meeting_id
    WHERE mp.meeting_id = ${meetingId} AND m.account_id = ${accountId}
  `;
  return result as MeetingParticipantDetails[];
}

export async function updateParticipantStatus(
  accountId: string,
  meetingId: string,
  personnelId: string,
  status: ParticipationStatus
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE meeting_participants mp
    SET participation_status = ${status}
    FROM meetings m
    WHERE mp.meeting_id = m.id
      AND mp.meeting_id = ${meetingId}
      AND mp.personnel_id = ${personnelId}
      AND m.account_id = ${accountId}
  `;
}

export async function updateParticipantStatusByEmail(
  accountId: string,
  meetingId: string,
  email: string,
  status: ParticipationStatus
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE meeting_participants mp
    SET participation_status = ${status}
    FROM personnel p, meetings m
    WHERE mp.personnel_id = p.id
      AND mp.meeting_id = m.id
      AND mp.meeting_id = ${meetingId}
      AND m.account_id = ${accountId}
      AND LOWER(p.email) = ${email.toLowerCase()}
  `;
}

export async function updateParticipantStatusByName(
  accountId: string,
  meetingId: string,
  name: string,
  status: ParticipationStatus
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE meeting_participants mp
    SET participation_status = ${status}
    FROM personnel p, meetings m
    WHERE mp.personnel_id = p.id
      AND mp.meeting_id = m.id
      AND mp.meeting_id = ${meetingId}
      AND m.account_id = ${accountId}
      AND LOWER(p.name) LIKE ${`%${name.toLowerCase()}%`}
  `;
}

export async function searchMeetings(accountId: string, query: string): Promise<Meeting[]> {
  const sql = getDb();
  const searchPattern = `%${query}%`;
  const result = await sql`
    SELECT * FROM meetings
    WHERE account_id = ${accountId}
      AND (name ILIKE ${searchPattern} OR transcript ILIKE ${searchPattern} OR user_notes ILIKE ${searchPattern})
    ORDER BY meeting_date DESC
  `;
  return result as Meeting[];
}

export async function findMeetingsNearDate(
  accountId: string,
  date: Date,
  windowMinutes: number = 30
): Promise<Meeting[]> {
  const sql = getDb();
  const startTime = new Date(date.getTime() - windowMinutes * 60 * 1000);
  const endTime = new Date(date.getTime() + windowMinutes * 60 * 1000);

  const result = await sql`
    SELECT * FROM meetings
    WHERE account_id = ${accountId}
      AND meeting_date >= ${startTime} AND meeting_date <= ${endTime}
    ORDER BY meeting_date DESC
  `;
  return result as Meeting[];
}

export interface DuplicateCandidate {
  id: string;
  name: string | null;
  meeting_date: Date | null;
  host_email: string | null;
  source: MeetingSource | null;
}

export interface DeduplicationResult {
  duplicatesFound: number;
  hubspotMeetingsDeleted: number;
  deletedMeetingIds: string[];
  extractsTransferred: number;
  draftsTransferred: number;
}

export async function findDuplicateCandidates(
  accountId: string,
  days: number = 30
): Promise<DuplicateCandidate[]> {
  const sql = getDb();
  const result = await sql`
    SELECT m1.id, m1.name, m1.meeting_date, m1.host_email, m1.source
    FROM meetings m1
    WHERE m1.account_id = ${accountId}
      AND m1.meeting_date >= NOW() - INTERVAL '1 day' * ${days}
      AND m1.source IN ('google_meet', 'zoom', 'hubspot')
      AND m1.name IS NOT NULL
      AND m1.host_email IS NOT NULL
      AND m1.meeting_date IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM meetings m2
        WHERE m2.account_id = ${accountId}
          AND m2.id != m1.id
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

function groupDuplicateMeetings(candidates: DuplicateCandidate[]): Map<string, DuplicateCandidate[]> {
  const groups = new Map<string, DuplicateCandidate[]>();
  for (const candidate of candidates) {
    if (!candidate.meeting_date || !candidate.name || !candidate.host_email) continue;
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

export async function deduplicateMeetings(
  accountId: string,
  days: number = 30,
  transferExtracts?: (accountId: string, fromMeetingId: string, toMeetingId: string) => Promise<number>,
  transferDrafts?: (accountId: string, fromMeetingId: string, toMeetingId: string) => Promise<number>,
  getExtractCount?: (accountId: string, meetingId: string) => Promise<number>
): Promise<DeduplicationResult> {
  const result: DeduplicationResult = {
    duplicatesFound: 0,
    hubspotMeetingsDeleted: 0,
    deletedMeetingIds: [],
    extractsTransferred: 0,
    draftsTransferred: 0,
  };
  const candidates = await findDuplicateCandidates(accountId, days);
  if (candidates.length === 0) return result;

  const groups = groupDuplicateMeetings(candidates);
  for (const [, meetings] of groups) {
    if (meetings.length < 2) continue;
    const hubspotMeetings = meetings.filter((m) => m.source === "hubspot");
    const otherMeetings = meetings.filter((m) => m.source !== "hubspot");
    if (hubspotMeetings.length === 0 || otherMeetings.length === 0) continue;
    result.duplicatesFound += hubspotMeetings.length;
    const keeper = otherMeetings[0];

    for (const hubspotMeeting of hubspotMeetings) {
      let initialExtractCount = 0;
      if (getExtractCount) initialExtractCount = await getExtractCount(accountId, hubspotMeeting.id);

      if (transferExtracts) {
        const transferred = await transferExtracts(accountId, hubspotMeeting.id, keeper.id);
        result.extractsTransferred += transferred;
      }

      if (getExtractCount && initialExtractCount > 0) {
        const remaining = await getExtractCount(accountId, hubspotMeeting.id);
        if (remaining > 0) continue;
      }

      if (transferDrafts) {
        const draftCount = await transferDrafts(accountId, hubspotMeeting.id, keeper.id);
        result.draftsTransferred += draftCount;
      }

      const deleted = await deleteMeeting(accountId, hubspotMeeting.id);
      if (deleted) {
        result.hubspotMeetingsDeleted++;
        result.deletedMeetingIds.push(hubspotMeeting.id);
      }
    }
  }
  return result;
}

export async function getUnprocessedMeetingsCount(accountId: string): Promise<number> {
  const sql = getDb();
  const result = await sql`
    SELECT COUNT(DISTINCT m.id)::int as count
    FROM meetings m
    LEFT JOIN extracts e ON e.meeting_id = m.id
    WHERE m.account_id = ${accountId}
      AND m.transcript IS NOT NULL
      AND m.transcript != ''
      AND m.is_internal IS NOT TRUE
      AND e.id IS NULL
  `;
  return result[0]?.count ?? 0;
}

export async function getUnprocessedMeetings(accountId: string, limit: number = 5): Promise<Meeting[]> {
  const sql = getDb();
  const result = await sql`
    SELECT DISTINCT m.*
    FROM meetings m
    LEFT JOIN extracts e ON e.meeting_id = m.id
    WHERE m.account_id = ${accountId}
      AND m.transcript IS NOT NULL
      AND m.transcript != ''
      AND m.is_internal IS NOT TRUE
      AND e.id IS NULL
    ORDER BY m.meeting_date DESC NULLS LAST
    LIMIT ${limit}
  `;
  return result as Meeting[];
}
