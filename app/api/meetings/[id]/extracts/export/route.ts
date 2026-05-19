import { NextRequest } from "next/server";
import { requireAccountContext } from "@/lib/account-context";
import { getDb } from "@/lib/db/client";
import { meetings } from "@/lib/db";

/**
 * GET /api/meetings/[id]/extracts/export
 * Returns all extracts for a meeting as a CSV download.
 *
 * Columns: Summary, Quotes, Tags, Rule, Action item?, Action status,
 *          Request status, Participant name, Participant email,
 *          Extract date, Created at
 *
 * Quotes are joined with newlines inside the cell; tags are joined with "; ".
 * Output is RFC 4180-compliant with a BOM so Excel correctly detects UTF-8.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { accountId } = await requireAccountContext();
  const { id } = await params;

  const meeting = await meetings.getMeetingById(accountId, id);
  if (!meeting) {
    return Response.json({ error: "Meeting not found" }, { status: 404 });
  }

  const sql = getDb();
  const rows = (await sql`
    SELECT
      e.summary,
      e.quotes,
      e.is_action_item,
      e.action_item_status,
      e.request_status,
      e.participant_name,
      e.participant_email,
      e.extract_date,
      e.created_at,
      er.name AS rule_name,
      COALESCE(
        array_agg(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL),
        '{}'::text[]
      ) AS tag_names
    FROM extracts e
    LEFT JOIN extract_rules er ON er.id = e.extract_rule_id
    LEFT JOIN extract_tags et ON et.extract_id = e.id
    LEFT JOIN tags t ON t.id = et.tag_id
    WHERE e.meeting_id = ${id} AND e.account_id = ${accountId}
    GROUP BY e.id, er.name
    ORDER BY e.created_at ASC
  `) as Array<{
    summary: string | null;
    quotes: unknown;
    is_action_item: boolean;
    action_item_status: string | null;
    request_status: string | null;
    participant_name: string | null;
    participant_email: string | null;
    extract_date: Date | null;
    created_at: Date;
    rule_name: string | null;
    tag_names: string[];
  }>;

  const header = [
    "Summary",
    "Quotes",
    "Tags",
    "Rule",
    "Action item?",
    "Action status",
    "Request status",
    "Participant name",
    "Participant email",
    "Extract date",
    "Created at",
  ];

  const lines: string[] = [header.map(csvField).join(",")];
  for (const r of rows) {
    const quotesArr = Array.isArray(r.quotes) ? (r.quotes as string[]) : [];
    lines.push(
      [
        r.summary ?? "",
        quotesArr.join("\n"),
        r.tag_names.join("; "),
        r.rule_name ?? "",
        r.is_action_item ? "Yes" : "No",
        r.action_item_status ?? "",
        r.request_status ?? "",
        r.participant_name ?? "",
        r.participant_email ?? "",
        r.extract_date ? new Date(r.extract_date).toISOString() : "",
        new Date(r.created_at).toISOString(),
      ]
        .map(csvField)
        .join(",")
    );
  }

  // BOM so Excel auto-detects UTF-8.
  const body = "﻿" + lines.join("\r\n");
  const filename = `${slugifyForFilename(meeting.name || "meeting")}-extracts.csv`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * RFC 4180: wrap in double-quotes if the field contains a comma, double-quote,
 * carriage return, or newline. Double-up any embedded quotes.
 */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function slugifyForFilename(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "meeting"
  );
}
