import { getDb } from "./client";
import { ExtractPosition, UpsertExtractPosition } from "./types";

/** All positions for extracts that belong to meetings linked to this customer. */
export async function getPositionsForCustomer(
  accountId: string,
  customerId: string
): Promise<ExtractPosition[]> {
  const sql = getDb();
  const result = await sql`
    SELECT ep.*
    FROM extract_positions ep
    JOIN extracts e ON e.id = ep.extract_id
    WHERE ep.account_id = ${accountId}
      AND e.customer_id = ${customerId}
  `;
  return result as ExtractPosition[];
}

export async function upsertPosition(
  accountId: string,
  data: UpsertExtractPosition
): Promise<ExtractPosition | null> {
  const sql = getDb();
  // Confirm the extract belongs to this account before writing.
  const owns = await sql`
    SELECT 1 FROM extracts WHERE id = ${data.extract_id} AND account_id = ${accountId}
  `;
  if (owns.length === 0) return null;
  const result = await sql`
    INSERT INTO extract_positions (extract_id, account_id, x, y, width, height, color, updated_at)
    VALUES (
      ${data.extract_id},
      ${accountId},
      ${data.x},
      ${data.y},
      ${data.width ?? 220},
      ${data.height ?? 160},
      ${data.color ?? null},
      NOW()
    )
    ON CONFLICT (extract_id) DO UPDATE SET
      x = EXCLUDED.x,
      y = EXCLUDED.y,
      width = EXCLUDED.width,
      height = EXCLUDED.height,
      color = COALESCE(EXCLUDED.color, extract_positions.color),
      updated_at = NOW()
    RETURNING *
  `;
  return (result[0] as ExtractPosition) || null;
}
