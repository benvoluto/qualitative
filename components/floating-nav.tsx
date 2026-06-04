"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Buildings,
  Calendar,
  Gear,
  MapTrifold,
  Note,
} from "@phosphor-icons/react";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Calendar;
  /** Pathname segment treated as "this route is active". */
  match: string;
}

const ITEMS: readonly NavItem[] = [
  { href: "/meetings", label: "Meetings", icon: Calendar, match: "/meetings" },
  { href: "/extracts", label: "Extracts", icon: Note, match: "/extracts" },
  { href: "/maps", label: "Maps", icon: MapTrifold, match: "/maps" },
  { href: "/extract-rules", label: "Extract Rules", icon: Gear, match: "/extract-rules" },
  { href: "/companies", label: "Organizations", icon: Buildings, match: "/companies" },
] as const;

/** Routes that should NOT show the floating nav. */
const HIDDEN_PREFIXES = ["/login", "/onboarding"];
const HIDDEN_EXACT = new Set(["/", "/privacy", "/terms", "/dpa", "/security"]);

function shouldHide(pathname: string): boolean {
  if (HIDDEN_EXACT.has(pathname)) return true;
  return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function FloatingNav() {
  const pathname = usePathname();
  if (shouldHide(pathname)) return null;

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
    >
      <ul className="flex items-center gap-1 px-1.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md shadow-lg">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.match || pathname.startsWith(`${item.match}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <Icon size={18} weight={isActive ? "fill" : "regular"} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
