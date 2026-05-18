interface GettingStartedProps {
  hasGoogle: boolean;
}

export function GettingStarted({ hasGoogle }: GettingStartedProps) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        Let&apos;s get your first meeting in
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Nothing here yet. Once you sync meetings, Qualitative will transcribe them,
        pull out the insights that match your extract rules, and draft follow-up emails.
      </p>

      <ol className="mt-6 space-y-4">
        <Step
          n={1}
          title="Connect your meeting source"
          done={hasGoogle}
          body={
            hasGoogle
              ? "Google Meet is connected. Your Calendar will be scanned for past meetings."
              : "Sign out and sign back in with Google to grant Calendar + Drive access."
          }
          cta={
            hasGoogle
              ? undefined
              : { label: "Open settings", href: "/app#settings" }
          }
        />
        <Step
          n={2}
          title="Sync your past meetings"
          done={false}
          body="Open the Meetings page and click Sync. We'll pull your recent Google Meet events and their transcripts."
          cta={{ label: "Go to Meetings", href: "/meetings" }}
        />
        <Step
          n={3}
          title="Process a transcript"
          done={false}
          body="Pick a meeting that has a transcript, hit Process → Extract, and the insights show up here."
        />
      </ol>
    </section>
  );
}

interface StepProps {
  n: number;
  title: string;
  body: string;
  done: boolean;
  cta?: { label: string; href: string };
}

function Step({ n, title, body, done, cta }: StepProps) {
  return (
    <li className="flex items-start gap-4">
      <span
        className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
          done
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">{title}</h3>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{body}</p>
        {cta && (
          <a
            href={cta.href}
            className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
          >
            {cta.label} →
          </a>
        )}
      </div>
    </li>
  );
}
