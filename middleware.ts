import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Routes that don't require authentication
const publicRoutes = ["/login", "/api/auth"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Check if the route is public
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Allow public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check if user is authenticated
  if (!req.auth) {
    // Redirect to login page
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all routes except static files and api routes that should be public
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
