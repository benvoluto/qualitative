"use client";

import { useState } from "react";
import { Tag } from "@/lib/db/types";
import { useRouter } from "next/navigation";
import { getContrastingTextColor } from "@/lib/constants/colors";

interface TagsSectionProps {
  tags: Tag[];
  availableColors: string[];
  allColors: string[];
}

export function TagsSection({ tags, availableColors, allColors }: TagsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tags ({tags.length})
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage tags used to categorize extracts
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transform transition-transform ${
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

      {/* Expandable content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
          {/* Add Tag Form */}
          <AddTagFormInline availableColors={availableColors} />

          {/* Tags List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {tags.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No tags yet. Add one above.
              </p>
            ) : (
              tags.map((tag) => (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  allColors={allColors}
                  usedColors={new Set(tags.map((t) => t.color).filter(Boolean))}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Add Tag Form
function AddTagFormInline({ availableColors }: { availableColors: string[] }) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState<string | null>(
    availableColors.length > 0 ? availableColors[0] : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color: selectedColor,
        }),
      });

      if (response.ok) {
        setName("");
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create tag");
      }
    } catch {
      setError("Failed to create tag");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New tag name"
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="px-3 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
        >
          {isSubmitting ? "..." : "Add"}
        </button>
      </div>

      {/* Color picker */}
      {availableColors.length > 0 && (
        <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-1">
          {availableColors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setSelectedColor(color)}
              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                selectedColor === color
                  ? "border-gray-900 dark:border-white scale-110"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}

// Tag Row Component
function TagRow({
  tag,
  allColors,
  usedColors,
}: {
  tag: Tag;
  allColors: string[];
  usedColors: Set<string | null>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editName, setEditName] = useState(tag.name);
  const [editColor, setEditColor] = useState(tag.color);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const availableColors = allColors.filter(
    (c) => !usedColors.has(c) || c === tag.color
  );

  async function handleSave() {
    if (!editName.trim()) {
      setError("Tag name cannot be empty");
      return;
    }

    try {
      const response = await fetch(`/api/tags/${tag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          color: editColor,
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        setError(null);
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update tag");
      }
    } catch {
      setError("Failed to update tag");
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/tags/${tag.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete tag");
      }
    } catch {
      setError("Failed to delete tag");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (showDeleteConfirm) {
    return (
      <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <p className="text-xs text-red-800 dark:text-red-200 mb-2">
          Delete &quot;{tag.name}&quot;?
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? "..." : "Delete"}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="p-2 border border-gray-200 dark:border-gray-700 rounded-md space-y-2">
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          autoFocus
        />
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1">
          {availableColors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setEditColor(color)}
              className={`w-4 h-4 rounded-full border-2 ${
                editColor === color
                  ? "border-gray-900 dark:border-white"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
          >
            Save
          </button>
          <button
            onClick={() => {
              setIsEditing(false);
              setEditName(tag.name);
              setEditColor(tag.color);
              setError(null);
            }}
            className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-700 rounded-md">
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
        style={
          tag.color
            ? {
                backgroundColor: tag.color,
                color: getContrastingTextColor(tag.color),
              }
            : undefined
        }
      >
        {tag.name}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setIsEditing(true)}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Edit"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
          title="Delete"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
