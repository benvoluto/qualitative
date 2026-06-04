"use client";

import { useState } from "react";
import { CircleNotch, Question } from "@phosphor-icons/react";

interface ActionToastProps {
  message: string;
  onYes: () => void;
  onNo: () => void;
  yesLabel?: string;
  noLabel?: string;
  isLoading?: boolean;
}

/**
 * A toast notification with Yes/No action buttons.
 * Used to prompt the user for a decision.
 */
export function ActionToast({
  message,
  onYes,
  onNo,
  yesLabel = "Yes",
  noLabel = "No",
  isLoading = false,
}: ActionToastProps) {
  const [isLeaving, setIsLeaving] = useState(false);

  function handleNo() {
    setIsLeaving(true);
    setTimeout(onNo, 300);
  }

  function handleYes() {
    if (!isLoading) {
      onYes();
    }
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg transition-all duration-300 max-w-md ${
        isLeaving ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
      }`}
    >
      <div className="flex items-start gap-3">
        <Question size={20} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleYes}
              disabled={isLoading}
              className="px-3 py-1.5 text-sm font-medium bg-white text-blue-600 rounded hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <CircleNotch size={16} className="animate-spin" />
                  Processing...
                </span>
              ) : (
                yesLabel
              )}
            </button>
            <button
              onClick={handleNo}
              disabled={isLoading}
              className="px-3 py-1.5 text-sm font-medium text-white/90 hover:text-white border border-white/30 rounded hover:bg-white/10 disabled:opacity-50 transition-colors"
            >
              {noLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
