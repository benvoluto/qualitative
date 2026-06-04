"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CaretDown, CircleNotch, EnvelopeSimple } from "@phosphor-icons/react";

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
            <CircleNotch size={16} className="animate-spin -ml-0.5 mr-2" />
            Generating...
          </>
        ) : (
          <>
            <EnvelopeSimple size={16} className="mr-1.5" />
            Generate Email
            <CaretDown size={16} className="ml-1" />
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
