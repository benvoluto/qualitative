import { redirect } from "next/navigation";
import { saveWorkspaceAction } from "./actions";

interface WorkspaceStepProps {
  initialName: string;
  initialDomain: string;
  initialAliases: string[];
}

export function WorkspaceStep({ initialName, initialDomain, initialAliases }: WorkspaceStepProps) {
  async function onSubmit(formData: FormData) {
    "use server";
    await saveWorkspaceAction(formData);
    redirect("/onboarding?step=rules");
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-x-auto p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Set up your workspace
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Confirm the name, then tell us which email domain belongs to your organization.
        Meetings where every participant is from one of these domains will be marked Other
        and skipped during sync.
      </p>

      <form action={onSubmit} className="mt-6 space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Workspace name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            defaultValue={initialName}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="internalDomain" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Your organization&apos;s primary email domain
          </label>
          <input
            type="text"
            id="internalDomain"
            name="internalDomain"
            placeholder="example.com"
            defaultValue={initialDomain}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            No leading @. Leave blank to disable Other-meeting filtering.
          </p>
        </div>

        <div>
          <label htmlFor="aliases" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Additional domains for Other meetings (optional)
          </label>
          <textarea
            id="aliases"
            name="aliases"
            rows={3}
            placeholder="subsidiary.com&#10;contractor-vendor.com"
            defaultValue={initialAliases.join("\n")}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            One per line. For subsidiaries, contractors, or other domains your team uses.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            Continue →
          </button>
        </div>
      </form>
    </div>
  );
}
