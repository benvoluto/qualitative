import { tags } from "@/lib/db";
import { requireAccountId } from "@/lib/account-context";
import { TagsList } from "./tags-list";
import { AddTagForm } from "./add-tag-form";
import { TAG_COLORS } from "@/lib/constants/colors";
import { LogoMenu } from "@/components/logo-menu";
import { HeaderUserMenu } from "@/components/header-user-menu";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const accountId = await requireAccountId();
  const [allTags, usedColors] = await Promise.all([
    tags.getTags(accountId),
    tags.getUsedColors(accountId),
  ]);

  // Calculate available colors
  const usedColorSet = new Set(usedColors);
  const availableColors = TAG_COLORS.filter((c) => !usedColorSet.has(c));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <LogoMenu />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Tags
              </h1>
            </div>
            <HeaderUserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Add tag form */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Add Tag
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Create a new tag to categorize extracts.
              </p>
              <AddTagForm availableColors={availableColors} />
            </div>
          </div>

          {/* Right column - Tags list */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  All Tags ({allTags.length})
                </h2>
              </div>

              {allTags.length === 0 ? (
                <div className="text-center py-8">
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
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  <p className="mt-4 text-gray-500 dark:text-gray-400">
                    No tags yet. Create one using the form.
                  </p>
                </div>
              ) : (
                <TagsList tags={allTags} allColors={TAG_COLORS as unknown as string[]} />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
