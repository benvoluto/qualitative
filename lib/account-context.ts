import { cache } from "react";
import { auth } from "@/lib/auth";
import { users } from "@/lib/db";

interface AccountContext {
  accountId: string;
  userId: string;
  email: string;
}

/**
 * Resolve the current user's account context for tenant-scoped queries.
 * Returns null if the request isn't authenticated or the user has no account yet.
 *
 * Cached per request via React's cache() — repeated calls within the same
 * request reuse the result without re-hitting the DB.
 */
export const getAccountContext = cache(async (): Promise<AccountContext | null> => {
  const session = await auth();
  if (!session?.user?.email) return null;

  const user = await users.getUserByEmail(session.user.email);
  if (!user || !user.account_id) return null;

  return {
    accountId: user.account_id,
    userId: user.id,
    email: user.email,
  };
});

/**
 * Resolve the current account context, throwing if unauthenticated.
 * Use this in API routes and server components that require an account.
 */
export async function requireAccountContext(): Promise<AccountContext> {
  const ctx = await getAccountContext();
  if (!ctx) {
    throw new AccountContextError("No account context — user is not authenticated or has no account");
  }
  return ctx;
}

export async function requireAccountId(): Promise<string> {
  const ctx = await requireAccountContext();
  return ctx.accountId;
}

export class AccountContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountContextError";
  }
}
