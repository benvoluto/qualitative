"use client";

import { useState, useTransition } from "react";
import { toggleCompedAction } from "./actions";

interface CompToggleProps {
  accountId: string;
  comped: boolean;
}

export function CompToggle({ accountId, comped: initial }: CompToggleProps) {
  const [comped, setComped] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !comped;
    setComped(next);
    startTransition(async () => {
      try {
        await toggleCompedAction(accountId, next);
      } catch {
        // Revert on error
        setComped(!next);
      }
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={comped}
      onClick={handleToggle}
      disabled={isPending}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
        comped ? "bg-purple-600" : "bg-gray-200 dark:bg-gray-600"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          comped ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
