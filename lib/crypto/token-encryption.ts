import crypto from "crypto";

/**
 * Application-level encryption for OAuth tokens stored in the database.
 *
 * Threat model: protect tokens against DB backup leaks, read-only DB credential
 * compromise, and exfiltration of a database copy. The encryption key lives only
 * in the application environment, so anyone holding *just* the DB cannot decrypt.
 *
 * Algorithm: AES-256-GCM. Each value gets a fresh 12-byte IV and a 16-byte
 * authentication tag — wrong key or tampered ciphertext will throw on decrypt.
 *
 * Storage format: "v1:<iv_b64>:<tag_b64>:<ciphertext_b64>"
 *
 * Legacy: any value not starting with "v1:" is treated as plaintext (lets us
 * deploy this change before the backfill has touched all rows).
 */

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and set in env."
    );
  }

  // Accept either base64 or hex.
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). Generate one with \`openssl rand -base64 32\`.`
    );
  }
  cachedKey = key;
  return key;
}

/**
 * Encrypt a token. Returns null when given null/undefined/empty so the column
 * stays NULL in the DB.
 */
export function encryptToken(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  // Idempotent: don't double-encrypt a value we already encrypted.
  if (plaintext.startsWith(`${VERSION}:`)) return plaintext;

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/**
 * Decrypt a token. Pass-through for null/undefined and for legacy plaintext
 * (values not prefixed with "v1:"), so existing rows keep working until the
 * backfill encrypts them.
 */
export function decryptToken(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  if (!stored.startsWith(`${VERSION}:`)) {
    // Legacy plaintext, or an empty/garbage string. Return as-is.
    return stored || null;
  }

  const parts = stored.split(":");
  if (parts.length !== 4) {
    throw new Error("Malformed encrypted token (expected v1:iv:tag:ct)");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Returns true if the value is in encrypted form. Used by the backfill script
 * to skip already-encrypted rows.
 */
export function isEncrypted(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(`${VERSION}:`);
}
