"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Buildings,
  CaretDown,
  Calendar,
  FileText,
  Gear,
  ListChecks,
  MapTrifold,
  Note,
} from "@phosphor-icons/react";
import { Logo } from "./logo";

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

export function LogoMenu({ counts }: LogoMenuProps) {
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
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const dropdownItems = [
    {
      href: "/companies",
      label: "Organizations",
      icon: Buildings,
      count: counts?.companies,
    },
    {
      href: "/extracts",
      label: "Extracts",
      icon: Note,
      count: counts?.extracts,
    },
    {
      href: "/extracts?filter=action",
      label: "Action Items",
      icon: ListChecks,
      count: counts?.actionItems,
    },
  ];

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Logo — clicking navigates home */}
      <Link
        href="/app"
        aria-label="Home"
        className="inline-flex shrink-0 rounded-md hover:opacity-80 transition-opacity"
      >
        <Logo width={64} height={64} className="rounded-md block" />
      </Link>

      {/* Tab Bar */}
      <nav className="flex items-center ml-2 border-l border-gray-200 dark:border-gray-700 pl-3">
        <Link
          href="/meetings"
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            isActive("/meetings")
              ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50"
          }`}
        >
          <Calendar size={16} />
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
          <FileText size={16} />
          <span>Extracts</span>
          {counts?.extracts !== undefined && counts.extracts > 0 && (
            <span className="ml-1 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
              {counts.extracts}
            </span>
          )}
        </Link>

        <Link
          href="/maps"
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            isActive("/maps")
              ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50"
          }`}
        >
          <MapTrifold size={16} />
          <span>Maps</span>
        </Link>

        <Link
          href="/extract-rules"
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            isActive("/extract-rules")
              ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50"
          }`}
        >
          <Gear size={16} />
          <span>Extract Rules</span>
          {counts?.extractRules !== undefined && counts.extractRules > 0 && (
            <span className="ml-1 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
              {counts.extractRules}
            </span>
          )}
        </Link>
      </nav>

      {/* Overflow menu — items that don't fit as top-level tabs */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center justify-center w-7 h-8 rounded-md text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="More navigation"
          aria-expanded={isOpen}
        >
          <CaretDown
            size={16}
            className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
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
                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                  <item.icon size={16} />
                  <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
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
    </div>
  );
}
