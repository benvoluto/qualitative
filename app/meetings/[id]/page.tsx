import { meetings, extracts, customers, emailDrafts } from "@/lib/db";
import { requireAccountId } from "@/lib/account-context";
import { notFound } from "next/navigation";
import { ProcessButton } from "./process-button";
import { ExtractButton } from "./extract-button";
import { MeetingActions } from "./meeting-actions";
import { EmailDraftPanel } from "./email-draft-panel";
import { TicketsPanel } from "./tickets-panel";
import { WorkflowActions } from "./workflow-actions";
import { CollapsibleTranscript } from "./collapsible-transcript";
import { EditableNotes } from "./editable-notes";
import { MeetingExtracts } from "./meeting-extracts";
import { EditableMeetingDetails } from "./editable-meeting-details";
import { hasTicketableContent } from "@/lib/gemini";
import { LogoMenu } from "@/components/logo-menu";

export const dynamic = "force-dynamic";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const accountId = await requireAccountId();
  const { id } = await params;

  const [meeting, meetingExtracts, allCustomers, meetingDrafts, meetingParticipants] = await Promise.all([
    meetings.getMeetingById(accountId, id),
    extracts.getExtractsWithTagsByMeetingId(accountId, id),
    customers.getCustomers(accountId),
    emailDrafts.getEmailDraftsByMeetingId(accountId, id),
    meetings.getMeetingParticipantsWithDetails(accountId, id),
  ]);

  if (!meeting) {
    notFound();
  }

  const linkedCustomer = meeting.customer_id
    ? await customers.getCustomerById(accountId, meeting.customer_id)
    : null;

  // Check if extracts contain potential feature requests or bugs
  const ticketableContent = hasTicketableContent(meetingExtracts);
  const hasPotentialTickets = ticketableContent.hasFeatureRequests || ticketableContent.hasBugs;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <LogoMenu />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                {meeting.name || "Untitled Meeting"}
              </h1>
              {/* Meeting Type Badge */}
              {linkedCustomer && (
                <MeetingTypeBadge customerType={linkedCustomer.customer_type} />
              )}
            </div>
            <div className="flex items-center gap-4">
              <StatusBadge status={meeting.workflow_status} />
              {!meeting.transcript && meeting.workflow_status !== "processing" && (
                <ProcessButton meetingId={id} hasExtracts={meetingExtracts.length > 0} />
              )}
              <ExtractButton
                meetingId={id}
                hasTranscript={!!meeting.transcript}
                hasExtracts={meetingExtracts.length > 0}
                extractCount={meetingExtracts.length}
              />
              <MeetingActions
                meeting={meeting}
                customers={allCustomers}
                extractCount={meetingExtracts.length}
                linkedCustomer={linkedCustomer}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Meeting details, Extracts, Transcript */}
          <div className="lg:col-span-2 space-y-6">
            {/* Meeting Info - Editable */}
            <EditableMeetingDetails
              meeting={meeting}
              linkedCustomer={linkedCustomer}
              participants={meetingParticipants}
              allCustomers={allCustomers}
            />

            {/* Extracts - Moved to main column */}
            <MeetingExtracts
              extracts={meetingExtracts}
              hasTranscript={!!meeting.transcript}
            />

            {/* Transcript - Collapsible, below extracts */}
            <CollapsibleTranscript
              meetingId={id}
              transcript={meeting.transcript}
              workflowStatus={meeting.workflow_status}
            />

            {/* User Notes - Editable */}
            <EditableNotes meetingId={id} notes={meeting.user_notes} />

            {/* Email Drafts */}
            <EmailDraftPanel drafts={meetingDrafts} meetingId={id} />

            {/* Tickets */}
            <TicketsPanel
              meetingId={id}
              hasExtracts={meetingExtracts.length > 0}
              hasPotentialTickets={hasPotentialTickets}
            />
          </div>

          {/* Right column - Workflow Actions */}
          <div className="space-y-6">
            {/* Workflow Actions */}
            <WorkflowActions
              meetingId={id}
              hasExtracts={meetingExtracts.length > 0}
              hasNotes={!!meeting.user_notes && meeting.user_notes.trim().length > 0}
              hasDraft={meetingDrafts.length > 0}
              customerType={linkedCustomer?.customer_type || null}
              hubspotCompanyId={linkedCustomer?.hubspot_company_id || null}
              hubspotDealId={linkedCustomer?.hubspot_deal_id || null}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        styles[status as keyof typeof styles] || styles.pending
      }`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function MeetingTypeBadge({
  customerType,
  size = "default",
}: {
  customerType: "deal" | "customer";
  size?: "default" | "sm";
}) {
  const sizeClasses = size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded font-medium ${sizeClasses} ${
        customerType === "deal"
          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
          : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
      }`}
    >
      {customerType === "deal" ? "Deal" : "Customer"}
    </span>
  );
}
