// One-off ops script: applies supabase/migrations/*.sql in order against SUPABASE_DB_URL.
// Usage: SUPABASE_DB_URL=postgresql://... node scripts/apply-migrations.mjs
// Requires the "pg" package (`npm install --no-save pg`) — it is not a runtime dependency
// of the app itself, only of this script.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "supabase", "migrations");

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(
    "Set SUPABASE_DB_URL (Supabase dashboard -> Settings -> Database -> Connection string).",
  );
  process.exit(1);
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log("Connected to database.");

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), "utf8");
  console.log(`\n--- Applying ${file} ---`);
  try {
    await client.query(sql);
    console.log(`OK: ${file}`);
  } catch (err) {
    console.error(`FAILED: ${file}`);
    console.error(err.message);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log("\nAll migrations applied successfully.");
