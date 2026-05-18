export const metadata = {
  title: "Data Processing Addendum — Qualitative",
};

export default function DPA() {
  return (
    <>
      <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Data Processing Addendum</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>

      <Section title="1. Scope and roles">
        <p>
          This Data Processing Addendum (&ldquo;DPA&rdquo;) forms part of the Terms of Service between you
          (&ldquo;Customer,&rdquo; the Data Controller) and Qualitative (the Data Processor) and applies where
          Qualitative processes personal data on Customer&apos;s behalf in connection with the Service.
        </p>
        <p>
          Qualitative will process personal data only on Customer&apos;s documented instructions, which include
          Customer&apos;s configuration of the Service and acceptance of the Terms.
        </p>
      </Section>

      <Section title="2. Nature and purpose of processing">
        <p>
          Qualitative processes personal data contained in meeting transcripts, recordings, and metadata
          provided by Customer&apos;s connected sources, for the purpose of generating structured insights,
          summaries, and follow-up drafts that are returned to Customer inside the Service.
        </p>
      </Section>

      <Section title="3. Categories of data subjects">
        <ul>
          <li>Customer&apos;s employees and authorized users of the Service</li>
          <li>Participants in Customer&apos;s meetings (including external customers and prospects)</li>
        </ul>
      </Section>

      <Section title="4. Categories of personal data">
        <ul>
          <li>Identification data: name, email address, profile image</li>
          <li>Professional data: job title, organization, role</li>
          <li>Meeting content: transcripts, recordings, calendar metadata</li>
          <li>Communications data: extracts, summaries, drafted emails</li>
        </ul>
      </Section>

      <Section title="5. Sub-processors">
        <p>
          Customer authorizes Qualitative to use the following sub-processors. We give 30 days&apos; notice of
          additions or changes via in-product notification.
        </p>
        <div className="not-prose overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left font-medium py-2 pr-4">Sub-processor</th>
                <th className="text-left font-medium py-2 pr-4">Purpose</th>
                <th className="text-left font-medium py-2">Location</th>
              </tr>
            </thead>
            <tbody>
              <SubRow name="Vercel, Inc." purpose="Application hosting, analytics" location="USA" />
              <SubRow name="Neon, Inc." purpose="Managed Postgres database" location="USA (US-East)" />
              <SubRow name="Google LLC" purpose="Gemini AI transcription and extraction" location="USA / global" />
              <SubRow name="Stripe, Inc." purpose="Payment processing" location="USA / global" />
              <SubRow name="Mailjet (Sinch)" purpose="Transactional email" location="EU" />
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="6. International transfers">
        <p>
          Where personal data is transferred outside the EEA, UK, or Switzerland, transfers rely on Standard
          Contractual Clauses (2021/914/EU) with our sub-processors, or on adequacy decisions where available.
        </p>
      </Section>

      <Section title="7. Security measures">
        <ul>
          <li>Encryption of data in transit (TLS 1.2+) and at rest</li>
          <li>OAuth access tokens encrypted at rest in the database</li>
          <li>Role-based access controls and least-privilege internal access</li>
          <li>Logical tenant isolation: every database query enforces an account-id filter</li>
          <li>Cloud-provider-level disk encryption and network isolation</li>
        </ul>
      </Section>

      <Section title="8. Data subject requests">
        <p>
          Qualitative will assist Customer in responding to data subject requests (access, rectification,
          erasure, restriction, portability, objection). Customers can fulfill most requests directly through
          the product UI. For deletion of an entire account, email{" "}
          <a href="mailto:privacy@qualitative.app">privacy@qualitative.app</a>.
        </p>
      </Section>

      <Section title="9. Personal data breach">
        <p>
          Qualitative will notify Customer without undue delay (and, where feasible, within 72 hours) of becoming
          aware of a personal data breach affecting Customer data, with information sufficient for Customer to
          meet its own notification obligations.
        </p>
      </Section>

      <Section title="10. Audits">
        <p>
          Customer may, no more than once per year and on at least 30 days&apos; written notice, request
          reasonable information about Qualitative&apos;s data-protection practices. Where required, we will
          arrange a confidential audit consistent with industry standards.
        </p>
      </Section>

      <Section title="11. Deletion at end of service">
        <p>
          On termination of the Service, and unless legally required to retain data longer, Qualitative will
          delete all personal data within 30 days. Customer may request a copy of its data in machine-readable
          form prior to deletion.
        </p>
      </Section>

      <Section title="12. AI processing">
        <p>
          Customer content sent to AI sub-processors (currently Google Gemini) is processed under those
          providers&apos; commercial terms, which prohibit training on customer data. We do not use Customer
          content to train our own models.
        </p>
      </Section>

      <Section title="13. Liability">
        <p>
          Liability under this DPA is subject to the limitation of liability provisions of the underlying Terms
          of Service.
        </p>
      </Section>

      <Section title="14. Contact">
        <p>
          For DPA inquiries or to sign a counter-signed copy on behalf of your organization, email{" "}
          <a href="mailto:privacy@qualitative.app">privacy@qualitative.app</a>.
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

function SubRow({ name, purpose, location }: { name: string; purpose: string; location: string }) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="py-2 pr-4 font-medium">{name}</td>
      <td className="py-2 pr-4">{purpose}</td>
      <td className="py-2">{location}</td>
    </tr>
  );
}
