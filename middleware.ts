import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";

// Routes that don't require authentication
const publicRoutes = ["/login", "/api/auth"];

// Routes the user can access *before* completing onboarding
const preOnboardingRoutes = ["/onboarding", "/api/onboarding", "/api/auth", "/login"];

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Onboarded check. Skip the DB hit on routes the un-onboarded user is allowed
  // to hit (onboarding page itself, its server actions, auth endpoints).
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
      return NextResponse.redirect(new URL("/", req.url));
    }
  } catch (err) {
    // Don't block the user if the DB check fails — they'll see the redirect
    // the next time they navigate. Log and continue.
    console.error("[middleware] onboarded check failed:", err);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
