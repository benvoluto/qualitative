import { NextRequest, NextResponse } from "next/server";
import { requireAccountId } from "@/lib/account-context";
import { meetings, extracts, customers, emailDrafts } from "@/lib/db";
import {
  sendMeetingProcessedNotification,
  sendDraftReadyNotification,
  isMailjetConfigured,
} from "@/lib/email";

type NotificationType = "meeting_processed" | "drafts_ready";

export async function POST(request: NextRequest) {
  try {
    const accountId = await requireAccountId();
    if (!isMailjetConfigured()) {
      return NextResponse.json(
        { error: "Email notifications are not configured. Set MAILJET_API_KEY, MAILJET_SECRET_KEY, and MAILJET_FROM_EMAIL." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { meetingId, notificationType, recipientEmail } = body as {
      meetingId: string;
      notificationType: NotificationType;
      recipientEmail?: string;
    };

    if (!meetingId) {
      return NextResponse.json(
        { error: "Meeting ID is required" },
        { status: 400 }
      );
    }

    if (!notificationType) {
      return NextResponse.json(
        { error: "Notification type is required (meeting_processed or drafts_ready)" },
        { status: 400 }
      );
    }

    const meeting = await meetings.getMeetingById(accountId, meetingId);
    if (!meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    // Determine recipient email
    const hostEmail = recipientEmail || meeting.host_email;
    if (!hostEmail) {
      return NextResponse.json(
        { error: "No recipient email provided and meeting has no host_email" },
        { status: 400 }
      );
    }

    let customer = null;
    if (meeting.customer_id) {
      customer = await customers.getCustomerById(accountId, meeting.customer_id);
    }

    let result;

    switch (notificationType) {
      case "meeting_processed": {
        const meetingExtracts = await extracts.getExtractsByMeetingId(accountId, meetingId);
        const actionItemCount = meetingExtracts.filter((e) => e.is_action_item).length;

        result = await sendMeetingProcessedNotification(
          hostEmail,
          meeting,
          customer,
          meetingExtracts.length,
          actionItemCount
        );
        break;
      }

      case "drafts_ready": {
        const drafts = await emailDrafts.getEmailDraftsByMeetingId(accountId, meetingId);
        if (drafts.length === 0) {
          return NextResponse.json(
            { error: "No email drafts found for this meeting" },
            { status: 400 }
          );
        }

        result = await sendDraftReadyNotification(
          hostEmail,
          meeting,
          customer,
          drafts
        );
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown notification type: ${notificationType}` },
          { status: 400 }
        );
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: `Notification sent to ${hostEmail}`,
      });
    } else {
      return NextResponse.json(
        { error: result.error || "Failed to send notification" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error sending notification:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
