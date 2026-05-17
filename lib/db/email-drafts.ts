import { getDb } from "./client";
import {
  EmailDraft,
  CreateEmailDraft,
  UpdateEmailDraft,
  EmailDraftStatus,
} from "./types";

export async function getEmailDraftById(id: string): Promise<EmailDraft | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM email_drafts WHERE id = ${id}`;
  return (result[0] as EmailDraft) || null;
}

export async function getEmailDraftsByMeetingId(
  meetingId: string
): Promise<EmailDraft[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM email_drafts
    WHERE meeting_id = ${meetingId}
    ORDER BY created_at DESC
  `;
  return result as EmailDraft[];
}

export async function getEmailDraftsByStatus(
  status: EmailDraftStatus
): Promise<EmailDraft[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM email_drafts
    WHERE status = ${status}
    ORDER BY created_at DESC
  `;
  return result as EmailDraft[];
}

export async function createEmailDraft(
  data: CreateEmailDraft
): Promise<EmailDraft> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO email_drafts (
      meeting_id, draft_type, subject, body, recipient_email, recipient_name, status
    )
    VALUES (
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
  id: string,
  data: UpdateEmailDraft
): Promise<EmailDraft | null> {
  const sql = getDb();

  // Get current draft to merge with updates
  const current = await getEmailDraftById(id);
  if (!current) return null;

  const result = await sql`
    UPDATE email_drafts SET
      subject = ${data.subject !== undefined ? data.subject : current.subject},
      body = ${data.body !== undefined ? data.body : current.body},
      recipient_email = ${data.recipient_email !== undefined ? data.recipient_email : current.recipient_email},
      recipient_name = ${data.recipient_name !== undefined ? data.recipient_name : current.recipient_name},
      status = ${data.status ?? current.status},
      sent_at = ${data.sent_at !== undefined ? data.sent_at : current.sent_at}
    WHERE id = ${id}
    RETURNING *
  `;

  return (result[0] as EmailDraft) || null;
}

export async function deleteEmailDraft(id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM email_drafts WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

export async function markEmailDraftAsSent(id: string): Promise<EmailDraft | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE email_drafts SET
      status = 'sent',
      sent_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as EmailDraft) || null;
}

export async function markEmailDraftAsDiscarded(
  id: string
): Promise<EmailDraft | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE email_drafts SET status = 'discarded'
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as EmailDraft) || null;
}

/**
 * Transfers all email drafts from one meeting to another.
 * Used during deduplication to preserve drafts before deleting a duplicate meeting.
 *
 * @param fromMeetingId The meeting ID to transfer drafts from
 * @param toMeetingId The meeting ID to transfer drafts to
 * @returns Number of drafts transferred
 */
export async function transferEmailDraftsToMeeting(
  fromMeetingId: string,
  toMeetingId: string
): Promise<number> {
  const sql = getDb();
  const result = await sql`
    UPDATE email_drafts
    SET meeting_id = ${toMeetingId}, updated_at = NOW()
    WHERE meeting_id = ${fromMeetingId}
    RETURNING id
  `;
  return result.length;
}
