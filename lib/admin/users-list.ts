import { getDb } from "@/lib/db/client";
import { SubscriptionPlan, SubscriptionStatus } from "@/lib/db/types";

export interface AdminUserRow {
  user_id: string;
  email: string;
  name: string | null;
  account_id: string;
  account_name: string;
  internal_domain: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  comped: boolean;
  current_period_end: Date | null;
  stripe_customer_id: string | null;
  meeting_count: number;
  meetings_this_month: number;
  created_at: Date;
  onboarded_at: Date | null;
}

/**
 * Admin-only: list every user in the system with their account, plan, and usage.
 * Ordered newest first. Restricted to a single page (recent 500) — for an
 * eventual admin UI with pagination we'd add LIMIT/OFFSET.
 */
export async function listAllUsers(): Promise<AdminUserRow[]> {
  const sql = getDb();
  const result = await sql`
    SELECT
      u.id AS user_id,
      u.email,
      u.name,
      u.account_id,
      a.name AS account_name,
      a.internal_domain,
      s.plan,
      s.status,
      s.comped,
      s.current_period_end,
      s.stripe_customer_id,
      COALESCE((
        SELECT COUNT(*) FROM meetings m WHERE m.account_id = u.account_id
      ), 0)::int AS meeting_count,
      COALESCE((
        SELECT COUNT(*) FROM meetings m
        WHERE m.account_id = u.account_id
          AND m.workflow_status IN ('transcribed', 'completed')
          AND m.created_at >= date_trunc('month', NOW())
      ), 0)::int AS meetings_this_month,
      u.created_at,
      u.onboarded_at
    FROM users u
    JOIN accounts a ON a.id = u.account_id
    LEFT JOIN subscriptions s ON s.account_id = u.account_id
    ORDER BY u.created_at DESC
    LIMIT 500
  `;
  return result as AdminUserRow[];
}
