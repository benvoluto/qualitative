"use client";

import { getContrastingTextColor } from "@/lib/constants/colors";

interface TagBadgeProps {
  name: string;
  color: string | null;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

export function TagBadge({
  name,
  color,
  onClick,
  selected,
  className = "",
}: TagBadgeProps) {
  const baseClasses = "inline-flex items-center px-2 py-0.5 rounded-xl text-xs font-medium transition-colors";

  // If no color, use default blue styling
  if (!color) {
    return (
      <span
        className={`${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 ${
          onClick ? "cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/40" : ""
        } ${selected ? "ring-2 ring-blue-500" : ""} ${className}`}
        onClick={onClick}
        role={onClick ? "button" : undefined}
      >
        {name}
      </span>
    );
  }

  const textColor = getContrastingTextColor(color);

  return (
    <span
      className={`${baseClasses} ${
        onClick ? "cursor-pointer hover:opacity-80" : ""
      } ${selected ? "ring-2 ring-offset-1 ring-gray-900 dark:ring-white" : ""} ${className}`}
      style={{
        backgroundColor: color,
        color: textColor,
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {name}
    </span>
  );
}

// Pill variant (rounded-full)
export function TagPill({
  name,
  color,
  onClick,
  selected,
  className = "",
}: TagBadgeProps) {
  const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors";

  if (!color) {
    return (
      <span
        className={`${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 ${
          onClick ? "cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/40" : ""
        } ${selected ? "ring-2 ring-blue-500" : ""} ${className}`}
        onClick={onClick}
        role={onClick ? "button" : undefined}
      >
        {name}
      </span>
    );
  }

  const textColor = getContrastingTextColor(color);

  return (
    <span
      className={`${baseClasses} ${
        onClick ? "cursor-pointer hover:opacity-80" : ""
      } ${selected ? "ring-2 ring-offset-1 ring-gray-900 dark:ring-white" : ""} ${className}`}
      style={{
        backgroundColor: color,
        color: textColor,
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {name}
    </span>
  );
}
