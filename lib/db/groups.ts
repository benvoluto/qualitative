import { getDb } from "./client";
import { Group, CreateGroup, UpdateGroup } from "./types";

export async function getGroups(): Promise<Group[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM groups ORDER BY name`;
  return result as Group[];
}

export async function getGroupById(id: string): Promise<Group | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM groups WHERE id = ${id}`;
  return (result[0] as Group) || null;
}

export async function getGroupByName(name: string): Promise<Group | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM groups WHERE name = ${name}`;
  return (result[0] as Group) || null;
}

export async function createGroup(data: CreateGroup): Promise<Group> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO groups (name)
    VALUES (${data.name})
    RETURNING *
  `;
  return result[0] as Group;
}

export async function updateGroup(id: string, data: UpdateGroup): Promise<Group | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE groups SET name = COALESCE(${data.name ?? null}, name)
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as Group) || null;
}

export async function deleteGroup(id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM groups WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

export async function getOrCreateGroup(name: string): Promise<Group> {
  const existing = await getGroupByName(name);
  if (existing) return existing;
  return createGroup({ name });
}
