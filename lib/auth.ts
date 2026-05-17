import NextAuth, { Session } from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import { users } from "@/lib/db";

// Domain restriction - only allow markerlearning.com emails
const ALLOWED_DOMAIN = "markerlearning.com";

// Extended session type with access token
interface SessionWithToken extends Session {
  accessToken?: string;
  msAccessToken?: string;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request additional scopes for Google Meet/Calendar access
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/drive.readonly",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
    // Microsoft provider for Teams integration
    ...(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET
      ? [
          MicrosoftEntraId({
            clientId: process.env.MS_CLIENT_ID,
            clientSecret: process.env.MS_CLIENT_SECRET,
            issuer: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID || "common"}/v2.0`,
            authorization: {
              params: {
                scope: [
                  "openid",
                  "email",
                  "profile",
                  "User.Read",
                  "OnlineMeetings.Read",
                  "Calendars.Read",
                  "Files.Read.All",
                  "offline_access",
                ].join(" "),
              },
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Check if email domain is allowed
      const email = user.email;
      if (!email) {
        return false;
      }

      const domain = email.split("@")[1];
      if (domain !== ALLOWED_DOMAIN) {
        // For development, you might want to allow other domains
        // Remove this condition in production
        if (process.env.NODE_ENV === "development") {
          console.warn(`Allowing non-${ALLOWED_DOMAIN} email in development: ${email}`);
        } else {
          return false;
        }
      }

      // Store/update user in database with provider tokens
      if (account) {
        try {
          if (account.provider === "google") {
            await users.upsertUser({
              email: email,
              name: user.name ?? null,
              image: user.image ?? null,
              google_access_token: account.access_token ?? null,
              google_refresh_token: account.refresh_token ?? null,
              google_token_expires_at: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
            });
          } else if (account.provider === "microsoft-entra-id") {
            await users.upsertUserMicrosoftTokens({
              email: email,
              name: user.name ?? null,
              image: user.image ?? null,
              ms_access_token: account.access_token ?? null,
              ms_refresh_token: account.refresh_token ?? null,
              ms_token_expires_at: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
            });
          }
        } catch (error) {
          console.error("Failed to upsert user:", error);
          // Don't block sign-in on database errors
        }
      }

      return true;
    },
    async jwt({ token, account, user }) {
      // Persist the OAuth access_token and refresh_token to the token
      if (account) {
        if (account.provider === "google") {
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
          token.expiresAt = account.expires_at;
        } else if (account.provider === "microsoft-entra-id") {
          token.msAccessToken = account.access_token;
          token.msRefreshToken = account.refresh_token;
          token.msExpiresAt = account.expires_at;
        }
        token.provider = account.provider;
      }
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (session.user) {
        session.user.id = token.userId as string;
      }
      // Expose access tokens for API calls
      (session as SessionWithToken).accessToken = token.accessToken as string;
      (session as SessionWithToken).msAccessToken = token.msAccessToken as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
});

// Helper to check if user is authenticated
export async function getSession() {
  return await auth();
}

// Helper to require authentication (throws if not authenticated)
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}
