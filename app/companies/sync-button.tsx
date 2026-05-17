"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncCustomersButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  async function handleSync() {
    setIsLoading(true);
    setMessage(null);

    try {
      // Sync both customers and deals in parallel
      const [customersResponse, dealsResponse] = await Promise.all([
        fetch("/api/customers/sync-hubspot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days: 180 }),
        }),
        fetch("/api/deals/sync-hubspot", {
          method: "POST",
        }),
      ]);

      const customersData = await customersResponse.json();
      const dealsData = await dealsResponse.json();

      if (customersResponse.ok && dealsResponse.ok) {
        const customersSynced = (customersData.created || 0) + (customersData.updated || 0);
        const dealsSynced = (dealsData.created || 0) + (dealsData.updated || 0);
        setMessage({
          type: "success",
          text: `Synced ${customersSynced} customers and ${dealsSynced} deals`,
        });
        router.refresh();
      } else {
        const errors: string[] = [];
        if (!customersResponse.ok) errors.push(customersData.error || "customers sync failed");
        if (!dealsResponse.ok) errors.push(dealsData.error || "deals sync failed");
        setMessage({ type: "error", text: errors.join(", ") });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to sync from HubSpot" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message && (
        <span
          className={`text-sm ${
            message.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {message.text}
        </span>
      )}
      <button
        onClick={handleSync}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
            Syncing...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984v-.066A2.198 2.198 0 0017.233.836h-.066a2.198 2.198 0 00-2.198 2.198v.066c0 .865.503 1.612 1.232 1.968v2.862a5.76 5.76 0 00-2.615 1.09l-6.7-5.209A2.633 2.633 0 007.232 1.5a2.625 2.625 0 10-.756 5.128l.07-.002 6.396 4.972a5.715 5.715 0 00-.183 1.427c0 .54.076 1.062.216 1.558l-2.39 1.201a2.274 2.274 0 00-1.27-.39 2.286 2.286 0 100 4.573 2.286 2.286 0 002.143-3.088l2.242-1.127a5.75 5.75 0 109.504-7.413v-.001a5.722 5.722 0 00-3.04-1.408zm-.964 9.263a3.468 3.468 0 110-6.936 3.468 3.468 0 010 6.936z" />
            </svg>
            Sync from HubSpot
          </>
        )}
      </button>
    </div>
  );
}
