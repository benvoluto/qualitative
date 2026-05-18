import { getDb } from "./client";
import {
  EmailDraft,
  CreateEmailDraft,
  UpdateEmailDraft,
  EmailDraftStatus,
} from "./types";

export async function getEmailDraftById(accountId: string, id: string): Promise<EmailDraft | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM email_drafts WHERE id = ${id} AND account_id = ${accountId}`;
  return (result[0] as EmailDraft) || null;
}

export async function getEmailDraftsByMeetingId(
  accountId: string,
  meetingId: string
): Promise<EmailDraft[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM email_drafts
    WHERE meeting_id = ${meetingId} AND account_id = ${accountId}
    ORDER BY created_at DESC
  `;
  return result as EmailDraft[];
}

export async function getEmailDraftsByStatus(
  accountId: string,
  status: EmailDraftStatus
): Promise<EmailDraft[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM email_drafts
    WHERE status = ${status} AND account_id = ${accountId}
    ORDER BY created_at DESC
  `;
  return result as EmailDraft[];
}

export async function createEmailDraft(
  accountId: string,
  data: CreateEmailDraft
): Promise<EmailDraft> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO email_drafts (
      account_id, meeting_id, draft_type, subject, body, recipient_email, recipient_name, status
    )
    VALUES (
      ${accountId},
      ${data.meeting_id},
      ${data.draft_type},
      ${data.subject ?? null},
      ${data.body ?? null},
      ${data.recipient_email ?? null},
      ${data.recipient_name ?? null},
      ${data.status ?? "draft"}
    )
    RETURNING *
  `;
  return result[0] as EmailDraft;
}

export async function updateEmailDraft(
  accountId: string,
  id: string,
  data: UpdateEmailDraft
): Promise<EmailDraft | null> {
  const sql = getDb();

  const current = await getEmailDraftById(accountId, id);
  if (!current) return null;

  const result = await sql`
    UPDATE email_drafts SET
      subject = ${data.subject !== undefined ? data.subject : current.subject},
      body = ${data.body !== undefined ? data.body : current.body},
      recipient_email = ${data.recipient_email !== undefined ? data.recipient_email : current.recipient_email},
      recipient_name = ${data.recipient_name !== undefined ? data.recipient_name : current.recipient_name},
      status = ${data.status ?? current.status},
      sent_at = ${data.sent_at !== undefined ? data.sent_at : current.sent_at}
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;

  return (result[0] as EmailDraft) || null;
}

export async function deleteEmailDraft(accountId: string, id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM email_drafts WHERE id = ${id} AND account_id = ${accountId} RETURNING id`;
  return result.length > 0;
}

export async function markEmailDraftAsSent(accountId: string, id: string): Promise<EmailDraft | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE email_drafts SET
      status = 'sent',
      sent_at = NOW()
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  return (result[0] as EmailDraft) || null;
}

export async function markEmailDraftAsDiscarded(
  accountId: string,
  id: string
): Promise<EmailDraft | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE email_drafts SET status = 'discarded'
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  return (result[0] as EmailDraft) || null;
}

/**
 * Transfers all email drafts from one meeting to another within the same account.
 * Used during deduplication to preserve drafts before deleting a duplicate meeting.
 */
export async function transferEmailDraftsToMeeting(
  accountId: string,
  fromMeetingId: string,
  toMeetingId: string
): Promise<number> {
  const sql = getDb();
  const result = await sql`
    UPDATE email_drafts
    SET meeting_id = ${toMeetingId}, updated_at = NOW()
    WHERE meeting_id = ${fromMeetingId} AND account_id = ${accountId}
    RETURNING id
  `;
  return result.length;
}
