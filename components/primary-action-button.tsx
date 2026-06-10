"use client";

import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import Link from "next/link";

type ButtonVariant = "primary" | "secondary";

interface PrimaryActionButtonProps {
  /** Visible button label. */
  label: string;
  /** Optional leading icon. */
  Icon?: ComponentType<IconProps>;
  /** When set, renders a navigation link instead of a button. */
  href?: string;
  /** Click handler used when no href is provided. */
  onClick?: () => void;
  /** Disables the control (button variant only). */
  disabled?: boolean;
  /** Visual style: solid blue (primary) or neutral (secondary). */
  variant?: ButtonVariant;
  /** Native title/tooltip. */
  title?: string;
}

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 border border-blue-600",
  secondary:
    "bg-white/95 dark:bg-gray-800/95 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700",
};

const BASE_CLASSES =
  "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap shadow-lg backdrop-blur-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Reusable pill-shaped primary action control used inside the floating action
 * bar. Renders a link when `href` is set, otherwise a button.
 */
export function PrimaryActionButton({
  label,
  Icon,
  href,
  onClick,
  disabled = false,
  variant = "primary",
  title,
}: PrimaryActionButtonProps) {
  const className = `${BASE_CLASSES} ${VARIANT_CLASSES[variant]}`;
  if (href) {
    return (
      <Link href={href} className={className} title={title}>
        {Icon && <Icon size={16} weight="bold" />}
        {label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      title={title}
    >
      {Icon && <Icon size={16} weight="bold" />}
      {label}
    </button>
  );
}
