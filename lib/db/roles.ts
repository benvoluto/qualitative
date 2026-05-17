import { getDb } from "./client";
import { Role, CreateRole, UpdateRole } from "./types";

export async function getRoles(): Promise<Role[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM roles ORDER BY name`;
  return result as Role[];
}

export async function getRoleById(id: string): Promise<Role | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM roles WHERE id = ${id}`;
  return (result[0] as Role) || null;
}

export async function getRoleByName(name: string): Promise<Role | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM roles WHERE name = ${name}`;
  return (result[0] as Role) || null;
}

export async function createRole(data: CreateRole): Promise<Role> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO roles (name, description)
    VALUES (${data.name}, ${data.description ?? null})
    RETURNING *
  `;
  return result[0] as Role;
}

export async function updateRole(id: string, data: UpdateRole): Promise<Role | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE roles SET
      name = COALESCE(${data.name ?? null}, name),
      description = COALESCE(${data.description ?? null}, description)
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as Role) || null;
}

export async function deleteRole(id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM roles WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

export async function getOrCreateRole(name: string, description?: string): Promise<Role> {
  const existing = await getRoleByName(name);
  if (existing) return existing;
  return createRole({ name, description });
}
