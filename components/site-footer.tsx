import Link from "next/link";
import { auth } from "@/lib/auth";
import { SignOutLink } from "./sign-out-link";

/**
 * Persistent site footer rendered from the root layout, so every page has the
 * same set of legal + account links at the bottom. Tolerates an invalid auth
 * cookie (after NEXTAUTH_SECRET rotation) by treating the visitor as logged out.
 */
export async function SiteFooter() {
  let isAuthed = false;
  try {
    const session = await auth();
    isAuthed = !!session?.user;
  } catch {
    isAuthed = false;
  }

  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
        <p>© {new Date().getFullYear()} Qualitative.</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-gray-900 dark:hover:text-white">
            Terms
          </Link>
          <Link href="/dpa" className="hover:text-gray-900 dark:hover:text-white">
            DPA
          </Link>
          <Link href="/security" className="hover:text-gray-900 dark:hover:text-white">
            Security
          </Link>
          {isAuthed ? (
            <>
              <Link href="/billing" className="hover:text-gray-900 dark:hover:text-white">
                Billing
              </Link>
              <SignOutLink />
            </>
          ) : (
            <Link href="/login" className="hover:text-gray-900 dark:hover:text-white">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </footer>
  );
}
