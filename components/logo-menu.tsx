"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";
import { features } from "@/lib/features";

interface LogoMenuProps {
  counts?: {
    meetings: number;
    companies: number;
    extracts: number;
    actionItems: number;
    extractRules: number;
  };
  integrationStatus?: {
    googleMeet: boolean;
    zoom: boolean;
    teams: boolean;
    hubspot: boolean;
  };
}

export function LogoMenu({ counts, integrationStatus }: LogoMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const dropdownItems = [
    { href: "/companies", label: "Companies", icon: BuildingIcon, count: counts?.companies },
    { href: "/extracts", label: "Extracts", icon: DocumentIcon, count: counts?.extracts },
    { href: "/extracts?filter=action", label: "Action Items", icon: ChecklistIcon, count: counts?.actionItems },
    { href: "/extract-rules", label: "Extract Rules", icon: CogIcon, count: counts?.extractRules },
    { href: "/billing", label: "Billing", icon: CreditCardIcon, count: undefined },
  ];

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Logo (links home) with dropdown chevron for other items */}
      <div className="relative flex items-center" ref={menuRef}>
        <Link
          href="/app"
          aria-label="Home"
          className="inline-flex shrink-0 rounded-md hover:opacity-80 transition-opacity"
        >
          <Logo width={40} height={40} className="rounded-md block" />
        </Link>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center justify-center w-6 h-8 ml-0.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Navigation menu"
          aria-expanded={isOpen}
        >
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 py-1">
            {dropdownItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  {item.label}
                </div>
                {item.count !== undefined && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    {item.count}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <nav className="flex items-center ml-2 border-l border-gray-200 dark:border-gray-700 pl-3">
        <Link
          href="/app"
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            pathname === "/app"
              ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50"
          }`}
        >
          <HomeIcon className="w-4 h-4" />
          <span>Home</span>
        </Link>

        <Link
          href="/meetings"
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            isActive("/meetings")
              ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50"
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          <span>Meetings</span>
          {counts?.meetings !== undefined && counts.meetings > 0 && (
            <span className="ml-1 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
              {counts.meetings}
            </span>
          )}
        </Link>

        <Link
          href="/extracts"
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            isActive("/extracts")
              ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50"
          }`}
        >
          <ExtractsIcon className="w-4 h-4" />
          <span>Extracts</span>
          {counts?.extracts !== undefined && counts.extracts > 0 && (
            <span className="ml-1 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
              {counts.extracts}
            </span>
          )}
        </Link>

        {integrationStatus && (
          <div className="flex items-center gap-0.5 ml-2" aria-label="Integration status">
            {[
              { connected: integrationStatus.googleMeet, color: "#4285F4", enabled: true, name: "Google Meet" },
              { connected: integrationStatus.zoom, color: "#2D8CFF", enabled: features.zoom, name: "Zoom" },
              { connected: integrationStatus.teams, color: "#6264A7", enabled: features.teams, name: "Teams" },
              { connected: integrationStatus.hubspot, color: "#FF7A59", enabled: features.hubspot, name: "HubSpot" },
            ]
              .filter((i) => i.enabled)
              .map((integration) => (
                <div
                  key={integration.name}
                  className={`w-2 h-2 rounded-full ${integration.connected ? "" : "opacity-30"}`}
                  style={{ backgroundColor: integration.color }}
                  title={`${integration.name}: ${integration.connected ? "Connected" : "Not connected"}`}
                />
              ))}
          </div>
        )}
      </nav>
    </div>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

function ExtractsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 8h10M7 12h10M7 16h6M5 4h11l4 4v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
      />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}

function CogIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"
      />
    </svg>
  );
}

