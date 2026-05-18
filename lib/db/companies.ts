import { getDb } from "./client";
import { Company, CreateCompany, UpdateCompany } from "./types";

export async function getCompanies(accountId: string): Promise<Company[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM companies WHERE account_id = ${accountId} ORDER BY name`;
  return result as Company[];
}

export async function getCompanyById(accountId: string, id: string): Promise<Company | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM companies WHERE id = ${id} AND account_id = ${accountId}`;
  return (result[0] as Company) || null;
}

export async function getCompanyByHubSpotId(accountId: string, hubspotId: string): Promise<Company | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM companies WHERE hubspot_company_id = ${hubspotId} AND account_id = ${accountId}
  `;
  return (result[0] as Company) || null;
}

export async function getCompanyByDomain(accountId: string, domain: string): Promise<Company | null> {
  const sql = getDb();
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");
  const result = await sql`
    SELECT * FROM companies
    WHERE account_id = ${accountId}
      AND (LOWER(REPLACE(domain, 'www.', '')) = ${normalizedDomain}
           OR ${normalizedDomain} = ANY(SELECT LOWER(unnest(domain_aliases))))
  `;
  return (result[0] as Company) || null;
}

export async function createCompany(accountId: string, data: CreateCompany): Promise<Company> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO companies (
      account_id, name, domain, address, city, state, zip, country,
      hubspot_company_id, hubspot_synced_at,
      waitlist, waitlist_date, waitlist_followup, waitlist_source, deal_stage
    )
    VALUES (
      ${accountId},
      ${data.name},
      ${data.domain ?? null},
      ${data.address ?? null},
      ${data.city ?? null},
      ${data.state ?? null},
      ${data.zip ?? null},
      ${data.country ?? null},
      ${data.hubspot_company_id ?? null},
      ${data.hubspot_synced_at ?? null},
      ${data.waitlist ?? false},
      ${data.waitlist_date ?? null},
      ${data.waitlist_followup ?? null},
      ${data.waitlist_source ?? null},
      ${data.deal_stage ?? null}
    )
    RETURNING *
  `;
  return result[0] as Company;
}

export async function updateCompany(
  accountId: string,
  id: string,
  data: UpdateCompany
): Promise<Company | null> {
  const sql = getDb();
  const current = await getCompanyById(accountId, id);
  if (!current) return null;

  const result = await sql`
    UPDATE companies SET
      name = ${data.name ?? current.name},
      domain = ${data.domain !== undefined ? data.domain : current.domain},
      address = ${data.address !== undefined ? data.address : current.address},
      city = ${data.city !== undefined ? data.city : current.city},
      state = ${data.state !== undefined ? data.state : current.state},
      zip = ${data.zip !== undefined ? data.zip : current.zip},
      country = ${data.country !== undefined ? data.country : current.country},
      hubspot_company_id = ${data.hubspot_company_id !== undefined ? data.hubspot_company_id : current.hubspot_company_id},
      hubspot_synced_at = ${data.hubspot_synced_at !== undefined ? data.hubspot_synced_at : current.hubspot_synced_at},
      waitlist = ${data.waitlist !== undefined ? data.waitlist : current.waitlist},
      waitlist_date = ${data.waitlist_date !== undefined ? data.waitlist_date : current.waitlist_date},
      waitlist_followup = ${data.waitlist_followup !== undefined ? data.waitlist_followup : current.waitlist_followup},
      waitlist_source = ${data.waitlist_source !== undefined ? data.waitlist_source : current.waitlist_source},
      deal_stage = ${data.deal_stage !== undefined ? data.deal_stage : current.deal_stage}
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  return (result[0] as Company) || null;
}

export async function deleteCompany(accountId: string, id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM companies WHERE id = ${id} AND account_id = ${accountId} RETURNING id`;
  return result.length > 0;
}

export async function searchCompanies(accountId: string, query: string): Promise<Company[]> {
  const sql = getDb();
  const searchPattern = `%${query}%`;
  const result = await sql`
    SELECT * FROM companies
    WHERE account_id = ${accountId}
      AND (name ILIKE ${searchPattern} OR domain ILIKE ${searchPattern})
    ORDER BY name
  `;
  return result as Company[];
}

export interface CompanyWithStats extends Company {
  customer_count: number;
  deal_count: number;
  meeting_count: number;
  extract_count: number;
  pending_action_count: number;
}

export async function getCompaniesWithStats(accountId: string): Promise<CompanyWithStats[]> {
  const sql = getDb();
  const result = await sql`
    SELECT
      co.*,
      COALESCE((SELECT COUNT(*) FROM customers c WHERE c.company_id = co.id AND c.customer_type = 'customer'), 0)::int as customer_count,
      COALESCE((SELECT COUNT(*) FROM customers c WHERE c.company_id = co.id AND c.customer_type = 'deal'), 0)::int as deal_count,
      COALESCE((SELECT COUNT(*) FROM meetings m WHERE m.company_id = co.id), 0)::int as meeting_count,
      COALESCE((SELECT COUNT(*) FROM extracts e WHERE e.company_id = co.id), 0)::int as extract_count,
      COALESCE((SELECT COUNT(*) FROM extracts e WHERE e.company_id = co.id AND e.is_action_item = true AND (e.action_item_status IS NULL OR e.action_item_status = 'pending')), 0)::int as pending_action_count
    FROM companies co
    WHERE co.account_id = ${accountId}
    ORDER BY co.name
  `;
  return result as CompanyWithStats[];
}

export async function getCompanyWithStats(
  accountId: string,
  id: string
): Promise<CompanyWithStats | null> {
  const sql = getDb();
  const result = await sql`
    SELECT
      co.*,
      COALESCE((SELECT COUNT(*) FROM customers c WHERE c.company_id = co.id AND c.customer_type = 'customer'), 0)::int as customer_count,
      COALESCE((SELECT COUNT(*) FROM customers c WHERE c.company_id = co.id AND c.customer_type = 'deal'), 0)::int as deal_count,
      COALESCE((SELECT COUNT(*) FROM meetings m WHERE m.company_id = co.id), 0)::int as meeting_count,
      COALESCE((SELECT COUNT(*) FROM extracts e WHERE e.company_id = co.id), 0)::int as extract_count,
      COALESCE((SELECT COUNT(*) FROM extracts e WHERE e.company_id = co.id AND e.is_action_item = true AND (e.action_item_status IS NULL OR e.action_item_status = 'pending')), 0)::int as pending_action_count
    FROM companies co
    WHERE co.id = ${id} AND co.account_id = ${accountId}
  `;
  return (result[0] as CompanyWithStats) || null;
}

export async function getCompaniesNeedingHubSpotSync(
  accountId: string,
  maxAgeHours: number = 1
): Promise<Company[]> {
  const sql = getDb();
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  const result = await sql`
    SELECT * FROM companies
    WHERE account_id = ${accountId}
      AND hubspot_company_id IS NOT NULL
      AND (hubspot_synced_at IS NULL OR hubspot_synced_at < ${cutoffTime})
    ORDER BY hubspot_synced_at ASC NULLS FIRST
  `;
  return result as Company[];
}

export async function getLastCompanySyncTime(accountId: string): Promise<Date | null> {
  const sql = getDb();
  const result = await sql`
    SELECT MAX(hubspot_synced_at) as last_sync
    FROM companies
    WHERE account_id = ${accountId} AND hubspot_company_id IS NOT NULL
  `;
  const lastSync = result[0]?.last_sync;
  return lastSync ? new Date(lastSync) : null;
}

export async function upsertCompanyByHubSpotId(
  accountId: string,
  hubspotId: string,
  data: Omit<CreateCompany, "hubspot_company_id">
): Promise<Company> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO companies (
      account_id, name, domain, address, city, state, zip, country,
      hubspot_company_id, hubspot_synced_at,
      waitlist, waitlist_date, waitlist_followup, waitlist_source, deal_stage
    )
    VALUES (
      ${accountId},
      ${data.name},
      ${data.domain ?? null},
      ${data.address ?? null},
      ${data.city ?? null},
      ${data.state ?? null},
      ${data.zip ?? null},
      ${data.country ?? null},
      ${hubspotId},
      ${data.hubspot_synced_at ?? new Date()},
      ${data.waitlist ?? false},
      ${data.waitlist_date ?? null},
      ${data.waitlist_followup ?? null},
      ${data.waitlist_source ?? null},
      ${data.deal_stage ?? null}
    )
    ON CONFLICT (hubspot_company_id) DO UPDATE SET
      name = EXCLUDED.name,
      domain = COALESCE(EXCLUDED.domain, companies.domain),
      address = COALESCE(EXCLUDED.address, companies.address),
      city = COALESCE(EXCLUDED.city, companies.city),
      state = COALESCE(EXCLUDED.state, companies.state),
      zip = COALESCE(EXCLUDED.zip, companies.zip),
      country = COALESCE(EXCLUDED.country, companies.country),
      hubspot_synced_at = EXCLUDED.hubspot_synced_at,
      waitlist = COALESCE(EXCLUDED.waitlist, companies.waitlist),
      waitlist_date = COALESCE(EXCLUDED.waitlist_date, companies.waitlist_date),
      waitlist_followup = COALESCE(EXCLUDED.waitlist_followup, companies.waitlist_followup),
      waitlist_source = COALESCE(EXCLUDED.waitlist_source, companies.waitlist_source),
      deal_stage = COALESCE(EXCLUDED.deal_stage, companies.deal_stage)
    RETURNING *
  `;
  return result[0] as Company;
}
