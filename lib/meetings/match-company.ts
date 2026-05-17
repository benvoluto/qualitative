import { meetings, customers } from "@/lib/db";

// Internal organization domain - meetings with only participants from this domain are marked as internal
const INTERNAL_DOMAIN = "markerlearning.com";

// Common email providers to skip when matching companies
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

/**
 * Checks if a meeting is internal based on participant emails.
 * A meeting is internal if ALL participants have the markerlearning.com domain.
 * Returns false if there are no emails to check.
 */
export function isInternalMeeting(emails: string[]): boolean {
  if (emails.length === 0) {
    return false;
  }
  return emails.every((email) => {
    const domain = email.split("@")[1]?.toLowerCase();
    return domain === INTERNAL_DOMAIN;
  });
}

/**
 * Attempts to match a meeting to a company based on participant email domains.
 * Also detects if a meeting is internal (all participants from markerlearning.com).
 *
 * If a meeting doesn't have a customer_id set, this function will:
 * 1. Get the meeting's participants
 * 2. Extract their email domains
 * 3. Check if all participants are internal (markerlearning.com)
 * 4. Look for matching companies in the database
 * 5. Update the meeting with the matched company_id and/or is_internal flag
 *
 * Returns the matched customer_id if found and whether the meeting is internal.
 */
export async function matchMeetingToCompanyByParticipants(
  meetingId: string
): Promise<MatchResult> {
  // Get the meeting
  const meeting = await meetings.getMeetingById(meetingId);
  if (!meeting) {
    return { customerId: null, isInternal: false, unmatchedDomains: [] };
  }

  // Get meeting participants with their details
  const participants = await meetings.getMeetingParticipantsWithDetails(meetingId);

  // Extract emails from participants
  const participantEmails = participants
    .filter((p) => p.email)
    .map((p) => p.email!);

  return matchMeetingToCompanyByEmailsInternal(meetingId, participantEmails, meeting.customer_id);
}

/**
 * Attempts to match a meeting to a company using a list of email addresses.
 * Also detects if a meeting is internal (all participants from markerlearning.com).
 * Useful when participant data is available during sync but not yet saved to DB.
 *
 * Returns the matched customer_id if found and whether the meeting is internal.
 */
export async function matchMeetingToCompanyByEmails(
  meetingId: string,
  emails: string[]
): Promise<MatchResult> {
  // Get the meeting
  const meeting = await meetings.getMeetingById(meetingId);
  if (!meeting) {
    return { customerId: null, isInternal: false, unmatchedDomains: [] };
  }

  return matchMeetingToCompanyByEmailsInternal(meetingId, emails, meeting.customer_id);
}

/**
 * Internal implementation for matching company and detecting internal meetings
 */
async function matchMeetingToCompanyByEmailsInternal(
  meetingId: string,
  emails: string[],
  existingCustomerId: string | null
): Promise<MatchResult> {
  // Extract domains from emails
  const emailDomains: string[] = [];
  let allInternal = emails.length > 0; // Assume internal if there are any emails

  for (const email of emails) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) continue;

    // Check if this is an internal domain
    if (domain !== INTERNAL_DOMAIN) {
      allInternal = false;
    }

    // Collect business domains (skip common email providers and internal domain)
    if (!COMMON_EMAIL_DOMAINS.has(domain) && domain !== INTERNAL_DOMAIN && !emailDomains.includes(domain)) {
      emailDomains.push(domain);
    }
  }

  // Build update object
  const updates: { customer_id?: string; is_internal?: boolean } = {};

  // Mark as internal if all participants are from internal domain
  if (allInternal && emails.length > 0) {
    updates.is_internal = true;
  }

  // Try to match a company if we don't already have one
  let matchedCustomerId: string | null = existingCustomerId;
  const unmatchedDomains: string[] = [];

  if (!existingCustomerId && emailDomains.length > 0) {
    for (const domain of emailDomains) {
      const matchedCompany = await customers.getCustomerByDomain(domain);
      if (matchedCompany) {
        updates.customer_id = matchedCompany.id;
        matchedCustomerId = matchedCompany.id;
        // Clear unmatched domains since we found a match
        unmatchedDomains.length = 0;
        break;
      } else {
        // Track domains that couldn't be matched
        unmatchedDomains.push(domain);
      }
    }
  }

  // Update the meeting if we have any updates
  if (Object.keys(updates).length > 0) {
    await meetings.updateMeeting(meetingId, updates);
  }

  return {
    customerId: matchedCustomerId,
    isInternal: updates.is_internal || false,
    unmatchedDomains,
  };
}
