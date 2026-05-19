"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Period = "week" | "month" | "quarter";
type TypeFilter = "all" | "deals" | "customers" | "internal";

const STORAGE_KEY_PERIOD = "recent-activity-period";
const STORAGE_KEY_TYPE = "recent-activity-type";

interface ActivitySummary {
  type: "deals" | "customers" | "internal";
  summary: string;
  meetingLinks: { name: string; meetingId: string }[];
}

interface StatusUpdate {
  extractId: string;
  status: string;
}

export function RecentActivity() {
  const [period, setPeriod] = useState<Period>("week");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [summaries, setSummaries] = useState<ActivitySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedStatuses, setUpdatedStatuses] = useState<Map<string, StatusUpdate>>(new Map());
  const [updatingExtractId, setUpdatingExtractId] = useState<string | null>(null);

  // Load saved preferences from localStorage on mount
  useEffect(() => {
    const savedPeriod = localStorage.getItem(STORAGE_KEY_PERIOD);
    if (savedPeriod && ["week", "month", "quarter"].includes(savedPeriod)) {
      setPeriod(savedPeriod as Period);
    }

    const savedType = localStorage.getItem(STORAGE_KEY_TYPE);
    if (savedType && ["all", "deals", "customers", "internal"].includes(savedType)) {
      setTypeFilter(savedType as TypeFilter);
    }
  }, []);

  // Save period to localStorage when it changes
  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
    localStorage.setItem(STORAGE_KEY_PERIOD, newPeriod);
  };

  // Save type filter to localStorage when it changes
  const handleTypeFilterChange = (newType: TypeFilter) => {
    setTypeFilter(newType);
    localStorage.setItem(STORAGE_KEY_TYPE, newType);
  };

  const fetchSummaries = useCallback(async (regenerate: boolean = false) => {
    if (regenerate) {
      setIsRegenerating(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const url = `/api/activity-summary?period=${period}${regenerate ? "&regenerate=true" : ""}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch summaries");
      }
      const data = await response.json();
      setSummaries(data.summaries || []);
    } catch (err) {
      setError("Failed to load activity summaries");
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsRegenerating(false);
    }
  }, [period]);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const handleRegenerate = () => {
    fetchSummaries(true);
  };

  const updateExtractStatus = async (
    extractId: string,
    statusType: "action" | "request",
    status: string
  ) => {
    setUpdatingExtractId(extractId);
    try {
      const response = await fetch(`/api/extracts/${extractId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusType, status }),
      });
      if (response.ok) {
        setUpdatedStatuses((prev) => {
          const newMap = new Map(prev);
          newMap.set(extractId, { extractId, status });
          return newMap;
        });
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdatingExtractId(null);
    }
  };

  // Filter summaries based on type filter
  const filteredSummaries = typeFilter === "all"
    ? summaries
    : summaries.filter((s) => s.type === typeFilter);

  // Parse text and replace [[Name|id]] or [[Name|meeting_id|extract_id]] with links
  function renderTextWithLinks(text: string, keyPrefix: string = "") {
    const parts: React.ReactNode[] = [];
    const linkPattern = /\[\[([^\]|]+)\|([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let lastIndex = 0;
    let match;

    while ((match = linkPattern.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // Add the link (extract the meeting ID, ignoring extract ID for the link)
      const [, name, meetingId] = match;
      parts.push(
        <Link
          key={`${keyPrefix}${meetingId}-${match.index}`}
          href={`/meetings/${meetingId}`}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
        >
          {name}
        </Link>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  }

  // Parse summary and separate action items section
  function renderSummaryWithItems(summary: string, type: string) {
    // Split by the separator
    const parts = summary.split(/\n---\n/);
    const mainSummary = parts[0].trim();
    const actionItemsSection = parts[1]?.trim();

    // Parse item type badge and extract ID
    function parseItemType(itemText: string): { type: "action" | "request" | null; text: string; extractId: string | null } {
      let itemType: "action" | "request" | null = null;
      let cleanedText = itemText;

      if (itemText.startsWith("[ACTION]")) {
        itemType = "action";
        cleanedText = itemText.replace(/^\[ACTION\]\s*/, "");
      } else if (itemText.startsWith("[REQUEST]")) {
        itemType = "request";
        cleanedText = itemText.replace(/^\[REQUEST\]\s*/, "");
      }

      // Extract the extract ID from the link pattern [[Name|meeting_id|extract_id]]
      const linkPattern = /\[\[([^\]|]+)\|([^\]|]+)\|([^\]]+)\]\]/;
      const match = linkPattern.exec(cleanedText);
      const extractId = match ? match[3] : null;

      return { type: itemType, text: cleanedText, extractId };
    }

    // Parse all items and separate into actions and requests
    const allItems = actionItemsSection
      ? actionItemsSection.split("\n").filter(line => line.trim().startsWith("•")).map((item) => {
          const itemText = item.replace(/^•\s*/, "").trim();
          return parseItemType(itemText);
        })
      : [];

    const actions = allItems.filter(item => item.type === "action");
    const requests = allItems.filter(item => item.type === "request");
    const otherItems = allItems.filter(item => item.type === null);

    const MAX_ITEMS = 3;
    const displayedActions = actions.slice(0, MAX_ITEMS);
    const displayedRequests = requests.slice(0, MAX_ITEMS);
    const displayedOther = otherItems.slice(0, MAX_ITEMS);
    const hasMoreActions = actions.length > MAX_ITEMS;
    const hasMoreRequests = requests.length > MAX_ITEMS;

    function renderItemList(items: { type: "action" | "request" | null; text: string; extractId: string | null }[], itemType: "action" | "request" | null, keyPrefix: string) {
      return items.map((item, index) => {
        const isUpdating = updatingExtractId === item.extractId;
        const statusUpdate = item.extractId ? updatedStatuses.get(item.extractId) : null;
        const isMarkedDone = statusUpdate?.status === "assigned" || statusUpdate?.status === "ticket_added";

        return (
          <li key={`${keyPrefix}-${index}`} className={`text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2 ${isMarkedDone ? "opacity-60" : ""}`}>
            <span className="text-gray-400 dark:text-gray-500 mt-0.5">•</span>
            {item.type && (
              <span
                className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  item.type === "action"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                }`}
              >
                {item.type === "action" ? "Action" : "Request"}
              </span>
            )}
            <span className={isMarkedDone ? "line-through" : ""}>{renderTextWithLinks(item.text, `${type}-${keyPrefix}-${index}-`)}</span>
            {item.extractId && !isMarkedDone && (
              <button
                onClick={() => {
                  if (item.type === "action") {
                    updateExtractStatus(item.extractId!, "action", "assigned");
                  } else if (item.type === "request") {
                    updateExtractStatus(item.extractId!, "request", "ticket_added");
                  }
                }}
                disabled={isUpdating}
                className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                  isUpdating
                    ? "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                    : item.type === "action"
                    ? "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
                }`}
                title={item.type === "action" ? "Mark as assigned" : "Mark as ticket added"}
              >
                {isUpdating ? "..." : item.type === "action" ? "Mark Assigned" : "Mark Ticket Added"}
              </button>
            )}
            {isMarkedDone && (
              <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                {statusUpdate?.status === "assigned" ? "Assigned" : "Ticket Added"}
              </span>
            )}
          </li>
        );
      });
    }

    return (
      <>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {renderTextWithLinks(mainSummary, `${type}-summary-`)}
        </p>
        {actionItemsSection && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-3">
            {/* Actions section */}
            {actions.length > 0 && (
              <div>
                <ul className="space-y-1.5">
                  {renderItemList(displayedActions, "action", "action")}
                </ul>
                <Link
                  href="/extracts?filter=action"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {hasMoreActions ? `See all ${actions.length} actions` : "Manage action status"}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}

            {/* Requests section */}
            {requests.length > 0 && (
              <div>
                <ul className="space-y-1.5">
                  {renderItemList(displayedRequests, "request", "request")}
                </ul>
                <Link
                  href="/extracts?filter=request"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
                >
                  {hasMoreRequests ? `See all ${requests.length} requests` : "Manage request status"}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}

            {/* Other items (no type) */}
            {otherItems.length > 0 && (
              <ul className="space-y-1.5">
                {renderItemList(displayedOther, null, "other")}
              </ul>
            )}
          </div>
        )}
      </>
    );
  }

  const periodLabels = {
    week: "Last Week",
    month: "Last Month",
    quarter: "Last 3 Months",
  };

  const typeLabels: Record<TypeFilter, string> = {
    all: "All",
    deals: "Deals",
    customers: "Customers",
    internal: "Internal",
  };

  const typeColors = {
    deals: "border-l-purple-500",
    customers: "border-l-blue-500",
    internal: "border-l-gray-500",
  };

  // Count meetings by type (using meetingLinks.length from each summary)
  const typeCounts = {
    all: summaries.reduce((acc, s) => acc + s.meetingLinks.length, 0),
    deals: summaries.find((s) => s.type === "deals")?.meetingLinks.length || 0,
    customers: summaries.find((s) => s.type === "customers")?.meetingLinks.length || 0,
    internal: summaries.find((s) => s.type === "internal")?.meetingLinks.length || 0,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Activity
          </h3>
          <button
            onClick={handleRegenerate}
            disabled={isLoading || isRegenerating}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Regenerate summaries"
          >
            <svg
              className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
        <div className="flex gap-3 flex-wrap">
          {/* Type Filter */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {(["all", "deals", "customers", "internal"] as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTypeFilterChange(t)}
                disabled={isLoading}
                className={`px-3 py-1 text-sm rounded-md transition-colors disabled:opacity-50 ${
                  typeFilter === t
                    ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {typeLabels[t]}
                {!isLoading && typeCounts[t] > 0 && (
                  <span className="ml-1 text-xs opacity-60">({typeCounts[t]})</span>
                )}
              </button>
            ))}
          </div>

          {/* Period Filter */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {(["week", "month", "quarter"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                disabled={isLoading}
                className={`px-3 py-1 text-sm rounded-md transition-colors disabled:opacity-50 ${
                  period === p
                    ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        {isLoading ? (
          <div className="p-6 text-center">
            <div className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Generating summaries...
            </div>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-500 dark:text-red-400">
            {error}
          </div>
        ) : filteredSummaries.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            {summaries.length === 0
              ? `No meetings with dates in the ${periodLabels[period].toLowerCase()}.`
              : `No ${typeFilter} activity in the ${periodLabels[period].toLowerCase()}.`}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredSummaries.map((summary) => (
              <div
                key={summary.type}
                className={`p-4 border-l-4 ${typeColors[summary.type]}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {typeLabels[summary.type]}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({summary.meetingLinks.length} meeting{summary.meetingLinks.length !== 1 ? "s" : ""})
                  </span>
                </div>
                {renderSummaryWithItems(summary.summary, summary.type)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
