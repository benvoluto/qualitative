/**
 * Zoom Integration
 * Supports both Server-to-Server OAuth and per-user OAuth 2.0
 */

// Server-to-Server OAuth (account-level access)
export { isZoomConfigured, getZoomAccessToken, zoomRequest } from "./client";
export {
  fetchZoomRecordings,
  getZoomTranscript,
  zoomMeetingExists,
  syncZoomMeetingToDatabase,
  processZoomMeetingTranscript,
  getZoomMeetingsForSync,
  type ZoomMeetingWithRecordings,
} from "./meetings";

// Per-User OAuth 2.0 (user-level access)
export {
  isUserZoomConnected,
  getUserZoomAccessToken,
  userZoomRequest,
  downloadUserZoomRecording,
  downloadUserZoomRecordingText,
  clearUserZoomTokenCache,
  ZoomReauthRequiredError,
} from "./client";
export {
  fetchUserZoomRecordings,
  getUserZoomTranscript,
  syncUserZoomMeetingToDatabase,
  getUserZoomMeetingsForSync,
  getZoomMeetingParticipants,
} from "./meetings";

// OAuth flow helpers
export { isZoomOAuthConfigured, getZoomAuthUrl } from "./oauth";
