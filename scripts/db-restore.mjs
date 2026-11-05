// Put a backup from scripts/db-backup.mjs back: upserts every table's rows (parents first), so it's safe to
// run on a database that still has some of them.   node scripts/db-restore.mjs <folder>
// Restoring a pre-multi-HQ backup into a database that already ran supabase/multi-hq.sql: rows without an
// hq_id are given your HQ's (the founder's) automatically.
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const dir = process.argv[2];
if (!dir || !existsSync(dir)) { console.error("Usage: node scripts/db-restore.mjs <backup folder>"); process.exit(1); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const FOUNDER = "00000000-0000-4000-8000-000000000001";
const TABLES = ["hqs", "employees", "runs", "jobs", "interviews", "reminders", "inbox_items", "push_subscriptions", "spotify_auth", "office_names", "hq_invites", "hq_secrets", "hq_prefs"];
// what each table's rows are unique by, before and after multi-hq.sql
const KEYS = {
  hqs: ["id"], employees: ["hq_id,id", "id"], runs: ["id"], jobs: ["id"], interviews: ["id"], reminders: ["id"],
  inbox_items: ["hq_id,message_id", "message_id"], push_subscriptions: ["hq_id,endpoint", "endpoint"],
  spotify_auth: ["hq_id", "id"], office_names: ["hq_id,id", "id"], hq_invites: ["code"], hq_secrets: ["hq_id,key"], hq_prefs: ["hq_id"],
};

// does the live database have hq_id yet?
const multi = !(await db.from("employees").select("hq_id").limit(1)).error;

for (const table of TABLES) {
  const file = join(dir, `${table}.json`);
  if (!existsSync(file)) continue;
  let rows = JSON.parse(readFileSync(file, "utf8"));
  if (!rows.length) { console.log(`  ${table.padEnd(20)} empty`); continue; }
  if (multi && table !== "hqs") rows = rows.map((r) => ("hq_id" in r ? r : { ...r, hq_id: FOUNDER }));
  const onConflict = multi ? KEYS[table][0] : KEYS[table].at(-1);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) { console.error(`  ${table}: ${error.message}`); process.exit(1); }
  }
  console.log(`  ${table.padEnd(20)} ${rows.length} rows restored`);
}
console.log("\nDone.");
