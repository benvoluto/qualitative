import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateEmailDraft } from "@/lib/workflows/email-workflow";
import { EmailDraftType } from "@/lib/db/types";
import { users, meetings, customers } from "@/lib/db";
import { sendDraftReadyNotification } from "@/lib/email";

// Extend timeout for Gemini processing (requires Vercel Pro)
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user for custom prompt templates and notification preferences
    const user = await users.getUserByEmail(session.user.email);
    const userId = user?.id;

    const { id: meetingId } = await params;
    const body = await request.json();
    const draftType: EmailDraftType = body.draftType || "follow_up";

    // Validate draft type
    if (!["follow_up", "action_items", "meeting_notes"].includes(draftType)) {
      return NextResponse.json(
        { error: "Invalid draft type" },
        { status: 400 }
      );
    }

    const draft = await generateEmailDraft(meetingId, draftType, userId);

    // Send notification if user has enabled it
    if (user) {
      const notificationPrefs = await users.getUserNotificationPrefs(user.id);
      if (notificationPrefs.notify_on_draft_created) {
        const notificationEmail = notificationPrefs.notification_email || session.user.email;
        const meeting = await meetings.getMeetingById(meetingId);
        if (meeting) {
          const customer = meeting.customer_id
            ? await customers.getCustomerById(meeting.customer_id)
            : null;
          // Send notification in background (don't await)
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
    return NextResponse.json(
      { error: `Failed to generate email: ${message}` },
      { status: 500 }
    );
  }
}
