"use client";

import { useState } from "react";
import Link from "next/link";
import { CustomerTypeBadge } from "./customer-type-badge";
import { CustomerType } from "@/lib/db/types";
import { CompanyWithStats } from "@/lib/db/companies";

interface CustomerWithStats {
  id: string;
  name: string;
  address: string | null;
  domain: string | null;
  customer_type: CustomerType;
  hubspot_company_id: string | null;
  hubspot_deal_id: string | null;
  company_id: string | null;
  meetingCount: number;
  extractCount: number;
  actionItemCount: number;
  pendingActionCount: number;
}

type ViewType = "companies" | "customers";
type CustomerFilterType = "all" | "customer" | "deal";

interface CompaniesPageClientProps {
  companies: CompanyWithStats[];
  customers: CustomerWithStats[];
  companyStats: {
    totalCompanies: number;
    totalMeetings: number;
    totalExtracts: number;
    totalPendingActions: number;
  };
  customerStats: {
    totalCustomers: number;
    customerTypeCount: number;
    dealTypeCount: number;
    totalMeetings: number;
    totalExtracts: number;
    totalPendingActions: number;
  };
}

export function CompaniesPageClient({
  companies,
  customers,
  companyStats,
  customerStats,
}: CompaniesPageClientProps) {
  const [view, setView] = useState<ViewType>("companies");
  const [customerFilter, setCustomerFilter] = useState<CustomerFilterType>("all");

  const filteredCustomers = customers.filter((customer) => {
    if (customerFilter === "all") return true;
    return customer.customer_type === customerFilter;
  });

  return (
    <div>
      {/* View Toggle */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <ViewButton
          active={view === "companies"}
          onClick={() => setView("companies")}
          count={companyStats.totalCompanies}
        >
          Organizations
        </ViewButton>
        <ViewButton
          active={view === "customers"}
          onClick={() => setView("customers")}
          count={customerStats.totalCustomers}
        >
          Primary & Secondary
        </ViewButton>
      </div>

      {view === "companies" ? (
        <CompaniesView companies={companies} stats={companyStats} />
      ) : (
        <CustomersView
          customers={filteredCustomers}
          allCustomers={customers}
          filter={customerFilter}
          onFilterChange={setCustomerFilter}
          stats={customerStats}
        />
      )}
    </div>
  );
}

function CompaniesView({
  companies,
  stats,
}: {
  companies: CompanyWithStats[];
  stats: CompaniesPageClientProps["companyStats"];
}) {
  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Organizations" value={stats.totalCompanies} />
        <StatCard label="Total Meetings" value={stats.totalMeetings} color="blue" />
        <StatCard label="Total Extracts" value={stats.totalExtracts} color="green" />
        <StatCard label="Pending Actions" value={stats.totalPendingActions} color="orange" />
      </div>

      {/* Companies List */}
      {companies.length === 0 ? (
        <EmptyState message="No organizations yet" description="Add an organization to get started." />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-x-auto overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Deal Stage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Waitlist
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {companies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/companies/company/${company.id}`}
                        className="text-gray-900 dark:text-white font-medium hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {company.name}
                      </Link>
                      {company.domain && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {company.domain}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {company.deal_stage ? (
                        <DealStageBadge stage={company.deal_stage} />
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {company.waitlist ? (
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                            Waitlist
                          </span>
                          {company.waitlist_date && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {formatDate(company.waitlist_date)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatLocation(company.city, company.state)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {company.meeting_count > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          {company.meeting_count}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {company.extract_count > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          {company.extract_count}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/companies/company/${company.id}`}
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

function CustomersView({
  customers,
  allCustomers,
  filter,
  onFilterChange,
  stats,
}: {
  customers: CustomerWithStats[];
  allCustomers: CustomerWithStats[];
  filter: CustomerFilterType;
  onFilterChange: (filter: CustomerFilterType) => void;
  stats: CompaniesPageClientProps["customerStats"];
}) {
  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total"
          value={stats.totalCustomers}
          subtitle={`${stats.customerTypeCount} primary, ${stats.dealTypeCount} secondary`}
        />
        <StatCard label="Total Meetings" value={stats.totalMeetings} color="blue" />
        <StatCard label="Total Extracts" value={stats.totalExtracts} color="green" />
        <StatCard label="Pending Actions" value={stats.totalPendingActions} color="orange" />
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <TabButton
          active={filter === "all"}
          onClick={() => onFilterChange("all")}
          count={allCustomers.length}
        >
          All
        </TabButton>
        <TabButton
          active={filter === "customer"}
          onClick={() => onFilterChange("customer")}
          count={stats.customerTypeCount}
        >
          Primary
        </TabButton>
        <TabButton
          active={filter === "deal"}
          onClick={() => onFilterChange("deal")}
          count={stats.dealTypeCount}
        >
          Secondary
        </TabButton>
      </div>

      {/* Customers List */}
      {customers.length === 0 ? (
        <EmptyState
          message={filter === "deal" ? "No secondary organizations yet" : "No primary organizations yet"}
          description="Add an organization to get started."
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-x-auto overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
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
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/companies/${customer.id}`}
                        className="text-gray-900 dark:text-white font-medium hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <CustomerTypeBadge type={customer.customer_type} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {customer.address || "—"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {customer.meetingCount > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          {customer.meetingCount}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {customer.extractCount > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          {customer.extractCount}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {customer.pendingActionCount > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                          {customer.pendingActionCount} pending
                        </span>
                      ) : customer.actionItemCount > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          {customer.actionItemCount} done
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/companies/${customer.id}`}
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

function formatLocation(city: string | null, state: string | null): string {
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return "—";
}

function ViewButton({
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
          ? "border-green-500 text-green-600 dark:text-green-400"
          : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      }`}
    >
      {children}
      <span
        className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
          active
            ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function StatCard({
  label,
  value,
  color = "gray",
  subtitle,
}: {
  label: string;
  value: number;
  color?: "gray" | "blue" | "green" | "orange";
  subtitle?: string;
}) {
  const colorClasses = {
    gray: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  };

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm opacity-75">{label}</p>
      {subtitle && <p className="text-xs opacity-60 mt-1">{subtitle}</p>}
    </div>
  );
}

function EmptyState({ message, description }: { message: string; description: string }) {
  return (
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
      <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">{message}</h3>
      <p className="mt-2 text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}

function DealStageBadge({ stage }: { stage: string }) {
  // Map common deal stages to colors
  const stageColors: Record<string, string> = {
    // Won stages
    "closedwon": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "closed won": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "won": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    // Lost stages
    "closedlost": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    "closed lost": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    "lost": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    // Active stages
    "qualifiedtobuy": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    "qualified to buy": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    "presentationscheduled": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    "presentation scheduled": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    "decisionmakerboughtin": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    "decision maker bought in": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    "contractsent": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    "contract sent": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  };

  const normalizedStage = stage.toLowerCase().replace(/\s+/g, "");
  const colorClass = stageColors[normalizedStage] || stageColors[stage.toLowerCase()] ||
    "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";

  // Format display name
  const displayName = stage
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {displayName}
    </span>
  );
}

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
