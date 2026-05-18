import { getDb } from "./client";
import { Customer, CreateCustomer, UpdateCustomer, CustomerType } from "./types";

export async function getCustomers(accountId: string): Promise<Customer[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM customers WHERE account_id = ${accountId} ORDER BY name`;
  return result as Customer[];
}

export async function getCustomerById(accountId: string, id: string): Promise<Customer | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM customers WHERE id = ${id} AND account_id = ${accountId}`;
  return (result[0] as Customer) || null;
}

export async function createCustomer(accountId: string, data: CreateCustomer): Promise<Customer> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO customers (account_id, name, address, domain, customer_type, hubspot_company_id, hubspot_deal_id, deal_stage, hubspot_synced_at, company_id)
    VALUES (
      ${accountId},
      ${data.name},
      ${data.address ?? null},
      ${data.domain ?? null},
      ${data.customer_type ?? "customer"},
      ${data.hubspot_company_id ?? null},
      ${data.hubspot_deal_id ?? null},
      ${data.deal_stage ?? null},
      ${data.hubspot_synced_at ?? null},
      ${data.company_id ?? null}
    )
    RETURNING *
  `;
  return result[0] as Customer;
}

export async function updateCustomer(
  accountId: string,
  id: string,
  data: UpdateCustomer
): Promise<Customer | null> {
  const sql = getDb();

  const current = await getCustomerById(accountId, id);
  if (!current) return null;

  const result = await sql`
    UPDATE customers SET
      name = ${data.name ?? current.name},
      address = ${data.address !== undefined ? data.address : current.address},
      domain = ${data.domain !== undefined ? data.domain : current.domain},
      customer_type = ${data.customer_type ?? current.customer_type},
      hubspot_company_id = ${data.hubspot_company_id !== undefined ? data.hubspot_company_id : current.hubspot_company_id},
      hubspot_deal_id = ${data.hubspot_deal_id !== undefined ? data.hubspot_deal_id : current.hubspot_deal_id},
      deal_stage = ${data.deal_stage !== undefined ? data.deal_stage : current.deal_stage},
      hubspot_synced_at = ${data.hubspot_synced_at !== undefined ? data.hubspot_synced_at : current.hubspot_synced_at},
      company_id = ${data.company_id !== undefined ? data.company_id : current.company_id}
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;

  return (result[0] as Customer) || null;
}

export async function getCustomersByCompanyId(accountId: string, companyId: string): Promise<Customer[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM customers
    WHERE company_id = ${companyId} AND account_id = ${accountId}
    ORDER BY name
  `;
  return result as Customer[];
}

export async function deleteCustomer(accountId: string, id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM customers WHERE id = ${id} AND account_id = ${accountId} RETURNING id`;
  return result.length > 0;
}

export async function searchCustomers(accountId: string, query: string): Promise<Customer[]> {
  const sql = getDb();
  const searchPattern = `%${query}%`;
  const result = await sql`
    SELECT * FROM customers
    WHERE account_id = ${accountId}
      AND (name ILIKE ${searchPattern} OR address ILIKE ${searchPattern})
    ORDER BY name
  `;
  return result as Customer[];
}

export async function getCustomersByType(accountId: string, type: CustomerType): Promise<Customer[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM customers
    WHERE customer_type = ${type} AND account_id = ${accountId}
    ORDER BY name
  `;
  return result as Customer[];
}

export async function getCustomerByHubSpotCompanyId(
  accountId: string,
  hubspotCompanyId: string
): Promise<Customer | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM customers
    WHERE hubspot_company_id = ${hubspotCompanyId} AND account_id = ${accountId}
  `;
  return (result[0] as Customer) || null;
}

export async function getCustomerByHubSpotDealId(
  accountId: string,
  hubspotDealId: string
): Promise<Customer | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM customers
    WHERE hubspot_deal_id = ${hubspotDealId} AND account_id = ${accountId}
  `;
  return (result[0] as Customer) || null;
}

export async function getCustomerByDomain(accountId: string, domain: string): Promise<Customer | null> {
  const sql = getDb();
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");
  const result = await sql`
    SELECT * FROM customers
    WHERE account_id = ${accountId}
      AND (LOWER(REPLACE(domain, 'www.', '')) = ${normalizedDomain}
           OR ${normalizedDomain} = ANY(SELECT LOWER(unnest(domain_aliases))))
  `;
  return (result[0] as Customer) || null;
}

export async function getCustomerByEmailDomain(accountId: string, email: string): Promise<Customer | null> {
  const domain = email.split("@")[1];
  if (!domain) return null;
  return getCustomerByDomain(accountId, domain);
}

export async function getCustomersNeedingHubSpotSync(
  accountId: string,
  maxAgeHours: number = 1
): Promise<Customer[]> {
  const sql = getDb();
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  const result = await sql`
    SELECT * FROM customers
    WHERE account_id = ${accountId}
      AND hubspot_company_id IS NOT NULL
      AND (hubspot_synced_at IS NULL OR hubspot_synced_at < ${cutoffTime})
    ORDER BY hubspot_synced_at ASC NULLS FIRST
  `;
  return result as Customer[];
}

export async function getLastHubSpotSyncTime(accountId: string): Promise<Date | null> {
  const sql = getDb();
  const result = await sql`
    SELECT MAX(hubspot_synced_at) as last_sync FROM customers
    WHERE account_id = ${accountId} AND hubspot_synced_at IS NOT NULL
  `;
  return result[0]?.last_sync || null;
}

export async function needsHubSpotSync(accountId: string, maxAgeHours: number = 1): Promise<boolean> {
  const lastSync = await getLastHubSpotSyncTime(accountId);
  if (!lastSync) return true;
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  return lastSync < cutoffTime;
}

export async function getCustomersWithHubSpotIds(accountId: string): Promise<Customer[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM customers
    WHERE account_id = ${accountId} AND hubspot_company_id IS NOT NULL
    ORDER BY name
  `;
  return result as Customer[];
}

export async function updateCustomerDealStage(
  accountId: string,
  id: string,
  dealStage: string | null,
  customerType: CustomerType
): Promise<Customer | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE customers SET
      deal_stage = ${dealStage},
      customer_type = ${customerType},
      hubspot_synced_at = NOW()
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *
  `;
  return (result[0] as Customer) || null;
}
