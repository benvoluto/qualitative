import { SubscriptionPlan } from "@/lib/db/types";

export interface PlanLimits {
  /** Meetings that can be processed/extracted per calendar month. Infinity = unlimited. */
  meetingsPerMonth: number;
  /** Display label */
  label: string;
  /** Short marketing copy */
  description: string;
  /** Stripe Price ID used for checkout. Null = no checkout (free tier). */
  stripePriceId: string | null;
}

export const PLANS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    label: "Free",
    description: "Try it out — up to 5 meetings per month.",
    meetingsPerMonth: 5,
    stripePriceId: null,
  },
  pro: {
    label: "Pro",
    description: "Unlimited meetings and integrations.",
    meetingsPerMonth: Number.POSITIVE_INFINITY,
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
  },
};

export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
  return PLANS[plan];
}
