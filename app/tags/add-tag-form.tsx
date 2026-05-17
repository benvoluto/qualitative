"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getContrastingTextColor } from "@/lib/constants/colors";

interface AddTagFormProps {
  availableColors: string[];
}

export function AddTagForm({ availableColors }: AddTagFormProps) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState<string | null>(
    availableColors.length > 0 ? availableColors[0] : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Tag name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: "user",
          color: selectedColor,
        }),
      });

      if (response.ok) {
        setName("");
        // Select next available color
        const idx = availableColors.indexOf(selectedColor || "");
        if (idx >= 0 && idx < availableColors.length - 1) {
          setSelectedColor(availableColors[idx + 1]);
        }
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="tag-name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Tag Name
        </label>
        <input
          id="tag-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., feature_request"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Use snake_case for consistency (e.g., feature_request, bug_report)
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tag Color
        </label>
        {availableColors.length > 0 ? (
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
            {availableColors.slice(0, 30).map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setSelectedColor(color)}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  selectedColor === color
                    ? "border-gray-900 dark:border-white scale-110 ring-2 ring-offset-2 ring-blue-500"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No colors available. Delete a tag to free up a color.
          </p>
        )}
        {selectedColor && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Selected:</span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: selectedColor,
                color: getContrastingTextColor(selectedColor),
              }}
            >
              {name || "tag_name"}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !name.trim() || !selectedColor}
        className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Adding..." : "Add Tag"}
      </button>
    </form>
  );
}
