"use client";

import { signOut } from "next-auth/react";

export function SignOutLink() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="hover:text-gray-900 dark:hover:text-white cursor-pointer"
    >
      Sign out
    </button>
  );
}
