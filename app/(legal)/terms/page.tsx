export const metadata = {
  title: "Terms of Service — Qualitative",
};

export default function TermsOfService() {
  return (
    <>
      <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Terms of Service</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>

      <Section title="1. Acceptance">
        <p>
          By creating an account or using Qualitative (&ldquo;the Service&rdquo;), you agree to be bound by these
          Terms of Service. If you are using the Service on behalf of an organization, you represent that you are
          authorized to bind that organization to these Terms.
        </p>
      </Section>

      <Section title="2. The Service">
        <p>
          Qualitative reads meeting transcripts and recordings from the integrations you connect, processes them
          through large language models, and surfaces structured insights, summaries, and follow-up drafts inside
          your workspace.
        </p>
      </Section>

      <Section title="3. Your account">
        <ul>
          <li>You are responsible for maintaining the security of your account credentials.</li>
          <li>You must be at least 18 years old to use the Service.</li>
          <li>You may not share your account with anyone else.</li>
          <li>You agree to provide accurate information and to keep it up to date.</li>
        </ul>
      </Section>

      <Section title="4. Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service to process content you do not have lawful permission to record or transcribe.</li>
          <li>Reverse-engineer, scrape, or attempt to extract our model prompts or extraction logic.</li>
          <li>Use the Service to send spam, harassment, or any unlawful content.</li>
          <li>Interfere with or attempt to disrupt the Service&apos;s infrastructure.</li>
        </ul>
        <p>
          You are responsible for obtaining all consents required to record and transcribe conversations in your
          jurisdiction. We do not provide legal advice on recording-consent laws.
        </p>
      </Section>

      <Section title="5. Plans and billing">
        <p>
          The Free plan is offered at no charge subject to the usage limits listed in the product. Paid plans are
          billed monthly in advance through Stripe. You may cancel at any time from the Billing page; cancellation
          takes effect at the end of the current billing period.
        </p>
        <p>
          We may change pricing with at least 30 days&apos; notice via email and in-product notification.
        </p>
      </Section>

      <Section title="6. Your content">
        <p>
          You retain all rights to the meeting data and content you bring into the Service. You grant us a
          limited, worldwide, royalty-free license to host, process, and display your content solely to operate
          the Service for you.
        </p>
        <p>
          We do not use your content to train AI models. See our <a href="/privacy">Privacy Policy</a> and{" "}
          <a href="/dpa">DPA</a> for details on sub-processors.
        </p>
      </Section>

      <Section title="7. Service availability">
        <p>
          The Service is provided on a commercially reasonable best-effort basis. We do not guarantee any specific
          uptime SLA on the Free plan. Paid plans include the SLA described in the Order Form or, absent one,
          99.5% monthly uptime.
        </p>
      </Section>

      <Section title="8. Suspension and termination">
        <p>
          We may suspend or terminate your access to the Service if you breach these Terms, if your account is
          delinquent, or if required by law. You may terminate your account at any time by emailing{" "}
          <a href="mailto:support@qualitative.app">support@qualitative.app</a>.
        </p>
      </Section>

      <Section title="9. Disclaimer of warranties">
        <p>
          The Service is provided &ldquo;AS IS&rdquo; without warranties of any kind, express or implied,
          including merchantability, fitness for a particular purpose, and non-infringement. AI-generated content
          may be inaccurate; verify before relying on it for any decision.
        </p>
      </Section>

      <Section title="10. Limitation of liability">
        <p>
          To the maximum extent permitted by law, our aggregate liability arising out of or related to these
          Terms or the Service will not exceed the greater of (a) the amount you paid us in the 12 months
          preceding the claim, or (b) USD $100.
        </p>
      </Section>

      <Section title="11. Indemnification">
        <p>
          You agree to indemnify and hold us harmless from any claims arising from your content, your use of the
          Service, or your violation of these Terms.
        </p>
      </Section>

      <Section title="12. Governing law">
        <p>
          These Terms are governed by the laws of the State of Delaware, USA, without regard to its conflict of
          laws principles.
        </p>
      </Section>

      <Section title="13. Changes">
        <p>
          We may update these Terms from time to time. Material changes will be announced in-product and via
          email at least 30 days before they take effect.
        </p>
      </Section>

      <Section title="14. Contact">
        <p>
          For questions about these Terms, email{" "}
          <a href="mailto:support@qualitative.app">support@qualitative.app</a>.
        </p>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
      <div className="mt-3 space-y-3 [&_a]:text-blue-600 [&_a]:dark:text-blue-400 [&_a]:hover:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}
