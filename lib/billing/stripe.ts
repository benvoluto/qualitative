import Stripe from "stripe";

let client: Stripe | null = null;

function getStripeSecretKey(): string | undefined {
  return process.env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET;
}

/**
 * Get the Stripe client. Throws if no secret key is set.
 * Accepts either STRIPE_SECRET_KEY (Stripe's documented convention) or STRIPE_SECRET.
 */
export function getStripe(): Stripe {
  if (!client) {
    const key = getStripeSecretKey();
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    client = new Stripe(key);
  }
  return client;
}

export function isStripeConfigured(): boolean {
  return !!getStripeSecretKey();
}
