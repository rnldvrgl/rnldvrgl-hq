-- rnldvrgl HQ · Phase 1: one database, many HQs (yours, and one per invited friend).
-- Run once in Supabase → SQL Editor AFTER schema.sql. Safe to re-run. Back up first (Database → Backups).
--
-- What it does:
--   hqs          one row per HQ. Yours is the fixed "founder" row (its owner is OWNER_EMAIL from the env).
--   hq_invites   invite links you (or a friend) create; one use each.
--   hq_secrets   each HQ's own keys and connections (AI keys, Google, GitHub), encrypted by the app.
--   hq_id        added to every table; all your existing rows become the founder HQ's.
-- RLS stays on with no public policies: only the server (service-role key) reads and writes.

begin;

create table if not exists hqs (
  id uuid primary key default gen_random_uuid(),
  -- null for the founder HQ (its owner is OWNER_EMAIL); a friend's sign-in email otherwise
  owner_email text unique check (owner_email is null or owner_email = lower(owner_email)),
  name text,
  invited_by uuid references hqs(id) on delete set null,
  created_at timestamptz not null default now()
);
insert into hqs (id, name) values ('00000000-0000-4000-8000-000000000001', 'Founder HQ') on conflict (id) do nothing;

create table if not exists hq_invites (
  code text primary key,
  hq_id uuid not null references hqs(id) on delete cascade,      -- who invited
  email text check (email is null or email = lower(email)),     -- optional: only this email may use it
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references hqs(id) on delete set null,
  used_at timestamptz
);

create table if not exists hq_secrets (
  hq_id uuid not null references hqs(id) on delete cascade,
  key text not null,
  value text not null,            -- AES-GCM ciphertext (the app holds the key, HQ_SECRET_KEY)
  updated_at timestamptz not null default now(),
  primary key (hq_id, key)
);

-- hq_id on every table, existing rows → the founder HQ
do $$
declare t text;
begin
  foreach t in array array['employees','runs','jobs','interviews','reminders','inbox_items','push_subscriptions','spotify_auth','office_names'] loop
    if to_regclass(t) is null then continue; end if;
    execute format('alter table %I add column if not exists hq_id uuid references hqs(id) on delete cascade', t);
    execute format('update %I set hq_id = %L where hq_id is null', t, '00000000-0000-4000-8000-000000000001');
    execute format('alter table %I alter column hq_id set not null', t);
  end loop;
end $$;

-- keys that were global become per HQ
-- (only the first time: once employees' key includes hq_id this is skipped)
do $$ begin
  if not exists (
    select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
    where i.indrelid = 'employees'::regclass and i.indisprimary and a.attname = 'hq_id'
  ) then
    alter table runs drop constraint if exists runs_employee_id_fkey;
    alter table employees drop constraint if exists employees_pkey;
    alter table employees add primary key (hq_id, id);
    alter table runs add constraint runs_employee_fkey foreign key (hq_id, employee_id) references employees (hq_id, id) on delete cascade;
  end if;
end $$;
drop index if exists runs_employee_started;
create index if not exists runs_hq_employee_started on runs (hq_id, employee_id, started_at desc);

alter table jobs drop constraint if exists jobs_link_key;
do $$ begin alter table jobs add constraint jobs_hq_link_key unique (hq_id, link); exception when duplicate_table or duplicate_object then null; end $$;

alter table inbox_items drop constraint if exists inbox_items_pkey;
do $$ begin alter table inbox_items add primary key (hq_id, message_id); exception when invalid_table_definition then null; end $$;

alter table spotify_auth drop constraint if exists spotify_auth_id_check;
alter table spotify_auth drop constraint if exists spotify_auth_pkey;
do $$ begin alter table spotify_auth add primary key (hq_id); exception when invalid_table_definition then null; end $$;

do $$ begin
  if to_regclass('office_names') is not null then
    alter table office_names drop constraint if exists office_names_pkey;
    begin alter table office_names add primary key (hq_id, id); exception when invalid_table_definition then null; end;
  end if;
end $$;

create index if not exists reminders_hq_due on reminders (hq_id, due_at) where sent_at is null;
create index if not exists jobs_hq_found on jobs (hq_id, date_found desc);

alter table hqs enable row level security;
alter table hq_invites enable row level security;
alter table hq_secrets enable row level security;

commit;
