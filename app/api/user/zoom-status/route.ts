import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { users } from "@/lib/db";
import { clearUserZoomTokenCache, getUserZoomAccessToken, ZoomReauthRequiredError } from "@/lib/zoom/client";
import { revokeZoomToken } from "@/lib/zoom/oauth";

/**
 * How long a successful validation is trusted before we probe Zoom again.
 * Short enough to detect revoked tokens quickly; long enough to avoid hitting
 * Zoom on every dashboard page load.
 */
const VALIDATION_TTL_MS = 5 * 60 * 1000;

/**
 * GET /api/user/zoom-status
 * Returns whether the current user has a *working* Zoom connection.
 *
 * Validation strategy:
 *  1. No tokens stored        → connected:false.
 *  2. Validated recently      → trust the cache, return connected:true without
 *                                hitting Zoom.
 *  3. Cache stale (or unset)  → call getUserZoomAccessToken (refreshes if the
 *                                access token is expired, auto-clears tokens
 *                                from the DB on invalid_grant). On success,
 *                                touch zoom_validated_at to NOW().
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

    if (!user.zoom_access_token || !user.zoom_refresh_token) {
      return NextResponse.json({ connected: false, zoomUserId: null });
    }

    const validatedAtMs = user.zoom_validated_at ? new Date(user.zoom_validated_at).getTime() : 0;
    const cacheFresh = Date.now() - validatedAtMs < VALIDATION_TTL_MS;

    if (cacheFresh) {
      return NextResponse.json({
        connected: true,
        zoomUserId: user.zoom_user_id || null,
        cached: true,
      });
    }

    try {
      await getUserZoomAccessToken(user.id);
      await users.touchUserZoomValidatedAt(user.id);
      return NextResponse.json({
        connected: true,
        zoomUserId: user.zoom_user_id || null,
        cached: false,
      });
    } catch (err) {
      if (err instanceof ZoomReauthRequiredError) {
        // getUserZoomAccessToken already cleared the bad tokens via disconnectUserZoom.
        return NextResponse.json({
          connected: false,
          zoomUserId: null,
          requiresReauth: true,
          reason: "Zoom connection expired. Please reconnect.",
        });
      }
      throw err;
    }
  } catch (error) {
    console.error("Error checking Zoom status:", error);
    return NextResponse.json(
      { error: "Failed to check Zoom status" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/zoom-status
 * Disconnects Zoom for the current user
 */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await users.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Try to revoke the token with Zoom (best effort)
    if (user.zoom_access_token) {
      await revokeZoomToken(user.zoom_access_token);
    }

    // Clear token cache
    clearUserZoomTokenCache(user.id);

    // Clear tokens from database
    await users.disconnectUserZoom(user.id);

    return NextResponse.json({ success: true, message: "Zoom disconnected" });
  } catch (error) {
    console.error("Error disconnecting Zoom:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Zoom" },
      { status: 500 }
    );
  }
}
