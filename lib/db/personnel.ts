import { getDb } from "./client";
import { Personnel, CreatePersonnel, UpdatePersonnel } from "./types";

export async function getPersonnel(accountId: string): Promise<Personnel[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM personnel WHERE account_id = ${accountId} ORDER BY name`;
  return result as Personnel[];
}

export async function getPersonnelById(accountId: string, id: string): Promise<Personnel | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM personnel WHERE id = ${id} AND account_id = ${accountId}`;
  return (result[0] as Personnel) || null;
}

export async function getPersonnelByCustomerId(accountId: string, customerId: string): Promise<Personnel[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM personnel WHERE customer_id = ${customerId} AND account_id = ${accountId} ORDER BY name
  `;
  return result as Personnel[];
}

export async function getPersonnelByEmail(accountId: string, email: string): Promise<Personnel | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM personnel WHERE email = ${email} AND account_id = ${accountId}`;
  return (result[0] as Personnel) || null;
}

export async function createPersonnel(accountId: string, data: CreatePersonnel): Promise<Personnel> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO personnel (account_id, name, title, email, customer_id, company_id, role_id, group_id, hubspot_contact_id, hubspot_synced_at)
    VALUES (
      ${accountId},
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

export async function updatePersonnel(
  accountId: string,
  id: string,
  data: UpdatePersonnel
): Promise<Personnel | null> {
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
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  return (result[0] as Personnel) || null;
}

export async function deletePersonnel(accountId: string, id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM personnel WHERE id = ${id} AND account_id = ${accountId} RETURNING id`;
  return result.length > 0;
}

export async function searchPersonnel(accountId: string, query: string): Promise<Personnel[]> {
  const sql = getDb();
  const searchPattern = `%${query}%`;
  const result = await sql`
    SELECT * FROM personnel
    WHERE account_id = ${accountId}
      AND (name ILIKE ${searchPattern} OR email ILIKE ${searchPattern} OR title ILIKE ${searchPattern})
    ORDER BY name
  `;
  return result as Personnel[];
}

export async function getPersonnelByHubSpotContactId(
  accountId: string,
  hubspotContactId: string
): Promise<Personnel | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM personnel WHERE hubspot_contact_id = ${hubspotContactId} AND account_id = ${accountId}
  `;
  return (result[0] as Personnel) || null;
}

export async function upsertPersonnelByHubSpotContactId(
  accountId: string,
  hubspotContactId: string,
  data: Omit<CreatePersonnel, "hubspot_contact_id">
): Promise<Personnel> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO personnel (account_id, name, title, email, customer_id, company_id, role_id, group_id, hubspot_contact_id, hubspot_synced_at)
    VALUES (
      ${accountId},
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

export async function getPersonnelByCompanyId(accountId: string, companyId: string): Promise<Personnel[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM personnel WHERE company_id = ${companyId} AND account_id = ${accountId} ORDER BY name
  `;
  return result as Personnel[];
}
