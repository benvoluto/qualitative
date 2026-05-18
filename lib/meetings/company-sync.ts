/**
 * Company Sync Module
 * Handles syncing company deal stages from HubSpot before meeting sync
 */

import { customers } from "@/lib/db";
import { isHubSpotConfigured, getBestDealStageForCompany } from "@/lib/hubspot";
import { CustomerType } from "@/lib/db/types";

interface SyncResult {
  synced: number;
  skipped: number;
  errors: string[];
}

export function getCustomerTypeFromDealStage(dealStage: string | null): CustomerType {
  if (!dealStage) return "deal";
  return dealStage.toLowerCase().includes("won") ? "customer" : "deal";
}

export async function syncCompanyDealStages(
  accountId: string,
  maxAgeHours: number = 1
): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, skipped: 0, errors: [] };

  if (!isHubSpotConfigured()) return result;

  const customersToSync = await customers.getCustomersNeedingHubSpotSync(accountId, maxAgeHours);
  if (customersToSync.length === 0) return result;

  for (const customer of customersToSync) {
    if (!customer.hubspot_company_id) {
      result.skipped++;
      continue;
    }

    try {
      const { dealStage, isWon } = await getBestDealStageForCompany(customer.hubspot_company_id);
      const customerType: CustomerType = isWon ? "customer" : "deal";
      await customers.updateCustomerDealStage(accountId, customer.id, dealStage, customerType);
      result.synced++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      result.errors.push(`Failed to sync ${customer.name}: ${message}`);
    }
  }

  return result;
}

export async function ensureCompaniesAreSynced(
  accountId: string,
  maxAgeHours: number = 1
): Promise<{ performed: boolean; result?: SyncResult }> {
  if (!isHubSpotConfigured()) return { performed: false };

  const needsSync = await customers.needsHubSpotSync(accountId, maxAgeHours);
  if (!needsSync) return { performed: false };

  const result = await syncCompanyDealStages(accountId, maxAgeHours);
  return { performed: true, result };
}

export async function getCustomerTypeWithSync(
  accountId: string,
  customerId: string
): Promise<CustomerType> {
  const customer = await customers.getCustomerById(accountId, customerId);
  if (!customer) return "deal";

  if (customer.hubspot_synced_at) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (customer.hubspot_synced_at > oneHourAgo) return customer.customer_type;
  }

  if (customer.hubspot_company_id && isHubSpotConfigured()) {
    try {
      const { dealStage, isWon } = await getBestDealStageForCompany(customer.hubspot_company_id);
      const customerType: CustomerType = isWon ? "customer" : "deal";
      await customers.updateCustomerDealStage(accountId, customer.id, dealStage, customerType);
      return customerType;
    } catch {
      // Fall through
    }
  }

  return customer.customer_type;
}
