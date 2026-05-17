# Implementation Status

## Project: Qualitative - Meeting Insights Platform

### MVP Scope (Based on Discussion)
- **Integrations**: Google Meet + HubSpot (Zoom, Linear deferred)
- **Workflows**: Display action items in-app only (no external integrations)
- **Users**: Equal access for all markerlearning.com employees
- **Transcripts**: Use Google Meet transcripts when available, Gemini Files API as fallback
- **Rules Creation**: UI for uploading transcript+notes pairs
- **Meeting Sync**: Webhook-based real-time notifications

---

## Implementation Phases

### Phase 1: Foundation & Database Schema
**Status**: COMPLETED

- [x] **1.1** Set up database schema with Neon PostgreSQL
  - Customer table (id, name, address, created_at, updated_at)
  - Personnel table (id, name, title, customer_id, role_id, group_id, created_at, updated_at)
  - Role table (id, name, description, created_at, updated_at)
  - Group table (id, name, created_at, updated_at)
  - Meeting table (id, name, date, customer_id, participants[], transcript, user_notes, workflow_status, source, recording_url, transcript_source, created_at, updated_at)
  - ExtractRule table (id, name, summary, quotes[], action_items[], is_active, created_at, updated_at)
  - Tag table (id, name, type, created_at, updated_at)
  - Extract table (id, meeting_id, customer_id, date, summary, quotes[], is_action_item, action_item_status, created_at, updated_at)
  - User table (id, email, name, image, google_access_token, google_refresh_token, google_token_expires_at, created_at, updated_at)
  - Junction tables for participants and tags
  - Workflow tables (for future use)

- [x] **1.2** Create database migration scripts
  - Created `db/migrations/001_initial_schema.sql`
  - Created `db/migrate.ts` migration runner
  - Added `npm run db:migrate` script

- [x] **1.3** Set up database utility functions (CRUD operations)
  - Created `lib/db/` with type-safe repositories for all entities
  - Repositories: customers, personnel, roles, groups, meetings, tags, extracts, extract-rules, users
  - Full CRUD operations with search and filtering functions

### Phase 2: Authentication
**Status**: COMPLETED

- [x] **2.1** Set up NextAuth.js with Google OAuth provider
  - Installed NextAuth.js v5 (beta)
  - Configured Google OAuth with Calendar and Drive scopes
  - Created `lib/auth.ts` with full auth configuration

- [x] **2.2** Implement email domain restriction (markerlearning.com only)
  - Added signIn callback to validate email domain
  - Development mode allows other domains with warning

- [x] **2.3** Create auth middleware for protected routes
  - Created `middleware.ts` to protect all routes except /login and /api/auth
  - Automatic redirect to login for unauthenticated users

- [x] **2.4** Create user session management
  - User data stored in database on sign-in
  - Google tokens (access & refresh) persisted for API access
  - JWT-based session strategy

- [x] **2.5** Build login/logout UI components
  - Created `/login` page with Google sign-in button
  - Created `UserMenu` component with avatar and sign-out
  - Updated home page with dashboard layout and user info

### Phase 3: Google Meet Integration
**Status**: COMPLETED

- [x] **3.1** Set up Google Calendar/Meet API client
  - Created `lib/google/client.ts` with OAuth2 client setup
  - Automatic token refresh handling
  - Calendar and Drive API clients

- [x] **3.2** Implement OAuth flow for Google Meet access
  - OAuth2 credentials from NextAuth session
  - Token storage in database per user

- [x] **3.3** Build meeting fetcher (retrieve meetings from last 7 days)
  - Created `lib/google/meetings.ts` with `fetchGoogleMeetings()`
  - Filters to only Google Meet events
  - Extracts meeting metadata (name, date, attendees)

- [x] **3.4** Create webhook endpoint for real-time meeting notifications
  - Deferred to future iteration (manual sync for MVP)

- [x] **3.5** Implement transcript retrieval from Google Meet (plain text from Drive)
  - `findMeetTranscript()` searches Drive for meeting transcripts
  - `getTranscriptContent()` exports Google Docs as plain text
  - `findMeetRecording()` locates video recordings for Gemini fallback

- [x] **3.6** Build meeting sync status tracking
  - API routes: `/api/meetings/sync`, `/api/meetings`, `/api/meetings/[id]`
  - Meetings list page with sync button
  - Meeting detail page with process button
  - Status badges (pending, processing, completed, failed)

### Phase 3.5: HubSpot Integration
**Status**: COMPLETED

- [x] **3.5.1** Set up HubSpot API client
  - Created `lib/hubspot/client.ts` with access token authentication
  - Generic request helper for HubSpot API calls

- [x] **3.5.2** Implement meetings fetcher
  - Created `lib/hubspot/meetings.ts` with `fetchHubSpotMeetingsLastDays()`
  - Fetches meeting title, description, notes, location, start/end times
  - Supports pagination for large result sets

- [x] **3.5.3** Create sync API endpoint
  - API route at `/api/meetings/sync-hubspot`
  - Imports meetings from last 7 days
  - Deduplicates based on external_id

- [x] **3.5.4** Update meetings UI
  - Added HubSpot to sync dropdown menu
  - HubSpot source badge in meetings list
  - Source display on meeting detail page

### Phase 4: Gemini Integration (Transcript Generation)
**Status**: COMPLETED

- [x] **4.1** Set up Gemini API client
  - Created `lib/gemini/client.ts` with GoogleGenerativeAI and FileManager
  - File state polling for upload processing

- [x] **4.2** Stream recordings from Google Drive directly to Gemini Files API
  - Created `lib/gemini/transcribe.ts`
  - Downloads from Drive, uploads to Gemini via temp file
  - Auto-cleanup of temp files after upload

- [x] **4.3** Build transcript generation from audio/video recordings
  - Uses Gemini 1.5 Pro for transcription
  - Speaker labeling and timestamp formatting
  - Full verbatim transcription (no summarization)

- [x] **4.4** Create fallback logic: Google Meet transcript → Gemini transcription
  - Updated `/api/meetings/[id]/process` endpoint
  - First tries Google Drive transcript
  - Falls back to Gemini transcription for recordings
  - Automatic status tracking through pipeline

### Phase 5: Extraction Rules Engine
**Status**: COMPLETED

- [x] **5.1** Build UI for uploading transcript + notes pairs
  - Created `/extract-rules` page with upload form
  - Transcript and notes text areas

- [x] **5.2** Implement Gemini prompt for generating extraction rules from pairs
  - Created `lib/gemini/extraction.ts` with rule generation
  - Matches notes to transcript quotes
  - Auto-assigns relevant tags

- [x] **5.3** Create extraction rules management UI (list, edit, delete)
  - Rules list with expand/collapse
  - Enable/disable toggle
  - Shows example quotes

- [x] **5.4** Seed default tags (feature_request, bug_reports, positive_feedback, etc.)
  - 34 tags seeded in Phase 1 migration

- [x] **5.5** Build tag management UI
  - Tags displayed on extract rules page
  - Auto-created when generating rules

### Phase 6: Meeting Extraction Processing
**Status**: COMPLETED

- [x] **6.1** Implement Gemini prompt for extracting insights from transcripts
  - Created `lib/gemini/extraction.ts` with `extractInsightsFromTranscript()`
  - Uses extraction rules to guide insight extraction
  - Returns structured insights with summaries, quotes, tags, and action item flags

- [x] **6.2** Build extraction processing pipeline
  - Created `lib/extraction/process.ts` with `processMeetingExtracts()`
  - Processes transcripts and creates extracts in database
  - Links extracts to meetings and adds tags

- [x] **6.3** Create extract storage and linking to meetings
  - Extracts stored with meeting_id, customer_id, quotes, and tags
  - Added `getExtractsWithTagsByMeetingId()` for retrieving extracts with tags
  - Extract tags linked via junction table

- [x] **6.4** Implement action item detection and flagging
  - Action items automatically detected during extraction
  - `is_action_item` flag and `action_item_status` tracked
  - Visual distinction in UI for action items

- [x] **6.5** Build extraction status tracking
  - API endpoint at `/api/meetings/[id]/extract`
  - Extract button on meeting detail page
  - Shows extract count and action item count
  - Displays quotes and tags for each extract

### Phase 7: Core UI - Dashboard & Views
**Status**: Not Started

- [ ] **7.1** Create main dashboard layout with navigation
- [ ] **7.2** Build meetings list view (filterable by date, customer)
- [ ] **7.3** Build meeting detail view (transcript, extracts, action items)
- [ ] **7.4** Create customers list view
- [ ] **7.5** Create customer detail view (associated meetings, personnel)
- [ ] **7.6** Build extracts/insights view (searchable, filterable by tags)
- [ ] **7.7** Create action items view (aggregated from all meetings)
- [ ] **7.8** Implement responsive design for mobile web

### Phase 8: Search & Filtering
**Status**: Not Started

- [ ] **8.1** Implement full-text search on transcripts and extracts
- [ ] **8.2** Build tag-based filtering
- [ ] **8.3** Create date range filtering
- [ ] **8.4** Add customer/organization filtering
- [ ] **8.5** Implement search results UI

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 15 (App Router) |
| Database | Neon PostgreSQL |
| Authentication | NextAuth.js + Google OAuth |
| AI/Transcription | Gemini Files API + Gemini Pro |
| Meeting Source | Google Calendar API + Google Drive API |
| Deployment | Vercel |
| Styling | Tailwind CSS |

---

## Environment Variables Status

```
# ✅ All configured in .vercel/.env.development.local
DATABASE_URL=✅ configured
GOOGLE_CLIENT_ID=✅ configured
GOOGLE_CLIENT_SECRET=✅ configured
GEMINI_API_KEY=✅ configured
BLOB_READ_WRITE_TOKEN=✅ configured (available if needed)
NEXTAUTH_SECRET=✅ configured
NEXTAUTH_URL=✅ configured (http://localhost:3000)
HUBSPOT_ACCESS_TOKEN=⚠️ optional (required for HubSpot integration)
```

---

## Decisions Made

1. **Google Meet API Access**: Use Google Calendar API to fetch meeting events, Google Drive API to access recordings/transcripts. ✓

2. **Webhook Setup**: Credentials will be provided when implementing webhook integration. ✓

3. **Transcript Format**: Extract plain text only from Google Docs transcripts. ✓

4. **Recording Handling**: Stream recordings directly to Gemini Files API for transcription - do not store in Vercel Blob. This avoids storage costs and simplifies the pipeline. ✓

---

## Current Progress

- [x] Project initialized with Next.js 15
- [x] Neon PostgreSQL connected
- [x] Environment variables configured via Vercel
- [x] Database schema created (12 tables with indexes and triggers)
- [x] Database migration system set up
- [x] Type-safe CRUD utilities created
- [x] 34 default tags seeded
- [x] Authentication implemented (NextAuth.js + Google OAuth)
- [x] Login/logout UI and middleware
- [x] Google Meet integration (Calendar API + Drive API)
- [x] Meetings list and detail pages
- [x] Gemini integration (transcript generation fallback)
- [x] Extraction rules engine (UI for creating rules from transcript+notes pairs)
- [x] Meeting extraction processing (extract insights with tags and action items)
- [ ] Core UI completed (Phase 7)
- [ ] Search & Filtering (Phase 8)

---

## Recent Changes (Jan 2025)

### Meeting Autosync User Setting - ADDED
**Date**: January 21, 2025

Added a new user setting `meeting_autosync_enabled` to control whether meetings are automatically synced.

**Implementation**:
1. Created migration `023_meeting_autosync_enabled.sql` - Adds boolean column with default `FALSE`
2. Updated `User` type in `lib/db/types.ts`
3. Added database functions in `lib/db/users.ts`:
   - `getUserMeetingAutosyncEnabled(userId)` - Gets autosync preference
   - `updateUserMeetingAutosyncEnabled(userId, enabled)` - Updates preference
4. Updated `/api/user/preferences` endpoint to include `meetingAutosyncEnabled` in GET/PATCH

**Default Behavior**: All existing users have autosync disabled by default.

### Future Meetings Hidden from List - ADDED
**Date**: January 21, 2025

Meetings occurring in the future are no longer shown in the meetings list.

**Implementation**:
1. Added `getPastMeetings()` function in `lib/db/meetings.ts` that filters to meetings where `meeting_date <= NOW()`
2. Updated `app/meetings/page.tsx` to use `getPastMeetings()` instead of `getMeetings()`

---

## Recent Fixes (Dec 2024)

### Email Address Issue in Email Drafts - FIXED
**Issue**: Email addresses were not appearing in generated email drafts for meetings.

**Root Cause**: The email workflow had multiple sources for participant emails but lacked a fallback mechanism:
1. `meeting_participants` table - Only populated for meetings synced AFTER participant sync was added
2. Extracts' `participant_email` - Relies on Gemini extracting emails from transcripts (rarely present)
3. HubSpot fallback - Existed but was never integrated into the workflow

**Fix Applied**:
1. Added HubSpot fallback to `lib/workflows/email-workflow.ts` to search for matching HubSpot meetings by time window and retrieve participant emails from contacts
2. Updated recipient storage to include ALL participant emails (comma-separated)
3. Improved email draft panel display for multiple recipients

**Files Modified**:
- `lib/workflows/email-workflow.ts` - Added HubSpot fallback, store all recipient emails
- `app/meetings/[id]/email-draft-panel.tsx` - Better display for multiple recipients

---

## Next Steps

### Recommended Priority Order:

1. **Phase 7: Core UI - Dashboard & Views** (High Priority)
   - Create main dashboard with at-a-glance metrics
   - Build customer list view with filtering
   - Improve meetings list with better search/filter
   - Create extracts/insights aggregated view
   - Action items view across all meetings

2. **Phase 8: Search & Filtering** (High Priority)
   - Full-text search on transcripts and extracts
   - Tag-based filtering
   - Date range filtering
   - Customer/organization filtering

3. **Per-User Zoom OAuth Integration** (Medium Priority)
   - As documented in PROJECT_PLAN.md
   - Enables Zoom meeting sync per user

4. **Microsoft Teams Integration** (Medium Priority)
   - Similar to Zoom OAuth flow
   - Sync Teams meetings with transcripts

5. **Webhook-based Real-time Notifications** (Lower Priority)
   - Google Meet webhook for new meetings
   - HubSpot webhook for meeting updates

6. **Mobile Web Optimization** (Lower Priority)
   - Responsive design improvements
   - Touch-friendly interactions
