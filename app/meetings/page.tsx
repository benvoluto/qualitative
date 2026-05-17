import { meetings, customers, extracts } from "@/lib/db";
import { MeetingsList } from "./meetings-list";
import { SyncButton } from "./sync-button";
import { CustomersList } from "./customers-list";
import Link from "next/link";
import { LogoMenu } from "@/components/logo-menu";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const [meetingsList, customersList, extractCounts] = await Promise.all([
    meetings.getPastMeetings(),
    customers.getCustomers(),
    extracts.getExtractCountsByMeetingIds(),
  ]);

  // Group meetings by status for stats
  const stats = {
    total: meetingsList.length,
    pending: meetingsList.filter((m) => m.workflow_status === "pending").length,
    processing: meetingsList.filter((m) => m.workflow_status === "processing").length,
    transcribed: meetingsList.filter((m) => m.workflow_status === "transcribed").length,
    completed: meetingsList.filter((m) => m.workflow_status === "completed").length,
    failed: meetingsList.filter((m) => m.workflow_status === "failed").length,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <LogoMenu />
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/meetings/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Meeting Manually
              </Link>
              <SyncButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Pending" value={stats.pending} color="yellow" />
          <StatCard label="Processing" value={stats.processing} color="blue" />
          <StatCard label="Transcribed" value={stats.transcribed} color="teal" />
          <StatCard label="Completed" value={stats.completed} color="green" />
          <StatCard label="Failed" value={stats.failed} color="red" />
        </div>

        <div className="space-y-8">
          {/* Meetings List */}
          {meetingsList.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                No meetings yet
              </h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                Click &quot;Sync Meetings&quot; to import your Google Meet or HubSpot meetings.
              </p>
            </div>
          ) : (
            <MeetingsList
              meetings={meetingsList}
              customers={customersList}
              extractCounts={Object.fromEntries(extractCounts)}
            />
          )}

          {/* Companies Accordion */}
          <CustomersList customers={customersList} />
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "gray",
}: {
  label: string;
  value: number;
  color?: "gray" | "yellow" | "blue" | "teal" | "green" | "red";
}) {
  const colorClasses = {
    gray: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    teal: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
    green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm opacity-75">{label}</p>
    </div>
  );
}
