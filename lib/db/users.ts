import { getDb } from "./client";
import { User, CreateUser, UpdateUser, PromptTemplateType } from "./types";

export async function getUsers(): Promise<User[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM users ORDER BY name`;
  return result as User[];
}

export async function getUserById(id: string): Promise<User | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM users WHERE id = ${id}`;
  return (result[0] as User) || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM users WHERE email = ${email}`;
  return (result[0] as User) || null;
}

export async function createUser(data: CreateUser): Promise<User> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO users (
      email, name, image, google_access_token, google_refresh_token, google_token_expires_at
    )
    VALUES (
      ${data.email},
      ${data.name ?? null},
      ${data.image ?? null},
      ${data.google_access_token ?? null},
      ${data.google_refresh_token ?? null},
      ${data.google_token_expires_at ?? null}
    )
    RETURNING *
  `;
  return result[0] as User;
}

export async function updateUser(id: string, data: UpdateUser): Promise<User | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE users SET
      name = COALESCE(${data.name ?? null}, name),
      image = COALESCE(${data.image ?? null}, image),
      google_access_token = COALESCE(${data.google_access_token ?? null}, google_access_token),
      google_refresh_token = COALESCE(${data.google_refresh_token ?? null}, google_refresh_token),
      google_token_expires_at = COALESCE(${data.google_token_expires_at ?? null}, google_token_expires_at)
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as User) || null;
}

export async function upsertUser(data: CreateUser): Promise<User> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO users (
      email, name, image, google_access_token, google_refresh_token, google_token_expires_at
    )
    VALUES (
      ${data.email},
      ${data.name ?? null},
      ${data.image ?? null},
      ${data.google_access_token ?? null},
      ${data.google_refresh_token ?? null},
      ${data.google_token_expires_at ?? null}
    )
    ON CONFLICT (email) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, users.name),
      image = COALESCE(EXCLUDED.image, users.image),
      google_access_token = COALESCE(EXCLUDED.google_access_token, users.google_access_token),
      google_refresh_token = COALESCE(EXCLUDED.google_refresh_token, users.google_refresh_token),
      google_token_expires_at = COALESCE(EXCLUDED.google_token_expires_at, users.google_token_expires_at)
    RETURNING *
  `;
  return result[0] as User;
}

export async function updateUserGoogleTokens(
  id: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date
): Promise<User | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE users SET
      google_access_token = ${accessToken},
      google_refresh_token = COALESCE(${refreshToken}, google_refresh_token),
      google_token_expires_at = ${expiresAt}
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as User) || null;
}

export async function deleteUser(id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM users WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

export async function isMarkerLearningEmployee(email: string): Promise<boolean> {
  return email.endsWith("@markerlearning.com");
}

// Microsoft Teams token management
export async function upsertUserMicrosoftTokens(data: {
  email: string;
  name?: string | null;
  image?: string | null;
  ms_access_token: string | null;
  ms_refresh_token: string | null;
  ms_token_expires_at: Date | null;
}): Promise<User> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO users (email, name, image, ms_access_token, ms_refresh_token, ms_token_expires_at)
    VALUES (
      ${data.email},
      ${data.name ?? null},
      ${data.image ?? null},
      ${data.ms_access_token ?? null},
      ${data.ms_refresh_token ?? null},
      ${data.ms_token_expires_at ?? null}
    )
    ON CONFLICT (email) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, users.name),
      image = COALESCE(EXCLUDED.image, users.image),
      ms_access_token = COALESCE(EXCLUDED.ms_access_token, users.ms_access_token),
      ms_refresh_token = COALESCE(EXCLUDED.ms_refresh_token, users.ms_refresh_token),
      ms_token_expires_at = COALESCE(EXCLUDED.ms_token_expires_at, users.ms_token_expires_at)
    RETURNING *
  `;
  return result[0] as User;
}

export async function updateUserMicrosoftTokens(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date
): Promise<User | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE users SET
      ms_access_token = ${accessToken},
      ms_refresh_token = COALESCE(${refreshToken}, ms_refresh_token),
      ms_token_expires_at = ${expiresAt}
    WHERE id = ${userId}
    RETURNING *
  `;
  return (result[0] as User) || null;
}

// Zoom OAuth token management

export async function hasZoomConnected(userId: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`
    SELECT zoom_access_token FROM users WHERE id = ${userId}
  `;
  return !!(result[0] && result[0].zoom_access_token);
}

export async function getUserZoomTokens(userId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  zoomUserId: string;
} | null> {
  const sql = getDb();
  const result = await sql`
    SELECT zoom_access_token, zoom_refresh_token, zoom_token_expires_at, zoom_user_id
    FROM users WHERE id = ${userId}
  `;
  const user = result[0];
  if (!user || !user.zoom_access_token || !user.zoom_refresh_token) {
    return null;
  }
  return {
    accessToken: user.zoom_access_token,
    refreshToken: user.zoom_refresh_token,
    expiresAt: user.zoom_token_expires_at ? new Date(user.zoom_token_expires_at) : new Date(),
    zoomUserId: user.zoom_user_id || "",
  };
}

export async function updateUserZoomTokens(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date,
  zoomUserId: string | null
): Promise<User | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE users SET
      zoom_access_token = ${accessToken},
      zoom_refresh_token = COALESCE(${refreshToken}, zoom_refresh_token),
      zoom_token_expires_at = ${expiresAt},
      zoom_user_id = ${zoomUserId}
    WHERE id = ${userId}
    RETURNING *
  `;
  return (result[0] as User) || null;
}

export async function disconnectUserZoom(userId: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE users SET
      zoom_access_token = NULL,
      zoom_refresh_token = NULL,
      zoom_token_expires_at = NULL,
      zoom_user_id = NULL
    WHERE id = ${userId}
  `;
}

// User preferences

export async function getUserSyncDaysPreference(userId: string): Promise<number> {
  const sql = getDb();
  const result = await sql`
    SELECT sync_days_preference FROM users WHERE id = ${userId}
  `;
  // Default to 14 days if not set
  return result[0]?.sync_days_preference ?? 14;
}

export async function updateUserSyncDaysPreference(
  userId: string,
  days: number
): Promise<number> {
  const sql = getDb();
  // Clamp between 1 and 90 days
  const clampedDays = Math.min(Math.max(days, 1), 90);
  await sql`
    UPDATE users SET
      sync_days_preference = ${clampedDays}
    WHERE id = ${userId}
  `;
  return clampedDays;
}

// Prompt templates

export interface UserPromptTemplates {
  deal_email_prompt_template: string | null;
  customer_email_prompt_template: string | null;
  notes_prompt_template: string | null;
}

export async function getUserPromptTemplates(userId: string): Promise<UserPromptTemplates> {
  const sql = getDb();
  const result = await sql`
    SELECT deal_email_prompt_template, customer_email_prompt_template, notes_prompt_template
    FROM users WHERE id = ${userId}
  `;
  return {
    deal_email_prompt_template: result[0]?.deal_email_prompt_template ?? null,
    customer_email_prompt_template: result[0]?.customer_email_prompt_template ?? null,
    notes_prompt_template: result[0]?.notes_prompt_template ?? null,
  };
}

export async function updateUserPromptTemplate(
  userId: string,
  templateType: PromptTemplateType,
  template: string
): Promise<void> {
  const sql = getDb();
  switch (templateType) {
    case "deal_email":
      await sql`UPDATE users SET deal_email_prompt_template = ${template} WHERE id = ${userId}`;
      break;
    case "customer_email":
      await sql`UPDATE users SET customer_email_prompt_template = ${template} WHERE id = ${userId}`;
      break;
    case "notes":
      await sql`UPDATE users SET notes_prompt_template = ${template} WHERE id = ${userId}`;
      break;
  }
}

export async function resetUserPromptTemplate(
  userId: string,
  templateType: PromptTemplateType
): Promise<void> {
  const sql = getDb();
  switch (templateType) {
    case "deal_email":
      await sql`UPDATE users SET deal_email_prompt_template = NULL WHERE id = ${userId}`;
      break;
    case "customer_email":
      await sql`UPDATE users SET customer_email_prompt_template = NULL WHERE id = ${userId}`;
      break;
    case "notes":
      await sql`UPDATE users SET notes_prompt_template = NULL WHERE id = ${userId}`;
      break;
  }
}

// Notification preferences

export interface UserNotificationPrefs {
  notification_email: string | null;
  notify_on_draft_created: boolean;
  notify_on_notes_created: boolean;
}

export async function getUserNotificationPrefs(userId: string): Promise<UserNotificationPrefs> {
  const sql = getDb();
  const result = await sql`
    SELECT notification_email, notify_on_draft_created, notify_on_notes_created
    FROM users WHERE id = ${userId}
  `;
  return {
    notification_email: result[0]?.notification_email ?? null,
    notify_on_draft_created: result[0]?.notify_on_draft_created ?? false,
    notify_on_notes_created: result[0]?.notify_on_notes_created ?? false,
  };
}

export async function updateUserNotificationPrefs(
  userId: string,
  prefs: Partial<UserNotificationPrefs>
): Promise<void> {
  const sql = getDb();
  const updates: string[] = [];
  const values: (string | boolean | null)[] = [];
  if (prefs.notification_email !== undefined) {
    updates.push("notification_email");
    values.push(prefs.notification_email);
  }
  if (prefs.notify_on_draft_created !== undefined) {
    updates.push("notify_on_draft_created");
    values.push(prefs.notify_on_draft_created);
  }
  if (prefs.notify_on_notes_created !== undefined) {
    updates.push("notify_on_notes_created");
    values.push(prefs.notify_on_notes_created);
  }
  if (updates.length === 0) return;
  await sql`
    UPDATE users SET
      notification_email = COALESCE(${prefs.notification_email ?? null}, notification_email),
      notify_on_draft_created = COALESCE(${prefs.notify_on_draft_created ?? null}, notify_on_draft_created),
      notify_on_notes_created = COALESCE(${prefs.notify_on_notes_created ?? null}, notify_on_notes_created)
    WHERE id = ${userId}
  `;
}

// Meeting autosync preference

/**
 * Gets whether meeting autosync is enabled for a user
 */
export async function getUserMeetingAutosyncEnabled(userId: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`
    SELECT meeting_autosync_enabled FROM users WHERE id = ${userId}
  `;
  return result[0]?.meeting_autosync_enabled ?? false;
}

/**
 * Updates the meeting autosync enabled setting for a user
 */
export async function updateUserMeetingAutosyncEnabled(
  userId: string,
  enabled: boolean
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE users SET meeting_autosync_enabled = ${enabled}
    WHERE id = ${userId}
  `;
}
