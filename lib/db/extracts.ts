import { getDb } from "./client";
import { Extract, CreateExtract, UpdateExtract, ActionItemStatus, RequestStatus } from "./types";

export async function getExtracts(): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM extracts ORDER BY created_at DESC`;
  return result as Extract[];
}

export async function getExtractById(id: string): Promise<Extract | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM extracts WHERE id = ${id}`;
  return (result[0] as Extract) || null;
}

export async function getExtractsByMeetingId(meetingId: string): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extracts WHERE meeting_id = ${meetingId} ORDER BY created_at
  `;
  return result as Extract[];
}

/**
 * Get the count of extracts for a specific meeting.
 * Used for verification during deduplication.
 */
export async function getExtractCountByMeetingId(meetingId: string): Promise<number> {
  const sql = getDb();
  const result = await sql`
    SELECT COUNT(*) as count FROM extracts WHERE meeting_id = ${meetingId}
  `;
  return parseInt(result[0]?.count || "0", 10);
}

/**
 * Batch fetch extracts for multiple meeting IDs in a single query.
 * Returns a Map of meeting_id -> Extract[]
 */
export async function getExtractsByMeetingIds(meetingIds: string[]): Promise<Map<string, Extract[]>> {
  if (meetingIds.length === 0) {
    return new Map();
  }
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extracts WHERE meeting_id = ANY(${meetingIds}) ORDER BY created_at
  `;
  const extractsByMeetingId = new Map<string, Extract[]>();
  for (const meetingId of meetingIds) {
    extractsByMeetingId.set(meetingId, []);
  }
  for (const extract of result as Extract[]) {
    const meetingExtracts = extractsByMeetingId.get(extract.meeting_id) || [];
    meetingExtracts.push(extract);
    extractsByMeetingId.set(extract.meeting_id, meetingExtracts);
  }
  return extractsByMeetingId;
}

export async function getExtractsByCustomerId(customerId: string): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extracts WHERE customer_id = ${customerId} ORDER BY extract_date DESC
  `;
  return result as Extract[];
}

export async function getExtractsByCompanyId(companyId: string): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extracts WHERE company_id = ${companyId} ORDER BY extract_date DESC
  `;
  return result as Extract[];
}

export async function getActionItems(): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extracts
    WHERE is_action_item = true
    ORDER BY created_at DESC
  `;
  return result as Extract[];
}

export async function getPendingActionItems(): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extracts
    WHERE is_action_item = true AND (action_item_status IS NULL OR action_item_status = 'pending')
    ORDER BY created_at DESC
  `;
  return result as Extract[];
}

export async function createExtract(data: CreateExtract): Promise<Extract> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO extracts (
      meeting_id, customer_id, company_id, extract_rule_id, extract_date, summary, quotes, is_action_item, action_item_status, request_status, participant_name, participant_email
    )
    VALUES (
      ${data.meeting_id},
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

export async function updateExtract(id: string, data: UpdateExtract): Promise<Extract | null> {
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
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as Extract) || null;
}

export async function updateActionItemStatus(
  id: string,
  status: ActionItemStatus
): Promise<Extract | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE extracts SET action_item_status = ${status}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as Extract) || null;
}

export async function updateRequestStatus(
  id: string,
  status: RequestStatus
): Promise<Extract | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE extracts SET request_status = ${status}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as Extract) || null;
}

export async function deleteExtract(id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM extracts WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

export async function updateExtractsCustomerByMeetingId(
  meetingId: string,
  customerId: string | null
): Promise<number> {
  const sql = getDb();
  const result = await sql`
    UPDATE extracts
    SET customer_id = ${customerId}, updated_at = NOW()
    WHERE meeting_id = ${meetingId}
    RETURNING id
  `;
  return result.length;
}

// Tag management for extracts
export async function addExtractTag(extractId: string, tagId: string): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO extract_tags (extract_id, tag_id)
    VALUES (${extractId}, ${tagId})
    ON CONFLICT (extract_id, tag_id) DO NOTHING
  `;
}

export async function removeExtractTag(extractId: string, tagId: string): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM extract_tags WHERE extract_id = ${extractId} AND tag_id = ${tagId}
  `;
}

export async function removeAllExtractTags(extractId: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM extract_tags WHERE extract_id = ${extractId}`;
}

export async function getExtractTagIds(extractId: string): Promise<string[]> {
  const sql = getDb();
  const result = await sql`
    SELECT tag_id FROM extract_tags WHERE extract_id = ${extractId}
  `;
  return (result as Array<{ tag_id: string }>).map((r) => r.tag_id);
}

export async function getExtractsByTagId(tagId: string): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`
    SELECT e.* FROM extracts e
    JOIN extract_tags et ON e.id = et.extract_id
    WHERE et.tag_id = ${tagId}
    ORDER BY e.created_at DESC
  `;
  return result as Extract[];
}

// Participant management for extracts
export async function addExtractParticipant(extractId: string, personnelId: string): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO extract_participants (extract_id, personnel_id)
    VALUES (${extractId}, ${personnelId})
    ON CONFLICT (extract_id, personnel_id) DO NOTHING
  `;
}

export async function getExtractParticipantIds(extractId: string): Promise<string[]> {
  const sql = getDb();
  const result = await sql`
    SELECT personnel_id FROM extract_participants WHERE extract_id = ${extractId}
  `;
  return (result as Array<{ personnel_id: string }>).map((r) => r.personnel_id);
}

export async function searchExtracts(query: string): Promise<Extract[]> {
  const sql = getDb();
  const searchPattern = `%${query}%`;
  const result = await sql`
    SELECT * FROM extracts
    WHERE summary ILIKE ${searchPattern}
    ORDER BY created_at DESC
  `;
  return result as Extract[];
}

export interface ExtractWithTags extends Extract {
  tags: Array<{ id: string; name: string }>;
}

export interface ExtractWithRule extends Extract {
  rule_name: string | null;
}

export async function getExtractsWithRuleByMeetingId(meetingId: string): Promise<ExtractWithRule[]> {
  const sql = getDb();
  const result = await sql`
    SELECT e.*, er.name as rule_name
    FROM extracts e
    LEFT JOIN extract_rules er ON e.extract_rule_id = er.id
    WHERE e.meeting_id = ${meetingId}
    ORDER BY e.created_at
  `;
  return result as ExtractWithRule[];
}

export async function getExtractsByRuleId(ruleId: string): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extracts WHERE extract_rule_id = ${ruleId} ORDER BY created_at DESC
  `;
  return result as Extract[];
}

export async function getExtractCountByRuleId(ruleId: string): Promise<number> {
  const sql = getDb();
  const result = await sql`
    SELECT COUNT(*) as count FROM extracts WHERE extract_rule_id = ${ruleId}
  `;
  return parseInt((result[0] as { count: string }).count, 10);
}

export async function getExtractsWithTagsByMeetingId(meetingId: string): Promise<ExtractWithTags[]> {
  const sql = getDb();

  // Get extracts for this meeting
  const extractsResult = await sql`
    SELECT * FROM extracts WHERE meeting_id = ${meetingId} ORDER BY created_at
  `;

  const extractsList = extractsResult as Extract[];

  // Get tags for each extract
  const extractsWithTags: ExtractWithTags[] = await Promise.all(
    extractsList.map(async (extract) => {
      const tagsResult = await sql`
        SELECT t.id, t.name FROM tags t
        JOIN extract_tags et ON t.id = et.tag_id
        WHERE et.extract_id = ${extract.id}
      `;
      return {
        ...extract,
        tags: tagsResult as Array<{ id: string; name: string }>,
      };
    })
  );

  return extractsWithTags;
}

export async function getExtractsByParticipantEmail(email: string): Promise<Extract[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM extracts
    WHERE participant_email = ${email}
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

/**
 * Get paginated extracts with all related data in optimized queries
 */
export async function getExtractsWithDetailsPaginated(
  params: PaginatedExtractsParams = {}
): Promise<PaginatedExtractsResult> {
  const sql = getDb();
  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;

  // Get total count
  const countResult = await sql`SELECT COUNT(*) as count FROM extracts`;
  const total = parseInt((countResult[0] as { count: string }).count, 10);

  // Get extracts with all related data in a single optimized query
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
      COALESCE(
        array_agg(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL),
        '{}'::uuid[]
      ) as tag_ids,
      COALESCE(
        array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL),
        '{}'::text[]
      ) as tag_names,
      COALESCE(
        array_agg(DISTINCT t.color) FILTER (WHERE t.id IS NOT NULL),
        '{}'::text[]
      ) as tag_colors
    FROM extracts e
    LEFT JOIN meetings m ON e.meeting_id = m.id
    LEFT JOIN extract_rules er ON e.extract_rule_id = er.id
    LEFT JOIN customers c ON e.customer_id = c.id
    LEFT JOIN extract_tags et ON e.id = et.extract_id
    LEFT JOIN tags t ON et.tag_id = t.id
    GROUP BY e.id, m.name, m.meeting_date, m.recording_url, m.recording_passcode, m.is_internal, er.name, c.name, c.customer_type
    ORDER BY e.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  // Get tag counts (only for tags that have extracts)
  const tagCountsResult = await sql`
    SELECT et.tag_id, COUNT(*) as count
    FROM extract_tags et
    GROUP BY et.tag_id
  `;
  const tagCounts: Record<string, number> = {};
  for (const row of tagCountsResult as Array<{ tag_id: string; count: string }>) {
    tagCounts[row.tag_id] = parseInt(row.count, 10);
  }

  // Get rule counts
  const ruleCountsResult = await sql`
    SELECT extract_rule_id, COUNT(*) as count
    FROM extracts
    WHERE extract_rule_id IS NOT NULL
    GROUP BY extract_rule_id
  `;
  const ruleCounts: Record<string, number> = {};
  for (const row of ruleCountsResult as Array<{ extract_rule_id: string; count: string }>) {
    ruleCounts[row.extract_rule_id] = parseInt(row.count, 10);
  }

  // Get customer counts
  const customerCountsResult = await sql`
    SELECT customer_id, COUNT(*) as count
    FROM extracts
    WHERE customer_id IS NOT NULL
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

/**
 * Search parameters for cursor-based pagination
 */
export interface CursorSearchParams {
  search?: string;
  cursor?: string; // Format: "timestamp_id" (e.g., "2024-01-15T10:30:00Z_abc123")
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

/**
 * Parse a cursor string into its components
 */
function parseCursor(cursor: string): { createdAt: Date; id: string } | null {
  const parts = cursor.split("_");
  if (parts.length < 2) return null;
  const id = parts.pop()!;
  const timestamp = parts.join("_");
  const createdAt = new Date(timestamp);
  if (isNaN(createdAt.getTime())) return null;
  return { createdAt, id };
}

/**
 * Create a cursor string from an extract
 */
function createCursor(extract: ExtractWithDetails): string {
  return `${new Date(extract.created_at).toISOString()}_${extract.id}`;
}

/**
 * Search extracts with cursor-based pagination and full-text search
 * Uses PostgreSQL tsvector for efficient searching
 */
export async function searchExtractsWithCursor(
  params: CursorSearchParams = {}
): Promise<CursorSearchResult> {
  const sql = getDb();
  const limit = Math.min(params.limit ?? 50, 100);
  const filters = params.filters || {};

  // Parse search terms for full-text search
  const searchTerms = params.search?.trim()
    ? params.search.trim().split(/\s+/).join(" & ")
    : null;

  // Parse cursor
  const cursorData = params.cursor ? parseCursor(params.cursor) : null;

  // Get total count first (only on initial load without cursor)
  let total = 0;
  if (!params.cursor) {
    if (searchTerms && filters.tagId) {
      const countResult = await sql`
        SELECT COUNT(DISTINCT e.id) as count
        FROM extracts e
        LEFT JOIN meetings m ON e.meeting_id = m.id
        LEFT JOIN customers c ON e.customer_id = c.id
        JOIN extract_tags et_filter ON e.id = et_filter.extract_id AND et_filter.tag_id = ${filters.tagId}
        WHERE e.search_vector @@ to_tsquery('english', ${searchTerms})
          AND (${filters.customerId}::uuid IS NULL OR e.customer_id = ${filters.customerId})
          AND (${filters.ruleId}::uuid IS NULL OR e.extract_rule_id = ${filters.ruleId})
          AND (${filters.isActionItem}::boolean IS NULL OR e.is_action_item = ${filters.isActionItem})
          AND (${filters.type}::text IS NULL OR (
            (${filters.type} = 'internal' AND m.is_internal = true) OR
            (${filters.type} != 'internal' AND c.customer_type = ${filters.type})
          ))
      `;
      total = parseInt((countResult[0] as { count: string }).count, 10);
    } else if (searchTerms) {
      const countResult = await sql`
        SELECT COUNT(DISTINCT e.id) as count
        FROM extracts e
        LEFT JOIN meetings m ON e.meeting_id = m.id
        LEFT JOIN customers c ON e.customer_id = c.id
        WHERE e.search_vector @@ to_tsquery('english', ${searchTerms})
          AND (${filters.customerId}::uuid IS NULL OR e.customer_id = ${filters.customerId})
          AND (${filters.ruleId}::uuid IS NULL OR e.extract_rule_id = ${filters.ruleId})
          AND (${filters.isActionItem}::boolean IS NULL OR e.is_action_item = ${filters.isActionItem})
          AND (${filters.type}::text IS NULL OR (
            (${filters.type} = 'internal' AND m.is_internal = true) OR
            (${filters.type} != 'internal' AND c.customer_type = ${filters.type})
          ))
      `;
      total = parseInt((countResult[0] as { count: string }).count, 10);
    } else if (filters.tagId) {
      const countResult = await sql`
        SELECT COUNT(DISTINCT e.id) as count
        FROM extracts e
        LEFT JOIN meetings m ON e.meeting_id = m.id
        LEFT JOIN customers c ON e.customer_id = c.id
        JOIN extract_tags et_filter ON e.id = et_filter.extract_id AND et_filter.tag_id = ${filters.tagId}
        WHERE (${filters.customerId}::uuid IS NULL OR e.customer_id = ${filters.customerId})
          AND (${filters.ruleId}::uuid IS NULL OR e.extract_rule_id = ${filters.ruleId})
          AND (${filters.isActionItem}::boolean IS NULL OR e.is_action_item = ${filters.isActionItem})
          AND (${filters.type}::text IS NULL OR (
            (${filters.type} = 'internal' AND m.is_internal = true) OR
            (${filters.type} != 'internal' AND c.customer_type = ${filters.type})
          ))
      `;
      total = parseInt((countResult[0] as { count: string }).count, 10);
    } else {
      const countResult = await sql`
        SELECT COUNT(DISTINCT e.id) as count
        FROM extracts e
        LEFT JOIN meetings m ON e.meeting_id = m.id
        LEFT JOIN customers c ON e.customer_id = c.id
        WHERE (${filters.customerId}::uuid IS NULL OR e.customer_id = ${filters.customerId})
          AND (${filters.ruleId}::uuid IS NULL OR e.extract_rule_id = ${filters.ruleId})
          AND (${filters.isActionItem}::boolean IS NULL OR e.is_action_item = ${filters.isActionItem})
          AND (${filters.type}::text IS NULL OR (
            (${filters.type} = 'internal' AND m.is_internal = true) OR
            (${filters.type} != 'internal' AND c.customer_type = ${filters.type})
          ))
      `;
      total = parseInt((countResult[0] as { count: string }).count, 10);
    }
  }

  // Main query - separate branches for tag filter and search combinations
  let extracts: ExtractWithDetails[];
  const fetchLimit = limit + 1;

  if (searchTerms && filters.tagId && cursorData) {
    const result = await sql`
      SELECT DISTINCT
        e.*,
        m.name as meeting_name, m.meeting_date, m.recording_url as meeting_recording_url, m.is_internal as meeting_is_internal,
        er.name as rule_name, c.name as customer_name, c.customer_type,
        COALESCE(array_agg(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), '{}'::uuid[]) as tag_ids,
        COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}'::text[]) as tag_names,
        COALESCE(array_agg(DISTINCT t.color) FILTER (WHERE t.id IS NOT NULL), '{}'::text[]) as tag_colors
      FROM extracts e
      LEFT JOIN meetings m ON e.meeting_id = m.id
      LEFT JOIN extract_rules er ON e.extract_rule_id = er.id
      LEFT JOIN customers c ON e.customer_id = c.id
      LEFT JOIN extract_tags et ON e.id = et.extract_id
      LEFT JOIN tags t ON et.tag_id = t.id
      JOIN extract_tags et_filter ON e.id = et_filter.extract_id AND et_filter.tag_id = ${filters.tagId}
      WHERE e.search_vector @@ to_tsquery('english', ${searchTerms})
        AND (e.created_at, e.id) < (${cursorData.createdAt}, ${cursorData.id})
        AND (${filters.customerId}::uuid IS NULL OR e.customer_id = ${filters.customerId})
        AND (${filters.ruleId}::uuid IS NULL OR e.extract_rule_id = ${filters.ruleId})
        AND (${filters.isActionItem}::boolean IS NULL OR e.is_action_item = ${filters.isActionItem})
        AND (${filters.type}::text IS NULL OR (
          (${filters.type} = 'internal' AND m.is_internal = true) OR
          (${filters.type} != 'internal' AND c.customer_type = ${filters.type})
        ))
      GROUP BY e.id, m.name, m.meeting_date, m.recording_url, m.recording_passcode, m.is_internal, er.name, c.name, c.customer_type
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ${fetchLimit}
    `;
    extracts = result as ExtractWithDetails[];
  } else if (searchTerms && filters.tagId) {
    const result = await sql`
      SELECT DISTINCT
        e.*,
        m.name as meeting_name, m.meeting_date, m.recording_url as meeting_recording_url, m.is_internal as meeting_is_internal,
        er.name as rule_name, c.name as customer_name, c.customer_type,
        COALESCE(array_agg(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), '{}'::uuid[]) as tag_ids,
        COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}'::text[]) as tag_names,
        COALESCE(array_agg(DISTINCT t.color) FILTER (WHERE t.id IS NOT NULL), '{}'::text[]) as tag_colors
      FROM extracts e
      LEFT JOIN meetings m ON e.meeting_id = m.id
      LEFT JOIN extract_rules er ON e.extract_rule_id = er.id
      LEFT JOIN customers c ON e.customer_id = c.id
      LEFT JOIN extract_tags et ON e.id = et.extract_id
      LEFT JOIN tags t ON et.tag_id = t.id
      JOIN extract_tags et_filter ON e.id = et_filter.extract_id AND et_filter.tag_id = ${filters.tagId}
      WHERE e.search_vector @@ to_tsquery('english', ${searchTerms})
        AND (${filters.customerId}::uuid IS NULL OR e.customer_id = ${filters.customerId})
        AND (${filters.ruleId}::uuid IS NULL OR e.extract_rule_id = ${filters.ruleId})
        AND (${filters.isActionItem}::boolean IS NULL OR e.is_action_item = ${filters.isActionItem})
        AND (${filters.type}::text IS NULL OR (
          (${filters.type} = 'internal' AND m.is_internal = true) OR
          (${filters.type} != 'internal' AND c.customer_type = ${filters.type})
        ))
      GROUP BY e.id, m.name, m.meeting_date, m.recording_url, m.recording_passcode, m.is_internal, er.name, c.name, c.customer_type
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ${fetchLimit}
    `;
    extracts = result as ExtractWithDetails[];
  } else if (searchTerms && cursorData) {
    const result = await sql`
      SELECT DISTINCT
        e.*,
        m.name as meeting_name, m.meeting_date, m.recording_url as meeting_recording_url, m.is_internal as meeting_is_internal,
        er.name as rule_name, c.name as customer_name, c.customer_type,
        COALESCE(array_agg(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), '{}'::uuid[]) as tag_ids,
        COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}'::text[]) as tag_names,
        COALESCE(array_agg(DISTINCT t.color) FILTER (WHERE t.id IS NOT NULL), '{}'::text[]) as tag_colors
      FROM extracts e
      LEFT JOIN meetings m ON e.meeting_id = m.id
      LEFT JOIN extract_rules er ON e.extract_rule_id = er.id
      LEFT JOIN customers c ON e.customer_id = c.id
      LEFT JOIN extract_tags et ON e.id = et.extract_id
      LEFT JOIN tags t ON et.tag_id = t.id
      WHERE e.search_vector @@ to_tsquery('english', ${searchTerms})
        AND (e.created_at, e.id) < (${cursorData.createdAt}, ${cursorData.id})
        AND (${filters.customerId}::uuid IS NULL OR e.customer_id = ${filters.customerId})
        AND (${filters.ruleId}::uuid IS NULL OR e.extract_rule_id = ${filters.ruleId})
        AND (${filters.isActionItem}::boolean IS NULL OR e.is_action_item = ${filters.isActionItem})
        AND (${filters.type}::text IS NULL OR (
          (${filters.type} = 'internal' AND m.is_internal = true) OR
          (${filters.type} != 'internal' AND c.customer_type = ${filters.type})
        ))
      GROUP BY e.id, m.name, m.meeting_date, m.recording_url, m.recording_passcode, m.is_internal, er.name, c.name, c.customer_type
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ${fetchLimit}
    `;
    extracts = result as ExtractWithDetails[];
  } else if (searchTerms) {
    const result = await sql`
      SELECT DISTINCT
        e.*,
        m.name as meeting_name, m.meeting_date, m.recording_url as meeting_recording_url, m.is_internal as meeting_is_internal,
        er.name as rule_name, c.name as customer_name, c.customer_type,
        COALESCE(array_agg(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), '{}'::uuid[]) as tag_ids,
        COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}'::text[]) as tag_names,
        COALESCE(array_agg(DISTINCT t.color) FILTER (WHERE t.id IS NOT NULL), '{}'::text[]) as tag_colors
      FROM extracts e
      LEFT JOIN meetings m ON e.meeting_id = m.id
      LEFT JOIN extract_rules er ON e.extract_rule_id = er.id
      LEFT JOIN customers c ON e.customer_id = c.id
      LEFT JOIN extract_tags et ON e.id = et.extract_id
      LEFT JOIN tags t ON et.tag_id = t.id
      WHERE e.search_vector @@ to_tsquery('english', ${searchTerms})
        AND (${filters.customerId}::uuid IS NULL OR e.customer_id = ${filters.customerId})
        AND (${filters.ruleId}::uuid IS NULL OR e.extract_rule_id = ${filters.ruleId})
        AND (${filters.isActionItem}::boolean IS NULL OR e.is_action_item = ${filters.isActionItem})
        AND (${filters.type}::text IS NULL OR (
          (${filters.type} = 'internal' AND m.is_internal = true) OR
          (${filters.type} != 'internal' AND c.customer_type = ${filters.type})
        ))
      GROUP BY e.id, m.name, m.meeting_date, m.recording_url, m.recording_passcode, m.is_internal, er.name, c.name, c.customer_type
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ${fetchLimit}
    `;
    extracts = result as ExtractWithDetails[];
  } else if (filters.tagId && cursorData) {
    const result = await sql`
      SELECT DISTINCT
        e.*,
        m.name as meeting_name, m.meeting_date, m.recording_url as meeting_recording_url, m.is_internal as meeting_is_internal,
        er.name as rule_name, c.name as customer_name, c.customer_type,
        COALESCE(array_agg(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), '{}'::uuid[]) as tag_ids,
        COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}'::text[]) as tag_names,
        COALESCE(array_agg(DISTINCT t.color) FILTER (WHERE t.id IS NOT NULL), '{}'::text[]) as tag_colors
      FROM extracts e
      LEFT JOIN meetings m ON e.meeting_id = m.id
      LEFT JOIN extract_rules er ON e.extract_rule_id = er.id
      LEFT JOIN customers c ON e.customer_id = c.id
      LEFT JOIN extract_tags et ON e.id = et.extract_id
      LEFT JOIN tags t ON et.tag_id = t.id
      JOIN extract_tags et_filter ON e.id = et_filter.extract_id AND et_filter.tag_id = ${filters.tagId}
      WHERE (e.created_at, e.id) < (${cursorData.createdAt}, ${cursorData.id})
        AND (${filters.customerId}::uuid IS NULL OR e.customer_id = ${filters.customerId})
        AND (${filters.ruleId}::uuid IS NULL OR e.extract_rule_id = ${filters.ruleId})
        AND (${filters.isActionItem}::boolean IS NULL OR e.is_action_item = ${filters.isActionItem})
        AND (${filters.type}::text IS NULL OR (
          (${filters.type} = 'internal' AND m.is_internal = true) OR
          (${filters.type} != 'internal' AND c.customer_type = ${filters.type})
        ))
      GROUP BY e.id, m.name, m.meeting_date, m.recording_url, m.recording_passcode, m.is_internal, er.name, c.name, c.customer_type
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ${fetchLimit}
    `;
    extracts = result as ExtractWithDetails[];
  } else if (filters.tagId) {
    const result = await sql`
      SELECT DISTINCT
        e.*,
        m.name as meeting_name, m.meeting_date, m.recording_url as meeting_recording_url, m.is_internal as meeting_is_internal,
        er.name as rule_name, c.name as customer_name, c.customer_type,
        COALESCE(array_agg(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), '{}'::uuid[]) as tag_ids,
        COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}'::text[]) as tag_names,
        COALESCE(array_agg(DISTINCT t.color) FILTER (WHERE t.id IS NOT NULL), '{}'::text[]) as tag_colors
      FROM extracts e
      LEFT JOIN meetings m ON e.meeting_id = m.id
      LEFT JOIN extract_rules er ON e.extract_rule_id = er.id
      LEFT JOIN customers c ON e.customer_id = c.id
      LEFT JOIN extract_tags et ON e.id = et.extract_id
      LEFT JOIN tags t ON et.tag_id = t.id
      JOIN extract_tags et_filter ON e.id = et_filter.extract_id AND et_filter.tag_id = ${filters.tagId}
      WHERE (${filters.customerId}::uuid IS NULL OR e.customer_id = ${filters.customerId})
        AND (${filters.ruleId}::uuid IS NULL OR e.extract_rule_id = ${filters.ruleId})
        AND (${filters.isActionItem}::boolean IS NULL OR e.is_action_item = ${filters.isActionItem})
        AND (${filters.type}::text IS NULL OR (
          (${filters.type} = 'internal' AND m.is_internal = true) OR
          (${filters.type} != 'internal' AND c.customer_type = ${filters.type})
        ))
      GROUP BY e.id, m.name, m.meeting_date, m.recording_url, m.recording_passcode, m.is_internal, er.name, c.name, c.customer_type
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ${fetchLimit}
    `;
    extracts = result as ExtractWithDetails[];
  } else if (cursorData) {
    const result = await sql`
      SELECT DISTINCT
        e.*,
        m.name as meeting_name, m.meeting_date, m.recording_url as meeting_recording_url, m.is_internal as meeting_is_internal,
        er.name as rule_name, c.name as customer_name, c.customer_type,
        COALESCE(array_agg(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), '{}'::uuid[]) as tag_ids,
        COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}'::text[]) as tag_names,
        COALESCE(array_agg(DISTINCT t.color) FILTER (WHERE t.id IS NOT NULL), '{}'::text[]) as tag_colors
      FROM extracts e
      LEFT JOIN meetings m ON e.meeting_id = m.id
      LEFT JOIN extract_rules er ON e.extract_rule_id = er.id
      LEFT JOIN customers c ON e.customer_id = c.id
      LEFT JOIN extract_tags et ON e.id = et.extract_id
      LEFT JOIN tags t ON et.tag_id = t.id
      WHERE (e.created_at, e.id) < (${cursorData.createdAt}, ${cursorData.id})
        AND (${filters.customerId}::uuid IS NULL OR e.customer_id = ${filters.customerId})
        AND (${filters.ruleId}::uuid IS NULL OR e.extract_rule_id = ${filters.ruleId})
        AND (${filters.isActionItem}::boolean IS NULL OR e.is_action_item = ${filters.isActionItem})
        AND (${filters.type}::text IS NULL OR (
          (${filters.type} = 'internal' AND m.is_internal = true) OR
          (${filters.type} != 'internal' AND c.customer_type = ${filters.type})
        ))
      GROUP BY e.id, m.name, m.meeting_date, m.recording_url, m.recording_passcode, m.is_internal, er.name, c.name, c.customer_type
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ${fetchLimit}
    `;
    extracts = result as ExtractWithDetails[];
  } else {
    const result = await sql`
      SELECT DISTINCT
        e.*,
        m.name as meeting_name, m.meeting_date, m.recording_url as meeting_recording_url, m.is_internal as meeting_is_internal,
        er.name as rule_name, c.name as customer_name, c.customer_type,
        COALESCE(array_agg(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), '{}'::uuid[]) as tag_ids,
        COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}'::text[]) as tag_names,
        COALESCE(array_agg(DISTINCT t.color) FILTER (WHERE t.id IS NOT NULL), '{}'::text[]) as tag_colors
      FROM extracts e
      LEFT JOIN meetings m ON e.meeting_id = m.id
      LEFT JOIN extract_rules er ON e.extract_rule_id = er.id
      LEFT JOIN customers c ON e.customer_id = c.id
      LEFT JOIN extract_tags et ON e.id = et.extract_id
      LEFT JOIN tags t ON et.tag_id = t.id
      WHERE (${filters.customerId}::uuid IS NULL OR e.customer_id = ${filters.customerId})
        AND (${filters.ruleId}::uuid IS NULL OR e.extract_rule_id = ${filters.ruleId})
        AND (${filters.isActionItem}::boolean IS NULL OR e.is_action_item = ${filters.isActionItem})
        AND (${filters.type}::text IS NULL OR (
          (${filters.type} = 'internal' AND m.is_internal = true) OR
          (${filters.type} != 'internal' AND c.customer_type = ${filters.type})
        ))
      GROUP BY e.id, m.name, m.meeting_date, m.recording_url, m.recording_passcode, m.is_internal, er.name, c.name, c.customer_type
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ${fetchLimit}
    `;
    extracts = result as ExtractWithDetails[];
  }

  // Check if there are more results
  const hasMore = extracts.length > limit;
  if (hasMore) {
    extracts.pop();
  }

  // Generate next cursor
  const nextCursor = hasMore && extracts.length > 0
    ? createCursor(extracts[extracts.length - 1])
    : null;

  return {
    extracts,
    nextCursor,
    hasMore,
    total,
  };
}

/**
 * Transfers all extracts from one meeting to another.
 * Used during deduplication to preserve extracts before deleting a duplicate meeting.
 *
 * @param fromMeetingId The meeting ID to transfer extracts from
 * @param toMeetingId The meeting ID to transfer extracts to
 * @returns Number of extracts transferred
 */
export async function transferExtractsToMeeting(
  fromMeetingId: string,
  toMeetingId: string
): Promise<number> {
  const sql = getDb();
  const result = await sql`
    UPDATE extracts
    SET meeting_id = ${toMeetingId}, updated_at = NOW()
    WHERE meeting_id = ${fromMeetingId}
    RETURNING id
  `;
  return result.length;
}

/**
 * Get extract counts grouped by meeting ID
 * Returns a map of meeting_id -> extract count
 */
export async function getExtractCountsByMeetingIds(): Promise<Map<string, number>> {
  const sql = getDb();
  const result = await sql`
    SELECT meeting_id, COUNT(*)::int as count
    FROM extracts
    WHERE meeting_id IS NOT NULL
    GROUP BY meeting_id
  `;
  const countMap = new Map<string, number>();
  for (const row of result) {
    countMap.set(row.meeting_id as string, row.count as number);
  }
  return countMap;
}
