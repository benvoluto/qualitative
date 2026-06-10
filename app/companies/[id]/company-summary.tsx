"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface CompanySummaryProps {
  customerId: string;
}

interface SummaryData {
  text: string;
  meetingLinks: { name: string; meetingId: string }[];
}

export function CompanySummary({ customerId }: CompanySummaryProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (regenerate: boolean = false) => {
    if (regenerate) {
      setIsRegenerating(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const url = `/api/company-summary/${customerId}${regenerate ? "?regenerate=true" : ""}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch summary");
      }
      const data = await response.json();
      setSummary(data.summary);
    } catch (err) {
      setError("Failed to load summary");
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsRegenerating(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleRegenerate = () => {
    fetchSummary(true);
  };

  // Parse text and replace [[Name|id]] with links
  function renderTextWithLinks(text: string, keyPrefix: string = "") {
    const parts: React.ReactNode[] = [];
    const linkPattern = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;
    let lastIndex = 0;
    let match;

    while ((match = linkPattern.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // Add the link
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
  function renderSummaryWithItems(summaryText: string) {
    // Split by the separator
    const parts = summaryText.split(/\n---\n/);
    const mainSummary = parts[0].trim();
    const actionItemsSection = parts[1]?.trim();

    // Parse item type badge
    function parseItemType(itemText: string): { type: "action" | "request" | null; text: string } {
      if (itemText.startsWith("[ACTION]")) {
        return { type: "action", text: itemText.replace(/^\[ACTION\]\s*/, "") };
      }
      if (itemText.startsWith("[REQUEST]")) {
        return { type: "request", text: itemText.replace(/^\[REQUEST\]\s*/, "") };
      }
      return { type: null, text: itemText };
    }

    return (
      <>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {renderTextWithLinks(mainSummary, "summary-")}
        </p>
        {actionItemsSection && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
            <ul className="space-y-1.5">
              {actionItemsSection.split("\n").filter(line => line.trim().startsWith("•")).map((item, index) => {
                const itemText = item.replace(/^•\s*/, "").trim();
                const { type: itemType, text } = parseItemType(itemText);
                return (
                  <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                    <span className="text-gray-400 dark:text-gray-500 mt-0.5">•</span>
                    {itemType && (
                      <span
                        className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          itemType === "action"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                        }`}
                      >
                        {itemType === "action" ? "Action" : "Request"}
                      </span>
                    )}
                    <span>{renderTextWithLinks(text, `item-${index}-`)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl overflow-x-auto p-6">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
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
          <span className="text-sm">Generating summary...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl overflow-x-auto p-6">
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!summary) {
    return null; // No summary available - don't show anything
  }

  return (
    <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl overflow-x-auto p-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          6-Month Summary
        </h2>
        <button
          onClick={handleRegenerate}
          disabled={isLoading || isRegenerating}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Regenerate summary"
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
      {renderSummaryWithItems(summary.text)}
    </div>
  );
}
