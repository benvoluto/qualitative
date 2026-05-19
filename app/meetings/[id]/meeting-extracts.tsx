"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ExtractTag {
  id: string;
  name: string;
}

interface ExtractWithTags {
  id: string;
  meeting_id: string;
  customer_id: string | null;
  extract_rule_id: string | null;
  extract_date: Date | null;
  summary: string | null;
  quotes: string[];
  is_action_item: boolean;
  action_item_status: "pending" | "assigned" | "done" | null;
  request_status: "pending" | "ticket_added" | null;
  participant_name: string | null;
  participant_email: string | null;
  created_at: Date;
  updated_at: Date;
  tags: ExtractTag[];
}

interface MeetingExtractsProps {
  extracts: ExtractWithTags[];
  hasTranscript: boolean;
  meetingId: string;
}

export function MeetingExtracts({ extracts, hasTranscript, meetingId }: MeetingExtractsProps) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  async function handleStatusUpdate(extractId: string, statusType: "action" | "request", status: string | null) {
    setUpdatingId(extractId);
    try {
      const response = await fetch(`/api/extracts/${extractId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusType, status }),
      });
      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setUpdatingId(null);
    }
  }

  const actionItemCount = extracts.filter(e => e.is_action_item).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <div
        className="w-full p-6 flex items-center justify-between cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Extracts ({extracts.length})
          </h2>
          {actionItemCount > 0 && (
            <span className="text-sm text-orange-600 dark:text-orange-400">
              {actionItemCount} action items
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {extracts.length > 0 && (
            <a
              href={`/api/meetings/${meetingId}/extracts/export`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              title="Download extracts as CSV"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                />
              </svg>
              Export CSV
            </a>
          )}
        <svg
          className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
        </div>
      </div>
      {isExpanded && extracts.length > 0 && (
        <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="space-y-4">
          {extracts.map((extract) => (
            <div
              key={extract.id}
              className={`p-4 rounded-lg border ${
                extract.is_action_item
                  ? "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800"
                  : "bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700"
              }`}
            >
              {/* Status Controls */}
              <div className="flex items-center gap-2 mb-2">
                {extract.is_action_item ? (
                  <div className="inline-flex items-center gap-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-l text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">
                      Action
                    </span>
                    <select
                      value={extract.action_item_status || "pending"}
                      onChange={(e) => handleStatusUpdate(extract.id, "action", e.target.value === "pending" ? null : e.target.value)}
                      disabled={updatingId === extract.id}
                      className="text-xs px-1.5 py-0.5 rounded-r border-l-0 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 text-orange-800 dark:text-orange-300 focus:ring-1 focus:ring-orange-400 disabled:opacity-50"
                    >
                      <option value="pending">Pending</option>
                      <option value="assigned">Assigned</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-l text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                      Request
                    </span>
                    <select
                      value={extract.request_status || "pending"}
                      onChange={(e) => handleStatusUpdate(extract.id, "request", e.target.value === "pending" ? null : e.target.value)}
                      disabled={updatingId === extract.id}
                      className="text-xs px-1.5 py-0.5 rounded-r border-l-0 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300 focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                    >
                      <option value="pending">Pending</option>
                      <option value="ticket_added">Ticket Added</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Participant Info */}
              {(extract.participant_name || extract.participant_email) && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>
                    {extract.participant_name}
                    {extract.participant_email && (
                      <span className="text-gray-400 dark:text-gray-500">
                        {" "}({extract.participant_email})
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Summary */}
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                {extract.summary}
              </p>

              {/* Quotes */}
              {extract.quotes && extract.quotes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {extract.quotes.slice(0, 2).map((quote, idx) => (
                    <blockquote
                      key={idx}
                      className="text-xs text-gray-500 dark:text-gray-400 italic border-l-2 border-gray-300 dark:border-gray-600 pl-2"
                    >
                      &ldquo;{quote}&rdquo;
                    </blockquote>
                  ))}
                  {extract.quotes.length > 2 && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      +{extract.quotes.length - 2} more quotes
                    </span>
                  )}
                </div>
              )}

              {/* Tags */}
              {extract.tags && extract.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {extract.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        </div>
      )}
      {isExpanded && extracts.length === 0 && (
        <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          <p className="text-gray-500 dark:text-gray-400">
            {hasTranscript
              ? "No extracts yet. Click 'Extract Insights' to generate insights from the transcript."
              : "No extracts yet. Process the transcript first, then extract insights."}
          </p>
        </div>
      )}
    </div>
  );
}
