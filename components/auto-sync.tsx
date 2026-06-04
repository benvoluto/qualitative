"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, Warning, X } from "@phosphor-icons/react";

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const LOCAL_STORAGE_KEY = "lastMeetingSync";

type SyncStatus = "idle" | "syncing" | "complete" | "error";

interface SyncResult {
  totalSynced: number;
  message: string;
  google: { synced: number } | null;
  hubspot: { synced: number } | null;
  zoom: { synced: number } | null;
  teams: { synced: number } | null;
}

interface AutoSyncProps {
  /** Whether any integration is connected */
  hasIntegrations: boolean;
}

/**
 * Component that automatically syncs meetings on mount and periodically.
 * Uses localStorage to track last sync time and prevent redundant syncs.
 */
export function AutoSync({ hasIntegrations }: AutoSyncProps) {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const router = useRouter();
  const syncInProgressRef = useRef(false);

  const triggerSync = useCallback(async (force: boolean = false) => {
    // Prevent concurrent syncs
    if (syncInProgressRef.current) {
      return;
    }

    // Check if sync is needed
    const lastSyncStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;
    const now = Date.now();

    if (!force && lastSync && (now - lastSync) < SYNC_INTERVAL_MS) {
      return;
    }

    syncInProgressRef.current = true;
    setStatus("syncing");

    try {
      const response = await fetch("/api/meetings/sync-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 14 }),
      });

      if (!response.ok) {
        throw new Error("Sync failed");
      }

      const result: SyncResult = await response.json();
      localStorage.setItem(LOCAL_STORAGE_KEY, now.toString());
      setLastResult(result);
      setStatus("complete");

      // Show notification if new meetings were synced
      if (result.totalSynced > 0) {
        setShowNotification(true);
        router.refresh();
      }

      // Hide notification after 5 seconds
      setTimeout(() => {
        setShowNotification(false);
        setStatus("idle");
      }, 5000);
    } catch (error) {
      console.error("Auto-sync error:", error);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 5000);
    } finally {
      syncInProgressRef.current = false;
    }
  }, [router]);

  // Sync on mount
  useEffect(() => {
    if (hasIntegrations) {
      // Small delay to let the page render first
      const timeout = setTimeout(() => triggerSync(), 1000);
      return () => clearTimeout(timeout);
    }
  }, [hasIntegrations, triggerSync]);

  // Set up periodic sync
  useEffect(() => {
    if (!hasIntegrations) return;

    const interval = setInterval(() => {
      triggerSync();
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [hasIntegrations, triggerSync]);

  // Don't render anything if no integrations
  if (!hasIntegrations) {
    return null;
  }

  return (
    <>
      {/* Syncing indicator - subtle top bar */}
      {status === "syncing" && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <div className="h-1 bg-blue-600 animate-pulse" />
        </div>
      )}

      {/* Success notification */}
      {showNotification && lastResult && lastResult.totalSynced > 0 && (
        <div className="fixed bottom-4 right-4 z-50 transition-all duration-300">
          <div className="bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <Check size={20} weight="bold" />
            <span>{lastResult.message}</span>
            <button
              onClick={() => setShowNotification(false)}
              className="ml-2 text-white/80 hover:text-white"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </div>
      )}

      {/* Error notification */}
      {status === "error" && (
        <div className="fixed bottom-4 right-4 z-50 transition-all duration-300">
          <div className="bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <Warning size={20} />
            <span>Failed to sync meetings</span>
          </div>
        </div>
      )}
    </>
  );
}
