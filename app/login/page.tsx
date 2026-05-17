import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  // If already logged in, redirect to home or callback URL
  if (session?.user) {
    redirect(params.callbackUrl || "/");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="flex flex-col items-center mb-8">
            <Logo
              width={80}
              height={64}
              className="text-gray-900 dark:text-white"
            />
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Meeting Insights Platform
            </p>
          </div>

          {params.error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                {params.error === "AccessDenied"
                  ? "Access denied. Please use a @markerlearning.com email."
                  : "An error occurred during sign in. Please try again."}
              </p>
            </div>
          )}

          <form
            action={async () => {
              "use server";
              await signIn("google", {
                redirectTo: params.callbackUrl || "/",
              });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <GoogleIcon />
              <span className="text-gray-700 dark:text-gray-200 font-medium">
                Sign in with Google
              </span>
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Only @markerlearning.com accounts are allowed
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
