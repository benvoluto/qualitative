"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/** DOM id of the slot rendered by the floating bar. */
const SLOT_ID = "floating-action-slot";

interface FloatingActionPortalProps {
  /** Action buttons to render inside the floating bar's action slot. */
  children: ReactNode;
}

/**
 * Renders its children into the floating bar's action slot (left of the primary
 * nav). Returns null until the slot is mounted. Any modals or dropdowns rendered
 * alongside the children should stay `fixed` so they remain full-screen.
 */
export function FloatingActionPortal({ children }: FloatingActionPortalProps) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setNode(document.getElementById(SLOT_ID));
  }, []);
  if (!node) return null;
  return createPortal(children, node);
}
