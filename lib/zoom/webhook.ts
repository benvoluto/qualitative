import crypto from "crypto";

/**
 * Zoom webhook signature verification.
 *
 * For each event Zoom sends, it adds two headers:
 *   x-zm-request-timestamp   epoch timestamp (seconds)
 *   x-zm-signature           "v0=<hex>" where hex = HMAC-SHA256(secret, "v0:{ts}:{body}")
 *
 * The body must be the *raw* request body — JSON.stringify(body) doesn't always
 * match what Zoom sent (whitespace, key order). Always sign the raw text.
 */
export function verifyZoomWebhookSignature(
  rawBody: string,
  timestamp: string | null,
  signatureHeader: string | null,
  secretToken: string
): boolean {
  if (!timestamp || !signatureHeader) return false;

  // Defend against replay — reject events older than 5 minutes.
  const tsMs = Number(timestamp) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
    return false;
  }

  const message = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${crypto.createHmac("sha256", secretToken).update(message).digest("hex")}`;

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Build the URL-validation response for Zoom's endpoint.url_validation handshake.
 * Zoom sends a plainToken; we return it back alongside HMAC-SHA256(secret, plainToken).
 */
export function buildZoomUrlValidationResponse(
  plainToken: string,
  secretToken: string
): { plainToken: string; encryptedToken: string } {
  const encryptedToken = crypto
    .createHmac("sha256", secretToken)
    .update(plainToken)
    .digest("hex");
  return { plainToken, encryptedToken };
}
