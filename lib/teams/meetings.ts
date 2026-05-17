/**
 * Microsoft Teams Meetings
 * Fetch meetings and transcripts via Microsoft Graph API
 */

import { graphRequest, graphDownload } from "./client";
import { parseVttToText } from "../utils/vtt-parser";
import { createMeeting, getMeetingByExternalId } from "../db/meetings";
import { Meeting } from "../db/types";

// Microsoft Graph API types
interface GraphEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isOnlineMeeting: boolean;
  onlineMeeting?: {
    joinUrl: string;
  };
  onlineMeetingProvider?: string;
  organizer?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
}

interface GraphEventsResponse {
  value: GraphEvent[];
  "@odata.nextLink"?: string;
}

interface OnlineMeeting {
  id: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
  joinWebUrl: string;
  recordingContentUrl?: string;
  transcriptContentUrl?: string;
}

interface Transcript {
  id: string;
  createdDateTime: string;
  meetingOrganizer: {
    user?: { displayName: string };
  };
}

interface TranscriptsResponse {
  value: Transcript[];
}

export interface TeamsMeeting {
  id: string;
  subject: string;
  startTime: Date;
  endTime: Date;
  joinUrl: string | null;
  isOnlineMeeting: boolean;
  organizerName: string | null;
  organizerEmail: string | null;
}

/**
 * Fetch calendar events from Microsoft Graph
 * Returns events that are Teams meetings
 */
export async function fetchTeamsMeetings(
  userId: string,
  days: number = 30
): Promise<TeamsMeeting[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 1); // Include today

  const meetings: TeamsMeeting[] = [];
  let nextLink: string | undefined;

  // Initial request
  const params = {
    $filter: `start/dateTime ge '${startDate.toISOString()}' and end/dateTime le '${endDate.toISOString()}'`,
    $orderby: "start/dateTime desc",
    $top: "100",
    $select: "id,subject,start,end,isOnlineMeeting,onlineMeeting,onlineMeetingProvider,organizer",
  };

  let response = await graphRequest<GraphEventsResponse>(
    userId,
    "/me/calendar/events",
    { params }
  );

  do {
    for (const event of response.value) {
      // Only include Teams meetings
      if (
        event.isOnlineMeeting &&
        (event.onlineMeetingProvider === "teamsForBusiness" ||
          event.onlineMeeting?.joinUrl?.includes("teams.microsoft"))
      ) {
        meetings.push({
          id: event.id,
          subject: event.subject,
          startTime: new Date(event.start.dateTime + "Z"),
          endTime: new Date(event.end.dateTime + "Z"),
          joinUrl: event.onlineMeeting?.joinUrl || null,
          isOnlineMeeting: true,
          organizerName: event.organizer?.emailAddress?.name || null,
          organizerEmail: event.organizer?.emailAddress?.address || null,
        });
      }
    }

    // Handle pagination
    nextLink = response["@odata.nextLink"];
    if (nextLink) {
      // Parse the next link and make the request
      const url = new URL(nextLink);
      const pathAndQuery = url.pathname.replace("/v1.0", "") + url.search;
      response = await graphRequest<GraphEventsResponse>(userId, pathAndQuery);
    }
  } while (nextLink);

  return meetings;
}

/**
 * Get online meeting details including recording/transcript info
 * Note: This requires specific permissions and meeting to be recorded
 */
export async function getTeamsMeetingDetails(
  userId: string,
  joinUrl: string
): Promise<OnlineMeeting | null> {
  try {
    // Extract meeting ID from join URL
    // Teams URLs look like: https://teams.microsoft.com/l/meetup-join/19%3ameeting_xxx
    const urlMatch = joinUrl.match(/meetup-join\/([^/]+)/);
    if (!urlMatch) {
      return null;
    }

    const meetingId = decodeURIComponent(urlMatch[1]);

    // Try to get online meeting details
    const meeting = await graphRequest<OnlineMeeting>(
      userId,
      `/me/onlineMeetings/${meetingId}`
    );

    return meeting;
  } catch (error) {
    // Meeting details may not be accessible
    console.error("Failed to get Teams meeting details:", error);
    return null;
  }
}

/**
 * Get transcripts for a Teams meeting
 */
export async function getTeamsMeetingTranscripts(
  userId: string,
  onlineMeetingId: string
): Promise<Transcript[]> {
  try {
    const response = await graphRequest<TranscriptsResponse>(
      userId,
      `/me/onlineMeetings/${onlineMeetingId}/transcripts`
    );
    return response.value;
  } catch (error) {
    console.error("Failed to get Teams transcripts:", error);
    return [];
  }
}

/**
 * Download a Teams meeting transcript content
 */
export async function downloadTeamsTranscript(
  userId: string,
  onlineMeetingId: string,
  transcriptId: string
): Promise<string | null> {
  try {
    // Get transcript content (VTT format)
    const content = await graphDownload(
      userId,
      `https://graph.microsoft.com/v1.0/me/onlineMeetings/${onlineMeetingId}/transcripts/${transcriptId}/content?$format=text/vtt`
    );

    return parseVttToText(content);
  } catch (error) {
    console.error("Failed to download Teams transcript:", error);
    return null;
  }
}

/**
 * Get transcript for a Teams meeting (tries all available transcripts)
 */
export async function getTeamsMeetingTranscript(
  userId: string,
  joinUrl: string
): Promise<string | null> {
  const meeting = await getTeamsMeetingDetails(userId, joinUrl);
  if (!meeting) {
    return null;
  }

  const transcripts = await getTeamsMeetingTranscripts(userId, meeting.id);
  if (transcripts.length === 0) {
    return null;
  }

  // Get the most recent transcript
  const latestTranscript = transcripts.sort(
    (a, b) =>
      new Date(b.createdDateTime).getTime() -
      new Date(a.createdDateTime).getTime()
  )[0];

  return downloadTeamsTranscript(userId, meeting.id, latestTranscript.id);
}

/**
 * Create external ID for Teams meetings
 */
function getTeamsExternalId(meeting: TeamsMeeting): string {
  return `teams_${meeting.id}`;
}

/**
 * Check if a Teams meeting already exists in the database
 */
export async function teamsMeetingExists(meeting: TeamsMeeting): Promise<boolean> {
  const externalId = getTeamsExternalId(meeting);
  const existing = await getMeetingByExternalId(externalId);
  return !!existing;
}

/**
 * Sync a Teams meeting to the database
 */
export async function syncTeamsMeetingToDatabase(
  userId: string,
  meeting: TeamsMeeting,
  options: { includeTranscript?: boolean } = {}
): Promise<Meeting> {
  const { includeTranscript = true } = options;

  const externalId = getTeamsExternalId(meeting);

  // Check if already exists
  const existing = await getMeetingByExternalId(externalId);
  if (existing) {
    return existing;
  }

  // Get transcript if available
  let transcript: string | null = null;
  let transcriptSource: "teams" | null = null;

  if (includeTranscript && meeting.joinUrl) {
    transcript = await getTeamsMeetingTranscript(userId, meeting.joinUrl);
    if (transcript) {
      transcriptSource = "teams";
    }
  }

  // Create the meeting with host information
  const newMeeting = await createMeeting({
    external_id: externalId,
    name: meeting.subject,
    meeting_date: meeting.startTime,
    source: "teams",
    recording_url: meeting.joinUrl, // Store join URL as reference
    meeting_url: meeting.joinUrl,
    transcript: transcript,
    transcript_source: transcriptSource,
    workflow_status: transcript ? "transcribed" : "pending",
    host_name: meeting.organizerName,
    host_email: meeting.organizerEmail,
  });

  // Teams doesn't provide participant info, so try HubSpot fallback
  try {
    const { findHubSpotMeetingParticipants } = await import("../hubspot/meetings");
    const { matchMeetingToCompanyByEmails } = await import("../meetings");

    const participantEmails: string[] = [];

    // Include organizer email if available
    if (meeting.organizerEmail) {
      participantEmails.push(meeting.organizerEmail);
    }

    // Try HubSpot for participant information
    const hubspotEmails = await findHubSpotMeetingParticipants(meeting.startTime, 5);
    if (hubspotEmails.length > 0) {
      for (const email of hubspotEmails) {
        if (!participantEmails.includes(email)) {
          participantEmails.push(email);
        }
      }
    }

    if (participantEmails.length > 0) {
      await matchMeetingToCompanyByEmails(newMeeting.id, participantEmails);
    }
  } catch (error) {
    console.error(`Failed to get participants for Teams meeting ${meeting.id}:`, error);
  }

  return newMeeting;
}

/**
 * Process a Teams meeting to get its transcript
 */
export async function processTeamsMeetingTranscript(
  userId: string,
  meetingId: string
): Promise<{ transcript: string | null; source: "teams" | "pending_gemini" }> {
  const { getMeetingById, updateMeeting } = await import("../db/meetings");

  const meeting = await getMeetingById(meetingId);
  if (!meeting) {
    throw new Error(`Meeting not found: ${meetingId}`);
  }

  // If already has transcript, return it
  if (meeting.transcript) {
    return {
      transcript: meeting.transcript,
      source: (meeting.transcript_source as "teams") || "teams",
    };
  }

  // Try to get transcript from Teams
  if (meeting.recording_url) {
    const transcript = await getTeamsMeetingTranscript(userId, meeting.recording_url);
    if (transcript) {
      await updateMeeting(meetingId, {
        transcript,
        transcript_source: "teams",
      });
      return { transcript, source: "teams" };
    }
  }

  // No transcript available - will need Gemini processing
  return { transcript: null, source: "pending_gemini" };
}

/**
 * Get Teams meetings that can be synced
 */
export async function getTeamsMeetingsForSync(
  userId: string,
  days: number = 30
): Promise<Array<TeamsMeeting & { alreadySynced: boolean; externalId: string }>> {
  const meetings = await fetchTeamsMeetings(userId, days);

  const results = await Promise.all(
    meetings.map(async (meeting) => {
      const externalId = getTeamsExternalId(meeting);
      const alreadySynced = await teamsMeetingExists(meeting);
      return { ...meeting, alreadySynced, externalId };
    })
  );

  return results;
}
