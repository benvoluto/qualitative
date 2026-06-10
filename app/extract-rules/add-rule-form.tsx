"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TagBadge } from "@/components/tag-badge";

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

interface CustomerOption {
  id: string;
  name: string;
}

interface AddRuleFormProps {
  tags: Tag[];
  customers: CustomerOption[];
  /** Called after a rule is successfully created (e.g. to close a modal). */
  onSuccess?: () => void;
}

export function AddRuleForm({ tags, customers, onSuccess }: AddRuleFormProps) {
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function toggleTag(tagId: string) {
    const newSelected = new Set(selectedTagIds);
    if (newSelected.has(tagId)) {
      newSelected.delete(tagId);
    } else {
      newSelected.add(tagId);
    }
    setSelectedTagIds(newSelected);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Rule name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/extract-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          summary: summary.trim() || null,
          is_active: true,
          customer_id: customerId || null,
          tagIds: Array.from(selectedTagIds),
        }),
      });

      if (response.ok) {
        setName("");
        setSummary("");
        setCustomerId("");
        setSelectedTagIds(new Set());
        router.refresh();
        onSuccess?.();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create rule");
      }
    } catch {
      setError("Failed to create rule");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="rule-name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Rule Name
        </label>
        <input
          id="rule-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Product Feedback"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="rule-summary"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Summary
        </label>
        <textarea
          id="rule-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Describe what this rule should extract..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="rule-customer"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Scope to organization
        </label>
        <select
          id="rule-customer"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All organizations (global)</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Global rules apply to every meeting. Scoped rules only apply to meetings with this organization.
        </p>
      </div>

      {tags.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`transition-all ${
                  selectedTagIds.has(tag.id)
                    ? "ring-2 ring-blue-500 ring-offset-1"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                <TagBadge name={tag.name} color={tag.color} />
              </button>
            ))}
          </div>
          {selectedTagIds.size > 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {selectedTagIds.size} tag{selectedTagIds.size !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !name.trim()}
        className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Adding..." : "Add Rule"}
      </button>
    </form>
  );
}
