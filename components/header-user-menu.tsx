import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { UserMenu } from "./user-menu";

/**
 * Server component wrapper that fetches the session and renders the avatar
 * UserMenu on the right edge of any page header. Drop it into a header's
 * right-aligned slot without per-page session plumbing. Returns null when the
 * visitor is logged out so it's safe to mount on auth-gated pages without
 * crashing during sign-out transitions.
 */
export async function HeaderUserMenu() {
  let isAuthed = false;
  let user = null;
  try {
    const session = await auth();
    if (session?.user) {
      isAuthed = true;
      user = session.user;
    }
  } catch {
    isAuthed = false;
  }
  if (!isAuthed || !user) return null;
  return <UserMenu user={user} isAdmin={isAdminEmail(user.email)} />;
}
