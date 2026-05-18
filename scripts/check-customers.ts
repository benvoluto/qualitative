import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function checkCustomers() {
  console.log("Checking customers and meeting associations...\n");

  // Get all customers
  const customers = await sql`SELECT id, name FROM customers ORDER BY name`;
  console.log(`Customers (${customers.length}):`);
  customers.forEach((c) => console.log(`  - ${c.name} (${c.id.slice(0, 8)}...)`));

  // Get all meetings with customer info
  const meetings = await sql`
    SELECT m.id, m.name, m.customer_id, c.name as customer_name
    FROM meetings m
    LEFT JOIN customers c ON m.customer_id = c.id
    ORDER BY m.meeting_date DESC
  `;
  console.log(`\nMeetings (${meetings.length}):`);
  meetings.forEach((m) =>
    console.log(`  - ${m.name || "Untitled"}: customer=${m.customer_name || "none"}`)
  );

  // Get extracts with customer info
  const extracts = await sql`
    SELECT e.id, e.summary, e.customer_id, c.name as customer_name
    FROM extracts e
    LEFT JOIN customers c ON e.customer_id = c.id
    LIMIT 5
  `;
  console.log(`\nSample extracts (${extracts.length}):`);
  extracts.forEach((e) =>
    console.log(`  - ${(e.summary || "").slice(0, 50)}...: customer=${e.customer_name || "none"}`)
  );
}

checkCustomers().catch(console.error);
