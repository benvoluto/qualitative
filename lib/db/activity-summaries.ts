import { getDb } from "./client";

export interface ActivitySummary {
  id: string;
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
 * Generate a hash from a list of extract IDs
 * Sorts the IDs first to ensure consistent hashing
 * Uses a simple hash function that works in all environments
 */
export function generateExtractIdsHash(extractIds: string[]): string {
  const sortedIds = [...extractIds].sort();
  const combined = sortedIds.join(",");

  // Simple hash function that works in all environments
  // Based on djb2 algorithm
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash) + combined.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  // Convert to hex and ensure positive
  return Math.abs(hash).toString(16).padStart(8, "0");
}

/**
 * Get a cached activity summary by type and extract IDs hash
 * Returns null if the summary is older than maxAgeHours (default 3 hours)
 */
export async function getActivitySummaryByHash(
  summaryType: "deals" | "customers" | "internal",
  extractIdsHash: string,
  maxAgeHours: number = 3
): Promise<ActivitySummary | null> {
  const sql = getDb();
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

  const result = await sql`
    SELECT * FROM activity_summaries
    WHERE summary_type = ${summaryType}
      AND extract_ids_hash = ${extractIdsHash}
      AND updated_at > ${cutoffTime}
  `;

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  return {
    ...row,
    meeting_links: row.meeting_links || [],
  } as ActivitySummary;
}

/**
 * Get any cached activity summary by type, regardless of hash or age
 * Used as a fallback when generation fails
 */
export async function getLatestActivitySummaryByType(
  summaryType: "deals" | "customers" | "internal"
): Promise<ActivitySummary | null> {
  const sql = getDb();

  const result = await sql`
    SELECT * FROM activity_summaries
    WHERE summary_type = ${summaryType}
    ORDER BY updated_at DESC
    LIMIT 1
  `;

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  return {
    ...row,
    meeting_links: row.meeting_links || [],
  } as ActivitySummary;
}

/**
 * Get a recent activity summary by type (within maxAgeHours), regardless of hash
 * Used to avoid unnecessary regeneration when content has only slightly changed
 */
export async function getRecentActivitySummaryByType(
  summaryType: "deals" | "customers" | "internal",
  maxAgeHours: number = 24
): Promise<ActivitySummary | null> {
  const sql = getDb();
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

  const result = await sql`
    SELECT * FROM activity_summaries
    WHERE summary_type = ${summaryType}
      AND updated_at > ${cutoffTime}
    ORDER BY updated_at DESC
    LIMIT 1
  `;

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  return {
    ...row,
    meeting_links: row.meeting_links || [],
  } as ActivitySummary;
}

/**
 * Create or update an activity summary
 * Uses upsert to handle conflicts on the unique index
 */
export async function upsertActivitySummary(
  data: CreateActivitySummary
): Promise<ActivitySummary> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO activity_summaries (summary_type, extract_ids_hash, summary_text, meeting_links)
    VALUES (
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
  return {
    ...row,
    meeting_links: row.meeting_links || [],
  } as ActivitySummary;
}

/**
 * Delete old activity summaries (older than specified days)
 * Useful for cleanup
 */
export async function deleteOldActivitySummaries(olderThanDays: number = 30): Promise<number> {
  const sql = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await sql`
    DELETE FROM activity_summaries
    WHERE updated_at < ${cutoffDate}
    RETURNING id
  `;

  return result.length;
}

/**
 * Get all activity summaries (for debugging/admin)
 */
export async function getAllActivitySummaries(): Promise<ActivitySummary[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM activity_summaries ORDER BY updated_at DESC
  `;

  return result.map((row) => ({
    ...row,
    meeting_links: row.meeting_links || [],
  })) as ActivitySummary[];
}
