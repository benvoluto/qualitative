"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Tag, ExtractRule, Meeting, Customer } from "@/lib/db/types";
import { TagBadge } from "@/components/tag-badge";

// Fuzzy match helper - returns a score (0-1) for how well the text matches the query
function fuzzyMatch(text: string, query: string): number {
  if (!query.trim()) return 1;
  if (!text) return 0;

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 0);

  if (queryWords.length === 0) return 1;

  let totalScore = 0;

  for (const word of queryWords) {
    // Exact word match (highest score)
    if (textLower.includes(word)) {
      totalScore += 1;
      continue;
    }

    // Fuzzy match - check if word characters appear in order
    let wordScore = 0;
    let textIdx = 0;
    let matchedChars = 0;

    for (const char of word) {
      const foundIdx = textLower.indexOf(char, textIdx);
      if (foundIdx !== -1) {
        matchedChars++;
        textIdx = foundIdx + 1;
      }
    }

    // Score based on percentage of characters matched
    wordScore = matchedChars / word.length;

    // Bonus for consecutive matches (word appears as substring)
    for (let i = 0; i < textLower.length; i++) {
      let matchLen = 0;
      for (let j = 0; j < word.length && i + j < textLower.length; j++) {
        if (textLower[i + j] === word[j]) {
          matchLen++;
        } else {
          break;
        }
      }
      if (matchLen >= 3 && matchLen >= word.length * 0.6) {
        wordScore = Math.max(wordScore, matchLen / word.length);
      }
    }

    totalScore += wordScore;
  }

  return totalScore / queryWords.length;
}

// Calculate match score for an extract
function getExtractMatchScore(
  extract: { summary: string | null; quotes: string[]; rule_name: string | null; tags: { name: string }[]; customer_name: string | null },
  query: string
): number {
  if (!query.trim()) return 1;

  const summaryScore = fuzzyMatch(extract.summary || "", query);
  const quotesText = extract.quotes.join(" ");
  const quotesScore = fuzzyMatch(quotesText, query);
  const ruleScore = fuzzyMatch(extract.rule_name || "", query);
  const tagsText = extract.tags.map((t) => t.name).join(" ");
  const tagsScore = fuzzyMatch(tagsText, query);
  const customerScore = fuzzyMatch(extract.customer_name || "", query);

  // Weight: summary most important, then quotes, then customer/rule/tags
  return Math.max(
    summaryScore * 1.0,
    quotesScore * 0.9,
    customerScore * 0.8,
    ruleScore * 0.7,
    tagsScore * 0.6
  );
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
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
                <svg
                  className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
          {searchQuery.trim() && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Fuzzy matching enabled
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Filter by Customer
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex border-b border-gray-200 dark:border-gray-700 px-4">
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
              Customers
            </TypeTabButton>
            <TypeTabButton
              active={typeFilter === "deal"}
              onClick={() => setTypeFilter("deal")}
              count={typeCounts.deal}
            >
              Deals
            </TypeTabButton>
            <TypeTabButton
              active={typeFilter === "internal"}
              onClick={() => setTypeFilter("internal")}
              count={typeCounts.internal}
            >
              Internal
            </TypeTabButton>
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
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
      className="h-[calc(100vh-280px)] overflow-auto"
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
      className={`bg-white dark:bg-gray-800 rounded-lg shadow border p-5 ${
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                title="Delete extract"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Meeting info row */}
      <div className="flex items-center gap-3 mb-3 text-xs text-gray-500 dark:text-gray-400">
        {extract.is_internal && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            Internal
          </span>
        )}
        {extract.customer_name && (
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
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
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
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
