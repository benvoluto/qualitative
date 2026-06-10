import Link from "next/link";
import { requireAccountId } from "@/lib/account-context";
import { customers, extracts } from "@/lib/db";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function MapsIndexPage() {
  const accountId = await requireAccountId();
  const allCustomers = await customers.getCustomers(accountId);
  const withCounts = await Promise.all(
    allCustomers.map(async (c) => {
      const rows = await extracts.getExtractsByCustomerId(accountId, c.id);
      return { id: c.id, name: c.name, customer_type: c.customer_type, extractCount: rows.length };
    })
  );
  withCounts.sort((a, b) => b.extractCount - a.extractCount);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      <PageHeader title="Maps" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          One affinity map per organization. Open a map to arrange extracts as sticky notes.
        </p>
        {withCounts.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No organizations yet. Add one from the Companies page.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {withCounts.map((c) => (
              <Link
                key={c.id}
                href={`/maps/${c.id}`}
                className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium text-gray-900 dark:text-white truncate">{c.name}</h2>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                      c.customer_type === "deal"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    }`}
                  >
                    {c.customer_type === "deal" ? "Secondary" : "Primary"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {c.extractCount} extract{c.extractCount === 1 ? "" : "s"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
