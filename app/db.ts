// Re-export from the new db library for backwards compatibility
export { getDb } from "@/lib/db";
import { getDb } from "@/lib/db";

export async function getPgVersion() {
  const sql = getDb();
  const result = await sql`SELECT version()`;
  return result[0].version;
}
