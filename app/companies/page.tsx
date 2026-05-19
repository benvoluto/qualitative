import { customers, meetings, extracts, companies } from "@/lib/db";
import { requireAccountId } from "@/lib/account-context";
import { SyncCustomersButton } from "./sync-button";
import { CompaniesPageClient } from "./companies-page-client";
import { LogoMenu } from "@/components/logo-menu";
import { HeaderUserMenu } from "@/components/header-user-menu";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const accountId = await requireAccountId();
  const companiesList = await companies.getCompaniesWithStats(accountId);
  const customersList = await customers.getCustomers(accountId);

  const customersWithStats = await Promise.all(
    customersList.map(async (customer) => {
      const customerMeetings = await meetings.getMeetingsByCustomerId(accountId, customer.id);
      const customerExtracts = await extracts.getExtractsByCustomerId(accountId, customer.id);
      const actionItems = customerExtracts.filter((e) => e.is_action_item);
      const pendingActions = actionItems.filter((e) => e.action_item_status === "pending");

      return {
        ...customer,
        meetingCount: customerMeetings.length,
        extractCount: customerExtracts.length,
        actionItemCount: actionItems.length,
        pendingActionCount: pendingActions.length,
      };
    })
  );

  // Sort by meeting count descending
  customersWithStats.sort((a, b) => b.meetingCount - a.meetingCount);

  // Calculate stats for customers view
  const customerTypeCount = customersWithStats.filter((c) => c.customer_type === "customer").length;
  const dealTypeCount = customersWithStats.filter((c) => c.customer_type === "deal").length;

  // Calculate totals for companies view
  const totalCompanyMeetings = companiesList.reduce((sum, c) => sum + c.meeting_count, 0);
  const totalCompanyExtracts = companiesList.reduce((sum, c) => sum + c.extract_count, 0);
  const totalCompanyPendingActions = companiesList.reduce((sum, c) => sum + c.pending_action_count, 0);

  // Calculate totals for customers view
  const totalCustomerMeetings = customersWithStats.reduce((sum, c) => sum + c.meetingCount, 0);
  const totalCustomerExtracts = customersWithStats.reduce((sum, c) => sum + c.extractCount, 0);
  const totalCustomerPendingActions = customersWithStats.reduce((sum, c) => sum + c.pendingActionCount, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <LogoMenu />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Organizations
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <SyncCustomersButton />
              <HeaderUserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CompaniesPageClient
          companies={companiesList}
          customers={customersWithStats}
          companyStats={{
            totalCompanies: companiesList.length,
            totalMeetings: totalCompanyMeetings,
            totalExtracts: totalCompanyExtracts,
            totalPendingActions: totalCompanyPendingActions,
          }}
          customerStats={{
            totalCustomers: customersList.length,
            customerTypeCount,
            dealTypeCount,
            totalMeetings: totalCustomerMeetings,
            totalExtracts: totalCustomerExtracts,
            totalPendingActions: totalCustomerPendingActions,
          }}
        />
      </main>
    </div>
  );
}
