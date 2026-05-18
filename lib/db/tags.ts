import { getDb } from "./client";
import { Tag, CreateTag, UpdateTag } from "./types";

export async function getTags(accountId: string): Promise<Tag[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM tags WHERE account_id = ${accountId} ORDER BY name`;
  return result as Tag[];
}

export async function getTagById(accountId: string, id: string): Promise<Tag | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM tags WHERE id = ${id} AND account_id = ${accountId}`;
  return (result[0] as Tag) || null;
}

export async function getTagByName(accountId: string, name: string): Promise<Tag | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM tags WHERE name = ${name} AND account_id = ${accountId}`;
  return (result[0] as Tag) || null;
}

export async function getTagsByType(accountId: string, type: string): Promise<Tag[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM tags WHERE type = ${type} AND account_id = ${accountId} ORDER BY name`;
  return result as Tag[];
}

export async function createTag(accountId: string, data: CreateTag): Promise<Tag> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO tags (account_id, name, type, color)
    VALUES (${accountId}, ${data.name}, ${data.type ?? null}, ${data.color ?? null})
    RETURNING *
  `;
  return result[0] as Tag;
}

export async function updateTag(accountId: string, id: string, data: UpdateTag): Promise<Tag | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE tags SET
      name = COALESCE(${data.name ?? null}, name),
      type = COALESCE(${data.type ?? null}, type),
      color = COALESCE(${data.color ?? null}, color)
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  return (result[0] as Tag) || null;
}

export async function deleteTag(accountId: string, id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM tags WHERE id = ${id} AND account_id = ${accountId} RETURNING id`;
  return result.length > 0;
}

export async function getOrCreateTag(accountId: string, name: string, type?: string): Promise<Tag> {
  const existing = await getTagByName(accountId, name);
  if (existing) return existing;
  return createTag(accountId, { name, type });
}

export async function getUsedColors(accountId: string): Promise<string[]> {
  const sql = getDb();
  const result = await sql`SELECT color FROM tags WHERE account_id = ${accountId} AND color IS NOT NULL`;
  return (result as Array<{ color: string }>).map((r) => r.color);
}

export async function setTagColor(accountId: string, id: string, color: string | null): Promise<Tag | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE tags SET color = ${color}
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  return (result[0] as Tag) || null;
}
