import { NextRequest, NextResponse } from "next/server";
import { requireAccountContext } from "@/lib/account-context";
import { fetchGoogleMeetings } from "@/lib/google/meetings";
import { fetchHubSpotMeetingsLastDays, isHubSpotConfigured } from "@/lib/hubspot";
import { getUserZoomMeetingsForSync, getZoomMeetingParticipants } from "@/lib/zoom";
import { isMicrosoftConfigured, userHasMicrosoftTokens, getTeamsMeetingsForSync } from "@/lib/teams";
import { meetings, users } from "@/lib/db";
import { isInternalMeeting } from "@/lib/meetings";

/** Feature flag to enable/disable HubSpot meeting sync. Set to true to re-enable. */
const HUBSPOT_MEETING_SYNC_ENABLED = false;

type SyncSource = "google" | "hubspot" | "zoom" | "teams";

interface PotentialMeeting {
  externalId: string;
  name: string;
  date: string | null;
  source: SyncSource;
  hasTimeConflict: boolean;
  hasTranscript?: boolean;
  isInternal?: boolean;
  alreadySynced?: boolean;
  hostEmail?: string | null;
  conflictingMeeting?: {
    id: string;
    name: string;
    date: string;
    source: string;
    customerId?: string | null;
    hostEmail?: string | null;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { accountId, userId } = await requireAccountContext();

    let source: SyncSource = "google";
    let days = 7;
    try {
      const body = await request.json();
      if (["google", "hubspot", "zoom", "teams"].includes(body.source)) {
        source = body.source;
      }
      if (body.days && typeof body.days === "number") {
        days = Math.min(Math.max(body.days, 1), 30);
      }
    } catch {
      // Use defaults
    }

    const potentialMeetings: PotentialMeeting[] = [];
    const user = await users.getUserById(userId);

    if (source === "google") {
      // Get user for Google API access
      if (!user?.google_access_token) {
        return NextResponse.json(
          { error: "Google account not connected" },
          { status: 400 }
        );
      }

      const googleMeetings = await fetchGoogleMeetings(user.id, days);

      for (const event of googleMeetings) {
        // Check if already synced by external ID
        const existingByExternalId = await meetings.getMeetingByExternalId(accountId, event.id);
        if (existingByExternalId) {
          potentialMeetings.push({
            externalId: event.id,
            name: event.summary || "Untitled Meeting",
            date: event.start?.toISOString() || null,
            source: "google",
            hasTimeConflict: false,
            alreadySynced: true,
            hostEmail: event.organizerEmail,
          });
          continue;
        }

        // Check if this is an internal meeting
        const participantEmails = event.attendees
          .filter((a) => !a.isOrganizer && a.email !== event.organizerEmail)
          .map((a) => a.email);
        const allAttendeeEmails = event.organizerEmail
          ? [...participantEmails, event.organizerEmail]
          : participantEmails;
        const isInternal = isInternalMeeting(allAttendeeEmails);

        // Check for potential duplicates (same customer, host, and similar time)
        let hasTimeConflict = false;
        let conflictingMeeting = undefined;

        if (event.start) {
          const nearbyMeetings = await meetings.findMeetingsNearDate(accountId, event.start, 30);
          // Only flag as duplicate if same host email
          const matchingMeeting = nearbyMeetings.find((m) =>
            m.host_email &&
            event.organizerEmail &&
            m.host_email.toLowerCase() === event.organizerEmail.toLowerCase()
          );
          if (matchingMeeting) {
            hasTimeConflict = true;
            conflictingMeeting = {
              id: matchingMeeting.id,
              name: matchingMeeting.name || "Untitled",
              date: matchingMeeting.meeting_date?.toISOString() || "",
              source: matchingMeeting.source || "unknown",
              customerId: matchingMeeting.customer_id,
              hostEmail: matchingMeeting.host_email,
            };
          }
        }

        potentialMeetings.push({
          externalId: event.id,
          name: event.summary || "Untitled Meeting",
          date: event.start?.toISOString() || null,
          source: "google",
          hasTimeConflict,
          isInternal,
          hostEmail: event.organizerEmail,
          conflictingMeeting,
        });
      }
    } else if (source === "hubspot") {
      // Return early if HubSpot meeting sync is disabled
      if (!HUBSPOT_MEETING_SYNC_ENABLED) {
        return NextResponse.json(
          { error: "HubSpot meeting sync is currently disabled" },
          { status: 400 }
        );
      }
      if (!isHubSpotConfigured()) {
        return NextResponse.json(
          { error: "HubSpot is not configured" },
          { status: 400 }
        );
      }

      const hubspotMeetings = await fetchHubSpotMeetingsLastDays(days);

      for (const hsMeeting of hubspotMeetings) {
        const externalId = `hubspot_${hsMeeting.id}`;

        // Check if already synced by external ID
        const existingByExternalId = await meetings.getMeetingByExternalId(accountId, externalId);
        if (existingByExternalId) {
          potentialMeetings.push({
            externalId,
            name: hsMeeting.title || `HubSpot Meeting ${hsMeeting.id}`,
            date: hsMeeting.startTime?.toISOString() || null,
            source: "hubspot",
            hasTimeConflict: false,
            alreadySynced: true,
          });
          continue;
        }

        // Check for time conflicts
        let hasTimeConflict = false;
        let conflictingMeeting = undefined;

        if (hsMeeting.startTime) {
          const nearbyMeetings = await meetings.findMeetingsNearDate(accountId, hsMeeting.startTime, 30);
          if (nearbyMeetings.length > 0) {
            hasTimeConflict = true;
            const conflict = nearbyMeetings[0];
            conflictingMeeting = {
              id: conflict.id,
              name: conflict.name || "Untitled",
              date: conflict.meeting_date?.toISOString() || "",
              source: conflict.source || "unknown",
            };
          }
        }

        potentialMeetings.push({
          externalId,
          name: hsMeeting.title || `HubSpot Meeting ${hsMeeting.id}`,
          date: hsMeeting.startTime?.toISOString() || null,
          source: "hubspot",
          hasTimeConflict,
          conflictingMeeting,
        });
      }
    } else if (source === "zoom") {
      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      // Check if user has Zoom connected
      const hasZoom = await users.hasZoomConnected(user.id);
      if (!hasZoom) {
        return NextResponse.json(
          {
            error: "Zoom is not connected",
            needsAuth: true,
            message: "Please connect your Zoom account in Settings",
          },
          { status: 400 }
        );
      }

      const zoomMeetings = await getUserZoomMeetingsForSync(accountId, user.id, days);

      for (const zoomMeeting of zoomMeetings) {
        if (zoomMeeting.alreadySynced) {
          potentialMeetings.push({
            externalId: zoomMeeting.externalId,
            name: zoomMeeting.topic,
            date: zoomMeeting.startTime.toISOString(),
            source: "zoom",
            hasTimeConflict: false,
            hasTranscript: !!zoomMeeting.transcriptUrl,
            alreadySynced: true,
            hostEmail: zoomMeeting.hostEmail,
          });
          continue;
        }

        // Check if this is an internal meeting
        let participantEmails: string[] = [];
        try {
          const participants = await getZoomMeetingParticipants(user.id, zoomMeeting.uuid);
          participantEmails = participants
            .filter((p) => p.user_email)
            .map((p) => p.user_email);
        } catch {
          // Participant fetch may fail, continue with host email only
        }
        const allEmails = zoomMeeting.hostEmail
          ? [...participantEmails, zoomMeeting.hostEmail]
          : participantEmails;
        const isInternal = isInternalMeeting(allEmails);

        // Check for potential duplicates (same host and similar time)
        let hasTimeConflict = false;
        let conflictingMeeting = undefined;

        const nearbyMeetings = await meetings.findMeetingsNearDate(accountId, zoomMeeting.startTime, 30);
        // Only flag as duplicate if same host email
        const matchingMeeting = nearbyMeetings.find((m) =>
          m.host_email &&
          zoomMeeting.hostEmail &&
          m.host_email.toLowerCase() === zoomMeeting.hostEmail.toLowerCase()
        );
        if (matchingMeeting) {
          hasTimeConflict = true;
          conflictingMeeting = {
            id: matchingMeeting.id,
            name: matchingMeeting.name || "Untitled",
            date: matchingMeeting.meeting_date?.toISOString() || "",
            source: matchingMeeting.source || "unknown",
            customerId: matchingMeeting.customer_id,
            hostEmail: matchingMeeting.host_email,
          };
        }

        potentialMeetings.push({
          externalId: zoomMeeting.externalId,
          name: zoomMeeting.topic,
          date: zoomMeeting.startTime.toISOString(),
          source: "zoom",
          hasTimeConflict,
          hasTranscript: !!zoomMeeting.transcriptUrl,
          isInternal,
          hostEmail: zoomMeeting.hostEmail,
          conflictingMeeting,
        });
      }
    } else if (source === "teams") {
      if (!isMicrosoftConfigured()) {
        return NextResponse.json(
          { error: "Microsoft Teams is not configured" },
          { status: 400 }
        );
      }

      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      const hasTokens = await userHasMicrosoftTokens(user.id);
      if (!hasTokens) {
        return NextResponse.json(
          {
            error: "Microsoft account not connected",
            needsAuth: true,
            message: "Please connect your Microsoft account to sync Teams meetings",
          },
          { status: 400 }
        );
      }

      const teamsMeetings = await getTeamsMeetingsForSync(accountId, user.id, days);

      for (const teamsMeeting of teamsMeetings) {
        if (teamsMeeting.alreadySynced) {
          potentialMeetings.push({
            externalId: teamsMeeting.externalId,
            name: teamsMeeting.subject,
            date: teamsMeeting.startTime.toISOString(),
            source: "teams",
            hasTimeConflict: false,
            alreadySynced: true,
            hostEmail: teamsMeeting.organizerEmail,
          });
          continue;
        }

        // Check if this is an internal meeting (Teams meetings only have organizer email available)
        // Without attendee info, we can only check if the organizer is internal
        const allEmails = teamsMeeting.organizerEmail ? [teamsMeeting.organizerEmail] : [];
        const isInternal = isInternalMeeting(allEmails);

        // Check for potential duplicates (same host and similar time)
        let hasTimeConflict = false;
        let conflictingMeeting = undefined;

        const nearbyMeetings = await meetings.findMeetingsNearDate(accountId, teamsMeeting.startTime, 30);
        // Only flag as duplicate if same host email
        const matchingMeeting = nearbyMeetings.find((m) =>
          m.host_email &&
          teamsMeeting.organizerEmail &&
          m.host_email.toLowerCase() === teamsMeeting.organizerEmail.toLowerCase()
        );
        if (matchingMeeting) {
          hasTimeConflict = true;
          conflictingMeeting = {
            id: matchingMeeting.id,
            name: matchingMeeting.name || "Untitled",
            date: matchingMeeting.meeting_date?.toISOString() || "",
            source: matchingMeeting.source || "unknown",
            customerId: matchingMeeting.customer_id,
            hostEmail: matchingMeeting.host_email,
          };
        }

        potentialMeetings.push({
          externalId: teamsMeeting.externalId,
          name: teamsMeeting.subject,
          date: teamsMeeting.startTime.toISOString(),
          source: "teams",
          hasTimeConflict,
          isInternal,
          hostEmail: teamsMeeting.organizerEmail,
          conflictingMeeting,
        });
      }
    }

    const conflictCount = potentialMeetings.filter(m => m.hasTimeConflict).length;
    const internalCount = potentialMeetings.filter(m => m.isInternal).length;

    return NextResponse.json({
      success: true,
      meetings: potentialMeetings,
      totalNew: potentialMeetings.length,
      conflictCount,
      internalCount,
    });
  } catch (error) {
    console.error("Meeting sync check error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to check meetings", details: message },
      { status: 500 }
    );
  }
}
