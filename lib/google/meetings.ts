import { getCalendarClient, getDriveClient } from "./client";
import { meetings } from "@/lib/db";
import { Meeting } from "@/lib/db/types";

export interface GoogleMeetAttendee {
  email: string;
  displayName: string | null;
  isOrganizer?: boolean;
}

export interface GoogleMeetEvent {
  id: string;
  summary: string | null;
  start: Date | null;
  end: Date | null;
  meetLink: string | null;
  conferenceId: string | null;
  attendees: GoogleMeetAttendee[];
  organizerEmail: string | null;
  organizerName: string | null;
}

// Fetch meetings from Google Calendar for the last N days
export async function fetchGoogleMeetings(
  userId: string,
  days: number = 7
): Promise<GoogleMeetEvent[]> {
  const calendar = await getCalendarClient(userId);

  const now = new Date();
  const pastDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: pastDate.toISOString(),
    timeMax: now.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 100,
  });

  const events = response.data.items || [];

  // Filter to only include events with Google Meet links
  const meetEvents = events.filter(
    (event) =>
      event.conferenceData?.conferenceSolution?.name === "Google Meet" ||
      event.hangoutLink
  );

  return meetEvents.map((event) => {
    // Map attendees with organizer flag
    const attendees: GoogleMeetAttendee[] = event.attendees
      ?.filter((a) => a.email)
      .map((a) => ({
        email: a.email!,
        displayName: a.displayName || null,
        isOrganizer: a.organizer || false,
      })) || [];

    // Get organizer email from event.organizer or from attendee with organizer flag
    const organizerEmail = event.organizer?.email ||
      attendees.find(a => a.isOrganizer)?.email || null;

    // Get organizer name - try multiple sources:
    // 1. event.organizer.displayName (often null)
    // 2. Attendee with organizer flag
    // 3. Attendee matching organizer email
    // 4. Extract from email address as last resort
    let organizerName = event.organizer?.displayName || null;
    if (!organizerName) {
      const organizerAttendee = attendees.find(a => a.isOrganizer) ||
        (organizerEmail ? attendees.find(a => a.email.toLowerCase() === organizerEmail.toLowerCase()) : null);
      organizerName = organizerAttendee?.displayName || null;
    }
    // Fallback: extract name from email (e.g., "ben.clemens@example.com" -> "Ben Clemens")
    if (!organizerName && organizerEmail) {
      const localPart = organizerEmail.split("@")[0];
      // Convert "ben.clemens" or "ben_clemens" to "Ben Clemens"
      organizerName = localPart
        .replace(/[._]/g, " ")
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    }

    return {
      id: event.id || "",
      summary: event.summary || null,
      start: event.start?.dateTime ? new Date(event.start.dateTime) : null,
      end: event.end?.dateTime ? new Date(event.end.dateTime) : null,
      meetLink: event.hangoutLink || null,
      conferenceId: event.conferenceData?.conferenceId || null,
      attendees,
      organizerEmail,
      organizerName,
    };
  });
}

// Search for Google Meet transcript in Drive
export async function findMeetTranscript(
  userId: string,
  meetingName: string,
  meetingDate: Date
): Promise<{ fileId: string; name: string; matchType: string } | null> {
  const drive = await getDriveClient(userId);

  // Google Meet transcripts are stored in Drive with specific naming patterns
  // They're typically named like "Meeting transcript - [Meeting Name] - [Date]"
  // or stored in a "Meet Recordings" folder

  // Search for transcript files around the meeting date
  const dateStr = meetingDate.toISOString().split("T")[0];

  // Escape special characters in meeting name for Drive search
  const escapedMeetingName = meetingName.replace(/'/g, "\\'");

  // Extract key words from meeting name for fuzzy matching (at least 3 chars)
  const meetingWords = meetingName
    .split(/\s+/)
    .filter(word => word.length >= 3)
    .slice(0, 3); // Use first 3 significant words

  const searchQueries = [
    // Query 1: Exact meeting name match (highest confidence)
    {
      query: `name contains 'transcript' and name contains '${escapedMeetingName}' and mimeType = 'application/vnd.google-apps.document'`,
      matchType: "exact_name",
    },
    // Query 2: Date-based WITH meeting name keywords (prevents wrong transcript)
    {
      query: meetingWords.length > 0
        ? `name contains 'transcript' and modifiedTime >= '${dateStr}T00:00:00' and modifiedTime <= '${dateStr}T23:59:59' and mimeType = 'application/vnd.google-apps.document' and (${meetingWords.map(w => `name contains '${w.replace(/'/g, "\\'")}'`).join(' or ')})`
        : `name contains 'transcript' and modifiedTime >= '${dateStr}T00:00:00' and modifiedTime <= '${dateStr}T23:59:59' and mimeType = 'application/vnd.google-apps.document' and name contains '${escapedMeetingName}'`,
      matchType: "date_with_keywords",
    },
    // Query 3: Meet Recordings folder with meeting name
    {
      query: `'Meet Recordings' in parents and name contains 'transcript' and modifiedTime >= '${dateStr}T00:00:00' and name contains '${escapedMeetingName}'`,
      matchType: "meet_recordings_folder",
    },
  ];

  for (const { query, matchType } of searchQueries) {
    try {
      const response = await drive.files.list({
        q: query,
        fields: "files(id, name, mimeType, modifiedTime)",
        orderBy: "modifiedTime desc",
        pageSize: 10,
      });

      const files = response.data.files || [];
      if (files.length > 0 && files[0].id && files[0].name) {
        console.log(`[Transcript Search] Found transcript for "${meetingName}" via ${matchType}: ${files[0].name}`);
        return {
          fileId: files[0].id,
          name: files[0].name,
          matchType,
        };
      }
    } catch (error) {
      // Continue to next query if this one fails
      console.error(`[Transcript Search] Query failed (${matchType}):`, error);
    }
  }

  console.log(`[Transcript Search] No transcript found for "${meetingName}" on ${dateStr}`);
  return null;
}

// Get transcript content from Google Drive document
export async function getTranscriptContent(
  userId: string,
  fileId: string
): Promise<string> {
  const drive = await getDriveClient(userId);

  // Export Google Doc as plain text
  const response = await drive.files.export({
    fileId: fileId,
    mimeType: "text/plain",
  });

  return response.data as string;
}

// Search for Google Meet recording in Drive
export async function findMeetRecording(
  userId: string,
  meetingName: string,
  meetingDate: Date
): Promise<{ fileId: string; name: string; mimeType: string } | null> {
  const drive = await getDriveClient(userId);

  const dateStr = meetingDate.toISOString().split("T")[0];

  // Search for video recordings
  const searchQueries = [
    `name contains '${meetingName}' and (mimeType contains 'video/' or mimeType = 'video/mp4') and modifiedTime >= '${dateStr}T00:00:00'`,
    `'Meet Recordings' in parents and (mimeType contains 'video/' or mimeType = 'video/mp4') and modifiedTime >= '${dateStr}T00:00:00'`,
  ];

  for (const query of searchQueries) {
    try {
      const response = await drive.files.list({
        q: query,
        fields: "files(id, name, mimeType, modifiedTime)",
        orderBy: "modifiedTime desc",
        pageSize: 10,
      });

      const files = response.data.files || [];
      if (files.length > 0 && files[0].id && files[0].name && files[0].mimeType) {
        return {
          fileId: files[0].id,
          name: files[0].name,
          mimeType: files[0].mimeType,
        };
      }
    } catch (error) {
      console.error("Drive recording search failed:", error);
    }
  }

  return null;
}

// Sync a single Google Meet event to the database
export async function syncMeetingToDatabase(
  accountId: string,
  event: GoogleMeetEvent
): Promise<Meeting> {
  const existing = await meetings.getMeetingByExternalId(accountId, event.id);
  if (existing) return existing;

  let hostName = event.organizerName;
  if (!hostName && event.organizerEmail) {
    const organizer = event.attendees.find(
      (a) => a.email.toLowerCase() === event.organizerEmail?.toLowerCase()
    );
    hostName = organizer?.displayName || null;
  }

  const meeting = await meetings.createMeeting(accountId, {
    external_id: event.id,
    name: event.summary,
    meeting_date: event.start,
    source: "google_meet",
    workflow_status: "pending",
    host_email: event.organizerEmail,
    host_name: hostName,
    meeting_url: event.meetLink,
  });

  return meeting;
}

interface SyncMeetingResult {
  meeting: Meeting;
  transcriptFound: boolean;
  transcriptFailed: boolean;
}

// Sync a Google Meet event with attendees as participants
export async function syncMeetingWithAttendees(
  accountId: string,
  event: GoogleMeetEvent,
  personnelDb: {
    getPersonnelByEmail: (accountId: string, email: string) => Promise<{ id: string } | null>;
    createPersonnel: (accountId: string, data: { name: string; email?: string | null }) => Promise<{ id: string }>;
  },
  userId?: string
): Promise<SyncMeetingResult> {
  const existing = await meetings.getMeetingByExternalId(accountId, event.id);
  if (existing) {
    return { meeting: existing, transcriptFound: !!existing.transcript, transcriptFailed: false };
  }

  let transcript: string | null = null;
  let transcriptSource: "google_meet" | null = null;
  let transcriptFailed = false;

  if (userId && event.summary && event.start) {
    try {
      const transcriptFile = await findMeetTranscript(userId, event.summary, event.start);
      if (transcriptFile) {
        transcript = await getTranscriptContent(userId, transcriptFile.fileId);
        transcriptSource = "google_meet";
      }
    } catch (error) {
      transcriptFailed = true;
      console.error(`[Google Sync] Failed to fetch transcript for "${event.summary}":`, error);
    }
  }

  const meeting = await meetings.createMeeting(accountId, {
    external_id: event.id,
    name: event.summary,
    meeting_date: event.start,
    source: "google_meet",
    workflow_status: transcript ? "transcribed" : "pending",
    host_email: event.organizerEmail,
    host_name: event.organizerName,
    transcript: transcript,
    transcript_source: transcriptSource,
    meeting_url: event.meetLink,
  });

  for (const attendee of event.attendees) {
    const isOrganizer = attendee.isOrganizer ||
      (event.organizerEmail && attendee.email.toLowerCase() === event.organizerEmail.toLowerCase());

    if (isOrganizer) continue;

    try {
      let personnelRecord = await personnelDb.getPersonnelByEmail(accountId, attendee.email);
      if (!personnelRecord) {
        const name = attendee.displayName || attendee.email.split("@")[0];
        personnelRecord = await personnelDb.createPersonnel(accountId, {
          name,
          email: attendee.email,
        });
      }
      await meetings.addMeetingParticipant(accountId, meeting.id, personnelRecord.id);
    } catch (error) {
      console.error(`Failed to add attendee ${attendee.email}:`, error);
    }
  }

  return { meeting, transcriptFound: !!transcript, transcriptFailed };
}

export async function syncUserMeetings(
  accountId: string,
  userId: string,
  days: number = 7
): Promise<{ synced: number; existing: number; errors: string[] }> {
  const googleMeetings = await fetchGoogleMeetings(userId, days);

  let synced = 0;
  let existing = 0;
  const errors: string[] = [];

  for (const event of googleMeetings) {
    try {
      const existingMeeting = await meetings.getMeetingByExternalId(accountId, event.id);
      if (existingMeeting) {
        existing++;
        continue;
      }
      await syncMeetingToDatabase(accountId, event);
      synced++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Failed to sync meeting ${event.id}: ${message}`);
    }
  }

  return { synced, existing, errors };
}

export async function processMeetingTranscript(
  accountId: string,
  userId: string,
  meetingId: string
): Promise<{ success: boolean; source?: string; error?: string }> {
  const meeting = await meetings.getMeetingById(accountId, meetingId);
  if (!meeting) return { success: false, error: "Meeting not found" };

  if (meeting.transcript) {
    return { success: true, source: meeting.transcript_source || "existing" };
  }

  await meetings.updateMeetingStatus(accountId, meetingId, "processing");

  try {
    if (meeting.name && meeting.meeting_date) {
      const transcript = await findMeetTranscript(userId, meeting.name, meeting.meeting_date);

      if (transcript) {
        const content = await getTranscriptContent(userId, transcript.fileId);
        await meetings.updateMeetingTranscript(accountId, meetingId, content, "google_meet");
        await meetings.updateMeetingStatus(accountId, meetingId, "completed");
        return { success: true, source: "google_meet" };
      }

      const recording = await findMeetRecording(userId, meeting.name, meeting.meeting_date);
      if (recording) {
        await meetings.updateMeeting(accountId, meetingId, {
          recording_url: `drive:${recording.fileId}`,
        });
        return { success: true, source: "pending_gemini" };
      }
    }

    await meetings.updateMeetingStatus(accountId, meetingId, "failed");
    return { success: false, error: "No transcript or recording found" };
  } catch (error) {
    await meetings.updateMeetingStatus(accountId, meetingId, "failed");
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
