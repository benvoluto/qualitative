"use client";

import { useState } from "react";
import { IntegrationStatus } from "./integration-status";
import { SettingsModal } from "@/components/settings-modal";

interface IntegrationStatusWithModalProps {
  status: {
    googleMeet: boolean;
    zoom: boolean;
    teams: boolean;
    hubspot: boolean;
  };
}

export function IntegrationStatusWithModal({ status }: IntegrationStatusWithModalProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <IntegrationStatus status={status} onClick={() => setShowSettings(true)} />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
