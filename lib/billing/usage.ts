import { getDb } from "@/lib/db/client";
import { ensureSubscription } from "@/lib/db/subscriptions";
import { getPlanLimits } from "./plans";

export interface UsageStatus {
  /** Meetings processed (transcribed or extracted) in the current calendar month */
  meetingsThisMonth: number;
  /** Hard cap from the account's plan. Infinity for unlimited. */
  monthlyLimit: number;
  /** True if the account has hit or exceeded its cap */
  overLimit: boolean;
  /** Convenience: how many more meetings are allowed this month */
  remaining: number;
}

/**
 * Count meetings that have been processed or extracted this calendar month.
 * "Processed" = has a transcript (workflow_status is transcribed or completed).
 *
 * This is the unit users understand and the cost driver (Gemini calls).
 */
async function countMeetingsThisMonth(accountId: string): Promise<number> {
  const sql = getDb();
  const result = await sql`
    SELECT COUNT(*)::int AS n FROM meetings
    WHERE account_id = ${accountId}
      AND workflow_status IN ('transcribed', 'completed')
      AND created_at >= date_trunc('month', NOW())
  `;
  return (result[0]?.n as number) ?? 0;
}

export async function getUsageStatus(accountId: string): Promise<UsageStatus> {
  const subscription = await ensureSubscription(accountId);
  // Comped accounts get Pro limits regardless of Stripe state.
  const effectivePlan = subscription.comped ? "pro" : subscription.plan;
  const limits = getPlanLimits(effectivePlan);
  const monthlyLimit = limits.meetingsPerMonth;
  const meetingsThisMonth = await countMeetingsThisMonth(accountId);
  const overLimit = meetingsThisMonth >= monthlyLimit;
  const remaining = Number.isFinite(monthlyLimit)
    ? Math.max(0, monthlyLimit - meetingsThisMonth)
    : Number.POSITIVE_INFINITY;
  return { meetingsThisMonth, monthlyLimit, overLimit, remaining };
}

/**
 * Throws a UsageLimitError if the account is over its monthly meeting cap.
 * Call from any expensive endpoint (process, extract) before doing the work.
 */
export async function assertWithinUsage(accountId: string): Promise<void> {
  const status = await getUsageStatus(accountId);
  if (status.overLimit) {
    throw new UsageLimitError(
      `Monthly meeting limit reached (${status.meetingsThisMonth}/${status.monthlyLimit}). Upgrade to Pro for unlimited meetings.`
    );
  }
}

export class UsageLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageLimitError";
  }
}
