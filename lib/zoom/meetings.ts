/**
 * Zoom Meetings and Recordings
 * Supports both Server-to-Server OAuth and per-user OAuth 2.0
 */

import { zoomRequest, downloadZoomRecordingText, userZoomRequest, downloadUserZoomRecordingText } from "./client";
import { parseVttToText } from "../utils/vtt-parser";
import { createMeeting, getMeetingByExternalId, addMeetingParticipant } from "../db/meetings";
import { getPersonnelByEmail, createPersonnel } from "../db/personnel";
import { Meeting } from "../db/types";
import { matchMeetingToCompanyByEmails } from "../meetings";

/** Appends ?pwd=passcode to a Zoom play_url if a passcode is available */
function buildVideoUrlWithPasscode(playUrl: string | null, passcode: string | null): string | null {
  if (!playUrl) return null;
  if (!passcode) return playUrl;
  return `${playUrl}?pwd=${passcode}`;
}

// Zoom API types
interface ZoomRecording {
  id: string;
  meeting_id: string;
  recording_start: string;
  recording_end: string;
  file_type: string;
  file_extension: string;
  file_size: number;
  play_url: string;
  download_url: string;
  status: string;
  recording_type: string;
}

interface ZoomMeeting {
  uuid: string;
  id: number;
  host_id: string;
  host_email?: string;
  password?: string;
  recording_play_passcode?: string;
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  timezone: string;
  total_size: number;
  recording_count: number;
  recording_files: ZoomRecording[];
}

interface ZoomRecordingsResponse {
  from: string;
  to: string;
  page_count: number;
  page_size: number;
  total_records: number;
  next_page_token: string;
  meetings: ZoomMeeting[];
}

export interface ZoomMeetingWithRecordings {
  uuid: string;
  id: number;
  topic: string;
  startTime: Date;
  duration: number;
  recordings: ZoomRecording[];
  transcriptUrl: string | null;
  videoUrl: string | null;
  hostEmail: string | null;
  password: string | null;
}

/**
 * Fetch cloud recordings from Zoom for the last N days
 * Paginated - fetches all results
 */
export async function fetchZoomRecordings(days: number = 30): Promise<ZoomMeetingWithRecordings[]> {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  const meetings: ZoomMeetingWithRecordings[] = [];
  let nextPageToken = "";

  do {
    const params: Record<string, string> = {
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
      page_size: "100",
    };

    if (nextPageToken) {
      params.next_page_token = nextPageToken;
    }

    // Use /users/me for Server-to-Server OAuth (returns all account recordings)
    const response = await zoomRequest<ZoomRecordingsResponse>(
      "/users/me/recordings",
      { params }
    );

    for (const meeting of response.meetings) {
      // Find transcript file (VTT format)
      const transcriptFile = meeting.recording_files.find(
        (f) => f.file_type === "TRANSCRIPT" || f.file_extension === "VTT"
      );

      // Find video file (prefer shared_screen_with_speaker_view, then active_speaker)
      const videoFile =
        meeting.recording_files.find(
          (f) =>
            f.recording_type === "shared_screen_with_speaker_view" &&
            f.file_type === "MP4"
        ) ||
        meeting.recording_files.find(
          (f) => f.recording_type === "active_speaker" && f.file_type === "MP4"
        ) ||
        meeting.recording_files.find((f) => f.file_type === "MP4");

      const passcode = meeting.recording_play_passcode || meeting.password || null;
      meetings.push({
        uuid: meeting.uuid,
        id: meeting.id,
        topic: meeting.topic,
        startTime: new Date(meeting.start_time),
        duration: meeting.duration,
        recordings: meeting.recording_files,
        transcriptUrl: transcriptFile?.download_url || null,
        videoUrl: buildVideoUrlWithPasscode(videoFile?.play_url || null, passcode),
        hostEmail: meeting.host_email || null,
        password: passcode,
      });
    }

    nextPageToken = response.next_page_token || "";
  } while (nextPageToken);

  return meetings;
}

/**
 * Get transcript text from a Zoom meeting
 * Downloads the VTT file and parses it to plain text
 */
export async function getZoomTranscript(
  meeting: ZoomMeetingWithRecordings
): Promise<string | null> {
  if (!meeting.transcriptUrl) {
    return null;
  }

  try {
    const vttContent = await downloadZoomRecordingText(meeting.transcriptUrl);
    return parseVttToText(vttContent);
  } catch (error) {
    console.error(`Failed to download Zoom transcript for meeting ${meeting.id}:`, error);
    return null;
  }
}

/**
 * Create external ID for Zoom meetings
 */
function getZoomExternalId(meeting: ZoomMeetingWithRecordings): string {
  return `zoom_${meeting.uuid}`;
}

/**
 * Check if a Zoom meeting already exists in the database
 */
export async function zoomMeetingExists(
  accountId: string,
  meeting: ZoomMeetingWithRecordings
): Promise<boolean> {
  const externalId = getZoomExternalId(meeting);
  const existing = await getMeetingByExternalId(accountId, externalId);
  return !!existing;
}

/**
 * Sync a Zoom meeting to the database (Server-to-Server OAuth)
 */
export async function syncZoomMeetingToDatabase(
  accountId: string,
  meeting: ZoomMeetingWithRecordings,
  options: { includeTranscript?: boolean } = {}
): Promise<Meeting> {
  const { includeTranscript = true } = options;

  const externalId = getZoomExternalId(meeting);

  const existing = await getMeetingByExternalId(accountId, externalId);
  if (existing) return existing;

  // Get transcript if available
  let transcript: string | null = null;
  let transcriptSource: "zoom" | null = null;

  if (includeTranscript && meeting.transcriptUrl) {
    transcript = await getZoomTranscript(meeting);
    if (transcript) {
      transcriptSource = "zoom";
    }
  }

  // Fetch participants first so we can get host name
  let participants: { id: string; name: string; user_email: string }[] = [];
  try {
    participants = await getZoomMeetingParticipantsS2S(meeting.uuid);
    console.log(`[Zoom S2S Sync] Got ${participants.length} participants for meeting "${meeting.topic}"`);
  } catch (error) {
    console.error(`[Zoom S2S Sync] Failed to fetch participants for meeting ${meeting.uuid}:`, error);
  }

  // Try to get host name from participants (if host joined with same email)
  let hostName: string | null = null;
  if (meeting.hostEmail) {
    const hostParticipant = participants.find(
      (p) => p.user_email && p.user_email.toLowerCase() === meeting.hostEmail!.toLowerCase()
    );
    if (hostParticipant?.name) {
      hostName = hostParticipant.name;
    }
  }

  const newMeeting = await createMeeting(accountId, {
    external_id: externalId,
    name: meeting.topic,
    meeting_date: meeting.startTime,
    source: "zoom",
    recording_url: meeting.videoUrl,
    transcript: transcript,
    transcript_source: transcriptSource,
    workflow_status: transcript ? "transcribed" : "pending",
    host_email: meeting.hostEmail,
    host_name: hostName,
    recording_passcode: meeting.password,
  });

  const participantEmails: string[] = [];
  for (const participant of participants) {
    if (!participant.user_email) continue;
    if (meeting.hostEmail && participant.user_email.toLowerCase() === meeting.hostEmail.toLowerCase()) continue;

    participantEmails.push(participant.user_email);

    try {
      let personnelRecord = await getPersonnelByEmail(accountId, participant.user_email);
      if (!personnelRecord) {
        const name = participant.name || participant.user_email.split("@")[0];
        personnelRecord = await createPersonnel(accountId, {
          name,
          email: participant.user_email,
        });
      }
      await addMeetingParticipant(accountId, newMeeting.id, personnelRecord.id);
    } catch (error) {
      console.error(`[Zoom S2S Sync] Failed to add participant ${participant.user_email}:`, error);
    }
  }

  if (participantEmails.length > 0) {
    await matchMeetingToCompanyByEmails(accountId, newMeeting.id, participantEmails);
  }

  return newMeeting;
}

/**
 * Process a Zoom meeting to get its transcript
 * If transcript is available in Zoom, downloads it
 * Otherwise returns null (caller should use Gemini)
 */
export async function processZoomMeetingTranscript(
  accountId: string,
  meetingId: string
): Promise<{ transcript: string | null; source: "zoom" | "pending_gemini" }> {
  const { getMeetingById, updateMeeting } = await import("../db/meetings");

  const meeting = await getMeetingById(accountId, meetingId);
  if (!meeting) throw new Error(`Meeting not found: ${meetingId}`);

  if (meeting.transcript) {
    return {
      transcript: meeting.transcript,
      source: meeting.transcript_source as "zoom" || "zoom",
    };
  }

  if (meeting.external_id?.startsWith("zoom_")) {
    const uuid = meeting.external_id.replace("zoom_", "");

    try {
      const recordings = await fetchZoomRecordings(90);
      const zoomMeeting = recordings.find((r) => r.uuid === uuid);

      if (zoomMeeting?.transcriptUrl) {
        const transcript = await getZoomTranscript(zoomMeeting);
        if (transcript) {
          await updateMeeting(accountId, meetingId, {
            transcript,
            transcript_source: "zoom",
          });
          return { transcript, source: "zoom" };
        }
      }
    } catch (error) {
      console.error("Failed to fetch Zoom transcript:", error);
    }
  }

  return { transcript: null, source: "pending_gemini" };
}

export async function getZoomMeetingsForSync(
  accountId: string,
  days: number = 30
): Promise<
  Array<ZoomMeetingWithRecordings & { alreadySynced: boolean; externalId: string }>
> {
  const recordings = await fetchZoomRecordings(days);

  const results = await Promise.all(
    recordings.map(async (meeting) => {
      const externalId = getZoomExternalId(meeting);
      const alreadySynced = await zoomMeetingExists(accountId, meeting);
      return { ...meeting, alreadySynced, externalId };
    })
  );

  return results;
}

/**
 * Fetch meeting participants from Zoom Past Meetings API (Server-to-Server OAuth)
 */
async function getZoomPastMeetingParticipantsS2S(
  meetingUuid: string
): Promise<ZoomParticipant[]> {
  const participants: ZoomParticipant[] = [];
  let nextPageToken = "";

  // Double-encode UUID if it contains / or //
  const encodedUuid = meetingUuid.includes("/")
    ? encodeURIComponent(encodeURIComponent(meetingUuid))
    : meetingUuid;

  do {
    const params: Record<string, string> = {
      page_size: "100",
    };

    if (nextPageToken) {
      params.next_page_token = nextPageToken;
    }

    const response = await zoomRequest<ZoomParticipantsResponse>(
      `/past_meetings/${encodedUuid}/participants`,
      { params }
    );

    participants.push(...response.participants);
    nextPageToken = response.next_page_token || "";
  } while (nextPageToken);

  return participants;
}

/**
 * Fetch meeting participants from Zoom Reports API (Server-to-Server OAuth)
 */
async function getZoomReportParticipantsS2S(
  meetingUuid: string
): Promise<ZoomParticipant[]> {
  const participants: ZoomParticipant[] = [];
  let nextPageToken = "";

  // Double-encode UUID if it contains / or //
  const encodedUuid = meetingUuid.includes("/")
    ? encodeURIComponent(encodeURIComponent(meetingUuid))
    : meetingUuid;

  do {
    const params: Record<string, string> = {
      page_size: "100",
    };

    if (nextPageToken) {
      params.next_page_token = nextPageToken;
    }

    const response = await zoomRequest<ZoomParticipantsResponse>(
      `/report/meetings/${encodedUuid}/participants`,
      { params }
    );

    participants.push(...response.participants);
    nextPageToken = response.next_page_token || "";
  } while (nextPageToken);

  return participants;
}

/**
 * Fetch meeting participants from Zoom - tries multiple endpoints (Server-to-Server OAuth)
 * First tries /past_meetings, then falls back to /report
 */
export async function getZoomMeetingParticipantsS2S(
  meetingUuid: string
): Promise<ZoomParticipant[]> {
  // Try /past_meetings endpoint first
  try {
    const participants = await getZoomPastMeetingParticipantsS2S(meetingUuid);
    if (participants.length > 0) {
      console.log(`[Zoom S2S] Got ${participants.length} participants from /past_meetings for ${meetingUuid}`);
      return participants;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`[Zoom S2S] /past_meetings endpoint failed for ${meetingUuid}: ${msg}`);
  }

  // Fall back to /report endpoint
  try {
    const participants = await getZoomReportParticipantsS2S(meetingUuid);
    if (participants.length > 0) {
      console.log(`[Zoom S2S] Got ${participants.length} participants from /report for ${meetingUuid}`);
      return participants;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`[Zoom S2S] /report endpoint failed for ${meetingUuid}: ${msg}`);
  }

  console.log(`[Zoom S2S] No participants found for meeting ${meetingUuid}`);
  return [];
}

// ============================================================================
// Zoom Participant Types and Functions
// ============================================================================

interface ZoomParticipant {
  id: string;
  name: string;
  user_email: string;
  join_time: string;
  leave_time: string;
  duration: number;
}

interface ZoomParticipantsResponse {
  page_count: number;
  page_size: number;
  total_records: number;
  next_page_token: string;
  participants: ZoomParticipant[];
}

/**
 * Fetch meeting participants from Zoom Past Meetings API
 * This endpoint works with user-level OAuth (meeting:read scope)
 * Note: This only works for past meetings (not ongoing)
 */
async function getZoomPastMeetingParticipants(
  userId: string,
  meetingUuid: string
): Promise<ZoomParticipant[]> {
  const participants: ZoomParticipant[] = [];
  let nextPageToken = "";

  // Double-encode UUID if it contains / or //
  const encodedUuid = meetingUuid.includes("/")
    ? encodeURIComponent(encodeURIComponent(meetingUuid))
    : meetingUuid;

  do {
    const params: Record<string, string> = {
      page_size: "100",
    };

    if (nextPageToken) {
      params.next_page_token = nextPageToken;
    }

    const response = await userZoomRequest<ZoomParticipantsResponse>(
      userId,
      `/past_meetings/${encodedUuid}/participants`,
      { params }
    );

    participants.push(...response.participants);
    nextPageToken = response.next_page_token || "";
  } while (nextPageToken);

  return participants;
}

/**
 * Fetch meeting participants from Zoom Reports API
 * Requires report:read:admin scope
 * Note: This only works for past meetings (not ongoing)
 */
async function getZoomReportParticipants(
  userId: string,
  meetingUuid: string
): Promise<ZoomParticipant[]> {
  const participants: ZoomParticipant[] = [];
  let nextPageToken = "";

  // Double-encode UUID if it contains / or //
  const encodedUuid = meetingUuid.includes("/")
    ? encodeURIComponent(encodeURIComponent(meetingUuid))
    : meetingUuid;

  do {
    const params: Record<string, string> = {
      page_size: "100",
    };

    if (nextPageToken) {
      params.next_page_token = nextPageToken;
    }

    const response = await userZoomRequest<ZoomParticipantsResponse>(
      userId,
      `/report/meetings/${encodedUuid}/participants`,
      { params }
    );

    participants.push(...response.participants);
    nextPageToken = response.next_page_token || "";
  } while (nextPageToken);

  return participants;
}

/**
 * Fetch meeting participants from Zoom - tries multiple endpoints
 * First tries /past_meetings (user-level OAuth), then falls back to /report (admin scope)
 */
export async function getZoomMeetingParticipants(
  userId: string,
  meetingUuid: string
): Promise<ZoomParticipant[]> {
  // Try /past_meetings endpoint first (works with user-level OAuth, meeting:read scope)
  try {
    const participants = await getZoomPastMeetingParticipants(userId, meetingUuid);
    if (participants.length > 0) {
      console.log(`[Zoom] Got ${participants.length} participants from /past_meetings for ${meetingUuid}`);
      return participants;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`[Zoom] /past_meetings endpoint failed for ${meetingUuid}: ${msg}`);
  }

  // Fall back to /report endpoint (requires report:read:admin scope)
  try {
    const participants = await getZoomReportParticipants(userId, meetingUuid);
    if (participants.length > 0) {
      console.log(`[Zoom] Got ${participants.length} participants from /report for ${meetingUuid}`);
      return participants;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`[Zoom] /report endpoint failed for ${meetingUuid}: ${msg}`);
  }

  console.log(`[Zoom] No participants found for meeting ${meetingUuid}`);
  return [];
}

// ============================================================================
// Per-User OAuth 2.0 Functions
// These functions use the authenticated user's Zoom tokens
// ============================================================================

/**
 * Fetch cloud recordings from Zoom for a specific user
 * Uses the user's OAuth 2.0 tokens
 */
export async function fetchUserZoomRecordings(
  userId: string,
  days: number = 30
): Promise<ZoomMeetingWithRecordings[]> {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  const meetings: ZoomMeetingWithRecordings[] = [];
  let nextPageToken = "";

  do {
    const params: Record<string, string> = {
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
      page_size: "100",
    };

    if (nextPageToken) {
      params.next_page_token = nextPageToken;
    }

    // Use /users/me for per-user OAuth (returns user's recordings)
    const response = await userZoomRequest<ZoomRecordingsResponse>(
      userId,
      "/users/me/recordings",
      { params }
    );

    for (const meeting of response.meetings) {
      // Find transcript file (VTT format)
      const transcriptFile = meeting.recording_files.find(
        (f) => f.file_type === "TRANSCRIPT" || f.file_extension === "VTT"
      );

      // Find video file (prefer shared_screen_with_speaker_view, then active_speaker)
      const videoFile =
        meeting.recording_files.find(
          (f) =>
            f.recording_type === "shared_screen_with_speaker_view" &&
            f.file_type === "MP4"
        ) ||
        meeting.recording_files.find(
          (f) => f.recording_type === "active_speaker" && f.file_type === "MP4"
        ) ||
        meeting.recording_files.find((f) => f.file_type === "MP4");

      const passcode = meeting.recording_play_passcode || meeting.password || null;
      meetings.push({
        uuid: meeting.uuid,
        id: meeting.id,
        topic: meeting.topic,
        startTime: new Date(meeting.start_time),
        duration: meeting.duration,
        recordings: meeting.recording_files,
        transcriptUrl: transcriptFile?.download_url || null,
        videoUrl: buildVideoUrlWithPasscode(videoFile?.play_url || null, passcode),
        hostEmail: meeting.host_email || null,
        password: passcode,
      });
    }

    nextPageToken = response.next_page_token || "";
  } while (nextPageToken);

  return meetings;
}

/**
 * Get transcript text from a Zoom meeting using user's OAuth tokens
 */
export async function getUserZoomTranscript(
  userId: string,
  meeting: ZoomMeetingWithRecordings
): Promise<string | null> {
  if (!meeting.transcriptUrl) {
    return null;
  }

  try {
    const vttContent = await downloadUserZoomRecordingText(userId, meeting.transcriptUrl);
    return parseVttToText(vttContent);
  } catch (error) {
    console.error(`Failed to download Zoom transcript for meeting ${meeting.id}:`, error);
    return null;
  }
}

interface ZoomSyncResult {
  meeting: Meeting;
  isNew: boolean;
  unmatchedDomains: string[];
  transcriptFailed?: boolean;
  hadTranscriptUrl?: boolean;
}

/**
 * Sync a Zoom meeting to the database using user's OAuth tokens
 * Now properly adds participants to meeting_participants table
 */
export async function syncUserZoomMeetingToDatabase(
  accountId: string,
  userId: string,
  meeting: ZoomMeetingWithRecordings,
  options: { includeTranscript?: boolean } = {}
): Promise<ZoomSyncResult> {
  const { includeTranscript = true } = options;

  const externalId = getZoomExternalId(meeting);

  const existing = await getMeetingByExternalId(accountId, externalId);
  if (existing) {
    return { meeting: existing, isNew: false, unmatchedDomains: [] };
  }

  // Get transcript if available
  let transcript: string | null = null;
  let transcriptSource: "zoom" | null = null;
  let transcriptFailed = false;
  const hadTranscriptUrl = !!meeting.transcriptUrl;

  if (includeTranscript && meeting.transcriptUrl) {
    console.log(`[Zoom Sync] Downloading transcript for meeting "${meeting.topic}"...`);

    // First try with user's OAuth token
    transcript = await getUserZoomTranscript(userId, meeting);

    // If user token failed, fall back to Server-to-Server OAuth
    if (!transcript) {
      console.log(`[Zoom Sync] User OAuth failed, trying Server-to-Server OAuth for "${meeting.topic}"...`);
      transcript = await getZoomTranscript(meeting);
    }

    if (transcript) {
      transcriptSource = "zoom";
      console.log(`[Zoom Sync] Successfully downloaded transcript (${transcript.length} chars) for meeting "${meeting.topic}"`);
    } else {
      transcriptFailed = true;
      console.error(`[Zoom Sync] Failed to download transcript for meeting "${meeting.topic}" - URL was available but both OAuth methods failed`);
    }
  }

  // Fetch participants first so we can get host name
  let participants: { id: string; name: string; user_email: string }[] = [];
  try {
    participants = await getZoomMeetingParticipants(userId, meeting.uuid);
    console.log(`[Zoom Sync] Got ${participants.length} participants for meeting "${meeting.topic}"`);
  } catch (error) {
    console.error(`[Zoom Sync] Failed to fetch participants for meeting ${meeting.uuid}:`, error);
  }

  // Try to get host name from participants (if host joined with same email)
  let hostName: string | null = null;
  if (meeting.hostEmail) {
    const hostParticipant = participants.find(
      (p) => p.user_email && p.user_email.toLowerCase() === meeting.hostEmail!.toLowerCase()
    );
    if (hostParticipant?.name) {
      hostName = hostParticipant.name;
    }
  }

  const newMeeting = await createMeeting(accountId, {
    external_id: externalId,
    name: meeting.topic,
    meeting_date: meeting.startTime,
    source: "zoom",
    recording_url: meeting.videoUrl,
    transcript: transcript,
    transcript_source: transcriptSource,
    workflow_status: transcript ? "transcribed" : "pending",
    host_email: meeting.hostEmail,
    host_name: hostName,
    recording_passcode: meeting.password,
  });

  const participantEmails: string[] = [];
  for (const participant of participants) {
    if (!participant.user_email) continue;
    if (meeting.hostEmail && participant.user_email.toLowerCase() === meeting.hostEmail.toLowerCase()) continue;

    participantEmails.push(participant.user_email);

    try {
      let personnelRecord = await getPersonnelByEmail(accountId, participant.user_email);
      if (!personnelRecord) {
        const name = participant.name || participant.user_email.split("@")[0];
        personnelRecord = await createPersonnel(accountId, {
          name,
          email: participant.user_email,
        });
      }
      await addMeetingParticipant(accountId, newMeeting.id, personnelRecord.id);
    } catch (error) {
      console.error(`[Zoom Sync] Failed to add participant ${participant.user_email}:`, error);
    }
  }

  let unmatchedDomains: string[] = [];
  if (participantEmails.length > 0) {
    const matchResult = await matchMeetingToCompanyByEmails(accountId, newMeeting.id, participantEmails);
    if (!matchResult.customerId) {
      unmatchedDomains = matchResult.unmatchedDomains;
    }
  }

  return { meeting: newMeeting, isNew: true, unmatchedDomains, transcriptFailed, hadTranscriptUrl };
}

/**
 * Get Zoom meetings that can be synced for a specific user
 * Uses the user's OAuth 2.0 tokens
 */
export async function getUserZoomMeetingsForSync(
  accountId: string,
  userId: string,
  days: number = 30
): Promise<
  Array<ZoomMeetingWithRecordings & { alreadySynced: boolean; externalId: string }>
> {
  const recordings = await fetchUserZoomRecordings(userId, days);

  const results = await Promise.all(
    recordings.map(async (meeting) => {
      const externalId = getZoomExternalId(meeting);
      const alreadySynced = await zoomMeetingExists(accountId, meeting);
      return { ...meeting, alreadySynced, externalId };
    })
  );

  return results;
}
