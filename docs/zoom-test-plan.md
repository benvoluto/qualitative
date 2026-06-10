# Zoom Marketplace Test Plan — Qualitative

This document walks Zoom Marketplace reviewers through end-to-end testing of the Qualitative integration, covering authorization, every requested scope, and all user-facing functionality.

---

## 1. Test Credentials

| Item | Value |
|---|---|
| Application URL | `https://<PROD_DOMAIN>` (replace with production URL) |
| Sign-in method | Google OAuth |
| App test account (Google) | `ttestor892@gmail.com` |
| App test password | Shared separately with reviewer |
| Zoom test account | `ttestor892@gmail.com` (Zoom Pro, has at least one cloud recording with a completed transcript) |
| Zoom Client ID in use | Production Client ID |

The reviewer should sign in to the application with the Google account above. The same email is registered on a Zoom Pro account so the Zoom OAuth consent screen can be completed with the same identity.

---

## 2. App Overview

Qualitative imports a user's Zoom cloud recordings and their VTT transcripts, then surfaces them inside an internal workspace where the user can review participants, read transcripts, and run qualitative analysis. The app is **read-only against Zoom** — it never creates, edits, schedules, or deletes Zoom meetings, recordings, or users.

The Zoom integration is per-user OAuth. Each end user individually authorizes Qualitative against their own Zoom account; there is no account-level or admin install.

---

## 3. Scopes Requested and Why

All scopes are granular and read-only.

| Scope | Why the app needs it | UI step that exercises it |
|---|---|---|
| `user:read:user` | Identify the Zoom user being connected and store their Zoom user ID against their app profile, so future syncs target the right account. | Section 5, Step 4 ("Connected as …" status row). |
| `cloud_recording:read:list_user_recordings` | Enumerate the user's cloud recordings so we know which meetings to import. | Section 5, Step 6 (Meetings list populates after sync). |
| `cloud_recording:read:list_recording_files` | For each recording, list the files attached (audio, video, transcript, chat). The app uses this to find the VTT transcript file. | Section 5, Step 6 (transcript availability badge on each meeting). |
| `cloud_recording:read:recording` | Fetch the recording-file metadata needed to download the transcript file. | Section 5, Step 7 (transcript loads into the meeting detail view). |
| `cloud_recording:read:meeting_transcript` | Read the VTT transcript content itself, which is the core data Qualitative analyzes. | Section 5, Step 7 (transcript body shown verbatim in the meeting detail). |
| `meeting:read:list_meeting_participants` | List past participants for a meeting so the app can attribute speakers and match attendees to companies in the user's CRM. | Section 5, Step 8 (Participants panel on the meeting detail view). |

The app does **not** request, store, or use any write scopes.

---

## 4. Prerequisites for the Reviewer

Before starting:

1. Be signed out of any other Zoom account in the browser you intend to use.
2. Have the test Google account credentials (`ttestor892@gmail.com`) ready.
3. Use a Chromium-based browser if possible (Chrome, Edge, Arc).

---

## 5. Step-by-Step Test Procedure

### Step 1 — Open the application

Navigate to `https://<PROD_DOMAIN>`. You should land on the marketing/login page.

**Expected:** A "Sign in" button is visible.

### Step 2 — Sign in to Qualitative

Click "Sign in with Google" and complete Google's standard OAuth screen using `ttestor892@gmail.com`.

**Expected:** You are redirected back to the Qualitative app, logged in, and land on the main dashboard.

### Step 3 — Open Settings and start the Zoom connection

In the top navigation, open **Settings** and locate the **Zoom** integration card. Click **Connect Zoom**.

**Expected:** You are redirected to `zoom.us/oauth/authorize`.

### Step 4 — Review the Zoom consent screen

The Zoom consent screen will list the exact scopes documented in Section 3 above. Each one is granular and read-only. Verify the displayed scopes match Section 3 — `user:read:user`, `cloud_recording:read:list_user_recordings`, `cloud_recording:read:list_recording_files`, `cloud_recording:read:recording`, `cloud_recording:read:meeting_transcript`, `meeting:read:list_meeting_participants`.

Sign in to Zoom with `ttestor892@gmail.com` if not already signed in, then click **Allow**.

**Expected:** Zoom redirects to the Qualitative production callback URL. You land back in the Qualitative Settings page, with the Zoom card now showing **Connected as ttestor892@gmail.com**. This step exercises `user:read:user`.

### Step 5 — Verify connection status

The Zoom card should now display:
- Connection state: Connected
- Connected Zoom email: `ttestor892@gmail.com`
- A **Disconnect Zoom** button

### Step 6 — Sync recordings

Navigate to **Meetings** in the top nav. Click **Sync Zoom Recordings** (or equivalent button).

**Expected:** Within a few seconds, the meetings list populates with the user's recent Zoom cloud recordings. Each row shows the meeting topic, date/time, duration, and whether a transcript is available. This step exercises `cloud_recording:read:list_user_recordings` and `cloud_recording:read:list_recording_files`.

### Step 7 — Open a meeting and read its transcript

Click on any meeting in the list that shows a transcript-available badge.

**Expected:** The meeting detail view loads with the transcript displayed inline. This step exercises `cloud_recording:read:recording` (to retrieve the file metadata) and `cloud_recording:read:meeting_transcript` (to load the VTT content).

### Step 8 — View participants

On the same meeting detail page, locate the **Participants** panel.

**Expected:** A list of past participants for that meeting appears (names and/or emails as Zoom returns them). This step exercises `meeting:read:list_meeting_participants`.

### Step 9 — Run qualitative analysis (downstream feature)

From the meeting detail view, the user can run downstream analysis features that operate purely on the already-fetched transcript text — these do not call Zoom further. The reviewer may explore these but they are not part of the Zoom OAuth surface.

### Step 10 — Webhook behavior (optional, automatic)

The app is also subscribed to Zoom event subscriptions:
- `recording.transcript_completed`
- `recording.completed`

When a new Zoom recording finishes processing on the test account, the app automatically imports it without the user clicking "Sync." Reviewers do not need to test this path manually; it relies on the same scopes already validated above.

### Step 11 — Disconnect

Return to **Settings**, locate the Zoom card, and click **Disconnect Zoom**.

**Expected:** The card returns to its disconnected state. Internally, the app calls Zoom's `oauth/revoke` endpoint to invalidate the stored access token, and the stored refresh token is deleted from the database. After this point, the app no longer holds any Zoom credentials for the user; re-connecting would require going through Step 3 again.

---

## 6. Data Handling and Privacy

- Access and refresh tokens are stored encrypted at rest in the application database.
- Transcript content is stored to support the user's qualitative analysis workflow. The user can delete a meeting at any time, which removes the transcript from the database.
- No Zoom data is shared with third parties. Transcripts are only processed by the application's own analysis pipeline.
- Disconnecting revokes the token with Zoom and removes locally stored credentials.

Privacy policy: `https://<PROD_DOMAIN>/privacy`
Security overview: `https://<PROD_DOMAIN>/security`

---

## 7. Troubleshooting for the Reviewer

| Symptom | Likely cause | Fix |
|---|---|---|
| Zoom OAuth screen does not list all six scopes | Browser cache from an earlier reduced-scope session | Open in a private window and retry from Step 3. |
| "No recordings found" after Sync | Test account has not yet recorded a meeting to the cloud, or recording processing hasn't completed | Verify in `zoom.us/recording` that at least one cloud recording with a transcript exists for `ttestor892@gmail.com`. |
| Sign-in fails at Google | Wrong Google account selected | Sign out of other Google accounts and use only `ttestor892@gmail.com`. |
| Connection succeeds but no transcript loads on a meeting | That specific recording does not have a transcript yet | Pick a different meeting from the list whose transcript badge is shown. |

---

## 8. Contact

If anything in this test plan does not behave as described, please contact:

- Maintainer: Ben Clemens
- Email: ben.clemens@gmail.com

We will respond same-day during the review window.
