import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";

/**
 * Routes that don't require authentication. The root path "/" is matched
 * exactly (not via prefix) because every URL starts with "/".
 */
const publicExactRoutes = new Set(["/", "/login", "/privacy", "/terms", "/dpa"]);
const publicPrefixRoutes = ["/api/auth", "/api/billing/webhook", "/api/webhooks"];

// Routes an authenticated-but-not-yet-onboarded user can reach.
const preOnboardingRoutes = ["/onboarding", "/api/onboarding", "/api/auth", "/login", "/api/billing"];

function isPublic(pathname: string): boolean {
  if (publicExactRoutes.has(pathname)) return true;
  return publicPrefixRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Logged-in users hitting the marketing landing go straight to the app.
  if (pathname === "/" && req.auth) {
    return NextResponse.redirect(new URL("/app", req.url));
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isPreOnboardingRoute = preOnboardingRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const email = req.auth.user?.email;
  if (!email) return NextResponse.next();

  try {
    const sql = getDb();
    const result = await sql`
      SELECT onboarded_at FROM users WHERE email = ${email} LIMIT 1
    `;
    const onboardedAt = result[0]?.onboarded_at ?? null;

    if (!onboardedAt && !isPreOnboardingRoute) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
    if (onboardedAt && pathname === "/onboarding") {
      return NextResponse.redirect(new URL("/app", req.url));
    }
  } catch (err) {
    console.error("[middleware] onboarded check failed:", err);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.well-known/workflow/).*)",
  ],
};
