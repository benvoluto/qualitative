import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { users } from "@/lib/db";
import { clearUserZoomTokenCache } from "@/lib/zoom/client";
import { revokeZoomToken } from "@/lib/zoom/oauth";

/**
 * GET /api/user/zoom-status
 * Returns whether the current user has Zoom connected
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

    const connected = !!(user.zoom_access_token && user.zoom_refresh_token);

    // If connected, try to get email from Zoom user ID lookup or just indicate connected
    // For simplicity, we'll just return the connected status
    // The email could be fetched from Zoom API if needed, but that adds latency

    return NextResponse.json({
      connected,
      zoomUserId: user.zoom_user_id || null,
    });
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
