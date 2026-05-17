import { extracts, tags, extractRules, customers } from "@/lib/db";
import { ExtractsFilter } from "./extracts-filter";
import { LogoMenu } from "@/components/logo-menu";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ExtractsPage() {
  // Get all data using optimized queries
  const [allTags, allRules, allCustomers, paginatedResult] = await Promise.all([
    tags.getTags(),
    extractRules.getExtractRules(),
    customers.getCustomers(),
    extracts.getExtractsWithDetailsPaginated({ limit: 500 }),
  ]);

  // Transform the paginated result to the format expected by ExtractsFilter
  const extractsWithDetails = paginatedResult.extracts.map((e) => {
    // Build tags array from the arrays
    const tagsArray = e.tag_ids.map((id, idx) => ({
      id,
      name: e.tag_names[idx] || "",
      color: e.tag_colors[idx] || null,
      type: null,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    return {
      id: e.id,
      meeting_id: e.meeting_id,
      customer_id: e.customer_id,
      extract_rule_id: e.extract_rule_id,
      extract_date: e.extract_date,
      summary: e.summary,
      quotes: e.quotes,
      is_action_item: e.is_action_item,
      action_item_status: e.action_item_status,
      request_status: e.request_status,
      created_at: e.created_at,
      updated_at: e.updated_at,
      meeting: e.meeting_name ? {
        id: e.meeting_id,
        external_id: null,
        name: e.meeting_name,
        meeting_date: e.meeting_date,
        customer_id: e.customer_id,
        company_id: e.company_id,
        transcript: null,
        user_notes: null,
        workflow_status: "completed" as const,
        source: null,
        recording_url: e.meeting_recording_url,
        meeting_url: null,
        transcript_source: null,
        host_name: null,
        host_email: null,
        is_internal: e.meeting_is_internal,
        recording_passcode: e.meeting_recording_passcode,
        created_at: new Date(),
        updated_at: new Date(),
      } : null,
      tags: tagsArray,
      rule_name: e.rule_name,
      customer_name: e.customer_name,
      customer_type: e.customer_type,
      is_internal: e.meeting_is_internal,
    };
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <LogoMenu />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Extracts
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ExtractsFilter
          extracts={extractsWithDetails}
          tags={allTags}
          rules={allRules}
          customers={allCustomers}
          tagCounts={paginatedResult.tagCounts}
          ruleCounts={paginatedResult.ruleCounts}
          customerCounts={paginatedResult.customerCounts}
        />
      </main>
    </div>
  );
}
