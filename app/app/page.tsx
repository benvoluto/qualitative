import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import Link from "next/link";
import {
  Buildings,
  Calendar,
  Gear,
  ListChecks,
  Note,
} from "@phosphor-icons/react/dist/ssr";
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
      <header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-3 items-center h-16 gap-4">
            <div />
            <div className="flex justify-center">
              <LogoMenu />
            </div>
            <div className="flex justify-end">
              {session?.user && (
                <UserMenu user={session.user} isAdmin={isAdminEmail(session.user.email)} />
              )}
            </div>
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
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-8">
            <DashboardCard count={allMeetings.length} label="Meetings" href="/meetings" Icon={Calendar} />
            <DashboardCard count={allExtracts.length} label="Extracts" href="/extracts" Icon={Note} />
            <DashboardCard count={allCompanies.length} label="Organizations" href="/companies" Icon={Buildings} />
            <DashboardCard count={allRules.length} label="Extraction Rules" href="/extract-rules" Icon={Gear} />
            <DashboardCard
              count={actionItems.length}
              label="Pending Action Items"
              href="/extracts?filter=action"
              Icon={ListChecks}
            />
            <SettingsCard status={integrationStatus} />
          </div>
        </div>
      </main>
    </div>
  );
}

function DashboardCard({
  count,
  label,
  href,
  Icon,
}: {
  count: number;
  label: string;
  href: string;
  Icon: ComponentType<IconProps>;
}) {
  return (
    <Link
      href={href}
      className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow px-8 py-7"
    >
      <div className="flex items-center gap-4">
        <p className="text-5xl font-light text-gray-900 dark:text-white leading-none tracking-tight">
          {count}
        </p>
        <Icon size={36} weight="regular" className="text-gray-400 dark:text-gray-500" />
      </div>
      <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        {label}
      </p>
    </Link>
  );
}
