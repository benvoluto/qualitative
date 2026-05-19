"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Customer, CustomerType } from "@/lib/db/types";
import { features } from "@/lib/features";

interface CustomersListProps {
  customers: Customer[];
}

export function CustomersList({ customers }: CustomersListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  async function handleSync() {
    setIsLoading(true);
    setMessage(null);

    try {
      // Sync both customers and deals in parallel
      const [customersResponse, dealsResponse] = await Promise.all([
        fetch("/api/customers/sync-hubspot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days: 180 }),
        }),
        fetch("/api/deals/sync-hubspot", {
          method: "POST",
        }),
      ]);

      const customersData = await customersResponse.json();
      const dealsData = await dealsResponse.json();

      if (customersResponse.ok && dealsResponse.ok) {
        const customersSynced = (customersData.created || 0) + (customersData.updated || 0);
        const dealsSynced = (dealsData.created || 0) + (dealsData.updated || 0);
        setMessage({
          type: "success",
          text: `Synced ${customersSynced + dealsSynced}`,
        });
        router.refresh();
      } else {
        setMessage({ type: "error", text: "Sync failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Sync failed" });
    } finally {
      setIsLoading(false);
    }
  }

  // Separate companies into customers and deals
  const companiesCount = customers.filter((c) => c.customer_type === "customer").length;
  const dealsCount = customers.filter((c) => c.customer_type === "deal").length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Accordion Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            Organizations ({customers.length})
          </span>
          {customers.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {companiesCount} customers, {dealsCount} deals
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
              setShowAddForm(true);
            }}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1"
            title="Add an organization manually"
            aria-label="Add organization"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          {features.hubspot && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSync();
              }}
              disabled={isLoading}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 p-1"
              title="Sync from HubSpot"
            >
              {isLoading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              )}
            </button>
          )}
          <Link
            href="/companies"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            View All
          </Link>
        </div>
      </div>

      {/* Accordion Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          {message && (
            <div
              className={`mb-3 p-2 rounded text-xs ${
                message.type === "success"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
              }`}
            >
              {message.text}
            </div>
          )}

          {showAddForm && (
            <AddCompanyForm
              onClose={() => setShowAddForm(false)}
              onCreated={() => {
                setShowAddForm(false);
                setMessage({ type: "success", text: "Organization added" });
                router.refresh();
              }}
            />
          )}

          {customers.length > 0 ? (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {customers.map((customer) => (
                <Link
                  key={customer.id}
                  href={`/companies/${customer.id}`}
                  className="block px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium truncate">{customer.name}</div>
                    <span
                      className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                        customer.customer_type === "deal"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      }`}
                    >
                      {customer.customer_type === "deal" ? "Secondary" : "Primary"}
                    </span>
                  </div>
                  {customer.address && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {customer.address}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            !showAddForm && (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  No organizations yet
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    Add an organization
                  </button>
                  {features.hubspot && (
                    <>
                      <span className="text-sm text-gray-400 dark:text-gray-600">·</span>
                      <button
                        onClick={handleSync}
                        disabled={isLoading}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 disabled:opacity-50"
                      >
                        Sync from HubSpot
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

interface AddCompanyFormProps {
  onClose: () => void;
  onCreated: () => void;
}

function AddCompanyForm({ onClose, onCreated }: AddCompanyFormProps) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [customerType, setCustomerType] = useState<CustomerType>("customer");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          domain: domain.trim() || null,
          customer_type: customerType,
        }),
      });
      if (response.ok) {
        onCreated();
        return;
      }
      const data = await response.json();
      setError(data.error || "Failed to add company");
    } catch {
      setError("Failed to add company");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 p-3 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-2"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
          placeholder="Organization name"
          className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
        />
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="Domain (optional)"
          className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={customerType}
          onChange={(e) => setCustomerType(e.target.value as CustomerType)}
          className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
        >
          <option value="customer">Primary</option>
          <option value="deal">Secondary</option>
        </select>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1 rounded"
        >
          {isSubmitting ? "Adding…" : "Add organization"}
        </button>
      </div>
    </form>
  );
}
