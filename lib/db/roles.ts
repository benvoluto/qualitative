import { getDb } from "./client";
import { Role, CreateRole, UpdateRole } from "./types";

export async function getRoles(accountId: string): Promise<Role[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM roles WHERE account_id = ${accountId} ORDER BY name`;
  return result as Role[];
}

export async function getRoleById(accountId: string, id: string): Promise<Role | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM roles WHERE id = ${id} AND account_id = ${accountId}`;
  return (result[0] as Role) || null;
}

export async function getRoleByName(accountId: string, name: string): Promise<Role | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM roles WHERE name = ${name} AND account_id = ${accountId}`;
  return (result[0] as Role) || null;
}

export async function createRole(accountId: string, data: CreateRole): Promise<Role> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO roles (account_id, name, description)
    VALUES (${accountId}, ${data.name}, ${data.description ?? null})
    RETURNING *
  `;
  return result[0] as Role;
}

export async function updateRole(accountId: string, id: string, data: UpdateRole): Promise<Role | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE roles SET
      name = COALESCE(${data.name ?? null}, name),
      description = COALESCE(${data.description ?? null}, description)
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  return (result[0] as Role) || null;
}

export async function deleteRole(accountId: string, id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM roles WHERE id = ${id} AND account_id = ${accountId} RETURNING id`;
  return result.length > 0;
}

export async function getOrCreateRole(accountId: string, name: string, description?: string): Promise<Role> {
  const existing = await getRoleByName(accountId, name);
  if (existing) return existing;
  return createRole(accountId, { name, description });
}
