import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { listAllUsers } from "@/lib/admin/users-list";
import { LogoMenu } from "@/components/logo-menu";
import { HeaderUserMenu } from "@/components/header-user-menu";
import { CompToggle } from "./comp-toggle";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    redirect("/app");
  }

  const users = await listAllUsers();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <LogoMenu />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Admin</h1>
            </div>
            <HeaderUserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Users ({users.length})
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Toggle Comp to grant Pro for free.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Account / Domain</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium text-right">Meetings (mo)</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Onboarded</th>
                <th className="px-4 py-3 font-medium">Comp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((u) => {
                const effectivePlan = u.comped ? "pro" : u.plan;
                return (
                  <tr key={u.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{u.name || "—"}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900 dark:text-white">{u.account_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {u.internal_domain || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <PlanBadge plan={effectivePlan} comped={u.comped} />
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{u.status}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-white">
                      {u.meetings_this_month}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
                      {u.meeting_count}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {u.onboarded_at ? new Date(u.onboarded_at).toLocaleDateString() : (
                        <span className="text-yellow-600 dark:text-yellow-400">pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CompToggle accountId={u.account_id} comped={u.comped} />
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Admin access is restricted to emails listed in <code>ADMIN_EMAILS</code>
          {" (defaults to ben.clemens@gmail.com)."}{" "}
          <Link href="/app" className="text-blue-600 dark:text-blue-400 hover:underline">
            Back to dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}

function PlanBadge({ plan, comped }: { plan: "free" | "pro"; comped: boolean }) {
  if (comped) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
        Pro (comp)
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center text-xs px-2 py-0.5 rounded font-medium ${
        plan === "pro"
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
      }`}
    >
      {plan === "pro" ? "Pro" : "Free"}
    </span>
  );
}
