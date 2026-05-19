import { auth } from "@/lib/auth";
import { UserMenu } from "@/components/user-menu";
import { LogoMenu } from "@/components/logo-menu";
import { AutoSync } from "@/components/auto-sync";
import { CompanySyncCheck } from "@/components/company-sync-check";
import { meetings, extracts, extractRules, users, customers } from "@/lib/db";
import { isHubSpotConfigured } from "@/lib/hubspot";
import { features } from "@/lib/features";
import { isAdminEmail } from "@/lib/admin";
import { SettingsCard } from "./settings-card";
import { RecentActivity } from "./recent-activity";
import { GettingStarted } from "./getting-started";

// Force dynamic rendering since we access auth
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await auth();

  // Resolve account before any tenant-scoped query
  let accountId: string | null = null;
  if (session?.user?.email) {
    const user = await users.getUserByEmail(session.user.email);
    accountId = user?.account_id ?? null;
  }

  const allMeetings = accountId ? await meetings.getMeetings(accountId) : [];
  const allExtracts = accountId ? await extracts.getExtracts(accountId) : [];
  const actionItems = accountId ? await extracts.getPendingActionItems(accountId) : [];
  const allRules = accountId ? await extractRules.getExtractRules(accountId) : [];
  const allCompanies = accountId ? await customers.getCustomers(accountId) : [];

  const menuCounts = {
    meetings: allMeetings.length,
    companies: allCompanies.length,
    extracts: allExtracts.length,
    actionItems: actionItems.length,
    extractRules: allRules.length,
  };

  // Get user's integration status and autosync preference
  let integrationStatus = {
    googleMeet: false,
    zoom: false,
    teams: false,
    hubspot: features.hubspot && isHubSpotConfigured(),
  };
  let autosyncEnabled = false;

  if (session?.user?.email) {
    const user = await users.getUserByEmail(session.user.email);
    if (user) {
      integrationStatus = {
        googleMeet: !!user.google_access_token,
        zoom: features.zoom && !!user.zoom_access_token,
        teams: features.teams && !!user.ms_access_token,
        hubspot: features.hubspot && isHubSpotConfigured(),
      };
      autosyncEnabled = await users.getUserMeetingAutosyncEnabled(user.id);
    }
  }

  // Check if user has any integrations and autosync is enabled
  const hasIntegrations = integrationStatus.googleMeet ||
    integrationStatus.zoom ||
    integrationStatus.teams ||
    integrationStatus.hubspot;
  const shouldAutosync = hasIntegrations && autosyncEnabled;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Auto-sync meetings on page load and periodically (only if user enabled it) */}
      <AutoSync hasIntegrations={shouldAutosync} />
      <CompanySyncCheck hasHubSpot={integrationStatus.hubspot} />

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <LogoMenu counts={menuCounts} integrationStatus={integrationStatus} />
            </div>
            {session?.user && <UserMenu user={session.user} isAdmin={isAdminEmail(session.user.email)} />}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {allMeetings.length === 0 ? (
            <GettingStarted hasGoogle={integrationStatus.googleMeet} />
          ) : (
            <RecentActivity />
          )}

          {/* Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            <DashboardCard
              title="Meetings"
              description="View and manage meeting transcripts"
              count={allMeetings.length}
              href="/meetings"
            />
            <DashboardCard
              title="Organizations"
              description="Browse Organizations (customers and deals)"
              count={allCompanies.length}
              href="/companies"
            />
            <DashboardCard
              title="Action Items"
              description="Track pending action items"
              count={actionItems.length}
              href="/extracts?filter=action"
            />
            <DashboardCard
              title="Extracts"
              description="Search insights and quotes"
              count={allExtracts.length}
              href="/extracts"
            />
            <DashboardCard
              title="Extract Rules"
              description="Manage extraction rules"
              count={allRules.length}
              href="/extract-rules"
            />
            <SettingsCard status={integrationStatus} />
          </div>
        </div>
      </main>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  count,
  href,
}: {
  title: string;
  description: string;
  count: number | null;
  href: string;
}) {
  return (
    <a
      href={href}
      className="block bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {title}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>
        {count !== null && (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-sm font-medium">
            {count}
          </span>
        )}
      </div>
    </a>
  );
}
