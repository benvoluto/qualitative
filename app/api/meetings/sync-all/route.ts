import { NextRequest, NextResponse } from "next/server";
import { requireAccountContext } from "@/lib/account-context";
import { users, extracts, emailDrafts } from "@/lib/db";
import { fetchGoogleMeetings, syncMeetingWithAttendees, GoogleMeetEvent } from "@/lib/google/meetings";
import { meetings, personnel } from "@/lib/db";
import { matchMeetingToCompanyByEmails, isInternalMeeting, ensureCompaniesAreSynced } from "@/lib/meetings";
import { getUserZoomMeetingsForSync, syncUserZoomMeetingToDatabase, getZoomMeetingParticipants, ZoomReauthRequiredError } from "@/lib/zoom";
import { isMicrosoftConfigured, userHasMicrosoftTokens, getTeamsMeetingsForSync, syncTeamsMeetingToDatabase } from "@/lib/teams";
import { DeduplicationResult } from "@/lib/db/meetings";
import { features } from "@/lib/features";

export const maxDuration = 300;

interface SyncResult {
  synced: number;
  existing: number;
  skipped: number;
  errors: string[];
}

interface SyncAllResponse {
  success: boolean;
  google: SyncResult | null;
  hubspot: SyncResult | null;
  zoom: SyncResult | null;
  teams: SyncResult | null;
  deduplication: DeduplicationResult | null;
  totalSynced: number;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    const { accountId, userId } = await requireAccountContext();

    const user = await users.getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let days = 14;
    try {
      const body = await request.json();
      if (body.days && typeof body.days === "number") {
        days = Math.min(Math.max(body.days, 1), 30);
      }
    } catch {
      // Use defaults
    }

    await ensureCompaniesAreSynced(accountId, 1);

    const response: SyncAllResponse = {
      success: true,
      google: null,
      hubspot: null,
      zoom: null,
      teams: null,
      deduplication: null,
      totalSynced: 0,
      message: "",
    };

    if (user.google_access_token) {
      response.google = await syncGoogleMeetings(accountId, user.id, days);
      response.totalSynced += response.google.synced;
    }

    if (features.zoom) {
      const hasZoom = await users.hasZoomConnected(user.id);
      if (hasZoom) {
        response.zoom = await syncZoomMeetings(accountId, user.id, days);
        response.totalSynced += response.zoom.synced;
      }
    }

    if (features.teams && isMicrosoftConfigured()) {
      const hasTeamsTokens = await userHasMicrosoftTokens(user.id);
      if (hasTeamsTokens) {
        response.teams = await syncTeamsMeetings(accountId, user.id, days);
        response.totalSynced += response.teams.synced;
      }
    }

    response.deduplication = await meetings.deduplicateMeetings(
      accountId,
      days,
      extracts.transferExtractsToMeeting,
      emailDrafts.transferEmailDraftsToMeeting,
      extracts.getExtractCountByMeetingId
    );

    const syncedSources: string[] = [];
    if (response.google?.synced) syncedSources.push(`${response.google.synced} from Google`);
    if (response.hubspot?.synced) syncedSources.push(`${response.hubspot.synced} from HubSpot`);
    if (response.zoom?.synced) syncedSources.push(`${response.zoom.synced} from Zoom`);
    if (response.teams?.synced) syncedSources.push(`${response.teams.synced} from Teams`);

    response.message = response.totalSynced > 0
      ? `Synced ${response.totalSynced} meeting(s): ${syncedSources.join(", ")}`
      : "No new meetings to sync";

    return NextResponse.json(response);
  } catch (error) {
    console.error("Sync-all error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to sync meetings", details: message },
      { status: 500 }
    );
  }
}

async function syncGoogleMeetings(accountId: string, userId: string, days: number): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, existing: 0, skipped: 0, errors: [] };

  try {
    const googleMeetings = await fetchGoogleMeetings(userId, days);

    for (const event of googleMeetings) {
      try {
        const participantEmails = event.attendees
          .filter((a) => !a.isOrganizer && a.email !== event.organizerEmail)
          .map((a) => a.email);
        const allAttendeeEmails = event.organizerEmail
          ? [...participantEmails, event.organizerEmail]
          : participantEmails;

        if (isInternalMeeting(allAttendeeEmails)) {
          result.skipped++;
          continue;
        }

        const existingMeeting = await meetings.getMeetingByExternalId(accountId, event.id);
        if (existingMeeting) {
          await updateMeetingParticipantsIfNeeded(accountId, existingMeeting.id, event);
          if (!existingMeeting.customer_id) {
            await matchMeetingToCompanyByEmails(accountId, existingMeeting.id, participantEmails);
          }
          result.existing++;
          continue;
        }

        const syncResult = await syncMeetingWithAttendees(accountId, event, personnel, userId);
        await matchMeetingToCompanyByEmails(accountId, syncResult.meeting.id, participantEmails);
        result.synced++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`Google meeting ${event.id}: ${message}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(`Google sync failed: ${message}`);
  }

  return result;
}

async function updateMeetingParticipantsIfNeeded(
  accountId: string,
  meetingId: string,
  event: GoogleMeetEvent
): Promise<void> {
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
        personnelRecord = await personnel.createPersonnel(accountId, { name, email: attendee.email });
      }
      await meetings.addMeetingParticipant(accountId, meetingId, personnelRecord.id);
    } catch (error) {
      console.error(`Failed to add attendee ${attendee.email}:`, error);
    }
  }
}

async function syncZoomMeetings(accountId: string, userId: string, days: number): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, existing: 0, skipped: 0, errors: [] };

  try {
    const zoomMeetings = await getUserZoomMeetingsForSync(accountId, userId, days);

    for (const zoomMeeting of zoomMeetings) {
      if (zoomMeeting.alreadySynced) {
        result.existing++;
        continue;
      }

      try {
        let participantEmails: string[] = [];
        try {
          const participants = await getZoomMeetingParticipants(userId, zoomMeeting.uuid);
          participantEmails = participants.filter((p) => p.user_email).map((p) => p.user_email);
        } catch {
          // Continue with host email only
        }

        const allEmails = zoomMeeting.hostEmail
          ? [...participantEmails, zoomMeeting.hostEmail]
          : participantEmails;

        if (isInternalMeeting(allEmails)) {
          result.skipped++;
          continue;
        }

        const syncResult = await syncUserZoomMeetingToDatabase(accountId, userId, zoomMeeting);
        if (syncResult.isNew) result.synced++;
        else result.existing++;
      } catch (error) {
        if (error instanceof ZoomReauthRequiredError) {
          result.errors.push("Zoom requires re-authentication");
          break;
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`Zoom meeting ${zoomMeeting.topic}: ${message}`);
      }
    }
  } catch (error) {
    if (error instanceof ZoomReauthRequiredError) {
      result.errors.push("Zoom requires re-authentication");
    } else {
      const message = error instanceof Error ? error.message : "Unknown error";
      result.errors.push(`Zoom sync failed: ${message}`);
    }
  }

  return result;
}

async function syncTeamsMeetings(accountId: string, userId: string, days: number): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, existing: 0, skipped: 0, errors: [] };

  try {
    const teamsMeetings = await getTeamsMeetingsForSync(accountId, userId, days);

    for (const teamsMeeting of teamsMeetings) {
      if (teamsMeeting.alreadySynced) {
        result.existing++;
        continue;
      }

      try {
        await syncTeamsMeetingToDatabase(accountId, userId, teamsMeeting);
        result.synced++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`Teams meeting ${teamsMeeting.subject}: ${message}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(`Teams sync failed: ${message}`);
  }

  return result;
}
