export const metadata = {
  title: "Security & Governance — Qualitative",
};

export default function SecurityPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Security &amp; Governance</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Last updated:{" "}
        {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>
      <p className="mt-4 text-gray-700 dark:text-gray-300">
        This page summarizes the policies that govern how we protect customer data and operate the
        Service. For our public-facing Privacy Policy see <a className="text-blue-600 dark:text-blue-400 hover:underline" href="/privacy">/privacy</a>; for the contractual data-processing terms see <a className="text-blue-600 dark:text-blue-400 hover:underline" href="/dpa">/dpa</a>.
      </p>
      <p className="mt-2 text-gray-700 dark:text-gray-300">
        We&apos;re an early-stage product with a small team. Where industry-standard policies apply,
        we describe what we do today honestly rather than aspirationally. Updates will be reflected
        on this page; material changes will be communicated to existing customers via email.
      </p>

      <nav className="mt-8 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white">Contents</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li><a className="text-blue-600 dark:text-blue-400 hover:underline" href="#ssdlc">1. Secure Software Development Lifecycle (SSDLC)</a></li>
          <li><a className="text-blue-600 dark:text-blue-400 hover:underline" href="#security-policy">2. Security policy</a></li>
          <li><a className="text-blue-600 dark:text-blue-400 hover:underline" href="#vulnerability-management">3. Vulnerability management</a></li>
          <li><a className="text-blue-600 dark:text-blue-400 hover:underline" href="#data-retention">4. Data retention &amp; protection</a></li>
          <li><a className="text-blue-600 dark:text-blue-400 hover:underline" href="#incident-response">5. Incident management and response</a></li>
          <li><a className="text-blue-600 dark:text-blue-400 hover:underline" href="#infrastructure">6. Infrastructure &amp; dependency management</a></li>
          <li><a className="text-blue-600 dark:text-blue-400 hover:underline" href="#compliance">7. Compliance attestations (SOC 2, ISO 27001)</a></li>
          <li><a className="text-blue-600 dark:text-blue-400 hover:underline" href="#contact">8. Contact</a></li>
        </ul>
      </nav>

      <Section id="ssdlc" title="1. Secure Software Development Lifecycle (SSDLC)">
        <p>
          Our SSDLC is intentionally lightweight but every stage has at least one enforced control.
          The phases below describe what is required for any change to reach production.
        </p>
        <h3>Design and threat modelling</h3>
        <ul>
          <li>Changes that touch authentication, authorization, encryption, third-party integrations,
            or data retention require a written design note in the pull request describing the
            data flows and the trust boundaries crossed.</li>
          <li>For new integrations, we identify the OAuth scopes requested, the data fields read or
            written, and any new sub-processors before implementation begins.</li>
        </ul>
        <h3>Secure coding</h3>
        <ul>
          <li>TypeScript with <code>strict</code> mode; <code>any</code> is avoided.</li>
          <li>All database queries are parameterized through the Neon serverless driver — no string
            concatenation.</li>
          <li>Webhook endpoints verify HMAC-SHA256 signatures with timing-safe comparison and a
            timestamp window before any side-effecting work runs.</li>
          <li>OAuth tokens are encrypted with AES-256-GCM before persistence; the key lives only in
            the application environment, never in source or the database.</li>
          <li>Tenant isolation is enforced by an <code>account_id</code> filter on every
            customer-data query, surfaced at the type system level.</li>
        </ul>
        <h3>Code review</h3>
        <ul>
          <li>All changes to <code>main</code> go through a pull request with at least one reviewer.
            Self-merges of security-relevant changes are prohibited.</li>
          <li>Reviewers consult the OWASP Top 10 informally; high-risk paths (auth, crypto, SQL,
            webhooks) receive extra scrutiny.</li>
        </ul>
        <h3>Automated checks (CI)</h3>
        <ul>
          <li><strong>SAST</strong>: GitHub CodeQL runs the <code>security-and-quality</code> query
            suite on every push, every pull request, and weekly. Findings are tracked in the
            repository&apos;s Security tab.</li>
          <li><strong>Dependency scanning</strong>: <code>npm audit</code> runs on every push and
            daily; GitHub Dependabot raises pull requests for vulnerable dependencies.</li>
          <li><strong>Type checking and linting</strong>: <code>tsc --noEmit</code> and
            <code>next lint</code> must pass before merge.</li>
        </ul>
        <h3>Deployment</h3>
        <ul>
          <li>Every pull request gets an isolated Vercel preview deployment with its own preview
            secrets — production secrets are never reachable from previews.</li>
          <li>Promotion to production happens only after the PR is merged to <code>main</code>;
            builds use the same artefact that was reviewed.</li>
          <li>Database schema changes ship as versioned migrations checked into source control and
            reviewed alongside the code that uses them.</li>
        </ul>
        <h3>Periodic dynamic testing (DAST)</h3>
        <ul>
          <li>OWASP ZAP baseline scans are run against production before each major release and at
            minimum quarterly. Reports are retained internally.</li>
        </ul>
        <h3>Post-deployment monitoring</h3>
        <ul>
          <li>Application errors and traffic anomalies are observable through Vercel&apos;s built-in
            telemetry; database health is monitored via Neon.</li>
          <li>Production incidents follow the process in §5 (Incident management).</li>
        </ul>
      </Section>

      <Section id="security-policy" title="2. Security policy">
        <p>
          Qualitative protects customer data through a combination of platform-provided controls,
          column-level encryption for sensitive fields, and strict tenant isolation enforced both
          in application code and at the database level.
        </p>
        <h3>Transport security</h3>
        <ul>
          <li>All traffic between the user&apos;s browser and the application is HTTPS only (TLS 1.2+).</li>
          <li>All traffic between the application and our database, OAuth providers, AI provider,
            and payment processor is encrypted in transit.</li>
          <li>HTTP Strict Transport Security (HSTS) is enabled on the production domain.</li>
        </ul>
        <h3>Data at rest</h3>
        <ul>
          <li>Database storage is encrypted at rest by our database provider (Neon).</li>
          <li>OAuth tokens (Google, Zoom, Microsoft Teams) are additionally encrypted at the column
            level using AES-256-GCM with a key held only in the application environment, so an
            attacker with read-only database access cannot retrieve usable tokens.</li>
          <li>The encryption key is held outside the database, rotated only via a versioned
            migration path (the stored format includes a version prefix so multiple keys can
            coexist during rotation).</li>
        </ul>
        <h3>Authentication and access control</h3>
        <ul>
          <li>End-user authentication is delegated to Google via OAuth 2.0; we do not store
            passwords.</li>
          <li>Session management uses signed, encrypted JWTs (NextAuth.js v5).</li>
          <li>Multi-tenant isolation: every database query for customer-owned data carries an
            <code>account_id</code> filter enforced at the type system level; cross-tenant access is
            structurally prevented at the application layer.</li>
          <li>Administrative access to the platform is restricted to an allow-list of emails (env
            variable <code>ADMIN_EMAILS</code>) and is gated behind the same Google OAuth flow as
            normal users, with 2FA recommended at the Google account level.</li>
        </ul>
        <h3>Webhooks and integrations</h3>
        <ul>
          <li>Inbound webhooks (Stripe, Zoom) are verified by HMAC-SHA256 signature against a
            provider-issued secret, with timing-safe comparison and a 5-minute replay window.</li>
          <li>OAuth state tokens use a single-use, signed cookie set with HttpOnly, Secure, and
            SameSite=Lax flags.</li>
        </ul>
      </Section>

      <Section id="vulnerability-management" title="3. Vulnerability management policy">
        <h3>Identification</h3>
        <ul>
          <li>Dependencies are pinned via <code>package-lock.json</code>; <code>npm audit</code> is
            consulted on every build and during dependency upgrades.</li>
          <li>We subscribe to security advisories for the runtime (Node.js LTS), framework
            (Next.js), and core libraries we ship.</li>
          <li>Customer or external reports may be sent to <a href="mailto:security@qualitative.one">security@qualitative.one</a>;
            we acknowledge receipt within 2 business days.</li>
        </ul>
        <h3>Triage and remediation SLAs</h3>
        <p>
          We classify vulnerabilities by CVSS v3.1 severity and target the following remediation
          windows from confirmation:
        </p>
        <ul>
          <li><strong>Critical (9.0–10.0)</strong>: 7 calendar days.</li>
          <li><strong>High (7.0–8.9)</strong>: 30 calendar days.</li>
          <li><strong>Medium (4.0–6.9)</strong>: next monthly maintenance window.</li>
          <li><strong>Low (&lt; 4.0)</strong>: best-effort, tracked publicly.</li>
        </ul>
        <h3>Disclosure</h3>
        <p>
          Vulnerabilities affecting customer data trigger the Incident Response process (§5). We
          do not run a bug-bounty program at this time but welcome responsible-disclosure reports
          and credit reporters in published postmortems with permission.
        </p>
      </Section>

      <Section id="data-retention" title="4. Data retention &amp; protection policy">
        <h3>What we store</h3>
        <ul>
          <li><strong>Account data</strong>: name, email, profile image, organization domain.</li>
          <li><strong>Meeting data</strong>: calendar metadata, transcripts (text), and the URLs to
            recordings hosted by the source platform (Google Meet, Zoom, etc.). We do not store
            the recording video files ourselves.</li>
          <li><strong>Derived data</strong>: AI-extracted insights, summaries, and draft emails.</li>
          <li><strong>Integration credentials</strong>: OAuth access and refresh tokens, encrypted
            at the column level as described in §1.</li>
        </ul>
        <h3>Retention</h3>
        <ul>
          <li>Customer data is retained for as long as the customer&apos;s account is active.</li>
          <li>Individual meetings, extracts, and email drafts can be deleted by the customer at
            any time from within the product.</li>
          <li>On account deletion (initiated by the customer via <a href="mailto:privacy@qualitative.one">privacy@qualitative.one</a>),
            we permanently delete all customer data within 30 days. Database backups are purged on
            their normal cycle (managed by Neon, typically 7 days).</li>
        </ul>
        <h3>Data portability</h3>
        <p>
          Customers can request a machine-readable export of their data in JSON format at any time
          by emailing <a href="mailto:privacy@qualitative.one">privacy@qualitative.one</a>. We provide the export within 30 days.
        </p>
        <h3>AI processing</h3>
        <p>
          Transcript text is sent to Google Gemini for processing under Google&apos;s commercial
          terms, which prohibit using customer content to train AI models. No Zoom identifiers,
          URLs, or OAuth credentials are sent to the AI provider — only the transcript text.
        </p>
      </Section>

      <Section id="incident-response" title="5. Incident management and response policy">
        <h3>Detection</h3>
        <ul>
          <li>Application errors and platform health are monitored through Vercel Observability.</li>
          <li>Database health is monitored through Neon&apos;s built-in metrics.</li>
          <li>Customer-reported issues route to <a href="mailto:support@qualitative.one">support@qualitative.one</a>;
            anything tagged as a possible security event is escalated to the on-call engineer.</li>
        </ul>
        <h3>Severity tiers</h3>
        <ul>
          <li><strong>P0 — Critical</strong>: unauthorized exposure of customer data, or full
            Service outage &gt; 60 minutes.</li>
          <li><strong>P1 — High</strong>: partial outage or degraded data accuracy affecting all
            customers.</li>
          <li><strong>P2 — Moderate</strong>: feature broken for some customers; workaround
            available.</li>
          <li><strong>P3 — Low</strong>: minor defect with no material impact.</li>
        </ul>
        <h3>Response</h3>
        <ul>
          <li>On-call engineer acknowledges P0/P1 within 1 hour.</li>
          <li>P0 incidents trigger immediate customer notification (within 72 hours for any
            personal-data breach, per GDPR Art. 33 obligations).</li>
          <li>P1 incidents trigger customer notification within 7 days where the impact warrants
            it.</li>
          <li>A written postmortem covering timeline, root cause, customer impact, and remediation
            is published within 14 days of incident resolution for P0/P1 events.</li>
        </ul>
        <h3>Communication</h3>
        <p>
          Affected customers are notified via the email on file. Subscriber-wide announcements use
          the same channel; we do not maintain a separate status page at this time.
        </p>
      </Section>

      <Section id="infrastructure" title="6. Infrastructure &amp; dependency management policy">
        <h3>Hosting and sub-processors</h3>
        <p>
          Qualitative is hosted on Vercel and uses the following sub-processors. Each is itself
          attested under one or more industry standards (SOC 2, ISO 27001, PCI DSS as
          applicable):
        </p>
        <div className="not-prose overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left font-medium py-2 pr-4">Sub-processor</th>
                <th className="text-left font-medium py-2 pr-4">Purpose</th>
                <th className="text-left font-medium py-2">Compliance</th>
              </tr>
            </thead>
            <tbody>
              <SubRow name="Vercel, Inc." purpose="Application hosting, edge network, analytics" compliance="SOC 2 Type II, ISO 27001" />
              <SubRow name="Neon, Inc." purpose="Managed PostgreSQL database" compliance="SOC 2 Type II" />
              <SubRow name="Google LLC (Gemini)" purpose="AI transcription and extraction" compliance="SOC 1/2/3, ISO 27001/17/18, FedRAMP High" />
              <SubRow name="Stripe, Inc." purpose="Payment processing" compliance="PCI DSS Level 1, SOC 2 Type II" />
              <SubRow name="Mailjet (Sinch Group)" purpose="Transactional email" compliance="ISO 27001, SOC 2" />
            </tbody>
          </table>
        </div>
        <h3>Dependency management</h3>
        <ul>
          <li>Application runtime is Node.js LTS, currently Node 22.</li>
          <li>All Node.js dependencies are pinned via <code>package-lock.json</code>.</li>
          <li>Dependency vulnerabilities are tracked through GitHub&apos;s Dependabot alerts and
            <code>npm audit</code>.</li>
          <li>Major version upgrades go through a manual review checklist before merge.</li>
        </ul>
        <h3>Change management</h3>
        <ul>
          <li>Production deploys go through Vercel&apos;s preview-then-promote pipeline.</li>
          <li>Database schema changes are versioned migrations stored in source control; all
            changes are reviewed before merge.</li>
          <li>Secrets are stored in Vercel environment variables, scoped per environment
            (production, preview, development).</li>
        </ul>
      </Section>

      <Section id="compliance" title="7. Compliance attestations (SOC 2, ISO 27001)">
        <p>
          <strong>Qualitative does not currently hold its own SOC 2 or ISO 27001 attestation.</strong>
          We are an early-stage product. Achieving these attestations involves expense and
          process overhead that is not yet justified by our customer base.
        </p>
        <p>
          We mitigate this by relying exclusively on sub-processors that <em>are</em> attested
          under SOC 2 and/or ISO 27001 for the components that handle data at scale (hosting,
          database, AI processing, payments). The application layer we build on top enforces the
          additional protections described above (tenant isolation, column-level token encryption,
          signed webhooks).
        </p>
        <p>
          We will revisit this stance as our customer base grows, and we&apos;re happy to discuss
          specific compliance needs with prospective customers. Email <a href="mailto:security@qualitative.one">security@qualitative.one</a>.
        </p>
      </Section>

      <Section id="contact" title="8. Contact">
        <ul>
          <li>Security issues and responsible disclosure: <a href="mailto:security@qualitative.one">security@qualitative.one</a></li>
          <li>Privacy and data-subject requests: <a href="mailto:privacy@qualitative.one">privacy@qualitative.one</a></li>
          <li>General support: <a href="mailto:support@qualitative.one">support@qualitative.one</a></li>
        </ul>
      </Section>
    </>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
      <div className="mt-3 space-y-3 [&_a]:text-blue-600 [&_a]:dark:text-blue-400 [&_a]:hover:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:text-gray-900 [&_h3]:dark:text-white [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-gray-100 [&_code]:dark:bg-gray-800 [&_code]:text-xs">
        {children}
      </div>
    </section>
  );
}

function SubRow({
  name,
  purpose,
  compliance,
}: {
  name: string;
  purpose: string;
  compliance: string;
}) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="py-2 pr-4 font-medium">{name}</td>
      <td className="py-2 pr-4">{purpose}</td>
      <td className="py-2">{compliance}</td>
    </tr>
  );
}
