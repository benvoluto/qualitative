/* eslint-disable */
/**
 * Backfill: encrypt any OAuth tokens still stored as plaintext.
 *
 * Safe to run mid-traffic and idempotent — values that are already in the
 * `v1:` encrypted format are skipped. The app continues to work throughout
 * because the decrypt helper passes plaintext through unchanged.
 *
 * Usage:
 *   set -a && . ./.env.local && set +a
 *   npx tsx scripts/encrypt-tokens.ts
 *
 * Requires TOKEN_ENCRYPTION_KEY to be set.
 */

import { neon } from "@neondatabase/serverless";
import { encryptToken, isEncrypted } from "@/lib/crypto/token-encryption";

const TOKEN_COLUMNS = [
  "google_access_token",
  "google_refresh_token",
  "ms_access_token",
  "ms_refresh_token",
  "zoom_access_token",
  "zoom_refresh_token",
] as const;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    console.error(
      "TOKEN_ENCRYPTION_KEY not set. Generate with `openssl rand -base64 32`."
    );
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  const rows = (await sql`
    SELECT id, email,
      google_access_token, google_refresh_token,
      ms_access_token, ms_refresh_token,
      zoom_access_token, zoom_refresh_token
    FROM users
  `) as Array<Record<string, string | null>>;

  console.log(`Scanning ${rows.length} user(s)...`);

  let totalEncrypted = 0;
  let usersTouched = 0;

  for (const row of rows) {
    const updates: Record<string, string> = {};
    for (const col of TOKEN_COLUMNS) {
      const current = row[col];
      if (current && !isEncrypted(current)) {
        const enc = encryptToken(current);
        if (enc) {
          updates[col] = enc;
        }
      }
    }
    if (Object.keys(updates).length === 0) continue;

    // Build a dynamic UPDATE with parameterized values.
    const setExprs: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [col, val] of Object.entries(updates)) {
      setExprs.push(`${col} = $${i++}`);
      values.push(val);
    }
    values.push(row.id);
    const query = `UPDATE users SET ${setExprs.join(", ")} WHERE id = $${i}`;
    await sql(query, values);

    totalEncrypted += Object.keys(updates).length;
    usersTouched++;
    console.log(
      `  ✓ ${row.email}: encrypted ${Object.keys(updates).length} token column(s)`
    );
  }

  console.log(
    `Done. Encrypted ${totalEncrypted} token value(s) across ${usersTouched} user(s).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
