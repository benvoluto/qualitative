"use client";

import { useState } from "react";
import { SettingsModal } from "@/components/settings-modal";

interface SettingsCardProps {
  status: {
    googleMeet: boolean;
    zoom: boolean;
    teams: boolean;
    hubspot: boolean;
  };
}

export function SettingsCard({ status }: SettingsCardProps) {
  const [showSettings, setShowSettings] = useState(false);

  const integrations = [
    { name: "Google Meet", connected: status.googleMeet, color: "#4285F4" },
    { name: "Zoom", connected: status.zoom, color: "#2D8CFF" },
    { name: "Teams", connected: status.teams, color: "#6264A7" },
    { name: "HubSpot", connected: status.hubspot, color: "#FF7A59" },
  ];

  return (
    <>
      <button
        onClick={() => setShowSettings(true)}
        className="block w-full text-left bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Settings
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Configure integrations
            </p>
          </div>
          <div className="flex items-center gap-1">
            {integrations.map((integration) => (
              <div
                key={integration.name}
                className={`w-3 h-3 rounded-full ${
                  integration.connected ? "" : "opacity-30"
                }`}
                style={{ backgroundColor: integration.color }}
                title={`${integration.name}: ${integration.connected ? "Connected" : "Not connected"}`}
              />
            ))}
          </div>
        </div>
      </button>
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
