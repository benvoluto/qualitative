"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/app/components/toast";
import { features } from "@/lib/features";

type SyncSource = "google" | "hubspot" | "zoom" | "teams";

interface PotentialMeeting {
  externalId: string;
  name: string;
  date: string | null;
  source: SyncSource;
  hasTimeConflict: boolean;
  hasTranscript?: boolean;
  isInternal?: boolean;
  alreadySynced?: boolean;
  hostEmail?: string | null;
  conflictingMeeting?: {
    id: string;
    name: string;
    date: string;
    source: string;
    customerId?: string | null;
    hostEmail?: string | null;
  };
}

interface UnmatchedMeeting {
  id: string;
  name: string;
  date: string | null;
  domains: string[];
}

export function SyncButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSource, setLoadingSource] = useState<SyncSource | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingMeetings, setPendingMeetings] = useState<PotentialMeeting[]>([]);
  const [selectedMeetings, setSelectedMeetings] = useState<Set<string>>(new Set());
  const [currentSource, setCurrentSource] = useState<SyncSource | null>(null);
  const [zoomConnected, setZoomConnected] = useState<boolean | null>(null);
  const [syncDays, setSyncDays] = useState<number>(14);
  const [unmatchedMeetings, setUnmatchedMeetings] = useState<UnmatchedMeeting[]>([]);
  const [showUnmatchedModal, setShowUnmatchedModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch Zoom connection status and user preferences. The status endpoint
  // actively probes Zoom, so this also catches the case where the refresh token
  // expired between page loads.
  const fetchUserData = useCallback(async () => {
    try {
      const [zoomResponse, prefsResponse] = await Promise.all([
        fetch("/api/user/zoom-status"),
        fetch("/api/user/preferences"),
      ]);

      if (zoomResponse.ok) {
        const data = await zoomResponse.json();
        setZoomConnected(data.connected);
      } else {
        setZoomConnected(false);
      }

      if (prefsResponse.ok) {
        const data = await prefsResponse.json();
        setSyncDays(data.syncDays ?? 14);
      }
    } catch {
      // Silently fail - use defaults
      setZoomConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Re-check Zoom connection whenever the dropdown opens, so a connection that
  // expired between page loads doesn't show as enabled.
  useEffect(() => {
    if (isMenuOpen) {
      fetchUserData();
    }
  }, [isMenuOpen, fetchUserData]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSyncCheck(source: SyncSource) {
    setIsLoading(true);
    setLoadingSource(source);
    setMessage(null);
    setIsMenuOpen(false);

    // Use user's sync days preference
    const days = syncDays;

    try {
      // First, check for potential meetings and conflicts
      const checkResponse = await fetch("/api/meetings/sync/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, days }),
      });

      const checkData = await checkResponse.json();

      if (!checkResponse.ok) {
        // Zoom check returns needsAuth: true when the connection has expired.
        if (source === "zoom" && (checkData.needsAuth || checkData.requiresReauth)) {
          setZoomConnected(false);
        }
        setMessage({ type: "error", text: checkData.error || `Failed to check ${source} meetings` });
        setIsLoading(false);
        setLoadingSource(null);
        return;
      }

      // If no meetings at all (not even already-synced), show message and return
      if (checkData.meetings.length === 0) {
        setMessage({ type: "success", text: "No meetings found" });
        setIsLoading(false);
        setLoadingSource(null);
        return;
      }

      // Always show the confirmation modal
      setPendingMeetings(checkData.meetings);
      // Pre-select non-internal, non-conflict, non-already-synced meetings by default
      const preSelected = new Set<string>(
        checkData.meetings
          .filter((m: PotentialMeeting) => !m.hasTimeConflict && !m.isInternal && !m.alreadySynced)
          .map((m: PotentialMeeting) => m.externalId)
      );
      setSelectedMeetings(preSelected);
      setCurrentSource(source);
      setShowConfirmModal(true);
      setIsLoading(false);
      setLoadingSource(null);
    } catch {
      setMessage({ type: "error", text: `Failed to sync from ${source}` });
      setIsLoading(false);
      setLoadingSource(null);
    }
  }

  async function performSync(source: SyncSource, skipExternalIds: string[], meetingCount: number) {
    setIsLoading(true);
    setLoadingSource(source);

    // Show initial syncing message
    setMessage({ type: "success", text: `Syncing ${meetingCount} ${source === "google" ? "Google Meet" : source === "zoom" ? "Zoom" : source === "teams" ? "Teams" : "HubSpot"} meeting${meetingCount !== 1 ? "s" : ""}...` });

    // Use user's sync days preference
    const days = syncDays;

    try {
      const endpoints: Record<SyncSource, string> = {
        google: "/api/meetings/sync",
        hubspot: "/api/meetings/sync-hubspot",
        zoom: "/api/meetings/sync-zoom",
        teams: "/api/meetings/sync-teams",
      };
      const endpoint = endpoints[source];

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, skipExternalIds }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: data.message });

        // Check for unmatched meetings
        if (data.unmatchedMeetings && data.unmatchedMeetings.length > 0) {
          setUnmatchedMeetings(data.unmatchedMeetings);
          setShowUnmatchedModal(true);
        }
      } else {
        // Server signaled the Zoom connection is no longer valid — auto-disconnect
        // in local state so the button is correctly greyed out until reconnect.
        if (source === "zoom" && data.requiresReauth) {
          setZoomConnected(false);
        }
        setMessage({
          type: "error",
          text: data.error || `Failed to sync from ${source}`,
        });
      }
    } catch {
      setMessage({ type: "error", text: `Failed to sync from ${source}` });
    } finally {
      // Reset loading state
      setIsLoading(false);
      setLoadingSource(null);

      // Refresh the page data
      router.refresh();
    }
  }

  function handleConfirmSync() {
    if (!currentSource) return;

    // Build skip list from unselected AND already-synced meetings
    const skipExternalIds = pendingMeetings
      .filter((m) => !selectedMeetings.has(m.externalId) || m.alreadySynced)
      .map((m) => m.externalId);

    const meetingCount = pendingMeetings.filter(
      (m) => selectedMeetings.has(m.externalId) && !m.alreadySynced
    ).length;
    const source = currentSource;

    // Close modal immediately
    setShowConfirmModal(false);
    setPendingMeetings([]);
    setSelectedMeetings(new Set());
    setCurrentSource(null);

    // Start sync in background (don't await)
    performSync(source, skipExternalIds, meetingCount);
  }

  function toggleMeetingSelection(externalId: string) {
    const newSelected = new Set(selectedMeetings);
    if (newSelected.has(externalId)) {
      newSelected.delete(externalId);
    } else {
      newSelected.add(externalId);
    }
    setSelectedMeetings(newSelected);
  }

  function selectAllMeetings() {
    setSelectedMeetings(
      new Set(pendingMeetings.filter((m) => !m.alreadySynced).map((m) => m.externalId))
    );
  }

  function deselectAllMeetings() {
    setSelectedMeetings(new Set());
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "No date";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <>
      {/* Toast notification */}
      {message && (
        <Toast
          message={message.text}
          type={message.type}
          onClose={() => setMessage(null)}
        />
      )}

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
              Syncing {
                loadingSource === "google" ? "Google" :
                loadingSource === "hubspot" ? "HubSpot" :
                loadingSource === "zoom" ? "Zoom" :
                loadingSource === "teams" ? "Teams" : ""
              }...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Sync Meetings
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-10">
            <div className="py-1">
              <button
                onClick={() => handleSyncCheck("google")}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google Meet
                <span className="ml-auto text-xs text-gray-400">Last {syncDays} days</span>
              </button>
              {features.hubspot && (
                <button
                  onClick={() => handleSyncCheck("hubspot")}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#FF7A59">
                    <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984v-.066A2.198 2.198 0 0017.233.836h-.066a2.198 2.198 0 00-2.198 2.198v.066c0 .865.503 1.612 1.232 1.968v2.862a5.76 5.76 0 00-2.615 1.09l-6.7-5.209A2.633 2.633 0 007.232 1.5a2.625 2.625 0 10-.756 5.128l.07-.002 6.396 4.972a5.715 5.715 0 00-.183 1.427c0 .54.076 1.062.216 1.558l-2.39 1.201a2.274 2.274 0 00-1.27-.39 2.286 2.286 0 100 4.573 2.286 2.286 0 002.143-3.088l2.242-1.127a5.75 5.75 0 109.504-7.413v-.001a5.722 5.722 0 00-3.04-1.408zm-.964 9.263a3.468 3.468 0 110-6.936 3.468 3.468 0 010 6.936z" />
                  </svg>
                  HubSpot
                  <span className="ml-auto text-xs text-gray-400">Last {syncDays} days</span>
                </button>
              )}
              {(features.zoom || features.teams) && (
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
              )}
              {features.zoom && (
              <button
                onClick={() => zoomConnected && handleSyncCheck("zoom")}
                disabled={!zoomConnected}
                className={`flex items-center gap-3 w-full px-4 py-2 text-sm ${
                  zoomConnected
                    ? "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    : "text-gray-400 dark:text-gray-500 cursor-not-allowed"
                }`}
                title={!zoomConnected ? "Connect Zoom in Settings first" : undefined}
              >
                <svg className={`w-5 h-5 ${!zoomConnected ? "opacity-50" : ""}`} viewBox="0 0 24 24" fill="#2D8CFF">
                  <path d="M4.585 12.813c0-1.467.012-2.934-.006-4.4-.01-.794.333-1.363 1.01-1.756 2.048-1.19 4.085-2.398 6.128-3.596.648-.38 1.296-.38 1.944 0 2.048 1.201 4.092 2.41 6.139 3.607.657.384 1.006.944 1.003 1.722-.012 2.945-.012 5.89 0 8.835.003.793-.345 1.356-1.01 1.747-2.048 1.206-4.094 2.414-6.145 3.615-.64.374-1.278.374-1.918 0-2.059-1.206-4.116-2.415-6.175-3.621-.647-.38-.982-.944-.976-1.719.021-1.478.006-2.956.006-4.434zm7.418 1.53v3.244c0 .45.227.632.629.398 1.31-.764 2.618-1.532 3.923-2.304.229-.136.346-.298.344-.568-.006-1.544-.004-3.089-.002-4.633 0-.414-.205-.601-.59-.384-1.33.752-2.657 1.508-3.982 2.268-.22.13-.326.29-.323.543.007 1.145.001 2.29.001 3.436z" />
                </svg>
                <span className="flex-1 text-left">
                  Zoom
                  {!zoomConnected && (
                    <span className="block text-xs text-gray-400 dark:text-gray-500">
                      Connect in Settings
                    </span>
                  )}
                </span>
                <span className="text-xs text-gray-400">
                  {zoomConnected ? `Last ${syncDays} days` : ""}
                </span>
              </button>
              )}
              {features.teams && (
              <button
                onClick={() => handleSyncCheck("teams")}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#6264A7">
                  <path d="M20.625 10.5h-6.75c-.621 0-1.125.504-1.125 1.125v6.75c0 .621.504 1.125 1.125 1.125h6.75c.621 0 1.125-.504 1.125-1.125v-6.75c0-.621-.504-1.125-1.125-1.125zM17.25 8.25c1.243 0 2.25-1.007 2.25-2.25S18.493 3.75 17.25 3.75 15 4.757 15 6s1.007 2.25 2.25 2.25zM12 9c1.657 0 3-1.343 3-3S13.657 3 12 3 9 4.343 9 6s1.343 3 3 3zm-1.5 1.5H3.375c-.621 0-1.125.504-1.125 1.125V18c0 1.657 1.343 3 3 3h6c.31 0 .609-.047.896-.131A2.981 2.981 0 0111.25 18.75v-7.125c0-.621-.504-1.125-1.125-1.125h-.625z" />
                </svg>
                Microsoft Teams
                <span className="ml-auto text-xs text-gray-400">Last {syncDays} days</span>
              </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Conflict Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Review Meetings to Sync
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Review the meetings below. Internal meetings (all participants from your organization) and possible duplicates require manual selection.
            </p>

            {/* Select All / Deselect All */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={selectAllMeetings}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={deselectAllMeetings}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                Deselect All
              </button>
              <span className="ml-auto text-sm text-gray-500">
                {pendingMeetings.filter((m) => selectedMeetings.has(m.externalId) && !m.alreadySynced).length} of {pendingMeetings.filter((m) => !m.alreadySynced).length} new selected
              </span>
            </div>

            {/* Meeting List */}
            <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
              {pendingMeetings.map((meeting) => (
                <div
                  key={meeting.externalId}
                  className={`p-3 ${meeting.alreadySynced ? "bg-gray-50 dark:bg-gray-800/50" : meeting.hasTimeConflict ? "bg-yellow-50 dark:bg-yellow-900/20" : meeting.isInternal ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                >
                  <label className={`flex items-start gap-3 ${meeting.alreadySynced ? "cursor-default opacity-60" : "cursor-pointer"}`}>
                    <input
                      type="checkbox"
                      checked={selectedMeetings.has(meeting.externalId)}
                      onChange={() => !meeting.alreadySynced && toggleMeetingSelection(meeting.externalId)}
                      disabled={meeting.alreadySynced}
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {meeting.name}
                        </span>
                        {meeting.alreadySynced && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                            Already Synced
                          </span>
                        )}
                        {meeting.isInternal && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                            Internal Meeting
                          </span>
                        )}
                        {meeting.hasTimeConflict && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300">
                            Possible Duplicate
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(meeting.date)}
                      </div>
                      {meeting.hasTimeConflict && meeting.conflictingMeeting && (
                        <div className="mt-1 text-xs text-yellow-700 dark:text-yellow-400">
                          Similar to existing: &ldquo;{meeting.conflictingMeeting.name}&rdquo; ({formatDate(meeting.conflictingMeeting.date)})
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingMeetings([]);
                  setSelectedMeetings(new Set());
                  setCurrentSource(null);
                }}
                disabled={isLoading}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSync}
                disabled={isLoading || pendingMeetings.filter((m) => selectedMeetings.has(m.externalId) && !m.alreadySynced).length === 0}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "Syncing..." : `Sync ${pendingMeetings.filter((m) => selectedMeetings.has(m.externalId) && !m.alreadySynced).length} Meeting${pendingMeetings.filter((m) => selectedMeetings.has(m.externalId) && !m.alreadySynced).length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unmatched Meetings Modal */}
      {showUnmatchedModal && unmatchedMeetings.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {unmatchedMeetings.length} Meeting{unmatchedMeetings.length !== 1 ? "s" : ""} Without Organization Match
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  These meetings have participant email domains that don&apos;t match any organization in the system.
                  You can assign an organization from the meeting page or add a new one.
                </p>
              </div>
            </div>

            {/* Unmatched Meeting List */}
            <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
              {unmatchedMeetings.map((meeting) => (
                <div key={meeting.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {meeting.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(meeting.date)}
                      </div>
                      {meeting.domains.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {meeting.domains.map((domain) => (
                            <span
                              key={domain}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            >
                              {domain}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        router.push(`/meetings/${meeting.id}`);
                        setShowUnmatchedModal(false);
                        setUnmatchedMeetings([]);
                      }}
                      className="flex-shrink-0 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      View Meeting →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => router.push("/companies")}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                + Add New Organization
              </button>
              <button
                onClick={() => {
                  setShowUnmatchedModal(false);
                  setUnmatchedMeetings([]);
                }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
