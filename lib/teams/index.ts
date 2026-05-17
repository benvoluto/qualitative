/**
 * Microsoft Teams Integration
 * User OAuth via NextAuth for per-user access to meetings and transcripts
 */

export {
  isMicrosoftConfigured,
  userHasMicrosoftTokens,
  getMicrosoftAccessToken,
  graphRequest,
} from "./client";

export {
  fetchTeamsMeetings,
  getTeamsMeetingDetails,
  getTeamsMeetingTranscript,
  teamsMeetingExists,
  syncTeamsMeetingToDatabase,
  processTeamsMeetingTranscript,
  getTeamsMeetingsForSync,
  type TeamsMeeting,
} from "./meetings";
