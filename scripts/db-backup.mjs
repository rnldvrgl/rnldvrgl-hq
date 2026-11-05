// Back up every HQ table to JSON files, through Supabase's API with the keys in .env.local (no database
// password, no Docker, no pg_dump). Free-tier Supabase has no downloadable backups, so run this before
// migrations:   node scripts/db-backup.mjs [folder]     (default: ~/hq-backups/<date-time>)
// Restore with scripts/db-restore.mjs. Keep the folder out of git: it holds your data (and tokens).
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

// parents before children, so a restore can follow the same order
const TABLES = ["hqs", "employees", "runs", "jobs", "interviews", "reminders", "inbox_items", "push_subscriptions", "spotify_auth", "office_names", "hq_invites", "hq_secrets"];

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = process.argv[2] ?? join(homedir(), "hq-backups", stamp);
mkdirSync(dir, { recursive: true });

let total = 0;
for (const table of TABLES) {
  const rows = [];
  let missing = false;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("*").range(from, from + 999);
    if (error) {
      if (/does not exist|schema cache|Could not find/i.test(error.message)) { missing = true; break; }
      console.error(`  ${table}: ${error.message}`);
      process.exit(1);
    }
    rows.push(...data);
    if (data.length < 1000) break;
  }
  if (missing) { console.log(`  ${table.padEnd(20)} (no such table yet, skipped)`); continue; }
  writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, null, 1));
  console.log(`  ${table.padEnd(20)} ${rows.length} rows`);
  total += rows.length;
}
console.log(`\nBacked up ${total} rows to ${dir}`);
