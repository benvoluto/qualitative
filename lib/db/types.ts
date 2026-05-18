// Database entity types

export interface Account {
  id: string;
  name: string;
  internal_domain: string | null;
  internal_domain_aliases: string[];
  deal_email_prompt_template: string | null;
  customer_email_prompt_template: string | null;
  notes_prompt_template: string | null;
  created_at: Date;
  updated_at: Date;
}

export type SubscriptionPlan = "free" | "pro";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete";

export interface Subscription {
  account_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_end: Date | null;
  /** Admin-granted Pro flag — independent of Stripe state. */
  comped: boolean;
  created_at: Date;
  updated_at: Date;
}

export type CustomerType = "deal" | "customer";

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  domain_aliases: string[];
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  hubspot_company_id: string | null;
  hubspot_synced_at: Date | null;
  waitlist: boolean;
  waitlist_date: Date | null;
  waitlist_followup: Date | null;
  waitlist_source: string | null;
  deal_stage: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Customer {
  id: string;
  name: string;
  address: string | null;
  domain: string | null;
  domain_aliases: string[];
  customer_type: CustomerType;
  hubspot_company_id: string | null;
  hubspot_deal_id: string | null;
  deal_stage: string | null;
  hubspot_synced_at: Date | null;
  company_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Group {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface Personnel {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  customer_id: string | null;
  company_id: string | null;
  role_id: string | null;
  group_id: string | null;
  hubspot_contact_id: string | null;
  hubspot_synced_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Tag {
  id: string;
  name: string;
  type: string | null;
  color: string | null;
  created_at: Date;
  updated_at: Date;
}

export type MeetingSource = "google_meet" | "zoom" | "teams" | "hubspot" | "manual";
export type TranscriptSource = "google_meet" | "teams" | "zoom" | "gemini" | "manual";
export type WorkflowStatus = "pending" | "processing" | "transcribed" | "completed" | "failed";
export type ParticipationStatus = "invited" | "participated" | "n/a";

export interface Meeting {
  id: string;
  external_id: string | null;
  name: string | null;
  meeting_date: Date | null;
  customer_id: string | null;
  company_id: string | null;
  transcript: string | null;
  user_notes: string | null;
  workflow_status: WorkflowStatus;
  source: MeetingSource | null;
  recording_url: string | null;
  meeting_url: string | null;
  transcript_source: TranscriptSource | null;
  host_name: string | null;
  host_email: string | null;
  is_internal: boolean;
  recording_passcode: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  personnel_id: string;
  participation_status: ParticipationStatus;
  created_at: Date;
}

export interface ExtractRule {
  id: string;
  name: string;
  summary: string | null;
  quotes: string[];
  action_items: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type ActionItemStatus = "pending" | "assigned" | "done" | null;
export type RequestStatus = "pending" | "ticket_added" | null;

export interface Extract {
  id: string;
  meeting_id: string;
  customer_id: string | null;
  company_id: string | null;
  extract_rule_id: string | null;
  extract_date: Date | null;
  summary: string | null;
  quotes: string[];
  is_action_item: boolean;
  action_item_status: ActionItemStatus;
  request_status: RequestStatus;
  participant_name: string | null;
  participant_email: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface WorkflowStepType {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Workflow {
  id: string;
  name: string;
  summary: string | null;
  status: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_type_id: string | null;
  name: string | null;
  step_order: number;
  trigger_config: Record<string, unknown>;
  action_config: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: string;
  account_id: string;
  email: string;
  name: string | null;
  image: string | null;
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_token_expires_at: Date | null;
  ms_access_token: string | null;
  ms_refresh_token: string | null;
  ms_token_expires_at: Date | null;
  zoom_access_token: string | null;
  zoom_refresh_token: string | null;
  zoom_token_expires_at: Date | null;
  zoom_user_id: string | null;
  sync_days_preference: number;
  meeting_autosync_enabled: boolean;
  notification_email: string | null;
  notify_on_draft_created: boolean;
  notify_on_notes_created: boolean;
  onboarded_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type PromptTemplateType = "deal_email" | "customer_email" | "notes";

export type EmailDraftType = "follow_up" | "action_items" | "meeting_notes";
export type EmailDraftStatus = "draft" | "sent" | "discarded";

export interface EmailDraft {
  id: string;
  meeting_id: string;
  draft_type: EmailDraftType;
  subject: string | null;
  body: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  status: EmailDraftStatus;
  sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Input types for creating/updating entities
export type CreateCompany = Pick<Company, "name"> &
  Partial<Pick<Company, "domain" | "address" | "city" | "state" | "zip" | "country" | "hubspot_company_id" | "hubspot_synced_at" | "waitlist" | "waitlist_date" | "waitlist_followup" | "waitlist_source" | "deal_stage">>;
export type UpdateCompany = Partial<
  Pick<Company, "name" | "domain" | "address" | "city" | "state" | "zip" | "country" | "hubspot_company_id" | "hubspot_synced_at" | "waitlist" | "waitlist_date" | "waitlist_followup" | "waitlist_source" | "deal_stage">
>;

export type CreateCustomer = Pick<Customer, "name"> &
  Partial<Pick<Customer, "address" | "domain" | "customer_type" | "hubspot_company_id" | "hubspot_deal_id" | "deal_stage" | "hubspot_synced_at" | "company_id">>;
export type UpdateCustomer = Partial<
  Pick<Customer, "name" | "address" | "domain" | "customer_type" | "hubspot_company_id" | "hubspot_deal_id" | "deal_stage" | "hubspot_synced_at" | "company_id">
>;

export type CreateRole = Pick<Role, "name"> & Partial<Pick<Role, "description">>;
export type UpdateRole = Partial<Pick<Role, "name" | "description">>;

export type CreateGroup = Pick<Group, "name">;
export type UpdateGroup = Partial<Pick<Group, "name">>;

export type CreatePersonnel = Pick<Personnel, "name"> &
  Partial<Pick<Personnel, "title" | "email" | "customer_id" | "company_id" | "role_id" | "group_id" | "hubspot_contact_id" | "hubspot_synced_at">>;
export type UpdatePersonnel = Partial<
  Pick<Personnel, "name" | "title" | "email" | "customer_id" | "company_id" | "role_id" | "group_id" | "hubspot_contact_id" | "hubspot_synced_at">
>;

export type CreateTag = Pick<Tag, "name"> & Partial<Pick<Tag, "type" | "color">>;
export type UpdateTag = Partial<Pick<Tag, "name" | "type" | "color">>;

export type CreateMeeting = Partial<
  Pick<
    Meeting,
    | "external_id"
    | "name"
    | "meeting_date"
    | "customer_id"
    | "company_id"
    | "transcript"
    | "user_notes"
    | "workflow_status"
    | "source"
    | "recording_url"
    | "meeting_url"
    | "transcript_source"
    | "host_name"
    | "host_email"
    | "is_internal"
    | "recording_passcode"
  >
>;
export type UpdateMeeting = Partial<
  Pick<
    Meeting,
    | "name"
    | "meeting_date"
    | "customer_id"
    | "company_id"
    | "transcript"
    | "user_notes"
    | "workflow_status"
    | "recording_url"
    | "meeting_url"
    | "transcript_source"
    | "host_name"
    | "host_email"
    | "is_internal"
    | "recording_passcode"
  >
>;

export type CreateExtractRule = Pick<ExtractRule, "name"> &
  Partial<Pick<ExtractRule, "summary" | "quotes" | "action_items" | "is_active">>;
export type UpdateExtractRule = Partial<
  Pick<ExtractRule, "name" | "summary" | "quotes" | "action_items" | "is_active">
>;

export type CreateExtract = Pick<Extract, "meeting_id"> &
  Partial<
    Pick<Extract, "customer_id" | "company_id" | "extract_rule_id" | "extract_date" | "summary" | "quotes" | "is_action_item" | "action_item_status" | "request_status" | "participant_name" | "participant_email">
  >;
export type UpdateExtract = Partial<
  Pick<Extract, "customer_id" | "company_id" | "extract_rule_id" | "extract_date" | "summary" | "quotes" | "is_action_item" | "action_item_status" | "request_status" | "participant_name" | "participant_email">
>;

export type CreateUser = Pick<User, "email"> &
  Partial<Pick<User, "name" | "image" | "google_access_token" | "google_refresh_token" | "google_token_expires_at" | "ms_access_token" | "ms_refresh_token" | "ms_token_expires_at" | "zoom_access_token" | "zoom_refresh_token" | "zoom_token_expires_at" | "zoom_user_id" | "sync_days_preference">>;
export type UpdateUser = Partial<
  Pick<User, "name" | "image" | "google_access_token" | "google_refresh_token" | "google_token_expires_at" | "ms_access_token" | "ms_refresh_token" | "ms_token_expires_at" | "zoom_access_token" | "zoom_refresh_token" | "zoom_token_expires_at" | "zoom_user_id" | "sync_days_preference">
>;

export type CreateEmailDraft = Pick<EmailDraft, "meeting_id" | "draft_type"> &
  Partial<Pick<EmailDraft, "subject" | "body" | "recipient_email" | "recipient_name" | "status">>;
export type UpdateEmailDraft = Partial<
  Pick<EmailDraft, "subject" | "body" | "recipient_email" | "recipient_name" | "status" | "sent_at">
>;
