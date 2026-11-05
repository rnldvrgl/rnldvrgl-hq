-- rnldvrgl HQ · Phase 1: one database, many HQs (yours, and one per invited friend).
-- Run once in Supabase → SQL Editor AFTER schema.sql. Safe to re-run. Back up first (Database → Backups).
-- Re-run it whenever you create one of the optional tables later (push_subscriptions, spotify_auth,
-- office_names from schema.sql): it gives them their hq_id too.
--
-- What it does:
--   hqs          one row per HQ. Yours is the fixed "founder" row (its owner is OWNER_EMAIL from the env).
--   hq_invites   invite links you (or a friend) create; one use each.
--   hq_secrets   each HQ's own keys and connections (AI keys, Google, GitHub), encrypted by the app.
--   hq_prefs     each HQ's settings (name, app icon, team, style, office), synced to all its devices.
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
insert into hqs (id) values ('00000000-0000-4000-8000-000000000001') on conflict (id) do nothing;

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

-- each HQ's preferences (Settings): its name, app icon, team, colour style and office settings, so they
-- follow the owner to every device. One JSON document per HQ, validated by the app (lib/prefs.ts).
create table if not exists hq_prefs (
  hq_id uuid primary key references hqs(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
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

do $$ begin
  if to_regclass('spotify_auth') is not null then
    alter table spotify_auth drop constraint if exists spotify_auth_id_check;
    alter table spotify_auth drop constraint if exists spotify_auth_pkey;
    begin alter table spotify_auth add primary key (hq_id); exception when invalid_table_definition then null; end;
  end if;
end $$;

-- a phone subscribed to push belongs to an HQ; the same phone can follow two HQs (yours and a friend's)
do $$ begin
  if to_regclass('push_subscriptions') is not null and not exists (
    select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
    where i.indrelid = 'push_subscriptions'::regclass and i.indisprimary and a.attname = 'hq_id'
  ) then
    alter table push_subscriptions drop constraint if exists push_subscriptions_pkey;
    alter table push_subscriptions add primary key (hq_id, endpoint);
  end if;
end $$;

do $$ begin
  if to_regclass('office_names') is not null then
    alter table office_names drop constraint if exists office_names_pkey;
    begin alter table office_names add primary key (hq_id, id); exception when invalid_table_definition then null; end;
  end if;
end $$;

create index if not exists reminders_hq_due on reminders (hq_id, due_at) where sent_at is null;
create index if not exists jobs_hq_found on jobs (hq_id, date_found desc);

-- A friend's new HQ and its desks in one go (one transaction): if anything fails, nothing is left half-made.
-- Returns the HQ's id; an email that already has an HQ just gets that one back.
create or replace function create_friend_hq(p_email text, p_invited_by uuid, p_desks text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  insert into hqs (owner_email, invited_by) values (lower(p_email), p_invited_by)
    on conflict (owner_email) do nothing returning id into v;
  if v is null then
    select id into v from hqs where owner_email = lower(p_email);
    return v;
  end if;
  insert into employees (hq_id, id) select v, d from unnest(p_desks) as d on conflict do nothing;
  return v;
end $$;
revoke all on function create_friend_hq(text, uuid, text[]) from public, anon, authenticated;

alter table hqs enable row level security;
alter table hq_invites enable row level security;
alter table hq_secrets enable row level security;
alter table hq_prefs enable row level security;

-- Chat between HQs: the Lounge (everyone) and direct messages ("dm:<hq id>:<hq id>", the two ids sorted).
-- Only the server reads and writes it (RLS on, no policies); it checks you're in the room.
create table if not exists hq_messages (
  id uuid primary key default gen_random_uuid(),
  room text not null check (room = 'lounge' or room ~ '^dm:[0-9a-f-]{36}:[0-9a-f-]{36}$'),
  from_hq uuid not null references hqs(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists hq_messages_room_at on hq_messages (room, created_at desc);
alter table hq_messages enable row level security;

-- Realtime: the friends' lobby (who's online). A private channel only signed-in people can join, and
-- sign-in is invite-only, so that's your circle. Nothing is stored; presence only lives while connected.
-- hq:voice is the voice lounge's signalling (who's in it, and the WebRTC handshakes between them);
-- hq:watch keeps movie night in sync (what's playing, play/pause and where).
do $$ begin
  if to_regclass('realtime.messages') is not null then
    drop policy if exists "hq lobby read" on realtime.messages;
    create policy "hq lobby read" on realtime.messages for select to authenticated using (realtime.topic() in ('hq:lobby', 'hq:voice', 'hq:watch'));
    drop policy if exists "hq lobby write" on realtime.messages;
    create policy "hq lobby write" on realtime.messages for insert to authenticated with check (realtime.topic() in ('hq:lobby', 'hq:voice', 'hq:watch'));
  end if;
end $$;

commit;
