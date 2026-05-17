"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/app/components/toast";

type ToastState = {
  message: string;
  type: "success" | "error" | "info";
} | null;

interface CompanySyncCheckProps {
  hasHubSpot: boolean;
}

/**
 * Checks if local company data is stale vs HubSpot on mount.
 * Runs sync silently in background and shows a toast on completion or error.
 */
export function CompanySyncCheck({ hasHubSpot }: CompanySyncCheckProps) {
  const [toast, setToast] = useState<ToastState>(null);
  const router = useRouter();
  const hasRunRef = useRef(false);

  const handleToastClose = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (!hasHubSpot || hasRunRef.current) return;
    hasRunRef.current = true;
    runSyncCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHubSpot]);

  async function runSyncCheck(): Promise<void> {
    try {
      const response = await fetch("/api/companies/sync-check");
      if (!response.ok) return;
      const data = await response.json();
      if (!data.needsSync) return;
      await performSync();
    } catch (err) {
      console.error("Company sync check failed:", err);
    }
  }

  async function performSync(): Promise<void> {
    try {
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
      if (!customersResponse.ok || !dealsResponse.ok) {
        const errors: string[] = [];
        if (!customersResponse.ok) {
          const data = await customersResponse.json().catch(() => ({}));
          errors.push(data.error || "Companies sync failed");
        }
        if (!dealsResponse.ok) {
          const data = await dealsResponse.json().catch(() => ({}));
          errors.push(data.error || "Deals sync failed");
        }
        setToast({ message: errors.join(". "), type: "error" });
        return;
      }
      setToast({ message: "Companies synced from HubSpot", type: "info" });
      router.refresh();
    } catch {
      setToast({ message: "Failed to sync from HubSpot", type: "error" });
    }
  }

  if (!toast) return null;

  return (
    <Toast
      message={toast.message}
      type={toast.type}
      onClose={handleToastClose}
    />
  );
}
