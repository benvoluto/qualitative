import { getDb } from "@/lib/db/client";
import * as fs from "fs";
import * as path from "path";

async function runMigration() {
  const migrationNumber = process.argv[2] || "008";

  try {
    const sql = getDb();
    const migrationPath = path.join(process.cwd(), `db/migrations/${migrationNumber}_meeting_host_name.sql`);
    const migrationSql = fs.readFileSync(migrationPath, "utf8");

    // Split by statement to handle multiple statements
    const statements = migrationSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await sql(statement);
      console.log("Executed:", statement.substring(0, 50) + "...");
    }

    console.log(`Migration ${migrationNumber} completed successfully`);
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
