import { customers } from "@/lib/db";
import { requireAccountId } from "@/lib/account-context";
import { NewMeetingForm } from "./new-meeting-form";
import { LogoMenu } from "@/components/logo-menu";
import { HeaderUserMenu } from "@/components/header-user-menu";

export const dynamic = "force-dynamic";

export default async function NewMeetingPage() {
  const accountId = await requireAccountId();
  const customersList = await customers.getCustomers(accountId);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <LogoMenu />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Add Meeting Manually
              </h1>
            </div>
            <HeaderUserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <NewMeetingForm customers={customersList} />
        </div>
      </main>
    </div>
  );
}
