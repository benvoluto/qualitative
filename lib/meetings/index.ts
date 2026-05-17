export {
  matchMeetingToCompanyByParticipants,
  matchMeetingToCompanyByEmails,
  isInternalMeeting,
} from "./match-company";

export {
  syncCompanyDealStages,
  ensureCompaniesAreSynced,
  getCustomerTypeWithSync,
  getCustomerTypeFromDealStage,
} from "./company-sync";

export {
  autoProcessAndExtract,
  autoProcessMeetings,
  type AutoProcessResult,
} from "./auto-process";
