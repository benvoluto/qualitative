import { getDb } from "./client";
import { Account } from "./types";

export async function getAccountById(id: string): Promise<Account | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM accounts WHERE id = ${id}`;
  return (result[0] as Account) || null;
}

export async function createAccount(data: {
  name: string;
  internal_domain: string | null;
}): Promise<Account> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO accounts (name, internal_domain)
    VALUES (${data.name}, ${data.internal_domain})
    RETURNING *
  `;
  return result[0] as Account;
}

export async function updateAccount(
  id: string,
  data: Partial<Pick<Account, "name" | "internal_domain" | "internal_domain_aliases">>
): Promise<Account | null> {
  const sql = getDb();
  const result = await sql`
    UPDATE accounts SET
      name = COALESCE(${data.name ?? null}, name),
      internal_domain = COALESCE(${data.internal_domain ?? null}, internal_domain),
      internal_domain_aliases = COALESCE(${data.internal_domain_aliases ?? null}, internal_domain_aliases)
    WHERE id = ${id}
    RETURNING *
  `;
  return (result[0] as Account) || null;
}

export async function updateAccountPromptTemplate(
  accountId: string,
  templateType: "deal_email" | "customer_email" | "notes",
  template: string | null
): Promise<Account | null> {
  const sql = getDb();
  const column =
    templateType === "deal_email"
      ? "deal_email_prompt_template"
      : templateType === "customer_email"
        ? "customer_email_prompt_template"
        : "notes_prompt_template";
  const result = await sql(
    `UPDATE accounts SET ${column} = $1 WHERE id = $2 RETURNING *`,
    [template, accountId]
  );
  return (result[0] as Account) || null;
}
