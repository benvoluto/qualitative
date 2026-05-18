import { getDb } from "./client";
import { Group, CreateGroup, UpdateGroup } from "./types";

export async function getGroups(accountId: string): Promise<Group[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM groups WHERE account_id = ${accountId} ORDER BY name`;
  return result as Group[];
}

export async function getGroupById(accountId: string, id: string): Promise<Group | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM groups WHERE id = ${id} AND account_id = ${accountId}`;
  return (result[0] as Group) || null;
}

export async function getGroupByName(accountId: string, name: string): Promise<Group | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM groups WHERE name = ${name} AND account_id = ${accountId}`;
  return (result[0] as Group) || null;
}

export async function createGroup(accountId: string, data: CreateGroup): Promise<Group> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO groups (account_id, name)
    VALUES (${accountId}, ${data.name})
    RETURNING *
  `;
  return result[0] as Group;
}

export async function updateGroup(accountId: string, id: string, data: UpdateGroup): Promise<Group | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE groups SET name = COALESCE(${data.name ?? null}, name)
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  return (result[0] as Group) || null;
}

export async function deleteGroup(accountId: string, id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM groups WHERE id = ${id} AND account_id = ${accountId} RETURNING id`;
  return result.length > 0;
}

export async function getOrCreateGroup(accountId: string, name: string): Promise<Group> {
  const existing = await getGroupByName(accountId, name);
  if (existing) return existing;
  return createGroup(accountId, { name });
}
