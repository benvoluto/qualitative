import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getZoomAuthUrl, isZoomOAuthConfigured } from "@/lib/zoom/oauth";
import { cookies } from "next/headers";

/**
 * GET /api/auth/zoom
 * Initiates the Zoom OAuth flow by redirecting to Zoom's authorization page
 */
export async function GET() {
  try {
    // Check user is authenticated
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000"));
    }

    // Check Zoom OAuth is configured
    if (!isZoomOAuthConfigured()) {
      return NextResponse.json(
        { error: "Zoom OAuth is not configured. Please set ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_REDIRECT_URI." },
        { status: 500 }
      );
    }

    // Generate a random state token for CSRF protection
    const state = crypto.randomUUID();

    // Store state in a cookie for verification in callback
    const cookieStore = await cookies();
    cookieStore.set("zoom_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });

    // Redirect to Zoom authorization URL
    const authUrl = getZoomAuthUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Zoom OAuth initiation error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Zoom OAuth" },
      { status: 500 }
    );
  }
}
