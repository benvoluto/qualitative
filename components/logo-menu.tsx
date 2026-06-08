"use client";

import Link from "next/link";
import { Logo } from "./logo";

/**
 * Small home-link in the page header. The primary nav moved to <FloatingNav />,
 * so this component now just renders the logo as a link to /app.
 */
export function LogoMenu() {
  return (
    <Link
      href="/app"
      aria-label="Home"
      className="inline-flex shrink-0 rounded-md hover:opacity-80 transition-opacity"
    >
      <Logo width={64} height={64} className="rounded-md block" />
    </Link>
  );
}
