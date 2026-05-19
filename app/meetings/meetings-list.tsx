"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Meeting, Customer } from "@/lib/db/types";
import Link from "next/link";

type FilterType = "all" | "external" | "customer" | "deal" | "internal";
type SortColumn = "date" | "host" | "company";
type SortDirection = "asc" | "desc";

const MEETINGS_FILTER_KEY = "meetings-list-filter";
const MEETINGS_SORT_KEY = "meetings-list-sort";
const MEETINGS_HOST_FILTER_KEY = "meetings-host-filter";
const MEETINGS_COMPANY_FILTER_KEY = "meetings-company-filter";

interface MeetingsListProps {
  meetings: Meeting[];
  customers?: Customer[];
  extractCounts?: Record<string, number>;
}

export function MeetingsList({ meetings, customers = [], extractCounts = {} }: MeetingsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [hostFilter, setHostFilter] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const router = useRouter();

  // Load filter and sort from localStorage on mount
  useEffect(() => {
    const savedFilter = localStorage.getItem(MEETINGS_FILTER_KEY);
    if (savedFilter && ["all", "external", "customer", "deal", "internal"].includes(savedFilter)) {
      setFilter(savedFilter as FilterType);
    }
    const savedSort = localStorage.getItem(MEETINGS_SORT_KEY);
    if (savedSort) {
      try {
        const { column, direction } = JSON.parse(savedSort);
        if (["date", "host", "company"].includes(column)) {
          setSortColumn(column);
        }
        if (["asc", "desc"].includes(direction)) {
          setSortDirection(direction);
        }
      } catch {
        // Ignore invalid JSON
      }
    }
    const savedHostFilter = localStorage.getItem(MEETINGS_HOST_FILTER_KEY);
    if (savedHostFilter) setHostFilter(savedHostFilter);
    const savedCompanyFilter = localStorage.getItem(MEETINGS_COMPANY_FILTER_KEY);
    if (savedCompanyFilter) setCompanyFilter(savedCompanyFilter);
  }, []);

  // Save filter to localStorage when it changes
  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    localStorage.setItem(MEETINGS_FILTER_KEY, newFilter);
  };

  // Handle sort column click
  const handleSort = (column: SortColumn) => {
    let newDirection: SortDirection = "asc";
    if (sortColumn === column) {
      newDirection = sortDirection === "asc" ? "desc" : "asc";
    } else if (column === "date") {
      newDirection = "desc";
    }
    setSortColumn(column);
    setSortDirection(newDirection);
    localStorage.setItem(MEETINGS_SORT_KEY, JSON.stringify({ column, direction: newDirection }));
  };

  // Handle host filter change
  const handleHostFilterChange = (value: string) => {
    setHostFilter(value);
    if (value) {
      localStorage.setItem(MEETINGS_HOST_FILTER_KEY, value);
    } else {
      localStorage.removeItem(MEETINGS_HOST_FILTER_KEY);
    }
  };

  // Handle company filter change
  const handleCompanyFilterChange = (value: string) => {
    setCompanyFilter(value);
    if (value) {
      localStorage.setItem(MEETINGS_COMPANY_FILTER_KEY, value);
    } else {
      localStorage.removeItem(MEETINGS_COMPANY_FILTER_KEY);
    }
  };

  // Create a map of customer IDs to customers for quick lookup
  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  // Extract unique hosts and companies for filter dropdowns
  const uniqueHosts = useMemo(() => {
    const hosts = new Set<string>();
    meetings.forEach((m) => {
      if (m.host_name) hosts.add(m.host_name);
    });
    return Array.from(hosts).sort((a, b) => a.localeCompare(b));
  }, [meetings]);

  const uniqueCompanies = useMemo(() => {
    const companies = new Set<string>();
    meetings.forEach((m) => {
      if (m.customer_id) {
        const customer = customerMap.get(m.customer_id);
        if (customer) companies.add(customer.name);
      }
    });
    return Array.from(companies).sort((a, b) => a.localeCompare(b));
  }, [meetings, customerMap]);

  // Calculate counts for each filter
  const counts = {
    all: meetings.length,
    external: meetings.filter((m) => {
      if (m.is_internal) return false;
      const customer = m.customer_id ? customerMap.get(m.customer_id) : null;
      return customer?.customer_type === "customer" || customer?.customer_type === "deal";
    }).length,
    customer: meetings.filter((m) => {
      const customer = m.customer_id ? customerMap.get(m.customer_id) : null;
      return customer?.customer_type === "customer";
    }).length,
    deal: meetings.filter((m) => {
      const customer = m.customer_id ? customerMap.get(m.customer_id) : null;
      return customer?.customer_type === "deal";
    }).length,
    internal: meetings.filter((m) => m.is_internal).length,
  };

  // Filter and sort meetings
  const filteredMeetings = useMemo(() => {
    // First apply tab filter
    let result = meetings.filter((meeting) => {
      if (filter === "all") return true;
      if (filter === "internal") return meeting.is_internal;
      if (filter === "external") {
        if (meeting.is_internal) return false;
        const customer = meeting.customer_id ? customerMap.get(meeting.customer_id) : null;
        return customer?.customer_type === "customer" || customer?.customer_type === "deal";
      }
      const customer = meeting.customer_id ? customerMap.get(meeting.customer_id) : null;
      if (filter === "customer") return customer?.customer_type === "customer";
      if (filter === "deal") return customer?.customer_type === "deal";
      return true;
    });

    // Apply host filter
    if (hostFilter) {
      result = result.filter((m) => m.host_name === hostFilter);
    }

    // Apply company filter
    if (companyFilter) {
      result = result.filter((m) => {
        const customer = m.customer_id ? customerMap.get(m.customer_id) : null;
        return customer?.name === companyFilter;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortColumn === "date") {
        const dateA = a.meeting_date ? new Date(a.meeting_date).getTime() : 0;
        const dateB = b.meeting_date ? new Date(b.meeting_date).getTime() : 0;
        comparison = dateA - dateB;
      } else if (sortColumn === "host") {
        const hostA = (a.host_name || "").toLowerCase();
        const hostB = (b.host_name || "").toLowerCase();
        comparison = hostA.localeCompare(hostB);
      } else if (sortColumn === "company") {
        const customerA = a.customer_id ? customerMap.get(a.customer_id) : null;
        const customerB = b.customer_id ? customerMap.get(b.customer_id) : null;
        const nameA = (customerA?.name || "").toLowerCase();
        const nameB = (customerB?.name || "").toLowerCase();
        comparison = nameA.localeCompare(nameB);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [meetings, filter, hostFilter, companyFilter, sortColumn, sortDirection, customerMap]);

  async function handleDelete(meetingId: string) {
    setDeletingId(meetingId);
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete meeting");
      }
    } catch {
      alert("Failed to delete meeting");
    } finally {
      setDeletingId(null);
      setShowDeleteConfirm(null);
    }
  }

  async function handleProcess(meetingId: string) {
    setProcessingId(meetingId);
    setProcessError(null);
    try {
      // Step 1: Process transcript
      const processResponse = await fetch(`/api/meetings/${meetingId}/process`, {
        method: "POST",
      });
      if (!processResponse.ok) {
        const data = await processResponse.json();
        throw new Error(data.error || "Failed to process transcript");
      }
      // Step 2: Extract insights
      const extractResponse = await fetch(`/api/meetings/${meetingId}/extract`, {
        method: "POST",
      });
      if (!extractResponse.ok) {
        const data = await extractResponse.json();
        throw new Error(data.error || "Failed to extract insights");
      }
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Processing failed";
      setProcessError(message);
      setTimeout(() => setProcessError(null), 5000);
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 px-4">
        <TabButton
          active={filter === "all"}
          onClick={() => handleFilterChange("all")}
          count={counts.all}
        >
          All
        </TabButton>
        <TabButton
          active={filter === "external"}
          onClick={() => handleFilterChange("external")}
          count={counts.external}
        >
          External
        </TabButton>
        <TabButton
          active={filter === "customer"}
          onClick={() => handleFilterChange("customer")}
          count={counts.customer}
        >
          Customers
        </TabButton>
        <TabButton
          active={filter === "deal"}
          onClick={() => handleFilterChange("deal")}
          count={counts.deal}
        >
          Deals
        </TabButton>
        <TabButton
          active={filter === "internal"}
          onClick={() => handleFilterChange("internal")}
          count={counts.internal}
        >
          Internal
        </TabButton>
      </div>

      {/* Filter Row */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
        <span className="text-sm text-gray-500 dark:text-gray-400">Filter by:</span>
        <FilterCombobox
          label="Host"
          value={hostFilter}
          options={uniqueHosts}
          onChange={handleHostFilterChange}
        />
        <FilterCombobox
          label="Organization"
          value={companyFilter}
          options={uniqueCompanies}
          onChange={handleCompanyFilterChange}
        />
        {(hostFilter || companyFilter) && (
          <button
            onClick={() => {
              handleHostFilterChange("");
              handleCompanyFilterChange("");
            }}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Meeting
              </th>
              <SortableHeader
                label="Date"
                column="date"
                currentColumn={sortColumn}
                direction={sortDirection}
                onClick={handleSort}
              />
              <SortableHeader
                label="Host"
                column="host"
                currentColumn={sortColumn}
                direction={sortDirection}
                onClick={handleSort}
              />
              <SortableHeader
                label="Organization"
                column="company"
                currentColumn={sortColumn}
                direction={sortDirection}
                onClick={handleSort}
              />
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredMeetings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No {filter === "all" ? "" : filter} meetings found
                </td>
              </tr>
            ) : (
              filteredMeetings.map((meeting) => {
                const customer = meeting.customer_id ? customerMap.get(meeting.customer_id) : null;
                return (
                  <tr key={meeting.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/meetings/${meeting.id}`}
                        className="text-gray-900 dark:text-white font-medium hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {meeting.name || "Untitled Meeting"}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        {extractCounts[meeting.id] > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                            {extractCounts[meeting.id]} extract{extractCounts[meeting.id] !== 1 ? "s" : ""}
                          </span>
                        ) : meeting.transcript ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            Has transcript
                          </span>
                        ) : null}
                        {meeting.is_internal && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                            Internal
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {meeting.meeting_date
                        ? new Date(meeting.meeting_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      {meeting.host_name || meeting.host_email ? (
                        <div className="text-sm">
                          <div className="text-gray-900 dark:text-white">
                            {meeting.host_name || "—"}
                          </div>
                          {meeting.host_email && (
                            <div className="text-gray-500 dark:text-gray-400 text-xs truncate max-w-[150px]" title={meeting.host_email}>
                              {meeting.host_email}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {customer ? (
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/companies/${customer.id}`}
                            className="text-sm text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            {customer.name}
                          </Link>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              customer.customer_type === "deal"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            }`}
                          >
                            {customer.customer_type === "deal" ? "Deal" : "Customer"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={meeting.workflow_status} />
                    </td>
                    <td className="px-6 py-4">
                      <SourceBadge source={meeting.source} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {(meeting.source === "zoom" || meeting.source === "google_meet") &&
                          meeting.transcript &&
                          meeting.workflow_status !== "completed" && (
                          <button
                            onClick={() => handleProcess(meeting.id)}
                            disabled={processingId !== null}
                            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingId === meeting.id ? "Processing..." : "Process"}
                          </button>
                        )}
                        <Link
                          href={`/meetings/${meeting.id}`}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => setShowDeleteConfirm(meeting.id)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete Meeting?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will permanently delete this meeting and all associated extracts.
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deletingId !== null}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deletingId !== null}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId === showDeleteConfirm ? "Deleting..." : "Delete Meeting"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Process Error Toast */}
      {processError && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">{processError}</span>
          <button
            onClick={() => setProcessError(null)}
            className="ml-2 text-white/80 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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

function StatusBadge({ status }: { status: string }) {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    transcribed: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        styles[status as keyof typeof styles] || styles.pending
      }`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  const sources: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    google_meet: {
      label: "Google Meet",
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      icon: (
        <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24">
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
        </svg>
      ),
    },
    hubspot: {
      label: "HubSpot",
      color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
      icon: (
        <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984v-.066A2.198 2.198 0 0017.233.836h-.066a2.198 2.198 0 00-2.198 2.198v.066c0 .865.503 1.612 1.232 1.968v2.862a5.76 5.76 0 00-2.615 1.09l-6.7-5.209A2.633 2.633 0 007.232 1.5a2.625 2.625 0 10-.756 5.128l.07-.002 6.396 4.972a5.715 5.715 0 00-.183 1.427c0 .54.076 1.062.216 1.558l-2.39 1.201a2.274 2.274 0 00-1.27-.39 2.286 2.286 0 100 4.573 2.286 2.286 0 002.143-3.088l2.242-1.127a5.75 5.75 0 109.504-7.413v-.001a5.722 5.722 0 00-3.04-1.408zm-.964 9.263a3.468 3.468 0 110-6.936 3.468 3.468 0 010 6.936z" />
        </svg>
      ),
    },
    zoom: {
      label: "Zoom",
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      icon: null,
    },
    teams: {
      label: "Teams",
      color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      icon: null,
    },
    manual: {
      label: "Manual",
      color: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
      icon: null,
    },
  };

  const sourceInfo = sources[source] || { label: source, color: "bg-gray-100 text-gray-600", icon: null };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sourceInfo.color}`}>
      {sourceInfo.icon}
      {sourceInfo.label}
    </span>
  );
}

function SortableHeader({
  label,
  column,
  currentColumn,
  direction,
  onClick,
}: {
  label: string;
  column: SortColumn;
  currentColumn: SortColumn;
  direction: SortDirection;
  onClick: (column: SortColumn) => void;
}) {
  const isActive = currentColumn === column;
  return (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none"
      onClick={() => onClick(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className="inline-flex flex-col">
          <svg
            className={`w-3 h-3 -mb-1 ${isActive && direction === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-300 dark:text-gray-600"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M10 6l-5 5h10l-5-5z" />
          </svg>
          <svg
            className={`w-3 h-3 -mt-1 ${isActive && direction === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-300 dark:text-gray-600"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M10 14l5-5H5l5 5z" />
          </svg>
        </span>
      </div>
    </th>
  );
}

function FilterCombobox({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg transition-colors ${
          value
            ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-500"
            : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        }`}
      >
        <span>{value || label}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-20 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
                setSearch("");
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                !value ? "text-blue-600 dark:text-blue-400 font-medium" : "text-gray-700 dark:text-gray-300"
              }`}
            >
              All {label}s
            </button>
            {filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                  setSearch("");
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  value === option
                    ? "text-blue-600 dark:text-blue-400 font-medium"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {option}
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
