import { getDb } from "./client";
import { Extract, CreateExtract, UpdateExtract, ActionItemStatus, RequestStatus } from "./types";

export async function getExtracts(accountId: string): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM extracts WHERE account_id = ${accountId} ORDER BY created_at DESC`;
  return result as Extract[];
}

export async function getExtractById(accountId: string, id: string): Promise<Extract | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM extracts WHERE id = ${id} AND account_id = ${accountId}`;
  return (result[0] as Extract) || null;
}

export async function getExtractsByMeetingId(accountId: string, meetingId: string): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extracts WHERE meeting_id = ${meetingId} AND account_id = ${accountId} ORDER BY created_at
  `;
  return result as Extract[];
}

export async function getExtractCountByMeetingId(accountId: string, meetingId: string): Promise<number> {
  const sql = getDb();
  const result = await sql`
    SELECT COUNT(*) as count FROM extracts WHERE meeting_id = ${meetingId} AND account_id = ${accountId}
  `;
  return parseInt(result[0]?.count || "0", 10);
}

export async function getExtractsByMeetingIds(
  accountId: string,
  meetingIds: string[]
): Promise<Map<string, Extract[]>> {
  if (meetingIds.length === 0) return new Map();
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extracts
    WHERE meeting_id = ANY(${meetingIds}) AND account_id = ${accountId}
    ORDER BY created_at
  `;
  const map = new Map<string, Extract[]>();
  for (const id of meetingIds) map.set(id, []);
  for (const e of result as Extract[]) {
    if (!e.meeting_id) continue;
    const arr = map.get(e.meeting_id) || [];
    arr.push(e);
    map.set(e.meeting_id, arr);
  }
  return map;
}

export async function getExtractsByCustomerId(accountId: string, customerId: string): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extracts WHERE customer_id = ${customerId} AND account_id = ${accountId} ORDER BY extract_date DESC
  `;
  return result as Extract[];
}

export async function getExtractsByCompanyId(accountId: string, companyId: string): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extracts WHERE company_id = ${companyId} AND account_id = ${accountId} ORDER BY extract_date DESC
  `;
  return result as Extract[];
}

export async function getActionItems(accountId: string): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extracts
    WHERE account_id = ${accountId} AND is_action_item = true
    ORDER BY created_at DESC
  `;
  return result as Extract[];
}

export async function getPendingActionItems(accountId: string): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extracts
    WHERE account_id = ${accountId}
      AND is_action_item = true
      AND (action_item_status IS NULL OR action_item_status = 'pending')
    ORDER BY created_at DESC
  `;
  return result as Extract[];
}

export async function createExtract(accountId: string, data: CreateExtract): Promise<Extract> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO extracts (
      account_id, meeting_id, customer_id, company_id, extract_rule_id, extract_date, summary, quotes,
      is_action_item, action_item_status, request_status, participant_name, participant_email
    )
    VALUES (
      ${accountId},
      ${data.meeting_id ?? null},
      ${data.customer_id ?? null},
      ${data.company_id ?? null},
      ${data.extract_rule_id ?? null},
      ${data.extract_date ?? null},
      ${data.summary ?? null},
      ${JSON.stringify(data.quotes ?? [])},
      ${data.is_action_item ?? false},
      ${data.action_item_status ?? null},
      ${data.request_status ?? null},
      ${data.participant_name ?? null},
      ${data.participant_email ?? null}
    )
    RETURNING *
  `;
  return result[0] as Extract;
}

export async function updateExtract(
  accountId: string,
  id: string,
  data: UpdateExtract
): Promise<Extract | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE extracts SET
      customer_id = COALESCE(${data.customer_id ?? null}, customer_id),
      company_id = COALESCE(${data.company_id ?? null}, company_id),
      extract_rule_id = COALESCE(${data.extract_rule_id ?? null}, extract_rule_id),
      extract_date = COALESCE(${data.extract_date ?? null}, extract_date),
      summary = COALESCE(${data.summary ?? null}, summary),
      quotes = COALESCE(${data.quotes ? JSON.stringify(data.quotes) : null}, quotes),
      is_action_item = COALESCE(${data.is_action_item ?? null}, is_action_item),
      action_item_status = COALESCE(${data.action_item_status ?? null}, action_item_status),
      request_status = COALESCE(${data.request_status ?? null}, request_status),
      participant_name = COALESCE(${data.participant_name ?? null}, participant_name),
      participant_email = COALESCE(${data.participant_email ?? null}, participant_email)
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  return (result[0] as Extract) || null;
}

export async function updateActionItemStatus(
  accountId: string,
  id: string,
  status: ActionItemStatus
): Promise<Extract | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE extracts SET action_item_status = ${status}, updated_at = NOW()
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  return (result[0] as Extract) || null;
}

export async function updateRequestStatus(
  accountId: string,
  id: string,
  status: RequestStatus
): Promise<Extract | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE extracts SET request_status = ${status}, updated_at = NOW()
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  return (result[0] as Extract) || null;
}

export async function deleteExtract(accountId: string, id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM extracts WHERE id = ${id} AND account_id = ${accountId} RETURNING id`;
  return result.length > 0;
}

export async function updateExtractsCustomerByMeetingId(
  accountId: string,
  meetingId: string,
  customerId: string | null,
  companyId: string | null
): Promise<number> {
  const sql = getDb();
  const result = await sql`
    UPDATE extracts
    SET customer_id = ${customerId},
        company_id = ${companyId},
        updated_at = NOW()
    WHERE meeting_id = ${meetingId} AND account_id = ${accountId}
    RETURNING id
  `;
  return result.length;
}

// Junction tables (extract_tags, extract_participants) — isolation via parent extract.
export async function addExtractTag(
  accountId: string,
  extractId: string,
  tagId: string
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO extract_tags (extract_id, tag_id)
    SELECT ${extractId}, ${tagId}
    WHERE EXISTS (SELECT 1 FROM extracts WHERE id = ${extractId} AND account_id = ${accountId})
    ON CONFLICT (extract_id, tag_id) DO NOTHING
  `;
}

export async function removeExtractTag(
  accountId: string,
  extractId: string,
  tagId: string
): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM extract_tags
    WHERE extract_id = ${extractId} AND tag_id = ${tagId}
      AND EXISTS (SELECT 1 FROM extracts WHERE id = ${extractId} AND account_id = ${accountId})
  `;
}

export async function removeAllExtractTags(accountId: string, extractId: string): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM extract_tags
    WHERE extract_id = ${extractId}
      AND EXISTS (SELECT 1 FROM extracts WHERE id = ${extractId} AND account_id = ${accountId})
  `;
}

export async function getExtractTagIds(accountId: string, extractId: string): Promise<string[]> {
  const sql = getDb();
  const result = await sql`
    SELECT et.tag_id FROM extract_tags et
    JOIN extracts e ON e.id = et.extract_id
    WHERE et.extract_id = ${extractId} AND e.account_id = ${accountId}
  `;
  return (result as Array<{ tag_id: string }>).map((r) => r.tag_id);
}

export async function getExtractsByTagId(accountId: string, tagId: string): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`
    SELECT e.* FROM extracts e
    JOIN extract_tags et ON e.id = et.extract_id
    WHERE et.tag_id = ${tagId} AND e.account_id = ${accountId}
    ORDER BY e.created_at DESC
  `;
  return result as Extract[];
}

export async function addExtractParticipant(
  accountId: string,
  extractId: string,
  personnelId: string
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO extract_participants (extract_id, personnel_id)
    SELECT ${extractId}, ${personnelId}
    WHERE EXISTS (SELECT 1 FROM extracts WHERE id = ${extractId} AND account_id = ${accountId})
    ON CONFLICT (extract_id, personnel_id) DO NOTHING
  `;
}

export async function getExtractParticipantIds(accountId: string, extractId: string): Promise<string[]> {
  const sql = getDb();
  const result = await sql`
    SELECT ep.personnel_id FROM extract_participants ep
    JOIN extracts e ON e.id = ep.extract_id
    WHERE ep.extract_id = ${extractId} AND e.account_id = ${accountId}
  `;
  return (result as Array<{ personnel_id: string }>).map((r) => r.personnel_id);
}

export async function searchExtracts(accountId: string, query: string): Promise<Extract[]> {
  const sql = getDb();
  const searchPattern = `%${query}%`;
  const result = await sql`
    SELECT * FROM extracts
    WHERE account_id = ${accountId} AND summary ILIKE ${searchPattern}
    ORDER BY created_at DESC
  `;
  return result as Extract[];
}

export interface ExtractWithTags extends Extract {
  tags: Array<{ id: string; name: string; color: string | null }>;
}

export interface ExtractWithRule extends Extract {
  rule_name: string | null;
}

export async function getExtractsWithRuleByMeetingId(
  accountId: string,
  meetingId: string
): Promise<ExtractWithRule[]> {
  const sql = getDb();
  const result = await sql`
    SELECT e.*, er.name as rule_name
    FROM extracts e
    LEFT JOIN extract_rules er ON e.extract_rule_id = er.id
    WHERE e.meeting_id = ${meetingId} AND e.account_id = ${accountId}
    ORDER BY e.created_at
  `;
  return result as ExtractWithRule[];
}

export async function getExtractsByRuleId(accountId: string, ruleId: string): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extracts WHERE extract_rule_id = ${ruleId} AND account_id = ${accountId}
    ORDER BY created_at DESC
  `;
  return result as Extract[];
}

export async function getExtractCountByRuleId(accountId: string, ruleId: string): Promise<number> {
  const sql = getDb();
  const result = await sql`
    SELECT COUNT(*) as count FROM extracts
    WHERE extract_rule_id = ${ruleId} AND account_id = ${accountId}
  `;
  return parseInt((result[0] as { count: string }).count, 10);
}

export async function getExtractsWithTagsByCustomerId(
  accountId: string,
  customerId: string
): Promise<ExtractWithTags[]> {
  const sql = getDb();
  const extractsResult = await sql`
    SELECT * FROM extracts
    WHERE customer_id = ${customerId} AND account_id = ${accountId}
    ORDER BY created_at
  `;
  const extractsList = extractsResult as Extract[];
  return Promise.all(
    extractsList.map(async (extract) => {
      const tagsResult = await sql`
        SELECT t.id, t.name, t.color FROM tags t
        JOIN extract_tags et ON t.id = et.tag_id
        WHERE et.extract_id = ${extract.id}
        ORDER BY t.name
      `;
      return { ...extract, tags: tagsResult as Array<{ id: string; name: string; color: string | null }> };
    })
  );
}

export async function getExtractsWithTagsByMeetingId(
  accountId: string,
  meetingId: string
): Promise<ExtractWithTags[]> {
  const sql = getDb();
  const extractsResult = await sql`
    SELECT * FROM extracts WHERE meeting_id = ${meetingId} AND account_id = ${accountId} ORDER BY created_at
  `;
  const extractsList = extractsResult as Extract[];

  const extractsWithTags: ExtractWithTags[] = await Promise.all(
    extractsList.map(async (extract) => {
      const tagsResult = await sql`
        SELECT t.id, t.name, t.color FROM tags t
        JOIN extract_tags et ON t.id = et.tag_id
        WHERE et.extract_id = ${extract.id}
      `;
      return { ...extract, tags: tagsResult as Array<{ id: string; name: string; color: string | null }> };
    })
  );

  return extractsWithTags;
}

export async function getExtractsByParticipantEmail(
  accountId: string,
  email: string
): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extracts
    WHERE participant_email = ${email} AND account_id = ${accountId}
    ORDER BY created_at DESC
  `;
  return result as Extract[];
}

export interface PaginatedExtractsParams {
  limit?: number;
  offset?: number;
}

export interface ExtractWithDetails {
  id: string;
  account_id: string;
  meeting_id: string;
  customer_id: string | null;
  company_id: string | null;
  extract_rule_id: string | null;
  extract_date: Date | null;
  summary: string | null;
  quotes: string[];
  is_action_item: boolean;
  action_item_status: ActionItemStatus;
  request_status: RequestStatus;
  participant_name: string | null;
  participant_email: string | null;
  created_at: Date;
  updated_at: Date;
  meeting_name: string | null;
  meeting_date: Date | null;
  meeting_recording_url: string | null;
  meeting_recording_passcode: string | null;
  meeting_is_internal: boolean;
  rule_name: string | null;
  customer_name: string | null;
  customer_type: "deal" | "customer" | null;
  tag_ids: string[];
  tag_names: string[];
  tag_colors: (string | null)[];
}

export interface PaginatedExtractsResult {
  extracts: ExtractWithDetails[];
  total: number;
  tagCounts: Record<string, number>;
  ruleCounts: Record<string, number>;
  customerCounts: Record<string, number>;
}

export async function getExtractsWithDetailsPaginated(
  accountId: string,
  params: PaginatedExtractsParams = {}
): Promise<PaginatedExtractsResult> {
  const sql = getDb();
  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;

  const countResult = await sql`SELECT COUNT(*) as count FROM extracts WHERE account_id = ${accountId}`;
  const total = parseInt((countResult[0] as { count: string }).count, 10);

  const extractsResult = await sql`
    SELECT
      e.*,
      m.name as meeting_name,
      m.meeting_date as meeting_date,
      m.recording_url as meeting_recording_url,
      m.recording_passcode as meeting_recording_passcode,
      m.is_internal as meeting_is_internal,
      er.name as rule_name,
      c.name as customer_name,
      c.customer_type as customer_type,
      COALESCE(array_agg(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), '{}'::uuid[]) as tag_ids,
      COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}'::text[]) as tag_names,
      COALESCE(array_agg(DISTINCT t.color) FILTER (WHERE t.id IS NOT NULL), '{}'::text[]) as tag_colors
    FROM extracts e
    LEFT JOIN meetings m ON e.meeting_id = m.id
    LEFT JOIN extract_rules er ON e.extract_rule_id = er.id
    LEFT JOIN customers c ON e.customer_id = c.id
    LEFT JOIN extract_tags et ON e.id = et.extract_id
    LEFT JOIN tags t ON et.tag_id = t.id
    WHERE e.account_id = ${accountId}
    GROUP BY e.id, m.name, m.meeting_date, m.recording_url, m.recording_passcode, m.is_internal, er.name, c.name, c.customer_type
    ORDER BY e.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const tagCountsResult = await sql`
    SELECT et.tag_id, COUNT(*) as count
    FROM extract_tags et
    JOIN extracts e ON e.id = et.extract_id
    WHERE e.account_id = ${accountId}
    GROUP BY et.tag_id
  `;
  const tagCounts: Record<string, number> = {};
  for (const row of tagCountsResult as Array<{ tag_id: string; count: string }>) {
    tagCounts[row.tag_id] = parseInt(row.count, 10);
  }

  const ruleCountsResult = await sql`
    SELECT extract_rule_id, COUNT(*) as count
    FROM extracts
    WHERE account_id = ${accountId} AND extract_rule_id IS NOT NULL
    GROUP BY extract_rule_id
  `;
  const ruleCounts: Record<string, number> = {};
  for (const row of ruleCountsResult as Array<{ extract_rule_id: string; count: string }>) {
    ruleCounts[row.extract_rule_id] = parseInt(row.count, 10);
  }

  const customerCountsResult = await sql`
    SELECT customer_id, COUNT(*) as count
    FROM extracts
    WHERE account_id = ${accountId} AND customer_id IS NOT NULL
    GROUP BY customer_id
  `;
  const customerCounts: Record<string, number> = {};
  for (const row of customerCountsResult as Array<{ customer_id: string; count: string }>) {
    customerCounts[row.customer_id] = parseInt(row.count, 10);
  }

  return {
    extracts: extractsResult as ExtractWithDetails[],
    total,
    tagCounts,
    ruleCounts,
    customerCounts,
  };
}

export interface CursorSearchParams {
  search?: string;
  cursor?: string;
  limit?: number;
  filters?: {
    customerId?: string;
    ruleId?: string;
    tagId?: string;
    isActionItem?: boolean;
    type?: "customer" | "deal" | "internal";
  };
}

export interface CursorSearchResult {
  extracts: ExtractWithDetails[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

function parseCursor(cursor: string): { createdAt: Date; id: string } | null {
  const parts = cursor.split("_");
  if (parts.length < 2) return null;
  const id = parts.pop()!;
  const timestamp = parts.join("_");
  const createdAt = new Date(timestamp);
  if (isNaN(createdAt.getTime())) return null;
  return { createdAt, id };
}

function createCursor(extract: ExtractWithDetails): string {
  return `${new Date(extract.created_at).toISOString()}_${extract.id}`;
}

/**
 * Search extracts with cursor-based pagination. The original implementation used
 * eight separate static SQL branches for each combination of (cursor, tagId, search).
 * Now that we filter by account_id everywhere, the simplest correct approach is to
 * construct the WHERE clause dynamically — much less SQL surface to keep in sync.
 */
export async function searchExtractsWithCursor(
  accountId: string,
  params: CursorSearchParams = {}
): Promise<CursorSearchResult> {
  const sql = getDb();
  const limit = Math.min(params.limit ?? 50, 100);
  const filters = params.filters || {};

  const searchTerms = params.search?.trim()
    ? params.search.trim().split(/\s+/).join(" & ")
    : null;
  const cursorData = params.cursor ? parseCursor(params.cursor) : null;

  const where: string[] = ["e.account_id = $1"];
  const values: unknown[] = [accountId];
  let i = 2;

  if (searchTerms) {
    where.push(`e.search_vector @@ to_tsquery('english', $${i++})`);
    values.push(searchTerms);
  }
  if (cursorData) {
    where.push(`(e.created_at, e.id) < ($${i++}, $${i++})`);
    values.push(cursorData.createdAt, cursorData.id);
  }
  if (filters.customerId) {
    where.push(`e.customer_id = $${i++}`);
    values.push(filters.customerId);
  }
  if (filters.ruleId) {
    where.push(`e.extract_rule_id = $${i++}`);
    values.push(filters.ruleId);
  }
  if (filters.isActionItem !== undefined) {
    where.push(`e.is_action_item = $${i++}`);
    values.push(filters.isActionItem);
  }
  if (filters.type === "internal") {
    where.push(`m.is_internal = true`);
  } else if (filters.type === "customer" || filters.type === "deal") {
    where.push(`c.customer_type = $${i++}`);
    values.push(filters.type);
  }

  let tagFilterJoin = "";
  if (filters.tagId) {
    tagFilterJoin = `JOIN extract_tags et_filter ON e.id = et_filter.extract_id AND et_filter.tag_id = $${i++}`;
    values.push(filters.tagId);
  }

  // Total count — only fetched on first page.
  let total = 0;
  if (!params.cursor) {
    const countWhere = where.filter((w) => !w.startsWith("(e.created_at, e.id)"));
    const countValues = values.slice(0, countWhere.length === where.length ? values.length : values.length);
    // Simpler: re-run count without the cursor clause.
    const cw: string[] = ["e.account_id = $1"];
    const cv: unknown[] = [accountId];
    let ci = 2;
    if (searchTerms) { cw.push(`e.search_vector @@ to_tsquery('english', $${ci++})`); cv.push(searchTerms); }
    if (filters.customerId) { cw.push(`e.customer_id = $${ci++}`); cv.push(filters.customerId); }
    if (filters.ruleId) { cw.push(`e.extract_rule_id = $${ci++}`); cv.push(filters.ruleId); }
    if (filters.isActionItem !== undefined) { cw.push(`e.is_action_item = $${ci++}`); cv.push(filters.isActionItem); }
    if (filters.type === "internal") cw.push(`m.is_internal = true`);
    else if (filters.type === "customer" || filters.type === "deal") { cw.push(`c.customer_type = $${ci++}`); cv.push(filters.type); }
    let ctf = "";
    if (filters.tagId) { ctf = `JOIN extract_tags et_filter ON e.id = et_filter.extract_id AND et_filter.tag_id = $${ci++}`; cv.push(filters.tagId); }

    const countQuery = `
      SELECT COUNT(DISTINCT e.id) as count
      FROM extracts e
      LEFT JOIN meetings m ON e.meeting_id = m.id
      LEFT JOIN customers c ON e.customer_id = c.id
      ${ctf}
      WHERE ${cw.join(" AND ")}
    `;
    const countResult = await sql(countQuery, cv);
    total = parseInt((countResult[0] as { count: string }).count, 10);
    void countValues;
  }

  const fetchLimit = limit + 1;
  values.push(fetchLimit);
  const limitParam = i;
  const mainQuery = `
    SELECT DISTINCT
      e.*,
      m.name as meeting_name,
      m.meeting_date,
      m.recording_url as meeting_recording_url,
      m.recording_passcode as meeting_recording_passcode,
      m.is_internal as meeting_is_internal,
      er.name as rule_name,
      c.name as customer_name,
      c.customer_type,
      COALESCE(array_agg(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), '{}'::uuid[]) as tag_ids,
      COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}'::text[]) as tag_names,
      COALESCE(array_agg(DISTINCT t.color) FILTER (WHERE t.id IS NOT NULL), '{}'::text[]) as tag_colors
    FROM extracts e
    LEFT JOIN meetings m ON e.meeting_id = m.id
    LEFT JOIN extract_rules er ON e.extract_rule_id = er.id
    LEFT JOIN customers c ON e.customer_id = c.id
    LEFT JOIN extract_tags et ON e.id = et.extract_id
    LEFT JOIN tags t ON et.tag_id = t.id
    ${tagFilterJoin}
    WHERE ${where.join(" AND ")}
    GROUP BY e.id, m.name, m.meeting_date, m.recording_url, m.recording_passcode, m.is_internal, er.name, c.name, c.customer_type
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT $${limitParam}
  `;
  const extractsResult = await sql(mainQuery, values);
  const extracts = extractsResult as ExtractWithDetails[];

  const hasMore = extracts.length > limit;
  if (hasMore) extracts.pop();

  const nextCursor = hasMore && extracts.length > 0
    ? createCursor(extracts[extracts.length - 1])
    : null;

  return { extracts, nextCursor, hasMore, total };
}

/**
 * Transfers all extracts from one meeting to another within the same account.
 */
export async function transferExtractsToMeeting(
  accountId: string,
  fromMeetingId: string,
  toMeetingId: string
): Promise<number> {
  const sql = getDb();
  const result = await sql`
    UPDATE extracts
    SET meeting_id = ${toMeetingId}, updated_at = NOW()
    WHERE meeting_id = ${fromMeetingId} AND account_id = ${accountId}
    RETURNING id
  `;
  return result.length;
}

export async function getExtractCountsByMeetingIds(accountId: string): Promise<Map<string, number>> {
  const sql = getDb();
  const result = await sql`
    SELECT meeting_id, COUNT(*)::int as count
    FROM extracts
    WHERE account_id = ${accountId} AND meeting_id IS NOT NULL
    GROUP BY meeting_id
  `;
  const countMap = new Map<string, number>();
  for (const row of result) {
    countMap.set(row.meeting_id as string, row.count as number);
  }
  return countMap;
}
