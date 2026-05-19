import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { users } from "@/lib/db";
import { exchangeZoomCode, getZoomUserInfo } from "@/lib/zoom/oauth";
import { cookies } from "next/headers";

/**
 * GET /api/auth/zoom/callback
 * Handles the OAuth callback from Zoom
 * Exchanges the authorization code for tokens and stores them
 */
export async function GET(request: NextRequest) {
  try {
    // Check user is authenticated
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000"));
    }

    // Get code and state from query params
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors from Zoom
    if (error) {
      const errorDescription = searchParams.get("error_description") || "Unknown error";
      console.error("Zoom OAuth error:", error, errorDescription);
      return NextResponse.redirect(
        new URL(`/meetings?zoom_error=${encodeURIComponent(errorDescription)}`, process.env.NEXTAUTH_URL || "http://localhost:3000")
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/meetings?zoom_error=Missing+authorization+code", process.env.NEXTAUTH_URL || "http://localhost:3000")
      );
    }

    // Verify state token
    const cookieStore = await cookies();
    const storedState = cookieStore.get("zoom_oauth_state")?.value;

    if (!storedState || storedState !== state) {
      console.error("Zoom OAuth state mismatch:", { storedState, receivedState: state });
      return NextResponse.redirect(
        new URL("/meetings?zoom_error=Invalid+state+token", process.env.NEXTAUTH_URL || "http://localhost:3000")
      );
    }

    // Clear the state cookie
    cookieStore.delete("zoom_oauth_state");

    // Exchange code for tokens
    const tokens = await exchangeZoomCode(code);

    // Get our user from database
    const user = await users.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.redirect(
        new URL("/meetings?zoom_error=User+not+found", process.env.NEXTAUTH_URL || "http://localhost:3000")
      );
    }

    // Try to get Zoom user info (optional - may fail if scope not granted)
    let zoomUserId: string | null = null;
    let zoomEmail: string | null = null;
    try {
      const zoomUser = await getZoomUserInfo(tokens.access_token);
      zoomUserId = zoomUser.id;
      zoomEmail = zoomUser.email;
    } catch (error) {
      // Log but don't fail - user info is nice-to-have
      console.warn("Could not fetch Zoom user info (scope may not be granted):", error);
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Store tokens in database
    await users.updateUserZoomTokens(
      user.id,
      tokens.access_token,
      tokens.refresh_token,
      expiresAt,
      zoomUserId
    );
    // Connection is known-healthy right now — seed the status cache so the
    // first /api/user/zoom-status after redirect doesn't immediately re-probe.
    await users.touchUserZoomValidatedAt(user.id);

    // Redirect back to meetings page with success message
    const successUrl = new URL("/meetings?zoom_connected=true", process.env.NEXTAUTH_URL || "http://localhost:3000");
    if (zoomEmail) {
      successUrl.searchParams.set("zoom_email", zoomEmail);
    }
    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error("Zoom OAuth callback error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/meetings?zoom_error=${encodeURIComponent(message)}`, process.env.NEXTAUTH_URL || "http://localhost:3000")
    );
  }
}
