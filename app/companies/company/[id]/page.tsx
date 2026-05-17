import { companies, customers, meetings, extracts } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerTypeBadge } from "../../customer-type-badge";
import { LogoMenu } from "@/components/logo-menu";

export const dynamic = "force-dynamic";

interface CompanyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanyDetailPage({ params }: CompanyDetailPageProps) {
  const { id } = await params;
  const company = await companies.getCompanyWithStats(id);

  if (!company) {
    notFound();
  }

  // Get associated customers/deals, meetings, and extracts
  const linkedCustomers = await customers.getCustomersByCompanyId(id);
  const companyMeetings = await meetings.getMeetingsByCompanyId(id);
  const companyExtracts = await extracts.getExtractsByCompanyId(id);
  const actionItems = companyExtracts.filter((e) => e.is_action_item);
  const pendingActions = actionItems.filter((e) => e.action_item_status === "pending");

  // Build location string
  const locationParts = [company.city, company.state].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(", ") : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <LogoMenu />
              <div className="flex items-center gap-3">
                <Link
                  href="/companies"
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  Companies
                </Link>
                <span className="text-gray-400">/</span>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {company.name}
                </h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Customers" value={company.customer_count} color="green" />
          <StatCard label="Deals" value={company.deal_count} color="blue" />
          <StatCard label="Meetings" value={company.meeting_count} color="gray" />
          <StatCard label="Extracts" value={company.extract_count} color="gray" />
          <StatCard label="Pending Actions" value={company.pending_action_count} color="orange" />
        </div>

        {/* Company Details & Linked Customers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Details Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Company Details
            </h2>
            <dl className="space-y-4">
              {location && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Location</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{location}</dd>
                </div>
              )}
              {company.address && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {company.address}
                    {company.city && <>, {company.city}</>}
                    {company.state && <>, {company.state}</>}
                    {company.zip && <> {company.zip}</>}
                    {company.country && <>, {company.country}</>}
                  </dd>
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
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">HubSpot ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono text-xs">
                    {company.hubspot_company_id}
                  </dd>
                </div>
              )}
              {company.hubspot_synced_at && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Synced</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {new Date(company.hubspot_synced_at).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Linked Customers/Deals */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Linked Customers & Deals
            </h2>
            {linkedCustomers.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No customers or deals linked to this company
              </p>
            ) : (
              <div className="space-y-3">
                {linkedCustomers.map((customer) => (
                  <Link
                    key={customer.id}
                    href={`/companies/${customer.id}`}
                    className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {customer.name}
                        </span>
                        <CustomerTypeBadge type={customer.customer_type} />
                      </div>
                      {customer.deal_stage && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {customer.deal_stage}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Meetings */}
        {companyMeetings.length > 0 && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Meetings ({companyMeetings.length})
            </h2>
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
              {companyMeetings.length > 10 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 pt-2">
                  And {companyMeetings.length - 10} more meetings...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Extracts */}
        {companyExtracts.length > 0 && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Extracts ({companyExtracts.length})
              {pendingActions.length > 0 && (
                <span className="ml-2 text-sm font-normal text-orange-600 dark:text-orange-400">
                  {pendingActions.length} pending action{pendingActions.length !== 1 ? "s" : ""}
                </span>
              )}
            </h2>
            <div className="space-y-4">
              {companyExtracts.slice(0, 10).map((extract) => (
                <div
                  key={extract.id}
                  className="p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  {extract.summary && (
                    <p className="text-gray-900 dark:text-white">{extract.summary}</p>
                  )}
                  {extract.quotes.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {extract.quotes.slice(0, 2).map((quote, i) => (
                        <p key={i} className="text-sm text-gray-500 dark:text-gray-400 italic">
                          &ldquo;{quote}&rdquo;
                        </p>
                      ))}
                    </div>
                  )}
                  {extract.is_action_item && (
                    <div className="mt-2">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          extract.action_item_status === "done"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : extract.action_item_status === "assigned"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                        }`}
                      >
                        Action: {extract.action_item_status || "pending"}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              {companyExtracts.length > 10 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 pt-2">
                  And {companyExtracts.length - 10} more extracts...
                </p>
              )}
            </div>
          </div>
        )}
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
