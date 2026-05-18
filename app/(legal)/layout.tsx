import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-gray-900 dark:text-white">
            Qualitative
          </Link>
          <nav className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
            <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-gray-900 dark:hover:text-white">
              Terms
            </Link>
            <Link href="/dpa" className="hover:text-gray-900 dark:hover:text-white">
              DPA
            </Link>
            <Link href="/login" className="hover:text-gray-900 dark:hover:text-white">
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-grow">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-gray-800 dark:text-gray-200">
          {children}
        </article>
      </main>
      <footer className="border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-sm text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} Qualitative.
        </div>
      </footer>
    </div>
  );
}
