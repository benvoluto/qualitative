"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Buildings,
  Calendar,
  Gear,
  List,
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

/** Routes that should NOT show the floating bar. */
const HIDDEN_PREFIXES = ["/login", "/onboarding"];
const HIDDEN_EXACT = new Set(["/", "/privacy", "/terms", "/dpa", "/security"]);

function shouldHide(pathname: string): boolean {
  if (HIDDEN_EXACT.has(pathname)) return true;
  return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isItemActive(pathname: string, match: string): boolean {
  return pathname === match || pathname.startsWith(`${match}/`);
}

/**
 * Single fixed bar at the bottom of the screen. Holds page action buttons (via
 * the `#floating-action-slot` portal target) to the left of the primary nav.
 * On small screens the nav collapses to a hamburger popover while the action
 * slot stays visible.
 */
export function FloatingBar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);
  if (shouldHide(pathname)) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3">
      <div id="floating-action-slot" className="flex items-center gap-2" />
      <nav aria-label="Primary navigation">
        <ul className="hidden sm:flex items-center gap-1 px-1.5 py-1.5 rounded-full dark:border-gray-700 bg-white/45 dark:bg-gray-800/95 backdrop-blur-md shadow-lg">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(pathname, item.match);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                      : "text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  <Icon size={18} weight={isActive ? "fill" : "regular"} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="sm:hidden relative" ref={menuRef}>
          {isMenuOpen && (
            <ul className="absolute bottom-full right-0 mb-2 w-52 py-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md shadow-lg">
              {ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = isItemActive(pathname, item.match);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      <Icon size={18} weight={isActive ? "fill" : "regular"} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
            className="flex items-center justify-center p-3 rounded-full border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md shadow-lg text-gray-700 dark:text-gray-200"
          >
            <List size={20} weight="bold" />
          </button>
        </div>
      </nav>
    </div>
  );
}
