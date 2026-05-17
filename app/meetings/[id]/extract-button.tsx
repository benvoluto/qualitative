"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/app/components/toast";

interface ExtractButtonProps {
  meetingId: string;
  hasTranscript: boolean;
  hasExtracts: boolean;
  extractCount?: number;
}

export function ExtractButton({ meetingId, hasTranscript, hasExtracts, extractCount = 0 }: ExtractButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const router = useRouter();

  if (!hasTranscript) {
    return null;
  }

  async function handleExtract(reprocess: boolean = false) {
    setIsLoading(true);
    setToast(null);
    setShowConfirm(false);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reprocess }),
      });

      const data = await response.json();

      if (response.ok) {
        setToast({ type: "success", message: data.message });
        router.refresh();
      } else {
        setToast({ type: "error", message: data.error || "Failed to extract insights" });
      }
    } catch {
      setToast({ type: "error", message: "Failed to extract insights" });
    } finally {
      setIsLoading(false);
    }
  }

  function handleClick() {
    if (hasExtracts) {
      setShowConfirm(true);
    } else {
      handleExtract(false);
    }
  }

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Reprocess Meeting?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will delete {extractCount > 0 ? extractCount : "all existing"} extract{extractCount !== 1 ? "s" : ""} and
              re-run the extraction process. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExtract(true)}
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {isLoading ? "Processing..." : "Reprocess"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
          hasExtracts
            ? "bg-orange-600 text-white hover:bg-orange-700"
            : "bg-purple-600 text-white hover:bg-purple-700"
        }`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
            {hasExtracts ? "Reprocessing..." : "Extracting..."}
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {hasExtracts ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              )}
            </svg>
            {hasExtracts ? "Reprocess" : "Extract Insights"}
          </>
        )}
      </button>
    </>
  );
}
