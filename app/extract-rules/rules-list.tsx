"use client";

import { ExtractRule } from "@/lib/db/types";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TagBadge } from "@/components/tag-badge";

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

interface ExtractRuleWithTags extends ExtractRule {
  tags: Tag[];
}

interface RulesListProps {
  rules: ExtractRuleWithTags[];
  allTags: Tag[];
}

export function RulesList({ rules, allTags }: RulesListProps) {
  return (
    <div className="space-y-4">
      {rules.map((rule) => (
        <RuleCard key={rule.id} rule={rule} allTags={allTags} />
      ))}
    </div>
  );
}

function RuleCard({ rule, allTags }: { rule: ExtractRuleWithTags; allTags: Tag[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState({
    name: rule.name,
    summary: rule.summary || "",
    tagIds: new Set<string>(rule.tags.map((t) => t.id)),
  });
  const router = useRouter();

  function toggleEditTag(tagId: string) {
    const newTagIds = new Set(editForm.tagIds);
    if (newTagIds.has(tagId)) {
      newTagIds.delete(tagId);
    } else {
      newTagIds.add(tagId);
    }
    setEditForm({ ...editForm, tagIds: newTagIds });
  }

  async function handleToggleActive() {
    setIsToggling(true);
    try {
      await fetch(`/api/extract-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !rule.is_active }),
      });
      router.refresh();
    } catch (error) {
      console.error("Failed to toggle rule:", error);
    } finally {
      setIsToggling(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/extract-rules/${rule.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to delete rule:", error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleSaveEdit() {
    try {
      const response = await fetch(`/api/extract-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          summary: editForm.summary,
          tagIds: Array.from(editForm.tagIds),
        }),
      });
      if (response.ok) {
        setIsEditing(false);
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to update rule:", error);
    }
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Rule name"
              />
              <textarea
                value={editForm.summary}
                onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Rule summary"
                rows={2}
              />
              {allTags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleEditTag(tag.id)}
                        className={`transition-all ${
                          editForm.tagIds.has(tag.id)
                            ? "ring-2 ring-blue-500 ring-offset-1"
                            : "opacity-60 hover:opacity-100"
                        }`}
                      >
                        <TagBadge name={tag.name} color={tag.color} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                    setEditForm({
                      name: rule.name,
                      summary: rule.summary || "",
                      tagIds: new Set<string>(rule.tags.map((t) => t.id)),
                    });
                  }}
                  className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {rule.name}
                </h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    rule.is_active
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {rule.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              {rule.summary && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {rule.summary}
                </p>
              )}
              {rule.tags && rule.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {rule.tags.map((tag) => (
                    <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {!isEditing && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              title="Edit rule"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={handleToggleActive}
              disabled={isToggling}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
            >
              {isToggling ? "..." : rule.is_active ? "Disable" : "Enable"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              title="Delete rule"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg
                className={`w-5 h-5 transform transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200 mb-3">
            Are you sure you want to delete this rule? This action cannot be undone.
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

      {isExpanded && !showDeleteConfirm && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {rule.quotes && rule.quotes.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Example Quotes ({(rule.quotes as string[]).length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(rule.quotes as string[]).map((quote, idx) => (
                  <blockquote
                    key={idx}
                    className="text-sm text-gray-600 dark:text-gray-400 italic border-l-2 border-gray-300 dark:border-gray-600 pl-3"
                  >
                    &ldquo;{quote}&rdquo;
                  </blockquote>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-400 dark:text-gray-500">
            Created: {new Date(rule.created_at).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
}
