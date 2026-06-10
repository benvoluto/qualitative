import { customers } from "@/lib/db";
import { requireAccountId } from "@/lib/account-context";
import { NewMeetingForm } from "./new-meeting-form";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function NewMeetingPage() {
  const accountId = await requireAccountId();
  const customersList = await customers.getCustomers(accountId);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      <PageHeader title="Add Meeting Manually" />

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-x-auto p-6">
          <NewMeetingForm customers={customersList} />
        </div>
      </main>
    </div>
  );
}
