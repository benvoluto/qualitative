"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { CaretDown, CircleNotch, Gear } from "@phosphor-icons/react";
import { EmailDraft } from "@/lib/db/types";
import { SettingsModal } from "@/components/settings-modal";

type MeetingWorkflowStatus =
  | "pending"
  | "processing"
  | "transcribed"
  | "completed"
  | "failed";

interface EmailDraftPanelProps {
  drafts: EmailDraft[];
  meetingId: string;
  meetingStatus: MeetingWorkflowStatus;
}

const LIVE_POLL_INTERVAL_MS = 3000;

export function EmailDraftPanel({
  drafts: initialDrafts,
  meetingId,
  meetingStatus: initialMeetingStatus,
}: EmailDraftPanelProps) {
  const [drafts, setDrafts] = useState<EmailDraft[]>(initialDrafts);
  const [meetingStatus, setMeetingStatus] =
    useState<MeetingWorkflowStatus>(initialMeetingStatus);
  const [showSettings, setShowSettings] = useState(false);
  const searchParams = useSearchParams();
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    setDrafts(initialDrafts);
  }, [initialDrafts]);
  useEffect(() => {
    setMeetingStatus(initialMeetingStatus);
  }, [initialMeetingStatus]);

  const hasRunId = searchParams.get("runId") !== null;
  const isInFlight =
    meetingStatus === "processing" || meetingStatus === "transcribed";
  const shouldPoll = hasRunId || (isInFlight && drafts.length === 0);

  useEffect(() => {
    if (!shouldPoll) return;
    let cancelled = false;
    async function poll(): Promise<void> {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/drafts`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          drafts: EmailDraft[];
          meetingStatus: MeetingWorkflowStatus;
        };
        if (cancelled) return;
        setMeetingStatus(data.meetingStatus);
        if (data.drafts.length !== drafts.length) {
          setDrafts(data.drafts);
        }
      } catch {
        // Transient failures retry on next tick.
      }
    }
    void poll();
    pollRef.current = window.setInterval(poll, LIVE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [meetingId, shouldPoll, drafts.length]);

  if (drafts.length === 0) {
    if (!shouldPoll) return null;
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-x-auto p-6">
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <CircleNotch size={16} className="animate-spin" />
          Generating email draft…
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-x-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Email Drafts ({drafts.length})
        </h2>
        <button
          onClick={() => setShowSettings(true)}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
        >
          <Gear size={14} />
          Edit Template
        </button>
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        initialSection="prompts"
      />
      <div className="space-y-4">
        {drafts.map((draft) => (
          <EmailDraftCard key={draft.id} draft={draft} />
        ))}
      </div>
    </div>
  );
}

function EmailDraftCard({
  draft,
}: {
  draft: EmailDraft;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState(draft.subject || "");
  const [editedBody, setEditedBody] = useState(draft.body || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);
  const [regenerateInstructions, setRegenerateInstructions] = useState("");
  const router = useRouter();

  const draftTypeLabels = {
    follow_up: "Follow-up Email",
    action_items: "Action Items Summary",
    meeting_notes: "Meeting Notes",
  };

  const statusColors = {
    draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    sent: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    discarded: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  };

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/email-drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editedSubject,
          body: editedBody,
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        router.refresh();
      }
    } catch (error) {
      console.error("Error saving draft:", error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRegenerate() {
    setIsRegenerating(true);
    try {
      const response = await fetch(`/api/email-drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regenerate: true,
          additionalInstructions: regenerateInstructions.trim() || null,
        }),
      });
      if (response.ok) {
        setShowRegeneratePrompt(false);
        setRegenerateInstructions("");
        router.refresh();
      }
    } catch (error) {
      console.error("Error regenerating draft:", error);
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleMarkSent() {
    try {
      const response = await fetch(`/api/email-drafts/${draft.id}/send`, {
        method: "POST",
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Error marking as sent:", error);
    }
  }

  async function handleDiscard() {
    try {
      const response = await fetch(`/api/email-drafts/${draft.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Error discarding draft:", error);
    }
  }

  function handleCopyToClipboard() {
    const emailText = `Subject: ${draft.subject}\n\n${draft.body}`;
    navigator.clipboard.writeText(emailText);
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {draftTypeLabels[draft.draft_type as keyof typeof draftTypeLabels]}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[draft.status]}`}>
              {draft.status}
            </span>
          </div>
          {(draft.recipient_email || draft.recipient_name) && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              <span className="font-medium">To:</span>{" "}
              {draft.recipient_email ? (
                <span className="break-all">
                  {draft.recipient_name || "Recipients"} &lt;{draft.recipient_email}&gt;
                </span>
              ) : (
                draft.recipient_name || "Recipients"
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <CaretDown
            size={20}
            className={`transform transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {isEditing ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Body
                </label>
                <textarea
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedSubject(draft.subject || "");
                    setEditedBody(draft.body || "");
                  }}
                  className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Regenerate with instructions panel */}
              {showRegeneratePrompt && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Additional instructions for regeneration (optional)
                  </label>
                  <textarea
                    value={regenerateInstructions}
                    onChange={(e) => setRegenerateInstructions(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="e.g., Make it shorter, use a more formal tone, emphasize the demo scheduling..."
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isRegenerating ? "Regenerating..." : "Regenerate Email"}
                    </button>
                    <button
                      onClick={() => {
                        setShowRegeneratePrompt(false);
                        setRegenerateInstructions("");
                      }}
                      disabled={isRegenerating}
                      className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Subject: {draft.subject}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <div className="prose prose-sm dark:prose-invert max-w-none
                  prose-headings:font-semibold prose-headings:text-gray-900 dark:prose-headings:text-white
                  prose-h1:text-xl prose-h1:mt-4 prose-h1:mb-2
                  prose-h2:text-lg prose-h2:mt-3 prose-h2:mb-2
                  prose-h3:text-base prose-h3:mt-2 prose-h3:mb-1
                  prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:my-1
                  prose-li:text-gray-700 dark:prose-li:text-gray-300
                  prose-ul:my-1 prose-ol:my-1
                  prose-strong:text-gray-900 dark:prose-strong:text-white
                  prose-hr:my-3 prose-hr:border-gray-300 dark:prose-hr:border-gray-600">
                  <ReactMarkdown>{draft.body || ""}</ReactMarkdown>
                </div>
              </div>
              {draft.status === "draft" && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleCopyToClipboard}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    onClick={() => setShowRegeneratePrompt(!showRegeneratePrompt)}
                    disabled={isRegenerating}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                  >
                    {isRegenerating ? "Regenerating..." : "Regenerate"}
                  </button>
                  <button
                    onClick={handleMarkSent}
                    className="px-3 py-1 text-sm text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                  >
                    Mark as Sent
                  </button>
                  <button
                    onClick={handleDiscard}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Discard
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
