import { meetings, customers } from "@/lib/db";

/**
 * Internal organization domain. Meetings whose participants are *all* from this domain
 * are flagged as internal and filtered out of sync results.
 *
 * Set via the INTERNAL_DOMAIN env var. If unset, internal-meeting detection is disabled
 * (no meetings will be marked internal) — this is the right default for a multi-tenant
 * deploy where the value should come from each account's settings instead.
 */
const INTERNAL_DOMAIN = process.env.INTERNAL_DOMAIN?.toLowerCase() ?? null;

const COMMON_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "mail.com",
  "yandex.com",
  "fastmail.com",
]);

interface MatchResult {
  customerId: string | null;
  isInternal: boolean;
  /** Business email domains found that could be used for matching (excludes common providers) */
  unmatchedDomains: string[];
}

export function isInternalMeeting(emails: string[]): boolean {
  if (!INTERNAL_DOMAIN || emails.length === 0) {
    return false;
  }
  return emails.every((email) => {
    const domain = email.split("@")[1]?.toLowerCase();
    return domain === INTERNAL_DOMAIN;
  });
}

export async function matchMeetingToCompanyByParticipants(
  accountId: string,
  meetingId: string
): Promise<MatchResult> {
  const meeting = await meetings.getMeetingById(accountId, meetingId);
  if (!meeting) {
    return { customerId: null, isInternal: false, unmatchedDomains: [] };
  }

  const participants = await meetings.getMeetingParticipantsWithDetails(accountId, meetingId);
  const participantEmails = participants
    .filter((p) => p.email)
    .map((p) => p.email!);

  return matchMeetingToCompanyByEmailsInternal(accountId, meetingId, participantEmails, meeting.customer_id);
}

export async function matchMeetingToCompanyByEmails(
  accountId: string,
  meetingId: string,
  emails: string[]
): Promise<MatchResult> {
  const meeting = await meetings.getMeetingById(accountId, meetingId);
  if (!meeting) {
    return { customerId: null, isInternal: false, unmatchedDomains: [] };
  }

  return matchMeetingToCompanyByEmailsInternal(accountId, meetingId, emails, meeting.customer_id);
}

async function matchMeetingToCompanyByEmailsInternal(
  accountId: string,
  meetingId: string,
  emails: string[],
  existingCustomerId: string | null
): Promise<MatchResult> {
  const emailDomains: string[] = [];
  let allInternal = INTERNAL_DOMAIN !== null && emails.length > 0;

  for (const email of emails) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) continue;

    if (INTERNAL_DOMAIN === null || domain !== INTERNAL_DOMAIN) {
      allInternal = false;
    }

    if (!COMMON_EMAIL_DOMAINS.has(domain) && domain !== INTERNAL_DOMAIN && !emailDomains.includes(domain)) {
      emailDomains.push(domain);
    }
  }

  const updates: { customer_id?: string; is_internal?: boolean } = {};

  if (allInternal && emails.length > 0) {
    updates.is_internal = true;
  }

  let matchedCustomerId: string | null = existingCustomerId;
  const unmatchedDomains: string[] = [];

  if (!existingCustomerId && emailDomains.length > 0) {
    for (const domain of emailDomains) {
      const matchedCompany = await customers.getCustomerByDomain(accountId, domain);
      if (matchedCompany) {
        updates.customer_id = matchedCompany.id;
        matchedCustomerId = matchedCompany.id;
        unmatchedDomains.length = 0;
        break;
      } else {
        unmatchedDomains.push(domain);
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await meetings.updateMeeting(accountId, meetingId, updates);
  }

  return {
    customerId: matchedCustomerId,
    isInternal: updates.is_internal || false,
    unmatchedDomains,
  };
}
