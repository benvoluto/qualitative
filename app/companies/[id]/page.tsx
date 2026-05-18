import { customers, meetings, extracts } from "@/lib/db";
import { requireAccountId } from "@/lib/account-context";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerTypeBadge } from "../customer-type-badge";
import { CompanySummary } from "./company-summary";
import { CompanyExtracts } from "./company-extracts";
import { LogoMenu } from "@/components/logo-menu";

export const dynamic = "force-dynamic";

interface CompanyPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const accountId = await requireAccountId();
  const { id } = await params;
  const company = await customers.getCustomerById(accountId, id);

  if (!company) {
    notFound();
  }

  const companyMeetings = await meetings.getMeetingsByCustomerId(accountId, id);
  const companyExtracts = await extracts.getExtractsByCustomerId(accountId, id);
  const actionItems = companyExtracts.filter((e) => e.is_action_item);
  const pendingActions = actionItems.filter((e) => e.action_item_status === "pending");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <LogoMenu />
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {company.name}
                </h1>
                <CustomerTypeBadge type={company.customer_type} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Meetings" value={companyMeetings.length} color="blue" />
          <StatCard label="Extracts" value={companyExtracts.length} color="green" />
          <StatCard label="Action Items" value={actionItems.length} color="gray" />
          <StatCard label="Pending Actions" value={pendingActions.length} color="orange" />
        </div>

        {/* Company Summary */}
        <CompanySummary customerId={id} />

        {/* Company Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Details Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Company Details
            </h2>
            <dl className="space-y-4">
              {company.address && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{company.address}</dd>
                </div>
              )}
              {company.domain && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Domain</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{company.domain}</dd>
                </div>
              )}
              {company.hubspot_company_id && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">HubSpot Company ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono text-xs">
                    {company.hubspot_company_id}
                  </dd>
                </div>
              )}
              {company.hubspot_deal_id && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">HubSpot Deal ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono text-xs">
                    {company.hubspot_deal_id}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Recent Meetings */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Meetings
            </h2>
            {companyMeetings.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No meetings found</p>
            ) : (
              <div className="space-y-3">
                {companyMeetings.slice(0, 10).map((meeting) => (
                  <Link
                    key={meeting.id}
                    href={`/meetings/${meeting.id}`}
                    className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {meeting.name || "Untitled Meeting"}
                        </div>
                        {meeting.meeting_date && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(meeting.meeting_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          meeting.workflow_status === "completed"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : meeting.workflow_status === "transcribed"
                            ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                            : meeting.workflow_status === "failed"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            : meeting.workflow_status === "processing"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                        }`}
                      >
                        {meeting.workflow_status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Extracts with filter */}
        <CompanyExtracts extracts={companyExtracts} />
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
  color?: "gray" | "blue" | "green" | "orange";
}) {
  const colorClasses = {
    gray: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  };

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm opacity-75">{label}</p>
    </div>
  );
}
