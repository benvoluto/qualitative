"use client";

import { useState, useEffect, useCallback } from "react";
import { features } from "@/lib/features";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: "integrations" | "prompts" | "notifications";
}

interface ZoomStatus {
  connected: boolean;
  zoomUserId: string | null;
}

interface IntegrationStatus {
  googleMeet: boolean;
  teams: boolean;
  hubspot: boolean;
}

interface UserPreferences {
  syncDays: number;
  meetingAutosyncEnabled: boolean;
}

interface PromptTemplate {
  custom: string | null;
  default: string;
  isCustomized: boolean;
}

interface PromptTemplates {
  deal_email: PromptTemplate;
  customer_email: PromptTemplate;
  notes: PromptTemplate;
}

interface NotificationPrefs {
  notificationEmail: string | null;
  notifyOnDraftCreated: boolean;
  notifyOnNotesCreated: boolean;
}

type TestResult = "idle" | "testing" | "success" | "error";
type TemplateType = "deal_email" | "customer_email" | "notes";

export function SettingsModal({ isOpen, onClose, initialSection }: SettingsModalProps) {
  const [zoomStatus, setZoomStatus] = useState<ZoomStatus | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>({
    googleMeet: false,
    teams: false,
    hubspot: false,
  });
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [syncDaysInput, setSyncDaysInput] = useState<string>("14");
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({
    googleMeet: "idle",
    teams: "idle",
    hubspot: "idle",
  });

  // Prompt templates state
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplates | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<TemplateType | null>(
    initialSection === "prompts" ? "deal_email" : null
  );
  const [editingTemplate, setEditingTemplate] = useState<TemplateType | null>(null);
  const [templateInput, setTemplateInput] = useState<string>("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState<TemplateType | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Notification preferences state
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs | null>(null);
  const [notificationEmailInput, setNotificationEmailInput] = useState<string>("");
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [notificationsSaved, setNotificationsSaved] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  // Active section for navigation
  const [activeSection, setActiveSection] = useState<"integrations" | "prompts" | "notifications">(
    initialSection || "integrations"
  );

  // Deduplication state
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [deduplicationResult, setDeduplicationResult] = useState<{
    duplicatesFound: number;
    hubspotMeetingsDeleted: number;
  } | null>(null);
  const [deduplicationError, setDeduplicationError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setPreferencesError(null);
      setTemplateError(null);
      setNotificationsError(null);

      // Fetch all data in parallel
      const [zoomResponse, prefsResponse, integrationsResponse, templatesResponse] = await Promise.all([
        fetch("/api/user/zoom-status"),
        fetch("/api/user/preferences"),
        fetch("/api/user/integrations-status"),
        fetch("/api/user/prompt-templates"),
      ]);

      if (zoomResponse.ok) {
        const data = await zoomResponse.json();
        setZoomStatus(data);
      } else {
        setError("Failed to load Zoom status");
      }

      if (prefsResponse.ok) {
        const data = await prefsResponse.json();
        setPreferences({
          syncDays: data.syncDays,
          meetingAutosyncEnabled: data.meetingAutosyncEnabled ?? true,
        });
        setSyncDaysInput(String(data.syncDays));
        // Also set notification prefs from same endpoint
        setNotificationPrefs({
          notificationEmail: data.notificationEmail || null,
          notifyOnDraftCreated: data.notifyOnDraftCreated || false,
          notifyOnNotesCreated: data.notifyOnNotesCreated || false,
        });
        setNotificationEmailInput(data.notificationEmail || "");
      } else {
        setPreferencesError("Failed to load preferences");
      }

      if (integrationsResponse.ok) {
        const data = await integrationsResponse.json();
        setIntegrationStatus(data);
      }

      if (templatesResponse.ok) {
        const data = await templatesResponse.json();
        setPromptTemplates(data.templates);
      } else {
        setTemplateError("Failed to load prompt templates");
      }
    } catch {
      setError("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setPreferencesSaved(false);
    }
  }, [isOpen, fetchData]);

  const handleSaveSyncDays = async () => {
    const days = parseInt(syncDaysInput, 10);
    if (isNaN(days) || days < 1 || days > 90) {
      setPreferencesError("Please enter a number between 1 and 90");
      return;
    }

    setIsSavingPreferences(true);
    setPreferencesError(null);
    setPreferencesSaved(false);

    try {
      const response = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncDays: days }),
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences({
          syncDays: data.syncDays,
          meetingAutosyncEnabled: data.meetingAutosyncEnabled ?? true,
        });
        setSyncDaysInput(String(data.syncDays));
        setPreferencesSaved(true);
        setTimeout(() => setPreferencesSaved(false), 2000);
      } else {
        const data = await response.json();
        setPreferencesError(data.error || "Failed to save preferences");
      }
    } catch {
      setPreferencesError("Failed to save preferences");
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleToggleAutosync = async (enabled: boolean) => {
    setIsSavingPreferences(true);
    setPreferencesError(null);

    try {
      const response = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingAutosyncEnabled: enabled }),
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences({
          syncDays: data.syncDays,
          meetingAutosyncEnabled: data.meetingAutosyncEnabled ?? true,
        });
      } else {
        const data = await response.json();
        setPreferencesError(data.error || "Failed to save auto-sync setting");
      }
    } catch {
      setPreferencesError("Failed to save auto-sync setting");
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleRunDeduplication = async () => {
    setIsDeduplicating(true);
    setDeduplicationError(null);
    setDeduplicationResult(null);

    try {
      const response = await fetch("/api/meetings/deduplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 90 }),
      });

      if (response.ok) {
        const data = await response.json();
        setDeduplicationResult({
          duplicatesFound: data.duplicatesFound,
          hubspotMeetingsDeleted: data.hubspotMeetingsDeleted,
        });
      } else {
        const data = await response.json();
        setDeduplicationError(data.error || "Failed to run deduplication");
      }
    } catch {
      setDeduplicationError("Failed to run deduplication");
    } finally {
      setIsDeduplicating(false);
    }
  };

  const handleConnectZoom = () => {
    // Redirect to Zoom OAuth flow
    window.location.href = "/api/auth/zoom";
  };

  const handleDisconnectZoom = async () => {
    if (!confirm("Are you sure you want to disconnect Zoom? You will need to reconnect to sync Zoom meetings.")) {
      return;
    }

    setIsDisconnecting(true);
    setError(null);

    try {
      const response = await fetch("/api/user/zoom-status", {
        method: "DELETE",
      });

      if (response.ok) {
        setZoomStatus({ connected: false, zoomUserId: null });
      } else {
        const data = await response.json();
        setError(data.error || "Failed to disconnect Zoom");
      }
    } catch {
      setError("Failed to disconnect Zoom");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleTestIntegration = async (integration: "googleMeet" | "teams" | "hubspot") => {
    setTestResults((prev) => ({ ...prev, [integration]: "testing" }));

    try {
      const response = await fetch(`/api/user/test-integration?type=${integration}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setTestResults((prev) => ({ ...prev, [integration]: "success" }));
      } else {
        setTestResults((prev) => ({ ...prev, [integration]: "error" }));
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [integration]: "error" }));
    }

    // Reset after 3 seconds
    setTimeout(() => {
      setTestResults((prev) => ({ ...prev, [integration]: "idle" }));
    }, 3000);
  };

  // Template handlers
  const handleEditTemplate = (type: TemplateType) => {
    if (!promptTemplates) return;
    const template = promptTemplates[type];
    setTemplateInput(template.custom || template.default);
    setEditingTemplate(type);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    setIsSavingTemplate(true);
    setTemplateError(null);

    try {
      const response = await fetch("/api/user/prompt-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateType: editingTemplate,
          template: templateInput,
        }),
      });

      if (response.ok) {
        // Update local state
        setPromptTemplates((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            [editingTemplate]: {
              ...prev[editingTemplate],
              custom: templateInput,
              isCustomized: true,
            },
          };
        });
        setTemplateSaved(editingTemplate);
        setEditingTemplate(null);
        setTimeout(() => setTemplateSaved(null), 2000);
      } else {
        const data = await response.json();
        setTemplateError(data.error || "Failed to save template");
      }
    } catch {
      setTemplateError("Failed to save template");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleResetTemplate = async (type: TemplateType) => {
    if (!confirm("Are you sure you want to reset this template to the default?")) {
      return;
    }

    setIsSavingTemplate(true);
    setTemplateError(null);

    try {
      const response = await fetch("/api/user/prompt-templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateType: type }),
      });

      if (response.ok) {
        // Update local state
        setPromptTemplates((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            [type]: {
              ...prev[type],
              custom: null,
              isCustomized: false,
            },
          };
        });
        setTemplateSaved(type);
        setTimeout(() => setTemplateSaved(null), 2000);
      } else {
        const data = await response.json();
        setTemplateError(data.error || "Failed to reset template");
      }
    } catch {
      setTemplateError("Failed to reset template");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Notification handlers
  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true);
    setNotificationsError(null);
    setNotificationsSaved(false);

    try {
      const response = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationEmail: notificationEmailInput || null,
          notifyOnDraftCreated: notificationPrefs?.notifyOnDraftCreated || false,
          notifyOnNotesCreated: notificationPrefs?.notifyOnNotesCreated || false,
        }),
      });

      if (response.ok) {
        setNotificationsSaved(true);
        setTimeout(() => setNotificationsSaved(false), 2000);
      } else {
        const data = await response.json();
        setNotificationsError(data.error || "Failed to save notification settings");
      }
    } catch {
      setNotificationsError("Failed to save notification settings");
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const templateLabels: Record<TemplateType, string> = {
    deal_email: "Deal Email Template",
    customer_email: "Customer Email Template",
    notes: "Meeting Notes Template",
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <CloseIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-4 flex-shrink-0">
          <button
            onClick={() => setActiveSection("integrations")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeSection === "integrations"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Integrations
          </button>
          <button
            onClick={() => setActiveSection("prompts")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeSection === "prompts"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Prompt Templates
          </button>
          <button
            onClick={() => setActiveSection("notifications")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeSection === "notifications"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Notifications
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 overflow-y-auto flex-1">
          {/* Integrations Section */}
          {activeSection === "integrations" && (
            <>
          {/* Sync Preferences Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Sync Preferences
            </h3>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
              {/* Auto-sync toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Auto-sync meetings
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Automatically sync meetings from connected services in the background
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleAutosync(!preferences?.meetingAutosyncEnabled)}
                  disabled={isLoading || isSavingPreferences}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                    preferences?.meetingAutosyncEnabled ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-600"
                  }`}
                  role="switch"
                  aria-checked={preferences?.meetingAutosyncEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      preferences?.meetingAutosyncEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </label>

              {/* Sync days input */}
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Sync meetings from the last
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={syncDaysInput}
                    onChange={(e) => setSyncDaysInput(e.target.value)}
                    disabled={isLoading || isSavingPreferences}
                    className="w-20 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">days</span>
                  <button
                    onClick={handleSaveSyncDays}
                    disabled={isLoading || isSavingPreferences || syncDaysInput === String(preferences?.syncDays)}
                    className="ml-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingPreferences ? "Saving..." : "Save"}
                  </button>
                  {preferencesSaved && (
                    <span className="text-sm text-green-600 dark:text-green-400">Saved!</span>
                  )}
                </div>
                {preferencesError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {preferencesError}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  This setting applies to Google Meet sync.
                </p>
              </div>

              {/* Deduplication — only relevant when HubSpot meetings sync is on */}
              {features.hubspot && (
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Remove duplicate meetings
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Removes HubSpot duplicates when a matching Google/Zoom meeting exists
                    </p>
                  </div>
                  <button
                    onClick={handleRunDeduplication}
                    disabled={isDeduplicating}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeduplicating ? "Running..." : "Run Now"}
                  </button>
                </div>
                {deduplicationResult && (
                  <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                    {deduplicationResult.hubspotMeetingsDeleted > 0
                      ? `Removed ${deduplicationResult.hubspotMeetingsDeleted} duplicate meeting(s)`
                      : "No duplicate meetings found"}
                  </p>
                )}
                {deduplicationError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {deduplicationError}
                  </p>
                )}
              </div>
              )}
            </div>
          </div>

          {/* Integrations Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Integrations
            </h3>

            <div className="space-y-3">
              {/* Google Meet */}
              <IntegrationCard
                name="Google Meet"
                icon={<GoogleIcon className="w-6 h-6" />}
                connected={integrationStatus.googleMeet}
                description={integrationStatus.googleMeet
                  ? "Connected via Google sign-in"
                  : "Sign in with Google to enable"}
                isLoading={isLoading}
                testResult={testResults.googleMeet}
                onTest={() => handleTestIntegration("googleMeet")}
                showTestButton={integrationStatus.googleMeet}
              />

              {/* Zoom */}
              {features.zoom && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <ZoomIcon className="w-6 h-6" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        Zoom
                      </span>
                      {isLoading ? (
                        <span className="text-xs text-gray-500">Loading...</span>
                      ) : zoomStatus?.connected ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          Not connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {zoomStatus?.connected
                        ? "Sync Zoom meetings and recordings"
                        : "Connect to import Zoom meetings"}
                    </p>
                  </div>
                  <div>
                    {zoomStatus?.connected ? (
                      <button
                        onClick={handleDisconnectZoom}
                        disabled={isDisconnecting}
                        className="text-xs px-2 py-1 text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                      >
                        {isDisconnecting ? "..." : "Disconnect"}
                      </button>
                    ) : (
                      <button
                        onClick={handleConnectZoom}
                        disabled={isLoading}
                        className="text-xs px-2 py-1 text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
                {error && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                    {error}
                  </p>
                )}
              </div>
              )}

              {/* Microsoft Teams */}
              {features.teams && (
                <IntegrationCard
                  name="Microsoft Teams"
                  icon={<TeamsIcon className="w-6 h-6" />}
                  connected={integrationStatus.teams}
                  description={integrationStatus.teams
                    ? "Connected via Microsoft sign-in"
                    : "Sign in with Microsoft to enable"}
                  isLoading={isLoading}
                  testResult={testResults.teams}
                  onTest={() => handleTestIntegration("teams")}
                  showTestButton={integrationStatus.teams}
                />
              )}

              {/* HubSpot */}
              {features.hubspot && (
                <IntegrationCard
                  name="HubSpot"
                  icon={<HubSpotIcon className="w-6 h-6" />}
                  connected={integrationStatus.hubspot}
                  description={integrationStatus.hubspot
                    ? "Server configured"
                    : "Contact admin to configure"}
                  isLoading={isLoading}
                  testResult={testResults.hubspot}
                  onTest={() => handleTestIntegration("hubspot")}
                  showTestButton={integrationStatus.hubspot}
                />
              )}
            </div>
          </div>
            </>
          )}

          {/* Prompt Templates Section */}
          {activeSection === "prompts" && (
            <div className="space-y-4">
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Customize the prompts used to generate email drafts and meeting notes.
                  Your changes will be used for all future generations.
                </p>
              </div>

              {templateError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{templateError}</p>
                </div>
              )}

              {(["deal_email", "customer_email", "notes"] as TemplateType[]).map((type) => {
                const template = promptTemplates?.[type];
                const isExpanded = expandedTemplate === type;
                const isEditing = editingTemplate === type;
                const wasSaved = templateSaved === type;

                return (
                  <div
                    key={type}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    {/* Header */}
                    <button
                      onClick={() => setExpandedTemplate(isExpanded ? null : type)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {templateLabels[type]}
                        </span>
                        {template?.isCustomized && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                            Customized
                          </span>
                        )}
                        {wasSaved && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded">
                            Saved!
                          </span>
                        )}
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && template && (
                      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                        {isEditing ? (
                          <div className="space-y-3">
                            <textarea
                              value={templateInput}
                              onChange={(e) => setTemplateInput(e.target.value)}
                              className="w-full h-64 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono resize-none"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleSaveTemplate}
                                disabled={isSavingTemplate}
                                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
                              >
                                {isSavingTemplate ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTemplate(null);
                                  setTemplateInput("");
                                }}
                                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 max-h-48 overflow-y-auto">
                              <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                                {template.custom || template.default}
                              </pre>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditTemplate(type)}
                                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                              >
                                Edit Template
                              </button>
                              {template.isCustomized && (
                                <button
                                  onClick={() => handleResetTemplate(type)}
                                  disabled={isSavingTemplate}
                                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
                                >
                                  Reset to Default
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Notifications Section */}
          {activeSection === "notifications" && (
            <div className="space-y-4">
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure email notifications for when email drafts or meeting notes are generated.
                </p>
              </div>

              {notificationsError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{notificationsError}</p>
                </div>
              )}

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
                {/* Notification Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notification Email
                  </label>
                  <input
                    type="email"
                    value={notificationEmailInput}
                    onChange={(e) => setNotificationEmailInput(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Leave empty to use your account email
                  </p>
                </div>

                {/* Notification Toggles */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationPrefs?.notifyOnDraftCreated || false}
                      onChange={(e) => setNotificationPrefs((prev) => ({
                        ...prev!,
                        notifyOnDraftCreated: e.target.checked,
                      }))}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Notify when email drafts are created
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Send an email when new follow-up email drafts are generated
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationPrefs?.notifyOnNotesCreated || false}
                      onChange={(e) => setNotificationPrefs((prev) => ({
                        ...prev!,
                        notifyOnNotesCreated: e.target.checked,
                      }))}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Notify when meeting notes are created
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Send an email when meeting notes are generated
                      </p>
                    </div>
                  </label>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSaveNotifications}
                    disabled={isSavingNotifications}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
                  >
                    {isSavingNotifications ? "Saving..." : "Save Notifications"}
                  </button>
                  {notificationsSaved && (
                    <span className="text-sm text-green-600 dark:text-green-400">Saved!</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ZoomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#2D8CFF" />
      <path
        d="M6 9.5C6 8.67 6.67 8 7.5 8H13.5C14.33 8 15 8.67 15 9.5V14.5C15 15.33 14.33 16 13.5 16H7.5C6.67 16 6 15.33 6 14.5V9.5Z"
        fill="white"
      />
      <path
        d="M15.5 10.5L18 9V15L15.5 13.5V10.5Z"
        fill="white"
      />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function TeamsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#6264A7">
      <path d="M20.625 10.5h-6.75c-.621 0-1.125.504-1.125 1.125v6.75c0 .621.504 1.125 1.125 1.125h6.75c.621 0 1.125-.504 1.125-1.125v-6.75c0-.621-.504-1.125-1.125-1.125zM17.25 8.25c1.243 0 2.25-1.007 2.25-2.25S18.493 3.75 17.25 3.75 15 4.757 15 6s1.007 2.25 2.25 2.25zM12 9c1.657 0 3-1.343 3-3S13.657 3 12 3 9 4.343 9 6s1.343 3 3 3zm-1.5 1.5H3.375c-.621 0-1.125.504-1.125 1.125V18c0 1.657 1.343 3 3 3h6c.31 0 .609-.047.896-.131A2.981 2.981 0 0111.25 18.75v-7.125c0-.621-.504-1.125-1.125-1.125h-.625z" />
    </svg>
  );
}

function HubSpotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#FF7A59">
      <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984v-.066A2.198 2.198 0 0017.233.836h-.066a2.198 2.198 0 00-2.198 2.198v.066c0 .865.503 1.612 1.232 1.968v2.862a5.76 5.76 0 00-2.615 1.09l-6.7-5.209A2.633 2.633 0 007.232 1.5a2.625 2.625 0 10-.756 5.128l.07-.002 6.396 4.972a5.715 5.715 0 00-.183 1.427c0 .54.076 1.062.216 1.558l-2.39 1.201a2.274 2.274 0 00-1.27-.39 2.286 2.286 0 100 4.573 2.286 2.286 0 002.143-3.088l2.242-1.127a5.75 5.75 0 109.504-7.413v-.001a5.722 5.722 0 00-3.04-1.408zm-.964 9.263a3.468 3.468 0 110-6.936 3.468 3.468 0 010 6.936z" />
    </svg>
  );
}

// Integration Card Component
interface IntegrationCardProps {
  name: string;
  icon: React.ReactNode;
  connected: boolean;
  description: string;
  isLoading: boolean;
  testResult: "idle" | "testing" | "success" | "error";
  onTest: () => void;
  showTestButton: boolean;
}

function IntegrationCard({
  name,
  icon,
  connected,
  description,
  isLoading,
  testResult,
  onTest,
  showTestButton,
}: IntegrationCardProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div className="flex items-center gap-3">
        <div className={connected ? "" : "opacity-40"}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium text-sm ${connected ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500"}`}>
              {name}
            </span>
            {isLoading ? (
              <span className="text-xs text-gray-500">Loading...</span>
            ) : connected ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                Not connected
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>
        {showTestButton && (
          <button
            onClick={onTest}
            disabled={testResult === "testing"}
            className={`text-xs px-2 py-1 rounded transition-colors disabled:opacity-50 ${
              testResult === "success"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : testResult === "error"
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {testResult === "testing"
              ? "Testing..."
              : testResult === "success"
              ? "Success!"
              : testResult === "error"
              ? "Failed"
              : "Test Link"}
          </button>
        )}
      </div>
    </div>
  );
}
