import { getDb } from "./client";
import { Tag, CreateTag, UpdateTag } from "./types";

export async function getTags(): Promise<Tag[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM tags ORDER BY name`;
  return result as Tag[];
}

export async function getTagById(id: string): Promise<Tag | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM tags WHERE id = ${id}`;
  return (result[0] as Tag) || null;
}

export async function getTagByName(name: string): Promise<Tag | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM tags WHERE name = ${name}`;
  return (result[0] as Tag) || null;
}

export async function getTagsByType(type: string): Promise<Tag[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM tags WHERE type = ${type} ORDER BY name`;
  return result as Tag[];
}

export async function createTag(data: CreateTag): Promise<Tag> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO tags (name, type, color)
    VALUES (${data.name}, ${data.type ?? null}, ${data.color ?? null})
    RETURNING *
  `;
  return result[0] as Tag;
}

export async function updateTag(id: string, data: UpdateTag): Promise<Tag | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE tags SET
      name = COALESCE(${data.name ?? null}, name),
      type = COALESCE(${data.type ?? null}, type),
      color = COALESCE(${data.color ?? null}, color)
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as Tag) || null;
}

export async function deleteTag(id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM tags WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

export async function getOrCreateTag(name: string, type?: string): Promise<Tag> {
  const existing = await getTagByName(name);
  if (existing) return existing;
  return createTag({ name, type });
}

export async function getUsedColors(): Promise<string[]> {
  const sql = getDb();
  const result = await sql`SELECT color FROM tags WHERE color IS NOT NULL`;
  return (result as Array<{ color: string }>).map((r) => r.color);
}

export async function setTagColor(id: string, color: string | null): Promise<Tag | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE tags SET color = ${color}
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as Tag) || null;
}
