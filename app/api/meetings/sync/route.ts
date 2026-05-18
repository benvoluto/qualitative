import { NextRequest, NextResponse } from "next/server";
import { requireAccountContext } from "@/lib/account-context";
import { fetchGoogleMeetings, syncMeetingWithAttendees, GoogleMeetEvent } from "@/lib/google/meetings";
import { users, meetings, personnel } from "@/lib/db";
import { matchMeetingToCompanyByEmails, isInternalMeeting, ensureCompaniesAreSynced } from "@/lib/meetings";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { accountId, userId } = await requireAccountContext();

    const user = await users.getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.google_access_token) {
      return NextResponse.json(
        { error: "Google account not connected. Please sign out and sign in again." },
        { status: 400 }
      );
    }

    // Parse request body for optional parameters
    let days = 7;
    let skipExternalIds: string[] = [];
    try {
      const body = await request.json();
      if (body.days && typeof body.days === "number") {
        days = Math.min(Math.max(body.days, 1), 30); // Limit to 1-30 days
      }
      if (Array.isArray(body.skipExternalIds)) {
        skipExternalIds = body.skipExternalIds;
      }
    } catch {
      // Use defaults if no body or invalid JSON
    }

    const companySyncResult = await ensureCompaniesAreSynced(accountId, 1);

    // Fetch meetings from Google
    const googleMeetings = await fetchGoogleMeetings(user.id, days);

    let synced = 0;
    let existing = 0;
    let skipped = 0;
    let internalSkipped = 0;
    let transcriptsFound = 0;
    let transcriptDownloadFailed = 0;
    const errors: string[] = [];
    const unmatchedMeetings: Array<{
      id: string;
      name: string;
      date: string | null;
      domains: string[];
    }> = [];

    for (const event of googleMeetings) {
      try {
        // Skip if in skip list (user explicitly deselected this meeting)
        if (skipExternalIds.includes(event.id)) {
          skipped++;
          continue;
        }

        // Get participant emails (excluding organizer) for internal check
        const participantEmails = event.attendees
          .filter((a) => !a.isOrganizer && a.email !== event.organizerEmail)
          .map((a) => a.email);

        // Include organizer email in internal check (all attendees must be internal)
        const allAttendeeEmails = event.organizerEmail
          ? [...participantEmails, event.organizerEmail]
          : participantEmails;

        // Check if this is an internal meeting (for tracking and marking)
        const isInternal = isInternalMeeting(allAttendeeEmails);

        const existingMeeting = await meetings.getMeetingByExternalId(accountId, event.id);
        if (existingMeeting) {
          await updateMeetingParticipants(existingMeeting.id, event);

          if (!existingMeeting.customer_id) {
            await matchMeetingToCompanyByEmails(accountId, existingMeeting.id, participantEmails);
          }

          existing++;
          continue;
        }

        const syncResult = await syncMeetingWithAttendees(accountId, event, personnel, user.id);
        const newMeeting = syncResult.meeting;

        if (syncResult.transcriptFound) transcriptsFound++;
        if (syncResult.transcriptFailed) transcriptDownloadFailed++;

        if (isInternal) {
          await meetings.updateMeeting(accountId, newMeeting.id, { is_internal: true });
          internalSkipped++;
        }

        if (!isInternal) {
          const matchResult = await matchMeetingToCompanyByEmails(accountId, newMeeting.id, participantEmails);

          // Track unmatched meetings for user notification
          if (!matchResult.customerId && matchResult.unmatchedDomains.length > 0) {
            unmatchedMeetings.push({
              id: newMeeting.id,
              name: newMeeting.name || event.summary || "Untitled Meeting",
              date: event.start?.toISOString() || null,
              domains: matchResult.unmatchedDomains,
            });
          }
        }

        synced++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Failed to sync meeting ${event.id}: ${message}`);
      }
    }

    async function updateMeetingParticipants(meetingId: string, event: GoogleMeetEvent) {
      const existingParticipants = await meetings.getMeetingParticipantsWithDetails(accountId, meetingId);
      if (existingParticipants.length > 0) return;

      const meeting = await meetings.getMeetingById(accountId, meetingId);
      if (meeting && (!meeting.host_name || !meeting.host_email)) {
        const updates: { host_name?: string; host_email?: string } = {};
        if (!meeting.host_name && event.organizerName) updates.host_name = event.organizerName;
        if (!meeting.host_email && event.organizerEmail) updates.host_email = event.organizerEmail;
        if (Object.keys(updates).length > 0) {
          await meetings.updateMeeting(accountId, meetingId, updates);
        }
      }

      for (const attendee of event.attendees) {
        const isOrganizer = attendee.isOrganizer ||
          (event.organizerEmail && attendee.email.toLowerCase() === event.organizerEmail.toLowerCase());
        if (isOrganizer) continue;

        try {
          let personnelRecord = await personnel.getPersonnelByEmail(accountId, attendee.email);
          if (!personnelRecord) {
            const name = attendee.displayName || attendee.email.split("@")[0];
            personnelRecord = await personnel.createPersonnel(accountId, {
              name,
              email: attendee.email,
            });
          }
          await meetings.addMeetingParticipant(accountId, meetingId, personnelRecord.id);
        } catch (error) {
          console.error(`Failed to add attendee ${attendee.email}:`, error);
        }
      }
    }

    // Gather some diagnostic info
    const sampleEvent = googleMeetings[0];
    const diagnostics = {
      totalMeetingsFromGoogle: googleMeetings.length,
      sampleMeetingHasAttendees: sampleEvent ? sampleEvent.attendees.length : 0,
      sampleOrganizerEmail: sampleEvent?.organizerEmail || null,
      sampleOrganizerName: sampleEvent?.organizerName || null,
    };

    // Build message with details
    let message = `Synced ${synced} new meetings (${existing} already existed, ${skipped} skipped`;
    if (internalSkipped > 0) {
      message += `, ${internalSkipped} internal`;
    }
    message += ")";
    if (transcriptDownloadFailed > 0) {
      message += ` (${transcriptDownloadFailed} transcript download failed)`;
    }

    return NextResponse.json({
      success: true,
      synced,
      existing,
      skipped,
      internalSkipped,
      transcriptsFound,
      transcriptDownloadFailed,
      errors,
      diagnostics,
      companySyncPerformed: companySyncResult.performed,
      companiesSynced: companySyncResult.result?.synced || 0,
      unmatchedMeetings,
      message,
    });
  } catch (error) {
    console.error("Meeting sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to sync meetings", details: message },
      { status: 500 }
    );
  }
}
