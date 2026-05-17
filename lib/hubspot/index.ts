export { hubspotRequest, isHubSpotConfigured, getHubSpotCredentials } from "./client";
export {
  fetchAllHubSpotMeetings,
  fetchHubSpotMeetingsLastDays,
  fetchHubSpotMeetingById,
  getHubSpotMeetingContacts,
  getHubSpotMeetingCompanies,
  getHubSpotOwner,
  findHubSpotMeetingParticipants,
  getParticipantsFromHubSpotFallback,
  type HubSpotMeetingData,
} from "./meetings";
export {
  fetchAllHubSpotCompanies,
  getCompaniesWithRecentMeetings,
  fetchHubSpotCompanyById,
  searchHubSpotCompanies,
  getLatestHubSpotCompanyModifiedDate,
  type HubSpotCompanyData,
} from "./companies";
export {
  fetchAllHubSpotDeals,
  fetchHubSpotDealById,
  getHubSpotDealCompanies,
  getDealsWithRecentMeetings,
  searchHubSpotDeals,
  getHubSpotDealsByStage,
  getOpenHubSpotDeals,
  getHubSpotDealsForCompany,
  getBestDealStageForCompany,
  type HubSpotDealData,
} from "./deals";
export {
  createHubSpotNote,
  formatCRMNotesForHubSpot,
  writeMeetingNotesToHubSpot,
  type CreateNoteOptions,
} from "./notes";
export {
  fetchHubSpotContactById,
  fetchHubSpotContactsByIds,
  searchHubSpotContacts,
  getHubSpotContactByEmail,
  type HubSpotContactData,
} from "./contacts";
