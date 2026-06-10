"use client";

import { useState } from "react";
import Link from "next/link";
import { CustomerTypeBadge } from "./customer-type-badge";
import { CustomerType } from "@/lib/db/types";

interface CompanyWithStats {
  id: string;
  name: string;
  address: string | null;
  domain: string | null;
  customer_type: CustomerType;
  hubspot_company_id: string | null;
  hubspot_deal_id: string | null;
  meetingCount: number;
  extractCount: number;
  actionItemCount: number;
  pendingActionCount: number;
}

type FilterType = "all" | "customer" | "deal";

interface CompaniesClientProps {
  companies: CompanyWithStats[];
  customerCount: number;
  dealCount: number;
}

export function CompaniesClient({ companies, customerCount, dealCount }: CompaniesClientProps) {
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredCompanies = companies.filter((company) => {
    if (filter === "all") return true;
    return company.customer_type === filter;
  });

  return (
    <div>
      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <TabButton
          active={filter === "all"}
          onClick={() => setFilter("all")}
          count={companies.length}
        >
          All
        </TabButton>
        <TabButton
          active={filter === "customer"}
          onClick={() => setFilter("customer")}
          count={customerCount}
        >
          Customers
        </TabButton>
        <TabButton
          active={filter === "deal"}
          onClick={() => setFilter("deal")}
          count={dealCount}
        >
          Deals
        </TabButton>
      </div>

      {/* Companies List */}
      {filteredCompanies.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-x-auto p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            {filter === "all"
              ? "No companies yet"
              : filter === "customer"
              ? "No customers yet"
              : "No deals yet"}
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Sync companies from HubSpot to get started.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-x-auto overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Meetings
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Extracts
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Action Items
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCompanies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/companies/${company.id}`}
                        className="text-gray-900 dark:text-white font-medium hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {company.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <CustomerTypeBadge type={company.customer_type} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {company.address || "—"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {company.meetingCount > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          {company.meetingCount}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {company.extractCount > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          {company.extractCount}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {company.pendingActionCount > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                          {company.pendingActionCount} pending
                        </span>
                      ) : company.actionItemCount > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          {company.actionItemCount} done
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/companies/${company.id}`}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
  count,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-blue-500 text-blue-600 dark:text-blue-400"
          : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      }`}
    >
      {children}
      <span
        className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
          active
            ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
