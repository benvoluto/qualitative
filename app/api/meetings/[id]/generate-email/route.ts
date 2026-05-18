import { NextRequest, NextResponse } from "next/server";
import { requireAccountContext } from "@/lib/account-context";
import { generateEmailDraft } from "@/lib/workflows/email-workflow";
import { EmailDraftType } from "@/lib/db/types";
import { users, meetings, customers } from "@/lib/db";
import { sendDraftReadyNotification } from "@/lib/email";

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { accountId, userId, email } = await requireAccountContext();
    const user = await users.getUserById(userId);

    const { id: meetingId } = await params;
    const body = await request.json();
    const draftType: EmailDraftType = body.draftType || "follow_up";

    if (!["follow_up", "action_items", "meeting_notes"].includes(draftType)) {
      return NextResponse.json({ error: "Invalid draft type" }, { status: 400 });
    }

    const draft = await generateEmailDraft(accountId, meetingId, draftType, userId);

    if (user) {
      const notificationPrefs = await users.getUserNotificationPrefs(user.id);
      if (notificationPrefs.notify_on_draft_created) {
        const notificationEmail = notificationPrefs.notification_email || email;
        const meeting = await meetings.getMeetingById(accountId, meetingId);
        if (meeting) {
          const customer = meeting.customer_id
            ? await customers.getCustomerById(accountId, meeting.customer_id)
            : null;
          sendDraftReadyNotification(notificationEmail, meeting, customer, [draft]).catch(
            (err) => console.error("Failed to send draft notification:", err)
          );
        }
      }
    }

    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    console.error("Error generating email draft:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to generate email: ${message}` }, { status: 500 });
  }
}
