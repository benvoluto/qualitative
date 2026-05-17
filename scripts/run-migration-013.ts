import { getDb } from "@/lib/db/client";

async function runMigration() {
  try {
    const sql = getDb();

    // Insert Professional Background rule
    await sql`
      INSERT INTO extract_rules (name, summary, quotes, action_items, is_active)
      VALUES (
          'Professional Background',
          'Extract insights related to professional background. Common themes include: career history, years in role, education, professional philosophy, career trajectory. Listen for: "years in role", "used to be", "before this", "started as", "background in", "retiring soon".',
          ${JSON.stringify([
              'diag for 16 years after taking a long term sub role',
              'lead diag 3 years, now coord of evals for 3 years',
              'has a masters in clinical psychology',
              'also a prof at Drexel and has private practice',
              'counting down to retirement 6 years and 1 month'
          ])}::jsonb,
          '[]'::jsonb,
          true
      )
      ON CONFLICT DO NOTHING
    `;
    console.log("Inserted Professional Background rule");

    // Insert District Connections rule
    await sql`
      INSERT INTO extract_rules (name, summary, quotes, action_items, is_active)
      VALUES (
          'District Connections',
          'Extract insights related to connections with other districts and referral opportunities. Common themes include: district references, industry connections, reference willingness, warm introductions. Listen for: "knows", "connected to", "friends with", "worked with", "can introduce", "you should talk to".',
          ${JSON.stringify([
              'knows [person] well and will reach out to her',
              'I texted [person] to tell her you would be reaching out',
              'school team referral to another assessment team',
              'main advocate for AI within her team'
          ])}::jsonb,
          ${JSON.stringify([
              'Capture any offers to introduce to other districts or contacts'
          ])}::jsonb,
          true
      )
      ON CONFLICT DO NOTHING
    `;
    console.log("Inserted District Connections rule");

    // Insert Upcoming Events rule
    await sql`
      INSERT INTO extract_rules (name, summary, quotes, action_items, is_active)
      VALUES (
          'Upcoming Events',
          'Extract insights related to upcoming events and engagement opportunities. Common themes include: conferences, team meetings, trainings, workshops. Listen for: "conference", "training", "workshop", "team meeting", "next week", "coming up". Flag events where Marker presence could add value.',
          ${JSON.stringify([
              'met at TASP conference',
              '12/3 is their next team meeting',
              'team has been attending trainings on AI including PAR webinar series',
              '2/11 Northern California Diagnostic Center is doing a free training with her team on AI'
          ])}::jsonb,
          ${JSON.stringify([
              'Flag events where product presence or participation could add value'
          ])}::jsonb,
          true
      )
      ON CONFLICT DO NOTHING
    `;
    console.log("Inserted Upcoming Events rule");

    // Insert Competitor Mentions rule
    await sql`
      INSERT INTO extract_rules (name, summary, quotes, action_items, is_active)
      VALUES (
          'Competitor Mentions',
          'Extract insights related to competitor and vendor mentions. Capture: product name, how they use it, sentiment (positive/negative/neutral), specific feedback. Listen for: "also using", "tried", "compared to", "switched from", "considering", "heard about". Include IEP systems, assessment tools, and AI competitors.',
          ${JSON.stringify([
              'School Psych AI - hallucinated too much, did not have a good experience',
              'likes giving it commands on what to do, Marker is too rigid',
              'PAR is launching their own report writer',
              'Uses Embrace for IEP',
              'has a spreadsheet that creates a bell curve for her'
          ])}::jsonb,
          '[]'::jsonb,
          true
      )
      ON CONFLICT DO NOTHING
    `;
    console.log("Inserted Competitor Mentions rule");

    // Insert Contract Approval Process rule
    await sql`
      INSERT INTO extract_rules (name, summary, quotes, action_items, is_active)
      VALUES (
          'Contract Approval Process',
          'Extract insights related to procurement and contract approval. Common themes include: approval thresholds, board approval, procurement timeline, key approvers, vendor requirements. Listen for: "approval", "board", "procurement", "contract", "vendor", "sign off", "threshold".',
          ${JSON.stringify([
              'over $50k needs board approval',
              '$150k or above is board',
              '80k contract would take 6-8 weeks to get board approval',
              'Feb he starts to decide which contracts they will move forward with',
              'wants a quote vs contract to push this through as a one off expense',
              'may need to complete a FERPA form',
              'will need to show data to the grown ups'
          ])}::jsonb,
          ${JSON.stringify([
              'Note approval thresholds for budget planning'
          ])}::jsonb,
          true
      )
      ON CONFLICT DO NOTHING
    `;
    console.log("Inserted Contract Approval Process rule");

    // Insert Staffing Challenges rule
    await sql`
      INSERT INTO extract_rules (name, summary, quotes, action_items, is_active)
      VALUES (
          'Staffing Challenges',
          'Extract insights related to staffing challenges. Common themes include: vacancies, retention struggles, talent quality, team turnover, growth plans. Listen for discussions about open positions, competition with neighboring districts, onboarding challenges.',
          ${JSON.stringify([
              'has had vacancies to start the year',
              'retention is their biggest struggle - 2 bigger neighboring districts with more money',
              'talent they are getting for diags and psychs is poor and requiring a lot of review and coaching',
              'has had to do more growth plans in the last 3 years than ever',
              'many openings - they said they would need to pitch this to director to close one of the open roles'
          ])}::jsonb,
          '[]'::jsonb,
          true
      )
      ON CONFLICT DO NOTHING
    `;
    console.log("Inserted Staffing Challenges rule");

    // Insert new tags
    await sql`
      INSERT INTO tags (name, type, color)
      VALUES
          ('professional_background', 'system', '#6366F1'),
          ('district_connections', 'system', '#8B5CF6'),
          ('upcoming_events', 'system', '#EC4899'),
          ('competitor_mentions', 'system', '#F59E0B'),
          ('contract_approval', 'system', '#10B981'),
          ('staffing_challenges', 'system', '#EF4444')
      ON CONFLICT (name) DO NOTHING
    `;
    console.log("Inserted new tags");

    console.log("Migration 013 completed successfully");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
