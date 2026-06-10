"use client";

import { useState } from "react";
import { Extract } from "@/lib/db/types";

type ExtractFilter = "all" | "actions" | "requests" | "extracts";

interface CompanyExtractsProps {
  extracts: Extract[];
}

export function CompanyExtracts({ extracts }: CompanyExtractsProps) {
  const [filter, setFilter] = useState<ExtractFilter>("all");

  const filteredExtracts = extracts.filter((extract) => {
    switch (filter) {
      case "actions":
        return extract.is_action_item;
      case "requests":
        return extract.request_status !== null;
      case "extracts":
        return !extract.is_action_item && extract.request_status === null;
      default:
        return true;
    }
  });

  const counts = {
    all: extracts.length,
    actions: extracts.filter((e) => e.is_action_item).length,
    requests: extracts.filter((e) => e.request_status !== null).length,
    extracts: extracts.filter((e) => !e.is_action_item && e.request_status === null).length,
  };

  const filterButtons: { key: ExtractFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "actions", label: "Actions" },
    { key: "requests", label: "Requests" },
    { key: "extracts", label: "Extracts" },
  ];

  if (extracts.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl overflow-x-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Extracts
        </h2>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {filterButtons.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === key
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {label}
              <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">
                ({counts[key]})
              </span>
            </button>
          ))}
        </div>
      </div>
      {filteredExtracts.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">
          No {filter === "all" ? "extracts" : filter} found
        </p>
      ) : (
        <div className="space-y-4">
          {filteredExtracts.map((extract) => (
            <div
              key={extract.id}
              className="p-4 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              {extract.summary && (
                <p className="text-gray-900 dark:text-white">{extract.summary}</p>
              )}
              {extract.quotes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {extract.quotes.map((quote, i) => (
                    <p key={i} className="text-sm text-gray-500 dark:text-gray-400 italic">
                      &ldquo;{quote}&rdquo;
                    </p>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {extract.is_action_item && (
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      extract.action_item_status === "done"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : extract.action_item_status === "assigned"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                    }`}
                  >
                    Action: {extract.action_item_status || "pending"}
                  </span>
                )}
                {extract.request_status !== null && (
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      extract.request_status === "ticket_added"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                    }`}
                  >
                    Request: {extract.request_status}
                  </span>
                )}
                {extract.participant_name && (
                  <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {extract.participant_name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
