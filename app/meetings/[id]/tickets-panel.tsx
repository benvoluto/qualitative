"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

interface TicketsPanelProps {
  meetingId: string;
  hasExtracts: boolean;
  hasPotentialTickets: boolean;
}

interface GeneratedTickets {
  featureRequests: Array<{
    title: string;
    description: string;
    priority: string;
    labels: string[];
    customerName: string;
    contactName: string;
    userQuote?: string;
  }>;
  bugs: Array<{
    title: string;
    description: string;
    priority: string;
    labels: string[];
    customerName: string;
    contactName: string;
  }>;
}

export function TicketsPanel({
  meetingId,
  hasExtracts,
  hasPotentialTickets,
}: TicketsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tickets, setTickets] = useState<GeneratedTickets | null>(null);
  const [formattedText, setFormattedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerateTickets() {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/generate-tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (response.ok) {
        setTickets(data.tickets);
        setFormattedText(data.formattedText);
        setIsExpanded(true);
      } else {
        setError(data.error || "Failed to generate tickets");
      }
    } catch (err) {
      console.error("Error generating tickets:", err);
      setError("Failed to generate tickets");
    } finally {
      setIsGenerating(false);
    }
  }

  const totalTickets = tickets
    ? tickets.featureRequests.length + tickets.bugs.length
    : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tickets
          </h2>
          {tickets && (
            <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded">
              {tickets.featureRequests.length} feature requests, {tickets.bugs.length} bugs
            </span>
          )}
        </div>
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
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          {error && (
            <div className="mb-4 p-3 rounded-md text-sm bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}

          {!tickets && !formattedText && (
            <div className="text-center py-4">
              {!hasExtracts ? (
                <p className="text-gray-500 dark:text-gray-400 mb-3">
                  Extract insights first to identify feature requests and bugs.
                </p>
              ) : !hasPotentialTickets ? (
                <p className="text-gray-500 dark:text-gray-400 mb-3">
                  No obvious feature requests or bugs detected in this meeting.
                  You can still generate tickets to analyze more thoroughly.
                </p>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 mb-3">
                  Analyze meeting extracts to identify feature requests and bug reports.
                </p>
              )}
              <button
                onClick={handleGenerateTickets}
                disabled={isGenerating || !hasExtracts}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Generate Ticket Text
                  </>
                )}
              </button>
            </div>
          )}

          {formattedText && (
            <div className="space-y-4">
              {totalTickets === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">
                  No feature requests or bugs were identified in this meeting.
                </p>
              ) : (
                <>
                  <div className="prose prose-sm dark:prose-invert max-w-none
                    prose-headings:font-semibold prose-headings:text-gray-900 dark:prose-headings:text-white
                    prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2 prose-h2:border-b prose-h2:border-gray-200 dark:prose-h2:border-gray-700 prose-h2:pb-2
                    prose-h3:text-base prose-h3:mt-3 prose-h3:mb-1
                    prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:my-1
                    prose-strong:text-gray-900 dark:prose-strong:text-white
                    prose-blockquote:border-purple-300 dark:prose-blockquote:border-purple-600
                    prose-blockquote:text-purple-700 dark:prose-blockquote:text-purple-300
                    prose-blockquote:bg-purple-50 dark:prose-blockquote:bg-purple-900/20
                    prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded
                    prose-hr:my-3 prose-hr:border-gray-200 dark:prose-hr:border-gray-700">
                    <ReactMarkdown>{formattedText}</ReactMarkdown>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(formattedText);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy to Clipboard
                    </button>
                    <button
                      onClick={handleGenerateTickets}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
