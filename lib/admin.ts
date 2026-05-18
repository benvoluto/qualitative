import { auth } from "@/lib/auth";

/**
 * Comma-separated list of admin emails from env. Defaults to ben.clemens@gmail.com
 * so the project owner has admin access out of the box.
 */
function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "ben.clemens@gmail.com";
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().has(email.toLowerCase());
}

/**
 * For use in server components and API routes. Returns the admin's email,
 * or throws if the current request isn't from an admin.
 */
export async function requireAdmin(): Promise<{ email: string }> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAdminEmail(email)) {
    throw new AdminAccessError();
  }
  return { email };
}

export class AdminAccessError extends Error {
  constructor() {
    super("Admin access required");
    this.name = "AdminAccessError";
  }
}
