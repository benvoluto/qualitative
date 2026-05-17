import { track } from "@vercel/analytics/server";

type EventProps = Record<string, string | number | boolean | null | undefined>;

/**
 * Fire a Vercel Analytics custom event from server code.
 * Never throws — analytics failures must not break the user flow.
 */
export async function trackEvent(name: string, props?: EventProps): Promise<void> {
  try {
    await track(name, props);
  } catch (err) {
    console.error(`[analytics] failed to track ${name}:`, err);
  }
}
