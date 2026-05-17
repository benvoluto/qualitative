import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { users } from "@/lib/db";

/**
 * GET /api/user/preferences
 * Returns the current user's preferences including sync days and notification settings
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await users.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const notificationPrefs = await users.getUserNotificationPrefs(user.id);
    const meetingAutosyncEnabled = await users.getUserMeetingAutosyncEnabled(user.id);

    return NextResponse.json({
      syncDays: user.sync_days_preference ?? 14,
      meetingAutosyncEnabled,
      notificationEmail: notificationPrefs.notification_email,
      notifyOnDraftCreated: notificationPrefs.notify_on_draft_created,
      notifyOnNotesCreated: notificationPrefs.notify_on_notes_created,
    });
  } catch (error) {
    console.error("Error fetching user preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

interface PreferencesUpdate {
  syncDays?: number;
  meetingAutosyncEnabled?: boolean;
  notificationEmail?: string | null;
  notifyOnDraftCreated?: boolean;
  notifyOnNotesCreated?: boolean;
}

/**
 * PATCH /api/user/preferences
 * Updates the current user's preferences
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await users.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json() as PreferencesUpdate;

    // Update sync days preference
    if (body.syncDays !== undefined) {
      if (typeof body.syncDays !== "number" || body.syncDays < 1 || body.syncDays > 90) {
        return NextResponse.json(
          { error: "syncDays must be a number between 1 and 90" },
          { status: 400 }
        );
      }
      await users.updateUserSyncDaysPreference(user.id, body.syncDays);
    }

    // Update meeting autosync preference
    if (body.meetingAutosyncEnabled !== undefined) {
      if (typeof body.meetingAutosyncEnabled !== "boolean") {
        return NextResponse.json(
          { error: "meetingAutosyncEnabled must be a boolean" },
          { status: 400 }
        );
      }
      await users.updateUserMeetingAutosyncEnabled(user.id, body.meetingAutosyncEnabled);
    }

    // Update notification preferences
    const notificationUpdates: {
      notification_email?: string | null;
      notify_on_draft_created?: boolean;
      notify_on_notes_created?: boolean;
    } = {};

    if (body.notificationEmail !== undefined) {
      notificationUpdates.notification_email = body.notificationEmail;
    }
    if (body.notifyOnDraftCreated !== undefined) {
      notificationUpdates.notify_on_draft_created = body.notifyOnDraftCreated;
    }
    if (body.notifyOnNotesCreated !== undefined) {
      notificationUpdates.notify_on_notes_created = body.notifyOnNotesCreated;
    }

    if (Object.keys(notificationUpdates).length > 0) {
      await users.updateUserNotificationPrefs(user.id, notificationUpdates);
    }

    // Return updated preferences
    const updatedSyncDays = await users.getUserSyncDaysPreference(user.id);
    const updatedMeetingAutosyncEnabled = await users.getUserMeetingAutosyncEnabled(user.id);
    const updatedNotificationPrefs = await users.getUserNotificationPrefs(user.id);

    return NextResponse.json({
      syncDays: updatedSyncDays,
      meetingAutosyncEnabled: updatedMeetingAutosyncEnabled,
      notificationEmail: updatedNotificationPrefs.notification_email,
      notifyOnDraftCreated: updatedNotificationPrefs.notify_on_draft_created,
      notifyOnNotesCreated: updatedNotificationPrefs.notify_on_notes_created,
    });
  } catch (error) {
    console.error("Error updating user preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
