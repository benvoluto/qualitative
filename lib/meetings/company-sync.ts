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

/**
 * Determines the customer type based on deal stage
 * If deal stage contains "won", it's a customer; otherwise it's a deal
 */
export function getCustomerTypeFromDealStage(dealStage: string | null): CustomerType {
  if (!dealStage) {
    return "deal"; // Default to deal if no stage
  }
  const stageLower = dealStage.toLowerCase();
  return stageLower.includes("won") ? "customer" : "deal";
}

/**
 * Sync deal stages for all customers that need updating
 * Only syncs customers that haven't been synced in the past hour
 */
export async function syncCompanyDealStages(maxAgeHours: number = 1): Promise<SyncResult> {
  const result: SyncResult = {
    synced: 0,
    skipped: 0,
    errors: [],
  };

  if (!isHubSpotConfigured()) {
    return result;
  }

  // Get customers that need syncing
  const customersToSync = await customers.getCustomersNeedingHubSpotSync(maxAgeHours);

  if (customersToSync.length === 0) {
    return result;
  }

  for (const customer of customersToSync) {
    if (!customer.hubspot_company_id) {
      result.skipped++;
      continue;
    }

    try {
      // Get the best deal stage for this company
      const { dealStage, isWon } = await getBestDealStageForCompany(customer.hubspot_company_id);

      // Determine customer type based on deal stage
      const customerType: CustomerType = isWon ? "customer" : "deal";

      // Update the customer with deal stage and type
      await customers.updateCustomerDealStage(customer.id, dealStage, customerType);
      result.synced++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      result.errors.push(`Failed to sync ${customer.name}: ${message}`);
    }
  }

  return result;
}

/**
 * Check if companies need syncing and sync if needed
 * Returns true if sync was performed, false if skipped
 */
export async function ensureCompaniesAreSynced(maxAgeHours: number = 1): Promise<{
  performed: boolean;
  result?: SyncResult;
}> {
  if (!isHubSpotConfigured()) {
    return { performed: false };
  }

  const needsSync = await customers.needsHubSpotSync(maxAgeHours);

  if (!needsSync) {
    return { performed: false };
  }

  const result = await syncCompanyDealStages(maxAgeHours);
  return { performed: true, result };
}

/**
 * Get the customer type for a specific customer, syncing from HubSpot if needed
 */
export async function getCustomerTypeWithSync(customerId: string): Promise<CustomerType> {
  const customer = await customers.getCustomerById(customerId);

  if (!customer) {
    return "deal"; // Default
  }

  // If customer has a recent sync, use cached value
  if (customer.hubspot_synced_at) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (customer.hubspot_synced_at > oneHourAgo) {
      return customer.customer_type;
    }
  }

  // If customer has HubSpot company ID, sync and update
  if (customer.hubspot_company_id && isHubSpotConfigured()) {
    try {
      const { dealStage, isWon } = await getBestDealStageForCompany(customer.hubspot_company_id);
      const customerType: CustomerType = isWon ? "customer" : "deal";
      await customers.updateCustomerDealStage(customer.id, dealStage, customerType);
      return customerType;
    } catch {
      // Fall through to return current type
    }
  }

  return customer.customer_type;
}
