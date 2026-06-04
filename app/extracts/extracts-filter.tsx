"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Buildings,
  Check,
  Clipboard,
  DownloadSimple,
  FileText,
  MagnifyingGlass,
  PencilSimple,
  Play,
  Trash,
  X,
} from "@phosphor-icons/react";
import { Tag, ExtractRule, Meeting, Customer } from "@/lib/db/types";
import { TagBadge } from "@/components/tag-badge";
import { exportExtractsToCsv, exportExtractsToXlsx, copyExtractsForMiro } from "./export-utils";

// Returns true if every whitespace-separated word in the query appears as a
// case-insensitive substring of the text. Whole-word, all-AND semantics —
// what most users intuitively expect from a search box.
function allWordsMatch(text: string, queryWords: string[]): boolean {
  if (queryWords.length === 0) return true;
  if (!text) return false;
  const textLower = text.toLowerCase();
  return queryWords.every((w) => textLower.includes(w));
}

// Calculate match score for an extract. Score is used both to filter (>= 0.5
// means "match") and to rank — extracts that match in the summary or quotes
// rank higher than those that only match via tags / customer name.
function getExtractMatchScore(
  extract: { summary: string | null; quotes: string[]; rule_name: string | null; tags: { name: string }[]; customer_name: string | null },
  query: string
): number {
  const trimmed = query.trim();
  if (!trimmed) return 1;
  const words = trimmed.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return 1;

  const fields: { text: string; weight: number }[] = [
    { text: extract.summary || "", weight: 1.0 },
    { text: extract.quotes.join(" "), weight: 0.9 },
    { text: extract.customer_name || "", weight: 0.8 },
    { text: extract.rule_name || "", weight: 0.7 },
    { text: extract.tags.map((t) => t.name).join(" "), weight: 0.6 },
  ];

  let best = 0;
  for (const { text, weight } of fields) {
    if (allWordsMatch(text, words) && weight > best) best = weight;
  }
  return best;
}

type TypeFilter = "all" | "customer" | "deal" | "internal";
type ActionItemFilter = "all" | "all_actions" | "assigned" | "done" | "unassigned";
type RequestFilter = "all" | "all_requests" | "ticket_added" | "pending";

interface ExtractWithDetails {
  id: string;
  meeting_id: string;
  customer_id: string | null;
  extract_rule_id: string | null;
  extract_date: Date | null;
  summary: string | null;
  quotes: string[];
  is_action_item: boolean;
  action_item_status: "pending" | "assigned" | "done" | null;
  request_status: "pending" | "ticket_added" | null;
  created_at: Date;
  updated_at: Date;
  meeting: Meeting | null;
  tags: Tag[];
  rule_name: string | null;
  customer_name: string | null;
  customer_type: "deal" | "customer" | null;
  is_internal: boolean;
}

interface ExtractsFilterProps {
  extracts: ExtractWithDetails[];
  tags: Tag[];
  rules: ExtractRule[];
  customers: Customer[];
  tagCounts: Record<string, number>;
  ruleCounts: Record<string, number>;
  customerCounts: Record<string, number>;
}

export function ExtractsFilter({
  extracts,
  tags,
  rules,
  customers,
  tagCounts,
  ruleCounts,
  customerCounts,
}: ExtractsFilterProps) {
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [actionItemFilter, setActionItemFilter] = useState<ActionItemFilter>("all");
  const [requestFilter, setRequestFilter] = useState<RequestFilter>("all");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle URL-based filter parameter
  useEffect(() => {
    const filterParam = searchParams.get("filter");
    if (filterParam === "action") {
      setActionItemFilter("all_actions");
    } else if (filterParam === "request") {
      setRequestFilter("all_requests");
    }
  }, [searchParams]);

  // Calculate type counts
  const typeCounts = useMemo(() => ({
    all: extracts.length,
    customer: extracts.filter((e) => e.customer_type === "customer").length,
    deal: extracts.filter((e) => e.customer_type === "deal").length,
    internal: extracts.filter((e) => e.is_internal).length,
  }), [extracts]);

  // Calculate action item counts
  const actionItemCounts = useMemo(() => {
    const actionItems = extracts.filter((e) => e.is_action_item);
    return {
      all_actions: actionItems.length,
      assigned: actionItems.filter((e) => e.action_item_status === "assigned").length,
      done: actionItems.filter((e) => e.action_item_status === "done").length,
      unassigned: actionItems.filter((e) => !e.action_item_status || e.action_item_status === "pending").length,
    };
  }, [extracts]);

  // Calculate request counts (extracts that are not action items)
  const requestCounts = useMemo(() => {
    const nonActionItems = extracts.filter((e) => !e.is_action_item);
    return {
      all_requests: nonActionItems.length,
      ticket_added: extracts.filter((e) => e.request_status === "ticket_added").length,
      pending: nonActionItems.filter((e) => !e.request_status || e.request_status === "pending").length,
    };
  }, [extracts]);

  // Minimum score threshold for fuzzy matches
  const MATCH_THRESHOLD = 0.5;

  // Filter extracts based on search, selected tags, rules, customers, type, and action item filter
  const filteredExtracts = useMemo(() => {
    let results = extracts;

    // Apply action item filter
    if (actionItemFilter !== "all") {
      if (actionItemFilter === "all_actions") {
        results = results.filter((extract) => extract.is_action_item);
      } else if (actionItemFilter === "assigned") {
        results = results.filter((extract) => extract.is_action_item && extract.action_item_status === "assigned");
      } else if (actionItemFilter === "done") {
        results = results.filter((extract) => extract.is_action_item && extract.action_item_status === "done");
      } else if (actionItemFilter === "unassigned") {
        results = results.filter((extract) => extract.is_action_item && (!extract.action_item_status || extract.action_item_status === "pending"));
      }
    }

    // Apply request filter (requests are non-action-item extracts)
    if (requestFilter !== "all") {
      if (requestFilter === "all_requests") {
        results = results.filter((extract) => !extract.is_action_item);
      } else if (requestFilter === "ticket_added") {
        results = results.filter((extract) => extract.request_status === "ticket_added");
      } else if (requestFilter === "pending") {
        results = results.filter((extract) => !extract.is_action_item && (!extract.request_status || extract.request_status === "pending"));
      }
    }

    // Apply type filter
    if (typeFilter !== "all") {
      if (typeFilter === "internal") {
        results = results.filter((extract) => extract.is_internal);
      } else {
        results = results.filter((extract) => extract.customer_type === typeFilter);
      }
    }

    // Apply search filter with fuzzy matching
    if (searchQuery.trim()) {
      results = results
        .map((extract) => ({
          extract,
          score: getExtractMatchScore(extract, searchQuery),
        }))
        .filter(({ score }) => score >= MATCH_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .map(({ extract }) => extract);
    }

    // Apply tag filter
    if (selectedTags.size > 0) {
      results = results.filter((extract) =>
        extract.tags.some((tag) => selectedTags.has(tag.id))
      );
    }

    // Apply rule filter
    if (selectedRules.size > 0) {
      results = results.filter(
        (extract) =>
          extract.extract_rule_id && selectedRules.has(extract.extract_rule_id)
      );
    }

    // Apply customer filter
    if (selectedCustomers.size > 0) {
      results = results.filter(
        (extract) =>
          extract.customer_id && selectedCustomers.has(extract.customer_id)
      );
    }

    return results;
  }, [extracts, selectedTags, selectedRules, selectedCustomers, searchQuery, typeFilter, actionItemFilter, requestFilter]);

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const toggleRule = (ruleId: string) => {
    setSelectedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const toggleCustomer = (customerId: string) => {
    setSelectedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSelectedTags(new Set());
    setSelectedRules(new Set());
    setSelectedCustomers(new Set());
    setSearchQuery("");
    setTypeFilter("all");
    setActionItemFilter("all");
    setRequestFilter("all");
    // Clear URL parameter
    router.push("/extracts");
  };

  const hasFilters = selectedTags.size > 0 || selectedRules.size > 0 || selectedCustomers.size > 0 || searchQuery.trim().length > 0 || typeFilter !== "all" || actionItemFilter !== "all" || requestFilter !== "all";
  const actionItemsCount = filteredExtracts.filter((e) => e.is_action_item).length;

  // Filter to only show tags/rules/customers with extracts
  const tagsWithExtracts = tags.filter((tag) => (tagCounts[tag.id] || 0) > 0);
  const rulesWithExtracts = rules.filter((rule) => (ruleCounts[rule.id] || 0) > 0);
  const customersWithExtracts = customers.filter((customer) => (customerCounts[customer.id] || 0) > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Left sidebar - Filters */}
      <div className="lg:col-span-1 space-y-6">

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlass size={16} className="text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search extracts..."
              className="block w-full pl-10 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <X size={16} weight="bold" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
              </button>
            )}
          </div>
          {searchQuery.trim() && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Searches summary, quotes, customer, rule, and tags
            </p>
          )}
        </div>

        {/* Filter header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Filters
          </h2>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Action Items filter */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Action Items
          </h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="actionItemFilter"
                checked={actionItemFilter === "all"}
                onChange={() => setActionItemFilter("all")}
                className="text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-orange-600 dark:group-hover:text-orange-400">
                Show All
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="actionItemFilter"
                checked={actionItemFilter === "all_actions"}
                onChange={() => setActionItemFilter("all_actions")}
                className="text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 group-hover:text-orange-600 dark:group-hover:text-orange-400">
                All Action Items
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {actionItemCounts.all_actions}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group pl-4">
              <input
                type="radio"
                name="actionItemFilter"
                checked={actionItemFilter === "unassigned"}
                onChange={() => setActionItemFilter("unassigned")}
                className="text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 group-hover:text-orange-600 dark:group-hover:text-orange-400">
                Unassigned
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {actionItemCounts.unassigned}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group pl-4">
              <input
                type="radio"
                name="actionItemFilter"
                checked={actionItemFilter === "assigned"}
                onChange={() => setActionItemFilter("assigned")}
                className="text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 group-hover:text-orange-600 dark:group-hover:text-orange-400">
                Assigned
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {actionItemCounts.assigned}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group pl-4">
              <input
                type="radio"
                name="actionItemFilter"
                checked={actionItemFilter === "done"}
                onChange={() => setActionItemFilter("done")}
                className="text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 group-hover:text-orange-600 dark:group-hover:text-orange-400">
                Done
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {actionItemCounts.done}
              </span>
            </label>
          </div>
        </div>

        {/* Requests filter */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Requests
          </h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="requestFilter"
                checked={requestFilter === "all"}
                onChange={() => setRequestFilter("all")}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Show All
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="requestFilter"
                checked={requestFilter === "all_requests"}
                onChange={() => setRequestFilter("all_requests")}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                All Requests
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {requestCounts.all_requests}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group pl-4">
              <input
                type="radio"
                name="requestFilter"
                checked={requestFilter === "pending"}
                onChange={() => setRequestFilter("pending")}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Pending
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {requestCounts.pending}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group pl-4">
              <input
                type="radio"
                name="requestFilter"
                checked={requestFilter === "ticket_added"}
                onChange={() => setRequestFilter("ticket_added")}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Ticket Added
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {requestCounts.ticket_added}
              </span>
            </label>
          </div>
        </div>

        {/* Customers filter */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Filter by Organization
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {customersWithExtracts.length > 0 ? (
              customersWithExtracts.map((customer) => (
                <label
                  key={customer.id}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={selectedCustomers.has(customer.id)}
                    onChange={() => toggleCustomer(customer.id)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 group-hover:text-green-600 dark:group-hover:text-green-400">
                    {customer.name}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {customerCounts[customer.id] || 0}
                  </span>
                </label>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No customers with extracts yet.
              </p>
            )}
          </div>
        </div>

        {/* Rules filter */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Filter by Rule
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {rulesWithExtracts.length > 0 ? (
              rulesWithExtracts.map((rule) => (
                <label
                  key={rule.id}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={selectedRules.has(rule.id)}
                    onChange={() => toggleRule(rule.id)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                    {rule.name}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {ruleCounts[rule.id] || 0}
                  </span>
                </label>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No rules with extracts yet.
              </p>
            )}
          </div>
        </div>

        {/* Tags filter */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Filter by Tag
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tagsWithExtracts.length > 0 ? (
              tagsWithExtracts.map((tag) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={selectedTags.has(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <TagBadge name={tag.name} color={tag.color} className="flex-shrink-0" />
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                    {tagCounts[tag.id] || 0}
                  </span>
                </label>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No tags with extracts yet.
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {filteredExtracts.length} of {extracts.length} extracts
          {actionItemsCount > 0 && (
            <span> ({actionItemsCount} action items)</span>
          )}
        </div>
      </div>

      {/* Right content - Extracts list */}
      <div className="lg:col-span-3">
        {/* Type Filter Tabs */}
        <div className="mb-6">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4">
            <div className="flex">
              <TypeTabButton
                active={typeFilter === "all"}
                onClick={() => setTypeFilter("all")}
                count={typeCounts.all}
              >
                All
              </TypeTabButton>
              <TypeTabButton
                active={typeFilter === "customer"}
                onClick={() => setTypeFilter("customer")}
                count={typeCounts.customer}
              >
                Primary
              </TypeTabButton>
              <TypeTabButton
                active={typeFilter === "deal"}
                onClick={() => setTypeFilter("deal")}
                count={typeCounts.deal}
              >
                Secondary
              </TypeTabButton>
              <TypeTabButton
                active={typeFilter === "internal"}
                onClick={() => setTypeFilter("internal")}
                count={typeCounts.internal}
              >
                Other
              </TypeTabButton>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <button
                type="button"
                onClick={() => exportExtractsToXlsx(filteredExtracts)}
                disabled={filteredExtracts.length === 0}
                className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                title="Save the current list as an Excel file"
              >
                <DownloadSimple size={16} />
                Save as XLS
              </button>
              <button
                type="button"
                onClick={() => exportExtractsToCsv(filteredExtracts)}
                disabled={filteredExtracts.length === 0}
                className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                title="Export the current list as a CSV file"
              >
                <DownloadSimple size={16} />
                Export CSV
              </button>
              <CopyForMiroButton extracts={filteredExtracts} />
            </div>
          </div>
        </div>

        {filteredExtracts.length > 0 ? (
          <VirtualizedExtractList
            extracts={filteredExtracts}
            selectedTags={selectedTags}
            toggleTag={toggleTag}
            onRefresh={() => router.refresh()}
          />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-8 text-center">
            <FileText size={48} className="mx-auto text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No extracts found
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {hasFilters
                ? "No extracts match the selected filters. Try adjusting your filters."
                : "Extract insights from meetings to see them here."}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
              >
                Clear Filters
              </button>
            )}
            {!hasFilters && (
              <div className="mt-6">
                <Link
                  href="/meetings"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
                >
                  Go to Meetings
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Virtualized Extract List Component
interface VirtualizedExtractListProps {
  extracts: ExtractWithDetails[];
  selectedTags: Set<string>;
  toggleTag: (tagId: string) => void;
  onRefresh: () => void;
}

function VirtualizedExtractList({ extracts, selectedTags, toggleTag, onRefresh }: VirtualizedExtractListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: extracts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated height of each card
    overscan: 5, // Render 5 extra items above/below viewport
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="h-[calc(100vh-60px)] overflow-auto px-4"
      style={{ contain: "strict" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => {
          const extract = extracts[virtualItem.index];
          return (
            <div
              key={extract.id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="pb-4">
                <ExtractCard
                  extract={extract}
                  selectedTags={selectedTags}
                  toggleTag={toggleTag}
                  onRefresh={onRefresh}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Extract Card Component
interface ExtractCardProps {
  extract: ExtractWithDetails;
  selectedTags: Set<string>;
  toggleTag: (tagId: string) => void;
  onRefresh: () => void;
}

function ExtractCard({ extract, selectedTags, toggleTag, onRefresh }: ExtractCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [editForm, setEditForm] = useState({
    summary: extract.summary || "",
  });

  async function handleStatusUpdate(statusType: "action" | "request", status: string | null) {
    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/extracts/${extract.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusType, status }),
      });
      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleSaveEdit() {
    try {
      const response = await fetch(`/api/extracts/${extract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (response.ok) {
        setIsEditing(false);
        onRefresh();
      }
    } catch (error) {
      console.error("Failed to update extract:", error);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/extracts/${extract.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error("Failed to delete extract:", error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border p-5 ${
        extract.is_action_item
          ? "border-orange-200 dark:border-orange-800"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      {/* Header with meeting info, rule, and actions */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {extract.is_action_item ? (
            <div className="inline-flex items-center gap-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-l text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">
                Action
              </span>
              <select
                value={extract.action_item_status || "pending"}
                onChange={(e) => handleStatusUpdate("action", e.target.value === "pending" ? null : e.target.value)}
                disabled={isUpdatingStatus}
                className="text-xs px-1.5 py-0.5 rounded-r border-l-0 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 text-orange-800 dark:text-orange-300 focus:ring-1 focus:ring-orange-400 disabled:opacity-50"
              >
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="done">Done</option>
              </select>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-l text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                Request
              </span>
              <select
                value={extract.request_status || "pending"}
                onChange={(e) => handleStatusUpdate("request", e.target.value === "pending" ? null : e.target.value)}
                disabled={isUpdatingStatus}
                className="text-xs px-1.5 py-0.5 rounded-r border-l-0 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300 focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
              >
                <option value="pending">Pending</option>
                <option value="ticket_added">Ticket Added</option>
              </select>
            </div>
          )}
          {extract.rule_name && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
              {extract.rule_name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Edit button */}
          {!isEditing && !showDeleteConfirm && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Edit extract"
              >
                <PencilSimple size={16} />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                title="Delete extract"
              >
                <Trash size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Meeting info row */}
      <div className="flex items-center gap-3 mb-3 text-xs text-gray-500 dark:text-gray-400">
        {extract.is_internal && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            Other
          </span>
        )}
        {extract.customer_name && (
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
              <Buildings size={12} />
              {extract.customer_name}
            </span>
            {extract.customer_type && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                  extract.customer_type === "deal"
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                }`}
              >
                {extract.customer_type === "deal" ? "Deal" : "Customer"}
              </span>
            )}
          </span>
        )}
        {extract.meeting && (
          <>
            <Link
              href={`/meetings/${extract.meeting.id}`}
              className="hover:text-purple-600 dark:hover:text-purple-400"
            >
              {extract.meeting.name || "Untitled Meeting"}
              {extract.meeting.meeting_date && (
                <span className="ml-1">
                  ({new Date(extract.meeting.meeting_date).toLocaleDateString()})
                </span>
              )}
            </Link>
            {extract.meeting.recording_url && (
              <a
                href={extract.meeting.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
              >
                <Play size={12} weight="fill" />
                Recording
              </a>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200 mb-3">
            Are you sure you want to delete this extract? This action cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit Form */}
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editForm.summary}
            onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Summary"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditForm({ summary: extract.summary || "" });
              }}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Summary */}
          <p className="text-gray-900 dark:text-white mb-3">
            {extract.summary}
          </p>

          {/* Quotes */}
          {extract.quotes && extract.quotes.length > 0 && (
            <div className="space-y-2 mb-3">
              {extract.quotes.slice(0, 2).map((quote, idx) => (
                <blockquote
                  key={idx}
                  className="text-sm text-gray-600 dark:text-gray-400 italic border-l-2 border-gray-300 dark:border-gray-600 pl-3"
                >
                  &ldquo;{quote}&rdquo;
                </blockquote>
              ))}
              {extract.quotes.length > 2 && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  +{extract.quotes.length - 2} more quotes
                </span>
              )}
            </div>
          )}

          {/* Tags */}
          {extract.tags && extract.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {extract.tags.map((tag) => (
                <TagBadge
                  key={tag.id}
                  name={tag.name}
                  color={tag.color}
                  onClick={() => toggleTag(tag.id)}
                  selected={selectedTags.has(tag.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Type Tab Button Component
function TypeTabButton({
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
          ? "border-purple-500 text-purple-600 dark:text-purple-400"
          : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      }`}
    >
      {children}
      <span
        className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
          active
            ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}


interface CopyForMiroButtonProps {
  extracts: ExtractWithDetails[];
}

function CopyForMiroButton({ extracts }: CopyForMiroButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function handleClick(): Promise<void> {
    try {
      await copyExtractsForMiro(extracts);
      setCopied(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("Copy for Miro failed:", err);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={extracts.length === 0}
      className={`inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
        copied
          ? "text-green-600 dark:text-green-400"
          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      }`}
      title="Copy the current list to the clipboard, formatted one extract per line for pasting into Miro"
    >
      {copied ? <Check size={16} weight="bold" /> : <Clipboard size={16} />}
      {copied ? "Copied!" : "Copy for Miro"}
    </button>
  );
}
