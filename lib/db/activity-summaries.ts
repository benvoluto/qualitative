import { getDb } from "./client";

export interface ActivitySummary {
  id: string;
  account_id: string;
  summary_type: "deals" | "customers" | "internal";
  extract_ids_hash: string;
  summary_text: string;
  meeting_links: { name: string; meetingId: string }[];
  created_at: Date;
  updated_at: Date;
}

export interface CreateActivitySummary {
  summary_type: "deals" | "customers" | "internal";
  extract_ids_hash: string;
  summary_text: string;
  meeting_links: { name: string; meetingId: string }[];
}

/**
 * Generate a hash from a list of extract IDs.
 * Stable across environments (djb2).
 */
export function generateExtractIdsHash(extractIds: string[]): string {
  const sortedIds = [...extractIds].sort();
  const combined = sortedIds.join(",");
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash) + combined.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export async function getActivitySummaryByHash(
  accountId: string,
  summaryType: "deals" | "customers" | "internal",
  extractIdsHash: string,
  maxAgeHours: number = 3
): Promise<ActivitySummary | null> {
  const sql = getDb();
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

  const result = await sql`
    SELECT * FROM activity_summaries
    WHERE account_id = ${accountId}
      AND summary_type = ${summaryType}
      AND extract_ids_hash = ${extractIdsHash}
      AND updated_at > ${cutoffTime}
  `;
  if (result.length === 0) return null;
  const row = result[0];
  return { ...row, meeting_links: row.meeting_links || [] } as ActivitySummary;
}

export async function getLatestActivitySummaryByType(
  accountId: string,
  summaryType: "deals" | "customers" | "internal"
): Promise<ActivitySummary | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM activity_summaries
    WHERE account_id = ${accountId} AND summary_type = ${summaryType}
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  if (result.length === 0) return null;
  const row = result[0];
  return { ...row, meeting_links: row.meeting_links || [] } as ActivitySummary;
}

export async function getRecentActivitySummaryByType(
  accountId: string,
  summaryType: "deals" | "customers" | "internal",
  maxAgeHours: number = 24
): Promise<ActivitySummary | null> {
  const sql = getDb();
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

  const result = await sql`
    SELECT * FROM activity_summaries
    WHERE account_id = ${accountId}
      AND summary_type = ${summaryType}
      AND updated_at > ${cutoffTime}
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  if (result.length === 0) return null;
  const row = result[0];
  return { ...row, meeting_links: row.meeting_links || [] } as ActivitySummary;
}

export async function upsertActivitySummary(
  accountId: string,
  data: CreateActivitySummary
): Promise<ActivitySummary> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO activity_summaries (account_id, summary_type, extract_ids_hash, summary_text, meeting_links)
    VALUES (
      ${accountId},
      ${data.summary_type},
      ${data.extract_ids_hash},
      ${data.summary_text},
      ${JSON.stringify(data.meeting_links)}::jsonb
    )
    ON CONFLICT (summary_type, extract_ids_hash)
    DO UPDATE SET
      summary_text = EXCLUDED.summary_text,
      meeting_links = EXCLUDED.meeting_links,
      updated_at = NOW()
    RETURNING *
  `;
  const row = result[0];
  return { ...row, meeting_links: row.meeting_links || [] } as ActivitySummary;
}

export async function deleteOldActivitySummaries(
  accountId: string,
  olderThanDays: number = 30
): Promise<number> {
  const sql = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  const result = await sql`
    DELETE FROM activity_summaries
    WHERE account_id = ${accountId} AND updated_at < ${cutoffDate}
    RETURNING id
  `;
  return result.length;
}

export async function getAllActivitySummaries(accountId: string): Promise<ActivitySummary[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM activity_summaries WHERE account_id = ${accountId} ORDER BY updated_at DESC
  `;
  return result.map((row) => ({
    ...row,
    meeting_links: row.meeting_links || [],
  })) as ActivitySummary[];
}
