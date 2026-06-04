"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleNotch, Play } from "@phosphor-icons/react";
import { Toast } from "@/app/components/toast";

interface ProcessButtonProps {
  meetingId: string;
  hasExtracts?: boolean;
}

type RunStatus =
  | "idle"
  | "starting"
  | "queued"
  | "running"
  | "completed"
  | "failed";

interface RunStatusResponse {
  status: "queued" | "running" | "completed" | "failed";
  meetingStatus: "pending" | "processing" | "transcribed" | "completed" | "failed" | null;
  result?: {
    transcriptSource: string | null;
    extractsCreated: number;
    actionItems: number;
    notesGenerated: boolean;
    emailGenerated: boolean;
    skipped?: string;
  };
  error?: string;
}

const POLL_INTERVAL_MS = 2000;
const RUN_ID_PARAM = "runId";

/**
 * Update ?runId=<id> in the URL without triggering Next.js navigation, so the
 * component's polling state isn't lost. Pass null to remove the param.
 */
function setRunIdInUrl(runId: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (runId) {
    url.searchParams.set(RUN_ID_PARAM, runId);
  } else {
    url.searchParams.delete(RUN_ID_PARAM);
  }
  window.history.replaceState({}, "", url.toString());
}

export function ProcessButton({ meetingId, hasExtracts = false }: ProcessButtonProps) {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [meetingStatus, setMeetingStatus] = useState<RunStatusResponse["meetingStatus"]>(null);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pollRef = useRef<number | null>(null);
  const activeRunRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollOnce = useCallback(
    async (runId: string): Promise<void> => {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/run/${runId}`);
        const data: RunStatusResponse = await res.json();
        if (!res.ok) {
          setToast({ type: "error", message: data.error || "Failed to check status" });
          stopPolling();
          setStatus("failed");
          setRunIdInUrl(null);
          activeRunRef.current = null;
          return;
        }
        setMeetingStatus(data.meetingStatus);
        if (data.status === "completed") {
          stopPolling();
          setStatus("completed");
          setRunIdInUrl(null);
          activeRunRef.current = null;
          setToast({ type: "success", message: formatResultSummary(data.result, hasExtracts) });
          router.refresh();
        } else if (data.status === "failed") {
          stopPolling();
          setStatus("failed");
          setRunIdInUrl(null);
          activeRunRef.current = null;
          setToast({ type: "error", message: data.error || "Processing failed" });
          router.refresh();
        } else {
          setStatus("running");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setToast({ type: "error", message: `Polling failed: ${message}` });
        stopPolling();
        setStatus("failed");
        setRunIdInUrl(null);
        activeRunRef.current = null;
      }
    },
    [meetingId, hasExtracts, router, stopPolling]
  );

  // Resume polling on mount if the URL has ?runId=<id>. Lets the user close the
  // tab during a long workflow and come back to live progress.
  useEffect(() => {
    const paramRunId = searchParams.get(RUN_ID_PARAM);
    if (!paramRunId || activeRunRef.current === paramRunId) return;

    activeRunRef.current = paramRunId;
    setStatus("running");
    setToast({ type: "info", message: "Resuming background processing..." });
    void pollOnce(paramRunId);
    pollRef.current = window.setInterval(() => pollOnce(paramRunId), POLL_INTERVAL_MS);
    // Intentionally fire once on mount only — we don't want re-renders restarting polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Always clear the interval on unmount.
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  async function handleProcess() {
    setStatus("starting");
    setToast(null);

    try {
      const res = await fetch(`/api/meetings/${meetingId}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          message: data.error || `Failed to start processing (HTTP ${res.status})`,
        });
        setStatus("failed");
        return;
      }

      const runId = data.runId as string;
      activeRunRef.current = runId;
      setRunIdInUrl(runId);
      setStatus("queued");
      setToast({ type: "info", message: "Processing meeting..." });

      void pollOnce(runId);
      pollRef.current = window.setInterval(() => pollOnce(runId), POLL_INTERVAL_MS);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setToast({ type: "error", message: `Failed to start: ${message}` });
      setStatus("idle");
    }
  }

  const isBusy = status === "starting" || status === "queued" || status === "running";

  return (
    <>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      <button
        onClick={handleProcess}
        disabled={isBusy}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isBusy ? (
          <>
            <Spinner />
            {labelForBusyState(status, meetingStatus, hasExtracts)}
          </>
        ) : (
          <>
            <PlayIcon />
            {status === "completed" ? "Re-run" : "Process & Extract"}
          </>
        )}
      </button>
    </>
  );
}

function labelForBusyState(
  status: RunStatus,
  meetingStatus: RunStatusResponse["meetingStatus"],
  hasExtracts: boolean
): string {
  if (status === "starting") return "Starting...";
  if (meetingStatus === "processing") return "Transcribing...";
  if (meetingStatus === "transcribed") return hasExtracts ? "Finishing..." : "Extracting...";
  if (meetingStatus === "completed") return "Wrapping up...";
  return "Processing...";
}

function formatResultSummary(
  result: RunStatusResponse["result"] | undefined,
  hadExtracts: boolean
): string {
  if (!result) return "Done.";
  const parts: string[] = [];
  if (result.transcriptSource) {
    parts.push(`transcribed (${result.transcriptSource})`);
  }
  if (result.extractsCreated > 0) {
    parts.push(`${result.extractsCreated} extract${result.extractsCreated === 1 ? "" : "s"}`);
  } else if (hadExtracts) {
    parts.push("extracts already existed");
  }
  if (result.actionItems > 0) {
    parts.push(`${result.actionItems} action item${result.actionItems === 1 ? "" : "s"}`);
  }
  if (result.notesGenerated) parts.push("notes");
  if (result.emailGenerated) parts.push("email draft");
  return parts.length > 0 ? `Done: ${parts.join(", ")}` : "Done.";
}

function Spinner() {
  return <CircleNotch size={16} className="animate-spin" />;
}

function PlayIcon() {
  return <Play size={16} weight="fill" />;
}
