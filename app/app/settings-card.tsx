"use client";

import { useState } from "react";
import { PlugsConnected } from "@phosphor-icons/react";
import { SettingsModal } from "@/components/settings-modal";
import { features } from "@/lib/features";

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
    { name: "Google Meet", connected: status.googleMeet, enabled: true },
    { name: "Zoom", connected: status.zoom, enabled: features.zoom },
    { name: "Teams", connected: status.teams, enabled: features.teams },
    { name: "HubSpot", connected: status.hubspot, enabled: features.hubspot },
  ].filter((i) => i.enabled);

  const connectedCount = integrations.filter((i) => i.connected).length;
  const totalCount = integrations.length;

  return (
    <>
      <button
        onClick={() => setShowSettings(true)}
        className="block w-full text-left bg-white dark:bg-gray-800 rounded-4xl hover:shadow-md transition-shadow px-8 py-7"
      >
        <div className="flex items-center gap-4">
          <p className="text-5xl font-light text-gray-900 dark:text-white leading-none tracking-tight">
            {connectedCount}
            <span className="text-2xl text-gray-400 dark:text-gray-500 font-light">
              {" "}
              / {totalCount}
            </span>
          </p>
          <PlugsConnected size={36} weight="regular" className="text-gray-400 dark:text-gray-500" />
        </div>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Connected Integrations
        </p>
      </button>
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
