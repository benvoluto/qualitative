"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { features } from "@/lib/features";

interface WorkflowActionsProps {
  meetingId: string;
  hasExtracts: boolean;
  hasNotes: boolean;
  hasDraft: boolean;
  customerType: "deal" | "customer" | null;
  hubspotCompanyId: string | null;
  hubspotDealId: string | null;
}

export function WorkflowActions({
  meetingId,
  hasExtracts,
  hasNotes,
  hasDraft,
  customerType,
  hubspotCompanyId,
  hubspotDealId,
}: WorkflowActionsProps) {
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [isWritingHubSpot, setIsWritingHubSpot] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  // Determine if HubSpot notes can be written
  const canWriteToHubSpot = hasExtracts && (hubspotCompanyId || hubspotDealId);

  async function handleGenerateEmail() {
    setIsGeneratingEmail(true);
    setMessage(null);

    try {
      // Use follow_up which automatically uses the correct template based on customer type
      const response = await fetch(`/api/meetings/${meetingId}/generate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftType: "follow_up" }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Email draft generated successfully!",
        });
        router.refresh();
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to generate email draft",
        });
      }
    } catch (error) {
      console.error("Error generating email:", error);
      setMessage({
        type: "error",
        text: "Failed to generate email draft",
      });
    } finally {
      setIsGeneratingEmail(false);
    }
  }

  async function handleGenerateNotes() {
    setIsGeneratingNotes(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/generate-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Meeting notes generated and added!",
        });
        router.refresh();
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to generate notes",
        });
      }
    } catch (error) {
      console.error("Error generating notes:", error);
      setMessage({
        type: "error",
        text: "Failed to generate notes",
      });
    } finally {
      setIsGeneratingNotes(false);
    }
  }

  async function handleWriteHubSpotNotes() {
    setIsWritingHubSpot(true);
    setMessage(null);

    try {
      const response = await fetch("/api/hubspot/write-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Notes written to HubSpot successfully!",
        });
        router.refresh();
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to write notes to HubSpot",
        });
      }
    } catch (error) {
      console.error("Error writing notes to HubSpot:", error);
      setMessage({
        type: "error",
        text: "Failed to write notes to HubSpot",
      });
    } finally {
      setIsWritingHubSpot(false);
    }
  }

  if (!hasExtracts) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Workflow Actions
      </h2>

      {message && (
        <div
          className={`mb-4 p-3 rounded-md text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300"
              : "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        {/* Generate Email Button */}
        {hasDraft ? (
          <CompletedAction
            title="Email Draft Created"
            description="View draft below in Email Drafts section"
            onRegenerate={handleGenerateEmail}
            isRegenerating={isGeneratingEmail}
          />
        ) : (
          <ActionButton
            onClick={handleGenerateEmail}
            isLoading={isGeneratingEmail}
            disabled={isGeneratingEmail}
            colorScheme="green"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
            title="Generate Follow-up Email"
            description={customerType === "deal" ? "Create sales follow-up with next steps" : "Create customer recap email"}
          />
        )}

        {/* Generate Notes Button */}
        {hasNotes ? (
          <CompletedAction
            title="Meeting Notes Generated"
            description="View notes below in Meeting Notes section"
            onRegenerate={handleGenerateNotes}
            isRegenerating={isGeneratingNotes}
          />
        ) : (
          <ActionButton
            onClick={handleGenerateNotes}
            isLoading={isGeneratingNotes}
            disabled={isGeneratingNotes}
            colorScheme="blue"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            }
            title="Generate Meeting Notes"
            description="Summarize extracts and add to notes"
          />
        )}

        {/* HubSpot Notes Button */}
        {features.hubspot && (
          <ActionButton
            onClick={handleWriteHubSpotNotes}
            isLoading={isWritingHubSpot}
            disabled={isWritingHubSpot || !canWriteToHubSpot}
            colorScheme="orange"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            title="Write Notes to HubSpot"
            description={canWriteToHubSpot ? "Generate CRM notes and sync to HubSpot" : "Link a HubSpot company or deal first"}
          />
        )}
      </div>
    </div>
  );
}

// Reusable action button component
interface ActionButtonProps {
  onClick: () => void;
  isLoading: boolean;
  disabled: boolean;
  colorScheme: "green" | "blue" | "orange" | "purple";
  icon: React.ReactNode;
  title: string;
  description: string;
  showChevron?: boolean;
  chevronRotated?: boolean;
}

function ActionButton({
  onClick,
  isLoading,
  disabled,
  colorScheme,
  icon,
  title,
  description,
  showChevron,
  chevronRotated,
}: ActionButtonProps) {
  const colorClasses = {
    green: {
      bg: "bg-green-50 dark:bg-green-900/20",
      border: "border-green-200 dark:border-green-800",
      hover: "hover:bg-green-100 dark:hover:bg-green-900/30",
      text: "text-green-900 dark:text-green-200",
      subtext: "text-green-600 dark:text-green-400",
      icon: "text-green-600 dark:text-green-400",
    },
    blue: {
      bg: "bg-blue-50 dark:bg-blue-900/20",
      border: "border-blue-200 dark:border-blue-800",
      hover: "hover:bg-blue-100 dark:hover:bg-blue-900/30",
      text: "text-blue-900 dark:text-blue-200",
      subtext: "text-blue-600 dark:text-blue-400",
      icon: "text-blue-600 dark:text-blue-400",
    },
    orange: {
      bg: "bg-orange-50 dark:bg-orange-900/20",
      border: "border-orange-200 dark:border-orange-800",
      hover: "hover:bg-orange-100 dark:hover:bg-orange-900/30",
      text: "text-orange-900 dark:text-orange-200",
      subtext: "text-orange-600 dark:text-orange-400",
      icon: "text-orange-600 dark:text-orange-400",
    },
    purple: {
      bg: "bg-purple-50 dark:bg-purple-900/20",
      border: "border-purple-200 dark:border-purple-800",
      hover: "hover:bg-purple-100 dark:hover:bg-purple-900/30",
      text: "text-purple-900 dark:text-purple-200",
      subtext: "text-purple-600 dark:text-purple-400",
      icon: "text-purple-600 dark:text-purple-400",
    },
  };

  const colors = colorClasses[colorScheme];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-between px-4 py-3 ${colors.bg} border ${colors.border} rounded-lg ${colors.hover} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
    >
      <div className="flex items-center gap-3">
        <span className={colors.icon}>{icon}</span>
        <div className="text-left">
          <p className={`text-sm font-medium ${colors.text}`}>{title}</p>
          <p className={`text-xs ${colors.subtext}`}>{description}</p>
        </div>
      </div>
      {isLoading ? (
        <svg className={`animate-spin h-5 w-5 ${colors.icon}`} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : showChevron !== false ? (
        <svg
          className={`w-5 h-5 ${colors.icon} transition-transform ${chevronRotated ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      ) : null}
    </button>
  );
}

// Completed action component showing done state with regenerate option
interface CompletedActionProps {
  title: string;
  description: string;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

function CompletedAction({
  title,
  description,
  onRegenerate,
  isRegenerating,
}: CompletedActionProps) {
  return (
    <div className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="flex items-center gap-3">
        <span className="text-green-600 dark:text-green-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <div className="text-left">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
      <button
        onClick={onRegenerate}
        disabled={isRegenerating}
        className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
      >
        {isRegenerating ? "Regenerating..." : "Regenerate"}
      </button>
    </div>
  );
}
