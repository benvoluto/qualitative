import { neon } from "@neondatabase/serverless";
import * as fs from "fs";
import * as path from "path";

// Split SQL into individual statements, handling $$ delimited functions
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;

  const lines = sql.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and comments at statement boundaries
    if (!inDollarQuote && current === "" && (trimmedLine === "" || trimmedLine.startsWith("--"))) {
      continue;
    }

    // Check for $$ delimiter
    const dollarMatches = line.match(/\$\$/g);
    if (dollarMatches) {
      for (const _ of dollarMatches) {
        inDollarQuote = !inDollarQuote;
      }
    }

    current += line + "\n";

    // If we're not in a dollar quote and line ends with semicolon, it's end of statement
    if (!inDollarQuote && trimmedLine.endsWith(";")) {
      const statement = current.trim();
      if (statement && !statement.startsWith("--")) {
        statements.push(statement);
      }
      current = "";
    }
  }

  // Handle any remaining content
  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = neon(process.env.DATABASE_URL);
  // `neon()` returns a tagged-template fn whose overload resolution is fragile
  // across minor versions; cast to the (statement: string) form explicitly.
  const exec = sql as unknown as (statement: string) => Promise<unknown>;
  const migrationsDir = path.join(__dirname, "migrations");

  // Get all migration files sorted by name
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  console.log(`Found ${migrationFiles.length} migration(s)`);

  for (const file of migrationFiles) {
    console.log(`Running migration: ${file}`);
    const filePath = path.join(migrationsDir, file);
    const migrationSql = fs.readFileSync(filePath, "utf-8");
    const statements = splitSqlStatements(migrationSql);

    console.log(`  Executing ${statements.length} statements...`);

    for (let i = 0; i < statements.length; i++) {
      try {
        await exec(statements[i]);
        process.stdout.write(".");
      } catch (error: any) {
        console.error(`\n  ✗ Statement ${i + 1} failed:`, error.message);
        console.error(`  Statement: ${statements[i].substring(0, 100)}...`);
        throw error;
      }
    }

    console.log(`\n  ✓ ${file} completed`);
  }

  console.log("\nAll migrations completed successfully!");
}

runMigrations().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
