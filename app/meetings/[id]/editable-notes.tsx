"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  ArrowsClockwise,
  Gear,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { SettingsModal } from "@/components/settings-modal";

type MeetingWorkflowStatus =
  | "pending"
  | "processing"
  | "transcribed"
  | "completed"
  | "failed";

interface EditableNotesProps {
  meetingId: string;
  notes: string | null;
  meetingStatus: MeetingWorkflowStatus;
}

const LIVE_POLL_INTERVAL_MS = 3000;

export function EditableNotes({
  meetingId,
  notes: initialNotes,
  meetingStatus: initialMeetingStatus,
}: EditableNotesProps) {
  const [notes, setNotes] = useState<string | null>(initialNotes);
  const [meetingStatus, setMeetingStatus] =
    useState<MeetingWorkflowStatus>(initialMeetingStatus);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState(initialNotes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);
  const [regenerateInstructions, setRegenerateInstructions] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);
  useEffect(() => {
    setMeetingStatus(initialMeetingStatus);
  }, [initialMeetingStatus]);

  // Live polling while the workflow is generating notes in the background.
  // Don't clobber the textarea while the user is actively editing.
  useEffect(() => {
    if (isEditing) return;
    const hasRunId = searchParams.get("runId") !== null;
    const isInFlight =
      meetingStatus === "processing" || meetingStatus === "transcribed";
    const shouldPoll = hasRunId || (isInFlight && !notes);
    if (!shouldPoll) return;

    let cancelled = false;
    async function poll(): Promise<void> {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/notes`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          notes: string | null;
          meetingStatus: MeetingWorkflowStatus;
        };
        if (cancelled) return;
        setMeetingStatus(data.meetingStatus);
        if (data.notes !== notes) {
          setNotes(data.notes);
        }
      } catch {
        // Transient failures retry on the next tick.
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
  }, [meetingId, meetingStatus, notes, isEditing, searchParams]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_notes: editedNotes || null,
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to save notes");
      }
    } catch (error) {
      console.error("Error saving notes:", error);
      alert("Failed to save notes");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_notes: null,
        }),
      });

      if (response.ok) {
        setEditedNotes("");
        setShowDeleteConfirm(false);
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete notes");
      }
    } catch (error) {
      console.error("Error deleting notes:", error);
      alert("Failed to delete notes");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setEditedNotes(notes ?? "");
    setIsEditing(false);
  }

  async function handleRegenerate() {
    setIsRegenerating(true);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/generate-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          additionalInstructions: regenerateInstructions.trim() || null,
        }),
      });
      if (response.ok) {
        setShowRegeneratePrompt(false);
        setRegenerateInstructions("");
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to regenerate notes");
      }
    } catch (error) {
      console.error("Error regenerating notes:", error);
      alert("Failed to regenerate notes");
    } finally {
      setIsRegenerating(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Notes
        </h2>
        {!isEditing && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <PencilSimple size={16} />
              Edit
            </button>
            {notes && (
              <button
                onClick={() => setShowRegeneratePrompt(!showRegeneratePrompt)}
                disabled={isRegenerating}
                className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
              >
                <ArrowsClockwise size={16} className={isRegenerating ? "animate-spin" : ""} />
                {isRegenerating ? "Regenerating..." : "Regenerate"}
              </button>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <Gear size={16} />
              Edit Template
            </button>
            {notes && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1 px-2 py-1 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                <Trash size={16} />
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Regenerate with instructions panel */}
      {showRegeneratePrompt && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Additional instructions for regeneration (optional)
          </label>
          <textarea
            value={regenerateInstructions}
            onChange={(e) => setRegenerateInstructions(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder="e.g., Focus on action items, make it more concise, include more quotes..."
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isRegenerating ? "Regenerating..." : "Regenerate Notes"}
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

      {isEditing ? (
        <div className="space-y-4">
          <textarea
            value={editedNotes}
            onChange={(e) => setEditedNotes(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder="Add notes about this meeting..."
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Notes"}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : notes ? (
        <div className="prose prose-sm dark:prose-invert max-w-none
          prose-headings:font-semibold prose-headings:text-gray-900 dark:prose-headings:text-white
          prose-h1:text-xl prose-h1:mt-6 prose-h1:mb-3
          prose-h2:text-lg prose-h2:mt-5 prose-h2:mb-2
          prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2
          prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:my-2
          prose-li:text-gray-700 dark:prose-li:text-gray-300
          prose-ul:my-2 prose-ol:my-2
          prose-strong:text-gray-900 dark:prose-strong:text-white
          prose-hr:my-4 prose-hr:border-gray-300 dark:prose-hr:border-gray-600
          prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600
          prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400">
          <ReactMarkdown>{notes}</ReactMarkdown>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-500 dark:text-gray-400 mb-3">No notes added yet.</p>
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <Plus size={16} weight="bold" />
            Add Notes
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete Notes?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will permanently delete all notes for this meeting. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isSaving}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isSaving ? "Deleting..." : "Delete Notes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        initialSection="prompts"
      />
    </div>
  );
}
