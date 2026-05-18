export const metadata = {
  title: "Privacy Policy — Qualitative",
};

export default function PrivacyPolicy() {
  return (
    <>
      <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Privacy Policy</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>

      <Section title="1. Who we are">
        <p>
          Qualitative (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;the Service&rdquo;) is a software platform that helps
          teams extract structured insights from their meeting transcripts. This Privacy Policy explains what we
          collect, how we use it, who we share it with, and the choices you have.
        </p>
        <p>
          For questions about this policy, contact us at{" "}
          <a href="mailto:privacy@qualitative.app">privacy@qualitative.app</a>.
        </p>
      </Section>

      <Section title="2. Information we collect">
        <h3>2.1 Account information</h3>
        <p>
          When you sign up, we collect your name, email address, profile image, and the email domain of your
          organization, primarily via Google OAuth.
        </p>
        <h3>2.2 Meeting content</h3>
        <p>
          To deliver the core product, we read and store: meeting metadata (title, date, attendees, URLs),
          transcripts (text), and recordings (when present), pulled from sources you connect — Google Calendar,
          Google Drive, Zoom, Microsoft Teams, and HubSpot.
        </p>
        <h3>2.3 Derived data</h3>
        <p>
          We process transcripts through large language models (currently Google Gemini) to generate structured
          extracts, summaries, follow-up email drafts, and tags. These outputs are stored alongside your meetings.
        </p>
        <h3>2.4 Billing</h3>
        <p>
          If you upgrade to a paid plan, payment is processed by Stripe. We do not store your card number — we
          receive only a customer/subscription identifier, plan, and status from Stripe.
        </p>
        <h3>2.5 Usage telemetry</h3>
        <p>
          We use Vercel Analytics to count anonymous page views and product events (sign-up, meeting processed,
          meeting extracted). We do not use third-party advertising trackers.
        </p>
      </Section>

      <Section title="3. How we use information">
        <ul>
          <li>To operate the Service — transcribe, extract, summarize, and surface insights from your meetings.</li>
          <li>To send transactional emails (notification preferences, password reset, billing receipts).</li>
          <li>To enforce plan limits and bill paid plans through Stripe.</li>
          <li>To improve the product through aggregated, anonymized usage patterns.</li>
        </ul>
        <p>
          <strong>We do not train AI models on your meeting content.</strong> Transcripts and extracts are sent to
          Google Gemini for processing under their commercial terms, which prohibit training on customer data.
        </p>
      </Section>

      <Section title="4. Who we share information with">
        <p>We share data only with the following sub-processors, and only as needed to deliver the Service:</p>
        <ul>
          <li><strong>Vercel</strong> — application hosting and analytics</li>
          <li><strong>Neon</strong> — managed Postgres database</li>
          <li><strong>Google (Gemini)</strong> — AI transcription and extraction</li>
          <li><strong>Stripe</strong> — payment processing</li>
          <li><strong>Mailjet</strong> — transactional email</li>
        </ul>
        <p>
          A full sub-processor list is available in our <a href="/dpa">Data Processing Addendum</a>. We do not sell
          personal information.
        </p>
      </Section>

      <Section title="5. Where data is stored">
        <p>
          Account data, meetings, and extracts are stored in Neon Postgres in US-East. Recording files (when
          processed) are streamed to Google Gemini and not retained on our infrastructure after transcription.
        </p>
      </Section>

      <Section title="6. Retention">
        <p>
          We retain your data for as long as your account is active. You can delete individual meetings, extracts,
          and email drafts at any time from the product. To delete your account and all associated data, email{" "}
          <a href="mailto:privacy@qualitative.app">privacy@qualitative.app</a> — we will action the request within
          30 days.
        </p>
      </Section>

      <Section title="7. Your rights">
        <p>
          If you are located in the EEA, UK, or California, you have rights under the GDPR, UK GDPR, and CCPA
          respectively, including access, correction, deletion, and portability. Email{" "}
          <a href="mailto:privacy@qualitative.app">privacy@qualitative.app</a> to exercise any of these rights.
        </p>
      </Section>

      <Section title="8. Security">
        <p>
          All traffic to the Service is encrypted in transit (TLS). Database connections are encrypted; OAuth
          access tokens are stored encrypted at rest. We restrict employee access to customer data on a
          need-to-know basis.
        </p>
        <p>
          Report a security issue to <a href="mailto:security@qualitative.app">security@qualitative.app</a>.
        </p>
      </Section>

      <Section title="9. Children">
        <p>The Service is not intended for users under 18. We do not knowingly collect data from minors.</p>
      </Section>

      <Section title="10. Changes to this policy">
        <p>
          We may update this policy from time to time. Material changes will be announced in-product and via
          email at least 30 days before they take effect.
        </p>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
      <div className="mt-3 space-y-3 [&_a]:text-blue-600 [&_a]:dark:text-blue-400 [&_a]:hover:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:text-gray-900 [&_h3]:dark:text-white">
        {children}
      </div>
    </section>
  );
}
