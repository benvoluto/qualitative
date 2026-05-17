import { getDb } from "./client";
import { Personnel, CreatePersonnel, UpdatePersonnel } from "./types";

export async function getPersonnel(): Promise<Personnel[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM personnel ORDER BY name`;
  return result as Personnel[];
}

export async function getPersonnelById(id: string): Promise<Personnel | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM personnel WHERE id = ${id}`;
  return (result[0] as Personnel) || null;
}

export async function getPersonnelByCustomerId(customerId: string): Promise<Personnel[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM personnel WHERE customer_id = ${customerId} ORDER BY name
  `;
  return result as Personnel[];
}

export async function getPersonnelByEmail(email: string): Promise<Personnel | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM personnel WHERE email = ${email}`;
  return (result[0] as Personnel) || null;
}

export async function createPersonnel(data: CreatePersonnel): Promise<Personnel> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO personnel (name, title, email, customer_id, company_id, role_id, group_id, hubspot_contact_id, hubspot_synced_at)
    VALUES (
      ${data.name},
      ${data.title ?? null},
      ${data.email ?? null},
      ${data.customer_id ?? null},
      ${data.company_id ?? null},
      ${data.role_id ?? null},
      ${data.group_id ?? null},
      ${data.hubspot_contact_id ?? null},
      ${data.hubspot_synced_at ?? null}
    )
    RETURNING *
  `;
  return result[0] as Personnel;
}

export async function updatePersonnel(id: string, data: UpdatePersonnel): Promise<Personnel | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE personnel SET
      name = COALESCE(${data.name ?? null}, name),
      title = COALESCE(${data.title ?? null}, title),
      email = COALESCE(${data.email ?? null}, email),
      customer_id = COALESCE(${data.customer_id ?? null}, customer_id),
      company_id = COALESCE(${data.company_id ?? null}, company_id),
      role_id = COALESCE(${data.role_id ?? null}, role_id),
      group_id = COALESCE(${data.group_id ?? null}, group_id),
      hubspot_contact_id = COALESCE(${data.hubspot_contact_id ?? null}, hubspot_contact_id),
      hubspot_synced_at = COALESCE(${data.hubspot_synced_at ?? null}, hubspot_synced_at),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as Personnel) || null;
}

export async function deletePersonnel(id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM personnel WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

export async function searchPersonnel(query: string): Promise<Personnel[]> {
  const sql = getDb();
  const searchPattern = `%${query}%`;
  const result = await sql`
    SELECT * FROM personnel
    WHERE name ILIKE ${searchPattern} OR email ILIKE ${searchPattern} OR title ILIKE ${searchPattern}
    ORDER BY name
  `;
  return result as Personnel[];
}

export async function getPersonnelByHubSpotContactId(hubspotContactId: string): Promise<Personnel | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM personnel WHERE hubspot_contact_id = ${hubspotContactId}`;
  return (result[0] as Personnel) || null;
}

export async function upsertPersonnelByHubSpotContactId(
  hubspotContactId: string,
  data: Omit<CreatePersonnel, "hubspot_contact_id">
): Promise<Personnel> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO personnel (name, title, email, customer_id, company_id, role_id, group_id, hubspot_contact_id, hubspot_synced_at)
    VALUES (
      ${data.name},
      ${data.title ?? null},
      ${data.email ?? null},
      ${data.customer_id ?? null},
      ${data.company_id ?? null},
      ${data.role_id ?? null},
      ${data.group_id ?? null},
      ${hubspotContactId},
      NOW()
    )
    ON CONFLICT (hubspot_contact_id) DO UPDATE SET
      name = EXCLUDED.name,
      title = COALESCE(EXCLUDED.title, personnel.title),
      email = COALESCE(EXCLUDED.email, personnel.email),
      customer_id = COALESCE(EXCLUDED.customer_id, personnel.customer_id),
      company_id = COALESCE(EXCLUDED.company_id, personnel.company_id),
      hubspot_synced_at = NOW(),
      updated_at = NOW()
    RETURNING *
  `;
  return result[0] as Personnel;
}

export async function getPersonnelByCompanyId(companyId: string): Promise<Personnel[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM personnel WHERE company_id = ${companyId} ORDER BY name
  `;
  return result as Personnel[];
}
