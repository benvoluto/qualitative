import { CustomerType } from "@/lib/db/types";

interface CustomerTypeBadgeProps {
  type: CustomerType;
  className?: string;
}

export function CustomerTypeBadge({ type, className = "" }: CustomerTypeBadgeProps) {
  const baseClasses = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium";

  if (type === "deal") {
    return (
      <span
        className={`${baseClasses} bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 ${className}`}
      >
        Deal
      </span>
    );
  }

  return (
    <span
      className={`${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 ${className}`}
    >
      Customer
    </span>
  );
}
