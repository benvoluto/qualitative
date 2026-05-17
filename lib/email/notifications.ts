// Meeting notification emails

import { sendEmail, isMailjetConfigured } from "./mailjet";
import { Meeting, Customer, EmailDraft } from "@/lib/db/types";
import { GeneratedCRMNote } from "@/lib/gemini/email-generation";
import { marked } from "marked";

interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a meeting processed notification to the meeting host
 */
export async function sendMeetingProcessedNotification(
  hostEmail: string,
  meeting: Meeting,
  customer: Customer | null,
  extractCount: number,
  actionItemCount: number
): Promise<NotificationResult> {
  if (!isMailjetConfigured()) {
    return {
      success: false,
      error: "Email notifications are not configured",
    };
  }

  const meetingName = meeting.name || "Meeting";
  const meetingDate = meeting.meeting_date
    ? new Date(meeting.meeting_date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown date";

  const subject = `Meeting Processed: ${meetingName}`;

  const textBody = `
Your meeting has been processed and insights have been extracted.

Meeting: ${meetingName}
Date: ${meetingDate}
Customer: ${customer?.name || "Not linked"}
Customer Type: ${customer?.customer_type || "N/A"}

Results:
- ${extractCount} insight(s) extracted
- ${actionItemCount} action item(s) identified

Next Steps:
1. Review the extracted insights in the Qualitative app
2. Generate follow-up emails if needed
3. Create Linear tickets for feature requests or bugs (customer meetings only)
4. Write notes to HubSpot CRM

View meeting: ${process.env.NEXT_PUBLIC_APP_URL || "https://qualitative-wheat.vercel.app"}/meetings/${meeting.id}

---
Qualitative - Meeting Insights Platform
  `.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .stats { display: flex; gap: 16px; margin: 16px 0; }
    .stat { background: white; padding: 12px 16px; border-radius: 8px; border: 1px solid #e5e7eb; flex: 1; }
    .stat-value { font-size: 24px; font-weight: bold; color: #4F46E5; }
    .stat-label { font-size: 12px; color: #6b7280; }
    .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px; }
    .footer { padding: 16px 20px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">Meeting Processed</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">${meetingName}</p>
    </div>
    <div class="content">
      <p>Your meeting has been processed and insights have been extracted.</p>

      <table style="width: 100%; margin: 16px 0;">
        <tr>
          <td style="color: #6b7280;">Date:</td>
          <td style="font-weight: 500;">${meetingDate}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Customer:</td>
          <td style="font-weight: 500;">${customer?.name || "Not linked"}</td>
        </tr>
        ${customer?.customer_type ? `
        <tr>
          <td style="color: #6b7280;">Type:</td>
          <td>
            <span style="background: ${customer.customer_type === "deal" ? "#ddd6fe" : "#dbeafe"}; color: ${customer.customer_type === "deal" ? "#7c3aed" : "#2563eb"}; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">
              ${customer.customer_type === "deal" ? "Deal" : "Customer"}
            </span>
          </td>
        </tr>
        ` : ""}
      </table>

      <div class="stats">
        <div class="stat">
          <div class="stat-value">${extractCount}</div>
          <div class="stat-label">Insights Extracted</div>
        </div>
        <div class="stat">
          <div class="stat-value">${actionItemCount}</div>
          <div class="stat-label">Action Items</div>
        </div>
      </div>

      <h3 style="margin-top: 24px; font-size: 14px; color: #374151;">Next Steps:</h3>
      <ul style="margin: 8px 0; padding-left: 20px; color: #4b5563;">
        <li>Review the extracted insights</li>
        <li>Generate follow-up emails</li>
        ${customer?.customer_type === "customer" ? "<li>Create Linear tickets for feature requests or bugs</li>" : ""}
        <li>Write notes to HubSpot CRM</li>
      </ul>

      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://qualitative-wheat.vercel.app"}/meetings/${meeting.id}" class="button">
        View Meeting
      </a>
    </div>
    <div class="footer">
      Qualitative - Meeting Insights Platform
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to: hostEmail,
    subject,
    text: textBody,
    html: htmlBody,
  });
}

/**
 * Send email draft notification to the meeting host
 */
export async function sendDraftReadyNotification(
  hostEmail: string,
  meeting: Meeting,
  customer: Customer | null,
  drafts: EmailDraft[]
): Promise<NotificationResult> {
  if (!isMailjetConfigured()) {
    return {
      success: false,
      error: "Email notifications are not configured",
    };
  }

  const meetingName = meeting.name || "Meeting";
  const subject = `Email Drafts Ready: ${meetingName}`;

  const draftsText = drafts.map((draft) => {
    const typeLabel = draft.draft_type === "follow_up"
      ? "Follow-up Email"
      : draft.draft_type === "action_items"
      ? "Action Items Summary"
      : draft.draft_type === "meeting_notes"
      ? "Meeting Notes"
      : draft.draft_type;
    return `--- ${typeLabel} ---
${draft.subject ? `Subject: ${draft.subject}\n` : ""}
${draft.body || "(No content)"}`;
  }).join("\n\n");

  const textBody = `
Email drafts are ready for your review.

Meeting: ${meetingName}
Customer: ${customer?.name || "Not linked"}

${draftsText}

---

Review and edit in the app: ${process.env.NEXT_PUBLIC_APP_URL || "https://qualitative-wheat.vercel.app"}/meetings/${meeting.id}

---
Qualitative - Meeting Insights Platform
  `.trim();

  // Convert draft bodies to HTML
  const draftsWithHtml = drafts.map((draft) => ({
    ...draft,
    bodyHtml: draft.body ? (marked.parse(draft.body) as string) : "",
  }));

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .draft-list { margin: 16px 0; }
    .draft-item { background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 16px; }
    .draft-type { font-weight: 600; color: #059669; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .draft-subject { font-weight: 500; color: #111827; font-size: 15px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb; }
    .draft-body { font-size: 14px; line-height: 1.7; color: #374151; }
    .draft-body h1, .draft-body h2, .draft-body h3 { margin-top: 16px; margin-bottom: 8px; color: #1f2937; }
    .draft-body h1 { font-size: 18px; }
    .draft-body h2 { font-size: 16px; }
    .draft-body h3 { font-size: 14px; }
    .draft-body p { margin: 8px 0; }
    .draft-body ul, .draft-body ol { margin: 8px 0; padding-left: 24px; }
    .draft-body li { margin: 4px 0; }
    .draft-body strong { font-weight: 600; }
    .button { display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px; }
    .footer { padding: 16px 20px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">Email Drafts Ready</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">${meetingName}</p>
    </div>
    <div class="content">
      <p>Email drafts have been generated and are ready for your review.</p>

      <p style="color: #6b7280; margin-top: 16px;">
        Customer: <strong>${customer?.name || "Not linked"}</strong>
      </p>

      <div class="draft-list">
        ${draftsWithHtml
          .map(
            (draft) => `
          <div class="draft-item">
            <div class="draft-type">
              ${
                draft.draft_type === "follow_up"
                  ? "Follow-up Email"
                  : draft.draft_type === "action_items"
                  ? "Action Items Summary"
                  : draft.draft_type === "meeting_notes"
                  ? "Meeting Notes"
                  : draft.draft_type
              }
            </div>
            ${draft.subject ? `<div class="draft-subject">Subject: ${draft.subject}</div>` : ""}
            <div class="draft-body">${draft.bodyHtml}</div>
          </div>
        `
          )
          .join("")}
      </div>

      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://qualitative-wheat.vercel.app"}/meetings/${meeting.id}" class="button">
        Review & Edit in App
      </a>
    </div>
    <div class="footer">
      Qualitative - Meeting Insights Platform
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to: hostEmail,
    subject,
    text: textBody,
    html: htmlBody,
  });
}

/**
 * Send meeting notes ready notification to the user
 */
export async function sendNotesReadyNotification(
  toEmail: string,
  meeting: Meeting,
  customer: Customer | null,
  notes: string
): Promise<NotificationResult> {
  if (!isMailjetConfigured()) {
    return {
      success: false,
      error: "Email notifications are not configured",
    };
  }

  const meetingName = meeting.name || "Meeting";
  const meetingDate = meeting.meeting_date
    ? new Date(meeting.meeting_date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown date";

  const subject = `Meeting Notes Ready: ${meetingName}`;

  const textBody = `
Meeting notes have been generated and are ready for your review.

Meeting: ${meetingName}
Date: ${meetingDate}
Customer: ${customer?.name || "Not linked"}

--- Notes ---

${notes}

---

View meeting: ${process.env.NEXT_PUBLIC_APP_URL || "https://qualitative-wheat.vercel.app"}/meetings/${meeting.id}

---
Qualitative - Meeting Insights Platform
  `.trim();

  // Convert markdown notes to HTML
  const notesHtml = marked.parse(notes) as string;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #7c3aed; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .notes-section { background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 16px 0; font-size: 14px; line-height: 1.7; }
    .notes-section h1, .notes-section h2, .notes-section h3 { margin-top: 16px; margin-bottom: 8px; color: #1f2937; }
    .notes-section h1 { font-size: 18px; }
    .notes-section h2 { font-size: 16px; }
    .notes-section h3 { font-size: 14px; }
    .notes-section p { margin: 8px 0; }
    .notes-section ul, .notes-section ol { margin: 8px 0; padding-left: 24px; }
    .notes-section li { margin: 4px 0; }
    .notes-section strong { font-weight: 600; }
    .notes-section code { background: #f3f4f6; padding: 2px 4px; border-radius: 3px; font-size: 13px; }
    .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px; }
    .footer { padding: 16px 20px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">Meeting Notes Ready</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">${meetingName}</p>
    </div>
    <div class="content">
      <p>Meeting notes have been generated and are ready for your review.</p>

      <table style="width: 100%; margin: 16px 0;">
        <tr>
          <td style="color: #6b7280;">Date:</td>
          <td style="font-weight: 500;">${meetingDate}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Customer:</td>
          <td style="font-weight: 500;">${customer?.name || "Not linked"}</td>
        </tr>
      </table>

      <h3 style="margin-top: 24px; font-size: 14px; color: #374151;">Notes:</h3>
      <div class="notes-section">${notesHtml}</div>

      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://qualitative-wheat.vercel.app"}/meetings/${meeting.id}" class="button">
        View Meeting
      </a>
    </div>
    <div class="footer">
      Qualitative - Meeting Insights Platform
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to: toEmail,
    subject,
    text: textBody,
    html: htmlBody,
  });
}

/**
 * Send CRM notes written notification
 */
export async function sendCRMNotesWrittenNotification(
  hostEmail: string,
  meeting: Meeting,
  customer: Customer | null,
  crmNotes: GeneratedCRMNote
): Promise<NotificationResult> {
  if (!isMailjetConfigured()) {
    return {
      success: false,
      error: "Email notifications are not configured",
    };
  }

  const meetingName = meeting.name || "Meeting";

  const featureRequestCount = crmNotes.sections.featureRequests?.length || 0;
  const bugCount = crmNotes.sections.bugsAndIssues?.length || 0;
  const actionItemCount = crmNotes.sections.actionItems?.length || 0;

  const subject = `CRM Notes Updated: ${meetingName}`;

  const textBody = `
CRM notes have been written to HubSpot.

Meeting: ${meetingName}
Customer: ${customer?.name || "Not linked"}

Summary:
${crmNotes.summary}

${featureRequestCount > 0 ? `Feature Requests: ${featureRequestCount}` : ""}
${bugCount > 0 ? `Bug Reports: ${bugCount}` : ""}
${actionItemCount > 0 ? `Action Items: ${actionItemCount}` : ""}

View in HubSpot or review in the Qualitative app.

---
Qualitative - Meeting Insights Platform
  `.trim();

  return sendEmail({
    to: hostEmail,
    subject,
    text: textBody,
  });
}
