"use client";

import { Plus } from "@phosphor-icons/react";
import { FloatingActionPortal } from "@/components/floating-action-portal";
import { PrimaryActionButton } from "@/components/primary-action-button";
import { SyncButton } from "./sync-button";

/**
 * Meetings page actions, rendered into the floating bar: a link to add a
 * meeting manually plus the sync-source dropdown.
 */
export function MeetingsActions() {
  return (
    <FloatingActionPortal>
      <PrimaryActionButton
        href="/meetings/new"
        Icon={Plus}
        label="Add Meeting"
        variant="secondary"
      />
      <SyncButton />
    </FloatingActionPortal>
  );
}
