import { getDb } from "./client";
import { Customer, CreateCustomer, UpdateCustomer, CustomerType } from "./types";

export async function getCustomers(): Promise<Customer[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM customers ORDER BY name`;
  return result as Customer[];
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM customers WHERE id = ${id}`;
  return (result[0] as Customer) || null;
}

export async function createCustomer(data: CreateCustomer): Promise<Customer> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO customers (name, address, domain, customer_type, hubspot_company_id, hubspot_deal_id, deal_stage, hubspot_synced_at, company_id)
    VALUES (
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

export async function updateCustomer(id: string, data: UpdateCustomer): Promise<Customer | null> {
  const sql = getDb();

  // Get current customer to merge with updates
  const current = await getCustomerById(id);
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
    WHERE id = ${id}
    RETURNING *
  `;

  return (result[0] as Customer) || null;
}

/**
 * Get all customers linked to a specific company.
 */
export async function getCustomersByCompanyId(companyId: string): Promise<Customer[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM customers
    WHERE company_id = ${companyId}
    ORDER BY name
  `;
  return result as Customer[];
}

export async function deleteCustomer(id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`DELETE FROM customers WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const sql = getDb();
  const searchPattern = `%${query}%`;
  const result = await sql`
    SELECT * FROM customers
    WHERE name ILIKE ${searchPattern} OR address ILIKE ${searchPattern}
    ORDER BY name
  `;
  return result as Customer[];
}

export async function getCustomersByType(type: CustomerType): Promise<Customer[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM customers
    WHERE customer_type = ${type}
    ORDER BY name
  `;
  return result as Customer[];
}

export async function getCustomerByHubSpotCompanyId(hubspotCompanyId: string): Promise<Customer | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM customers
    WHERE hubspot_company_id = ${hubspotCompanyId}
  `;
  return (result[0] as Customer) || null;
}

export async function getCustomerByHubSpotDealId(hubspotDealId: string): Promise<Customer | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM customers
    WHERE hubspot_deal_id = ${hubspotDealId}
  `;
  return (result[0] as Customer) || null;
}

export async function getCustomerByDomain(domain: string): Promise<Customer | null> {
  const sql = getDb();
  // Normalize domain for comparison (lowercase, strip www.)
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");
  // Check both primary domain and domain_aliases
  const result = await sql`
    SELECT * FROM customers
    WHERE LOWER(REPLACE(domain, 'www.', '')) = ${normalizedDomain}
       OR ${normalizedDomain} = ANY(SELECT LOWER(unnest(domain_aliases)))
  `;
  return (result[0] as Customer) || null;
}

export async function getCustomerByEmailDomain(email: string): Promise<Customer | null> {
  // Extract domain from email address
  const domain = email.split("@")[1];
  if (!domain) return null;
  return getCustomerByDomain(domain);
}

/**
 * Get customers with HubSpot company IDs that need syncing
 * (hubspot_synced_at is null or older than specified hours)
 */
export async function getCustomersNeedingHubSpotSync(maxAgeHours: number = 1): Promise<Customer[]> {
  const sql = getDb();
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  const result = await sql`
    SELECT * FROM customers
    WHERE hubspot_company_id IS NOT NULL
      AND (hubspot_synced_at IS NULL OR hubspot_synced_at < ${cutoffTime})
    ORDER BY hubspot_synced_at ASC NULLS FIRST
  `;
  return result as Customer[];
}

/**
 * Get the most recent hubspot_synced_at timestamp across all customers
 * Returns null if no customers have been synced
 */
export async function getLastHubSpotSyncTime(): Promise<Date | null> {
  const sql = getDb();
  const result = await sql`
    SELECT MAX(hubspot_synced_at) as last_sync FROM customers
    WHERE hubspot_synced_at IS NOT NULL
  `;
  return result[0]?.last_sync || null;
}

/**
 * Check if any customer sync is needed (no sync in the past hour)
 */
export async function needsHubSpotSync(maxAgeHours: number = 1): Promise<boolean> {
  const lastSync = await getLastHubSpotSyncTime();
  if (!lastSync) return true;
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  return lastSync < cutoffTime;
}

/**
 * Get all customers with HubSpot company IDs
 */
export async function getCustomersWithHubSpotIds(): Promise<Customer[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM customers
    WHERE hubspot_company_id IS NOT NULL
    ORDER BY name
  `;
  return result as Customer[];
}

/**
 * Update customer's deal stage and mark as synced
 */
export async function updateCustomerDealStage(
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
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as Customer) || null;
}
