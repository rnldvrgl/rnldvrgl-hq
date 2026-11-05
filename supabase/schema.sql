-- rnldvrgl HQ schema. Run once in Supabase → SQL Editor.
-- RLS is on with no public policies: only the server (service-role key) reads and writes.

create table if not exists employees (
  id text primary key,
  enabled boolean not null default true,
  status text not null default 'idle'
    check (status in ('idle','working','needs_you','error')),
  summary text,
  last_run_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references employees(id) on delete cascade,
  trigger text not null default 'schedule' check (trigger in ('schedule','manual')),
  status text not null default 'running' check (status in ('running','done','needs_you','error')),
  output text,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists runs_employee_started on runs (employee_id, started_at desc);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  company text not null,
  link text unique,
  source text,
  salary_text text,
  salary_min_php int,
  fit_score int check (fit_score between 0 and 100),
  fit_reason text,
  status text not null default 'saved'
    check (status in ('saved','applied','interview','offer','closed')),
  date_found date not null default (now() at time zone 'Asia/Manila')::date,
  date_applied date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete set null,
  company text,
  starts_at timestamptz not null,
  meeting_link text,
  calendar_event_id text,
  created_at timestamptz not null default now()
);

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  due_at timestamptz not null,
  repeat text check (repeat in ('daily','weekdays','weekly')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists reminders_due on reminders (due_at) where sent_at is null;

-- iPhone Reminders sync (via the iOS Shortcut, see README). Safe to re-run on an existing database.
--   source:    'hq' = created in HQ, 'iphone' = came from the iPhone Reminders app
--   pushed_at: when an HQ reminder was handed to the iPhone, so it's only added there once
alter table reminders add column if not exists source text not null default 'hq';
alter table reminders add column if not exists pushed_at timestamptz;
do $$ begin
  alter table reminders add constraint reminders_source_check check (source in ('hq','iphone'));
exception when duplicate_object then null; end $$;

create table if not exists inbox_items (
  message_id text primary key,
  thread_id text,
  sender text,
  subject text,
  category text check (category in ('reply','fyi','ignore','interview')),
  summary text,
  draft_id text,
  handled boolean not null default false,
  received_at timestamptz,
  created_at timestamptz not null default now()
);

alter table employees enable row level security;
alter table runs enable row level security;
alter table jobs enable row level security;
alter table interviews enable row level security;
alter table reminders enable row level security;
alter table inbox_items enable row level security;

-- The eight desks (a fresh database, before multi-hq.sql). After multi-hq.sql the app adds missing desks for
-- every HQ itself, so this is skipped then.
do $$ begin
  insert into employees (id) values
    ('chief-of-staff'), ('inbox-triage'), ('job-hunter'), ('reminder-bot'),
    ('scheduler'), ('researcher'), ('dev-assistant'), ('weekly-reviewer')
  on conflict (id) do nothing;
exception when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- The office clock: Supabase pings /api/tick every 5 minutes.
-- Enable the pg_cron and pg_net extensions first (Database → Extensions),
-- then replace the URL and secret below and run this block.
-- ---------------------------------------------------------------------------
-- select cron.schedule(
--   'rnldvrgl-hq-tick',
--   '*/5 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://YOUR-APP.vercel.app/api/tick',
--     headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'),
--     timeout_milliseconds := 60000
--   );
--   $$
-- );

-- ---------------------------------------------------------------------------
-- Push notifications: one row per device that tapped "Enable" (safe to re-run).
-- ---------------------------------------------------------------------------
create table if not exists push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;

-- Spotify, connected once for every device (see README → Spotify). One row: the owner's tokens.
-- Only the server reads it (service-role key); the browser gets short-lived access tokens from /api/spotify.
create table if not exists spotify_auth (
  id int primary key default 1 check (id = 1),
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table spotify_auth enable row level security;

-- Names (Settings → Names): renames of the boss ('owner') and the employees (their ids). Safe to re-run.
-- A missing row means the name from hq.config.ts. Only the server reads it (service-role key).
create table if not exists office_names (
  id text primary key check (id in ('owner','chief-of-staff','inbox-triage','job-hunter','reminder-bot','scheduler','researcher','dev-assistant','weekly-reviewer')),
  name text not null check (char_length(name) between 1 and 24),
  updated_at timestamptz not null default now()
);
alter table office_names enable row level security;
