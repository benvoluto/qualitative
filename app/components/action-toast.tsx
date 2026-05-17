"use client";

import { useState } from "react";

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
        <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
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
