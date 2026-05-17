"use client";

import { Tag } from "@/lib/db/types";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getContrastingTextColor } from "@/lib/constants/colors";

interface TagsListProps {
  tags: Tag[];
  allColors: string[];
}

export function TagsList({ tags, allColors }: TagsListProps) {
  // Build set of used colors (excluding current tag when editing)
  const usedColors = new Set(tags.map((t) => t.color).filter(Boolean));

  return (
    <div className="space-y-2">
      {tags.map((tag) => (
        <TagRow
          key={tag.id}
          tag={tag}
          allColors={allColors}
          usedColors={usedColors}
        />
      ))}
    </div>
  );
}

interface TagRowProps {
  tag: Tag;
  allColors: string[];
  usedColors: Set<string | null>;
}

function TagRow({ tag, allColors, usedColors }: TagRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editName, setEditName] = useState(tag.name);
  const [editColor, setEditColor] = useState(tag.color);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Available colors for this tag (unused colors + this tag's current color)
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

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      {isEditing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            placeholder="Tag name"
            autoFocus
          />

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Color
            </label>
            <div className="flex flex-wrap gap-1.5">
              {availableColors.slice(0, 20).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setEditColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    editColor === color
                      ? "border-gray-900 dark:border-white scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {editColor && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Preview:</span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: editColor,
                  color: getContrastingTextColor(editColor),
                }}
              >
                {editName || tag.name}
              </span>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
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
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : showDeleteConfirm ? (
        <div className="space-y-2">
          <p className="text-sm text-red-600 dark:text-red-400">
            Delete tag &quot;{tag.name}&quot;? This will remove it from all extracts and rules.
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
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
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
            {tag.type && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tag.type}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Edit tag"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              title="Delete tag"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
