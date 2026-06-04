"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowsClockwise, CircleNotch, Lightning } from "@phosphor-icons/react";
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
            <CircleNotch size={16} className="animate-spin" />
            {hasExtracts ? "Reprocessing..." : "Extracting..."}
          </>
        ) : (
          <>
            {hasExtracts ? <ArrowsClockwise size={16} /> : <Lightning size={16} />}
            {hasExtracts ? "Reprocess" : "Extract Insights"}
          </>
        )}
      </button>
    </>
  );
}
