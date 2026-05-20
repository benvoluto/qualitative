import * as XLSX from "xlsx";

interface ExtractRowSource {
  summary: string | null;
  quotes: string[];
  rule_name: string | null;
  tags: { name: string }[];
  customer_name: string | null;
  customer_type: "deal" | "customer" | null;
  is_internal: boolean;
  is_action_item: boolean;
  action_item_status: "pending" | "assigned" | "done" | null;
  request_status: "pending" | "ticket_added" | null;
  extract_date: Date | string | null;
  created_at: Date | string;
  meeting: { name: string | null; meeting_date: Date | string | null } | null;
}

interface ExportRow {
  Summary: string;
  Quotes: string;
  Tags: string;
  Rule: string;
  "Action item?": string;
  "Action status": string;
  "Request status": string;
  Organization: string;
  "Organization type": string;
  Meeting: string;
  "Meeting date": string;
  "Extract date": string;
  "Created at": string;
}

const COLUMN_ORDER: (keyof ExportRow)[] = [
  "Summary",
  "Quotes",
  "Tags",
  "Rule",
  "Action item?",
  "Action status",
  "Request status",
  "Organization",
  "Organization type",
  "Meeting",
  "Meeting date",
  "Extract date",
  "Created at",
];

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function formatOrgType(type: "deal" | "customer" | null, isInternal: boolean): string {
  if (isInternal) return "Other";
  if (type === "deal") return "Secondary";
  if (type === "customer") return "Primary";
  return "";
}

function toExportRows(extracts: ExtractRowSource[]): ExportRow[] {
  return extracts.map((e) => ({
    Summary: e.summary ?? "",
    Quotes: (e.quotes ?? []).join("\n"),
    Tags: (e.tags ?? []).map((t) => t.name).sort((a, b) => a.localeCompare(b)).join("; "),
    Rule: e.rule_name ?? "",
    "Action item?": e.is_action_item ? "Yes" : "No",
    "Action status": e.is_action_item ? (e.action_item_status ?? "pending") : "",
    "Request status": e.is_action_item ? "" : (e.request_status ?? "pending"),
    Organization: e.customer_name ?? "",
    "Organization type": formatOrgType(e.customer_type, e.is_internal),
    Meeting: e.meeting?.name ?? "",
    "Meeting date": formatDate(e.meeting?.meeting_date),
    "Extract date": formatDate(e.extract_date),
    "Created at": formatDate(e.created_at),
  }));
}

function csvField(value: string): string {
  // RFC 4180: wrap in quotes if contains comma, quote, newline, or CR; double up internal quotes.
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildFilename(prefix: string, extension: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `${prefix}-${stamp}.${extension}`;
}

export function exportExtractsToCsv(extracts: ExtractRowSource[]): void {
  const rows = toExportRows(extracts);
  const lines: string[] = [];
  lines.push(COLUMN_ORDER.join(","));
  for (const row of rows) {
    lines.push(COLUMN_ORDER.map((col) => csvField(row[col])).join(","));
  }
  // UTF-8 BOM so Excel detects the encoding correctly.
  const body = "﻿" + lines.join("\r\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, buildFilename("extracts", "csv"));
}

/**
 * Format extracts as plain text for pasting into Miro (or any sticky-note tool
 * that takes one item per line). Each line:
 *
 *   <summary> "<first 48 chars of first quote, ellipsized>" (tag1, tag2)
 *
 * Quote and parenthetical tag list are omitted if absent so the output stays
 * tidy for extracts that have no quote or no tags.
 */
const MIRO_QUOTE_LENGTH = 48;

export function formatExtractsForMiro(extracts: ExtractRowSource[]): string {
  return extracts.map(formatExtractLine).join("\n");
}

function formatExtractLine(e: ExtractRowSource): string {
  const summary = (e.summary ?? "").trim();
  const firstQuote = (e.quotes ?? []).find((q) => q && q.trim().length > 0)?.trim() ?? "";
  const tagNames = (e.tags ?? []).map((t) => t.name);

  const parts: string[] = [];
  if (summary) parts.push(summary);
  if (firstQuote) {
    const truncated = firstQuote.length > MIRO_QUOTE_LENGTH
      ? firstQuote.slice(0, MIRO_QUOTE_LENGTH).trimEnd() + "..."
      : firstQuote;
    parts.push(`"${truncated}"`);
  }
  if (tagNames.length > 0) parts.push(`(${tagNames.join(", ")})`);
  return parts.join(" ");
}

export function exportExtractsToXlsx(extracts: ExtractRowSource[]): void {
  const rows = toExportRows(extracts);
  const sheet = XLSX.utils.json_to_sheet(rows, { header: COLUMN_ORDER });
  // Sensible default column widths so users don't have to manually resize.
  sheet["!cols"] = COLUMN_ORDER.map((col) => {
    if (col === "Summary" || col === "Quotes") return { wch: 60 };
    if (col === "Meeting") return { wch: 32 };
    if (col === "Organization") return { wch: 24 };
    if (col === "Tags" || col === "Rule") return { wch: 24 };
    if (col.includes("date") || col.includes("at")) return { wch: 22 };
    return { wch: 14 };
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Extracts");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, buildFilename("extracts", "xlsx"));
}
