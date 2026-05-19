import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = neon(url);
  const updated = await sql`
    UPDATE meetings
    SET meeting_date = NULL
    WHERE meeting_date IS NOT NULL AND meeting_date < TIMESTAMP '2000-01-01'
    RETURNING id, name
  `;
  console.log(`[fix-epoch] nullified ${updated.length} row(s)`);
  for (const r of updated) {
    console.log(`  ${r.id}  ${r.name}`);
  }
}

main().catch((err: unknown) => {
  console.error("[fix-epoch] FAILED:", err);
  process.exit(1);
});
