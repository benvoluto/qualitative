import type { ReactNode } from "react";
import { LogoMenu } from "./logo-menu";
import { HeaderUserMenu } from "./header-user-menu";

interface PageHeaderProps {
  /** Page title shown on the left edge of the header. */
  title: ReactNode;
  /** Optional extra controls rendered on the right, left of the user menu. */
  rightSlot?: ReactNode;
}

/**
 * Standard top header used across all authenticated pages:
 * page title at left, logo centred, user menu (and optional extras) at right.
 * Uses a 3-column grid so the logo stays dead-centre regardless of the widths
 * of the title or the right slot.
 */
export function PageHeader({ title, rightSlot }: PageHeaderProps) {
  return (
    <header>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-3 items-center h-16 gap-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate min-w-1">
            {title}&nbsp;
          </h1>
          <div className="flex justify-center">
            <LogoMenu />
          </div>
          <div className="flex justify-end items-center gap-3">
            {rightSlot}
            <HeaderUserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
