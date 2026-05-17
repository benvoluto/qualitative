export { getGeminiClient, getFileManager, waitForFileProcessing } from "./client";
export {
  uploadDriveFileToGemini,
  transcribeWithGemini,
  transcribeMeetingRecording,
  needsGeminiTranscription,
} from "./transcribe";
export {
  generateExtractionRules,
  saveGeneratedRules,
  extractInsightsFromTranscript,
  type CompanyInfo,
  type GeneratedExtract,
} from "./extraction";
export {
  generateFollowUpEmail,
  generateActionItemsEmail,
  generateMeetingNotesEmail,
  generateMeetingNotesSummary,
  generateCRMNotes,
  extractFeatureRequests,
  extractBugReports,
  type GeneratedEmail,
  type GeneratedCRMNote,
  type FeatureRequestData,
  type BugReportData,
  type ActionItemData,
  type MeetingParticipantInfo,
} from "./email-generation";
export {
  hasTicketableContent,
  generateTicketText,
  formatTicketsAsText,
  type GeneratedTicket,
  type GeneratedTickets,
} from "./ticket-generation";
export {
  generateActivitySummary,
  generateAllActivitySummaries,
} from "./activity-summary";
export {
  analyzeTranscriptParticipation,
  extractSpeakerLabels,
  type ParticipantAnalysis,
  type ParticipationAnalysisResult,
} from "./participation-analysis";
