"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/app/components/toast";

interface ProcessButtonProps {
  meetingId: string;
  hasExtracts?: boolean;
}

type ProcessingStep = "idle" | "processing" | "extracting" | "done";

export function ProcessButton({ meetingId, hasExtracts = false }: ProcessButtonProps) {
  const [step, setStep] = useState<ProcessingStep>("idle");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const router = useRouter();

  const isLoading = step !== "idle" && step !== "done";

  async function handleProcess() {
    setStep("processing");
    setToast(null);

    try {
      // Step 1: Process transcript
      const processResponse = await fetch(`/api/meetings/${meetingId}/process`, {
        method: "POST",
      });

      const processData = await processResponse.json();

      if (!processResponse.ok) {
        setToast({ type: "error", message: processData.error || "Failed to process meeting" });
        setStep("idle");
        return;
      }

      // Step 2: Extract insights (only if meeting doesn't already have extracts)
      if (!hasExtracts) {
        setStep("extracting");

        const extractResponse = await fetch(`/api/meetings/${meetingId}/extract`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reprocess: false }),
        });

        const extractData = await extractResponse.json();

        if (extractResponse.ok) {
          setToast({ type: "success", message: `Processed transcript and ${extractData.message}` });
        } else {
          // Transcript was processed but extraction failed
          setToast({ type: "error", message: `Transcript processed but extraction failed: ${extractData.error}` });
        }
      } else {
        setToast({ type: "success", message: "Transcript processed successfully" });
      }

      setStep("done");
      router.refresh();
    } catch {
      setToast({ type: "error", message: "Failed to process meeting" });
      setStep("idle");
    }
  }

  function getButtonText() {
    switch (step) {
      case "processing":
        return "Processing...";
      case "extracting":
        return "Extracting...";
      default:
        return "Process & Extract";
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
      <button
        onClick={handleProcess}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            {getButtonText()}
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            {getButtonText()}
          </>
        )}
      </button>
    </>
  );
}
