"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface GenerateEmailButtonProps {
  meetingId: string;
  hasExtracts: boolean;
}

export function GenerateEmailButton({
  meetingId,
  hasExtracts,
}: GenerateEmailButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();

  const draftTypes = [
    { id: "follow_up", label: "Follow-up Email" },
    { id: "action_items", label: "Action Items Summary" },
    { id: "meeting_notes", label: "Meeting Notes" },
  ] as const;

  async function handleGenerate(
    draftType: "follow_up" | "action_items" | "meeting_notes"
  ) {
    setIsGenerating(true);
    setShowMenu(false);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/generate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftType }),
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to generate email");
      }
    } catch (error) {
      console.error("Error generating email:", error);
      alert("Failed to generate email");
    } finally {
      setIsGenerating(false);
    }
  }

  if (!hasExtracts) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isGenerating}
        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <svg
              className="animate-spin -ml-0.5 mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Generating...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4 mr-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Generate Email
            <svg
              className="w-4 h-4 ml-1"
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
          </>
        )}
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
          {draftTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => handleGenerate(type.id)}
              className="block w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-md last:rounded-b-md"
            >
              {type.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
