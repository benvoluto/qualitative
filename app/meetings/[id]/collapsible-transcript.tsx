"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface CollapsibleTranscriptProps {
  meetingId: string;
  transcript: string | null;
  workflowStatus: string;
}

export function CollapsibleTranscript({
  meetingId,
  transcript,
  workflowStatus,
}: CollapsibleTranscriptProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState(transcript || "");
  const [isSaving, setIsSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSave() {
    if (!editedTranscript.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: editedTranscript.trim(),
          transcript_source: "manual",
        }),
      });
      if (response.ok) {
        setIsEditing(false);
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to save transcript:", error);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setEditedTranscript(transcript || "");
    setIsEditing(false);
  }

  function handleFileSelect(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        // Handle VTT/SRT format - strip timestamps if present
        const cleanedContent = cleanTranscriptFormat(content);
        setEditedTranscript(cleanedContent);
        setIsEditing(true);
        setIsExpanded(true);
      }
    };
    reader.readAsText(file);
  }

  function cleanTranscriptFormat(content: string): string {
    // Check if it's VTT format
    if (content.startsWith("WEBVTT")) {
      return parseVTT(content);
    }
    // Check if it's SRT format (starts with number followed by timestamp)
    if (/^\d+\r?\n\d{2}:\d{2}/.test(content)) {
      return parseSRT(content);
    }
    return content;
  }

  function parseVTT(content: string): string {
    const lines = content.split("\n");
    const textLines: string[] = [];
    let skipNext = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "WEBVTT" || trimmed === "" || trimmed.startsWith("NOTE")) {
        continue;
      }
      if (trimmed.includes("-->")) {
        skipNext = false;
        continue;
      }
      if (trimmed && !skipNext) {
        textLines.push(trimmed);
      }
    }
    return textLines.join("\n");
  }

  function parseSRT(content: string): string {
    const lines = content.split("\n");
    const textLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^\d+$/.test(trimmed) || trimmed.includes("-->") || trimmed === "") {
        continue;
      }
      textLines.push(trimmed);
    }
    return textLines.join("\n");
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <div
        className="w-full p-6 flex items-center justify-between"
        role="button"
        tabIndex={0}
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isEditing) {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Transcript
          </h2>
          {transcript && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({transcript.length.toLocaleString()} characters)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
                setIsExpanded(true);
                setEditedTranscript(transcript || "");
              }}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 px-2 py-1"
            >
              {transcript ? "Edit" : "Add"}
            </button>
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

      {isExpanded && (
        <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          {isEditing ? (
            <div className="space-y-4">
              {/* File upload area */}
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                  dragActive
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.vtt,.srt"
                  onChange={handleFileInput}
                  className="hidden"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Drag & drop a transcript file here, or{" "}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    browse
                  </button>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Supports .txt, .vtt, .srt files
                </p>
              </div>

              {/* Textarea for paste/edit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Paste or type transcript
                </label>
                <textarea
                  value={editedTranscript}
                  onChange={(e) => setEditedTranscript(e.target.value)}
                  placeholder="Paste your transcript here..."
                  rows={15}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !editedTranscript.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Transcript"}
                </button>
              </div>
            </div>
          ) : transcript ? (
            <div className="prose dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-[500px]">
                {transcript}
              </pre>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {workflowStatus === "processing"
                  ? "Transcript is being processed..."
                  : "No transcript available."}
              </p>
              {workflowStatus !== "processing" && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Transcript
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!isExpanded && !transcript && !isEditing && (
        <div className="px-6 pb-6 pt-0">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {workflowStatus === "processing"
              ? "Transcript is being processed..."
              : "No transcript available. Click 'Add' to upload or paste a transcript."}
          </p>
        </div>
      )}
    </div>
  );
}
