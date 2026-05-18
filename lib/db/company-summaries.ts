import { getDb } from "./client";

export interface CompanySummary {
  id: string;
  account_id: string;
  customer_id: string;
  extract_ids_hash: string;
  summary_text: string;
  meeting_links: { name: string; meetingId: string }[];
  created_at: Date;
  updated_at: Date;
}

export interface CreateCompanySummary {
  customer_id: string;
  extract_ids_hash: string;
  summary_text: string;
  meeting_links: { name: string; meetingId: string }[];
}

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

export async function getCompanySummaryByHash(
  accountId: string,
  customerId: string,
  extractIdsHash: string
): Promise<CompanySummary | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM company_summaries
    WHERE account_id = ${accountId}
      AND customer_id = ${customerId}
      AND extract_ids_hash = ${extractIdsHash}
  `;
  if (result.length === 0) return null;
  const row = result[0];
  return { ...row, meeting_links: row.meeting_links || [] } as CompanySummary;
}

export async function upsertCompanySummary(
  accountId: string,
  data: CreateCompanySummary
): Promise<CompanySummary> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO company_summaries (account_id, customer_id, extract_ids_hash, summary_text, meeting_links)
    VALUES (
      ${accountId},
      ${data.customer_id},
      ${data.extract_ids_hash},
      ${data.summary_text},
      ${JSON.stringify(data.meeting_links)}::jsonb
    )
    ON CONFLICT (customer_id, extract_ids_hash)
    DO UPDATE SET
      summary_text = EXCLUDED.summary_text,
      meeting_links = EXCLUDED.meeting_links,
      updated_at = NOW()
    RETURNING *
  `;
  const row = result[0];
  return { ...row, meeting_links: row.meeting_links || [] } as CompanySummary;
}

export async function deleteOldCompanySummaries(
  accountId: string,
  olderThanDays: number = 30
): Promise<number> {
  const sql = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  const result = await sql`
    DELETE FROM company_summaries
    WHERE account_id = ${accountId} AND updated_at < ${cutoffDate}
    RETURNING id
  `;
  return result.length;
}

export async function getCompanySummaryByCustomerId(
  accountId: string,
  customerId: string
): Promise<CompanySummary | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM company_summaries
    WHERE account_id = ${accountId} AND customer_id = ${customerId}
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  if (result.length === 0) return null;
  const row = result[0];
  return { ...row, meeting_links: row.meeting_links || [] } as CompanySummary;
}
