-- =====================================================================
-- RTIH Catalyst Demo Day: Supabase schema
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- It is safe to re-run (idempotent).
--
-- Privacy model (enforced here with row-level security, not just in the UI):
--   • Investor contact details  → only organisers + that investor
--   • Individual requests        → only organisers + that investor
--   • Room / time / deck links   → only organisers, and the investor once an organiser
--                                  explicitly sends a notice
--   • Live VC board              → fund name per startup, visible to registered investors
--   • Startup contacts & decks   → organisers only
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Organisers (allow-list by email) with a role:
--   'editor' → full control (approve, notify, edit startups, queue, settings)
--   'viewer' → read-only overview of everything organisers can see
-- Add organisers with:
--   insert into public.organisers (email, name, role) values ('someone@rtih.in', 'Name', 'editor');
-- They sign in with email + password. Create their login in
-- Authentication → Users → Add user (tick "Auto confirm user").
-- New rows default to 'viewer', so a mistake never grants edit rights.
-- ---------------------------------------------------------------------
create table if not exists public.organisers (
  email text primary key,
  name text not null default '',
  created_at timestamptz not null default now()
);
alter table public.organisers add column if not exists role text not null default 'viewer';
do $$
begin
  alter table public.organisers add constraint organisers_role_check check (role in ('editor', 'viewer'));
exception when duplicate_object then null;
end;
$$;

-- Role of the signed-in user if they are a confirmed organiser, else null
create or replace function public.organiser_role()
returns text
language sql stable security definer
set search_path = public, auth
as $$
  select o.role
  from auth.users u
  join public.organisers o on lower(o.email) = lower(u.email)
  where u.id = auth.uid()
    and u.email_confirmed_at is not null
  limit 1;
$$;

-- Any organiser (editor or viewer): read access
create or replace function public.is_organiser()
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select public.organiser_role() is not null;
$$;

-- Editors only: write access
create or replace function public.can_edit()
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select coalesce(public.organiser_role() = 'editor', false);
$$;

-- ---------------------------------------------------------------------
-- Event settings (single row, JSON)
-- ---------------------------------------------------------------------
create table if not exists public.event_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.event_settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Investors and the devices (anonymous auth users) linked to them
-- ---------------------------------------------------------------------
create table if not exists public.investors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fund text not null,
  email text not null default '',
  phone text not null default '',
  designation text not null default '',
  invite_token text not null unique default encode(gen_random_bytes(12), 'hex'),
  created_by text not null default 'self' check (created_by in ('self', 'organiser')),
  created_at timestamptz not null default now()
);

create table if not exists public.investor_devices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  investor_id uuid not null references public.investors(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.current_investor_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select investor_id from public.investor_devices where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Startups (public summary) + private organiser-only details
-- ---------------------------------------------------------------------
create table if not exists public.startups (
  id uuid primary key default gen_random_uuid(),
  position int not null default 0,
  name text not null,
  sector text not null default '',
  description text not null default '',
  city text not null default '',
  stage text not null default '',
  founders text not null default '',
  website text not null default '',
  problem text not null default '',
  solution text not null default '',
  market text not null default '',
  traction text not null default '',
  business_model text not null default '',
  team text not null default '',
  ask text not null default '',
  one_pager_url text not null default '',
  status text not null default 'queued' check (status in ('queued', 'pitching', 'done')),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.startup_private (
  startup_id uuid primary key references public.startups(id) on delete cascade,
  deck_url text not null default '',
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  notes text not null default ''
);

-- ---------------------------------------------------------------------
-- Requests: one row per (investor, startup, action). Toggling = active flag.
-- ---------------------------------------------------------------------
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,
  startup_id uuid not null references public.startups(id) on delete cascade,
  type text not null check (type in ('deck', 'meet_today', 'meet_later')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique (investor_id, startup_id, type)
);
create index if not exists requests_startup_idx on public.requests (startup_id);

-- Organiser-only handling of each request
create table if not exists public.request_handling (
  request_id uuid primary key references public.requests(id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'approved', 'archived')),
  room text not null default '',
  meeting_at text not null default '',
  deck_link text not null default '',
  message text not null default '',
  organiser_note text not null default '',
  approved_at timestamptz,
  notified_at timestamptz,
  updated_at timestamptz not null default now()
);

-- What organisers explicitly send to one investor
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,
  request_id uuid not null references public.requests(id) on delete cascade,
  startup_id uuid not null references public.startups(id) on delete cascade,
  type text not null,
  room text not null default '',
  meeting_at text not null default '',
  deck_link text not null default '',
  message text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notices_investor_idx on public.notices (investor_id);

-- Live VC board: maintained by trigger, exposes only (startup, fund)
create table if not exists public.live_interest (
  startup_id uuid not null references public.startups(id) on delete cascade,
  investor_id uuid not null references public.investors(id) on delete cascade,
  fund text not null,
  updated_at timestamptz not null default now(),
  primary key (startup_id, investor_id)
);

-- =====================================================================
-- Triggers
-- =====================================================================

-- requests: investors may only flip `active`; keep timestamps honest
create or replace function public.requests_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.investor_id <> old.investor_id or new.startup_id <> old.startup_id or new.type <> old.type then
      raise exception 'Only the active flag of a request can change';
    end if;
    new.created_at := old.created_at;
  else
    new.created_at := now();
  end if;
  new.updated_at := now();
  new.withdrawn_at := case when new.active then null else now() end;
  return new;
end;
$$;

drop trigger if exists requests_before_write on public.requests;
create trigger requests_before_write
before insert or update on public.requests
for each row execute function public.requests_before_write();

-- keep live_interest in sync with requests
create or replace function public.refresh_live_interest(p_startup uuid, p_investor uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  -- Serialise per (startup, investor). Without this, two toggles withdrawn at the same moment
  -- (parallel requests) each see the *other* as still active and the fund stays on the board.
  -- After the lock, the next statement takes a fresh snapshot (READ COMMITTED) and sees both.
  perform pg_advisory_xact_lock(hashtextextended(p_startup::text || ':' || p_investor::text, 0));
  if exists (
    select 1 from public.requests
    where startup_id = p_startup and investor_id = p_investor and active
  ) then
    insert into public.live_interest (startup_id, investor_id, fund, updated_at)
    select p_startup, p_investor, i.fund, now() from public.investors i where i.id = p_investor
    on conflict (startup_id, investor_id) do update set fund = excluded.fund, updated_at = now();
  else
    delete from public.live_interest where startup_id = p_startup and investor_id = p_investor;
  end if;
end;
$$;

create or replace function public.requests_after_write()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_live_interest(old.startup_id, old.investor_id);
    return old;
  end if;
  perform public.refresh_live_interest(new.startup_id, new.investor_id);
  return new;
end;
$$;

drop trigger if exists requests_after_write on public.requests;
create trigger requests_after_write
after insert or update or delete on public.requests
for each row execute function public.requests_after_write();

-- fund renamed → board follows
create or replace function public.investors_after_update()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.fund is distinct from old.fund then
    update public.live_interest set fund = new.fund where investor_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists investors_after_update on public.investors;
create trigger investors_after_update
after update on public.investors
for each row execute function public.investors_after_update();

-- investors cannot change their own invite token / provenance
create or replace function public.investors_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.can_edit() then
    new.invite_token := old.invite_token;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists investors_before_update on public.investors;
create trigger investors_before_update
before update on public.investors
for each row execute function public.investors_before_update();

-- investors may only mark their notices read
create or replace function public.notices_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.can_edit() then
    new := old;
    new.read_at := coalesce(old.read_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists notices_before_update on public.notices;
create trigger notices_before_update
before update on public.notices
for each row execute function public.notices_before_update();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists startups_touch on public.startups;
create trigger startups_touch before update on public.startups
for each row execute function public.touch_updated_at();

drop trigger if exists handling_touch on public.request_handling;
create trigger handling_touch before update on public.request_handling
for each row execute function public.touch_updated_at();

-- =====================================================================
-- RPC functions (called from the app)
-- =====================================================================

-- Identify-once: link this device (anonymous auth user) to a new or existing investor.
create or replace function public.register_investor(
  p_name text, p_fund text, p_email text, p_phone text, p_designation text
)
returns public.investors
language plpgsql security definer
set search_path = public
as $$
declare
  v_inv public.investors;
  v_existing uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_fund), '') = '' then
    raise exception 'Name and fund are required';
  end if;

  select investor_id into v_existing from public.investor_devices where user_id = auth.uid();

  if v_existing is not null then
    update public.investors
       set name = trim(p_name), fund = trim(p_fund), email = trim(coalesce(p_email, '')),
           phone = trim(coalesce(p_phone, '')), designation = trim(coalesce(p_designation, ''))
     where id = v_existing
     returning * into v_inv;
  else
    insert into public.investors (name, fund, email, phone, designation, created_by)
    values (trim(p_name), trim(p_fund), trim(coalesce(p_email, '')), trim(coalesce(p_phone, '')),
            trim(coalesce(p_designation, '')), 'self')
    returning * into v_inv;
    insert into public.investor_devices (user_id, investor_id) values (auth.uid(), v_inv.id);
  end if;
  return v_inv;
end;
$$;

-- Personal link: attach this device to the investor who owns the token.
create or replace function public.claim_invite(p_token text)
returns public.investors
language plpgsql security definer
set search_path = public
as $$
declare
  v_inv public.investors;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select * into v_inv from public.investors where invite_token = p_token;
  if v_inv.id is null then
    raise exception 'This personal link is not valid';
  end if;
  insert into public.investor_devices (user_id, investor_id) values (auth.uid(), v_inv.id)
  on conflict (user_id) do update set investor_id = excluded.investor_id;
  return v_inv;
end;
$$;

create or replace function public.forget_device()
returns void
language sql security definer
set search_path = public
as $$
  delete from public.investor_devices where user_id = auth.uid();
$$;

-- Reorder the pitch queue in one call
create or replace function public.reorder_startups(p_ids uuid[])
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.can_edit() then
    raise exception 'Organiser editors only';
  end if;
  update public.startups s
     set position = x.ord
    from unnest(p_ids) with ordinality as x(id, ord)
   where s.id = x.id;
end;
$$;

-- Make one startup "now pitching"; whoever was pitching becomes done
create or replace function public.set_pitching(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.can_edit() then
    raise exception 'Organiser editors only';
  end if;
  update public.startups set status = 'done' where status = 'pitching' and (p_id is null or id <> p_id);
  if p_id is not null then
    update public.startups set status = 'pitching' where id = p_id;
  end if;
end;
$$;

-- Send the approved details of a request to its investor
create or replace function public.notify_request(p_request_id uuid)
returns public.notices
language plpgsql security definer
set search_path = public
as $$
declare
  v_req public.requests;
  v_h public.request_handling;
  v_n public.notices;
begin
  if not public.can_edit() then
    raise exception 'Organiser editors only';
  end if;
  select * into v_req from public.requests where id = p_request_id;
  select * into v_h from public.request_handling where request_id = p_request_id;
  if v_req.id is null or v_h.request_id is null or v_h.status <> 'approved' then
    raise exception 'Approve the request before notifying the investor';
  end if;
  insert into public.notices (investor_id, request_id, startup_id, type, room, meeting_at, deck_link, message)
  values (v_req.investor_id, v_req.id, v_req.startup_id, v_req.type, v_h.room, v_h.meeting_at, v_h.deck_link, v_h.message)
  returning * into v_n;
  update public.request_handling set notified_at = now() where request_id = p_request_id;
  return v_n;
end;
$$;

-- Fund names already entered by investors, offered as suggestions to teammates.
-- Exposes fund NAMES only (no investor names or contact details).
create or replace function public.fund_suggestions()
returns setof text
language sql stable security definer
set search_path = public
as $$
  select name from (
    select distinct on (lower(regexp_replace(trim(fund), '\s+', ' ', 'g')))
           regexp_replace(trim(fund), '\s+', ' ', 'g') as name, created_at
    from public.investors
    where trim(fund) <> ''
    order by lower(regexp_replace(trim(fund), '\s+', ' ', 'g')), created_at
  ) f
  order by lower(name);
$$;

-- Lets the app tell an organiser login apart from an investor
create or replace function public.whoami_organiser()
returns json
language sql stable security definer
set search_path = public, auth
as $$
  select json_build_object('email', o.email, 'name', o.name, 'role', o.role)
  from auth.users u
  join public.organisers o on lower(o.email) = lower(u.email)
  where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;

-- =====================================================================
-- Row-level security
-- =====================================================================
alter table public.organisers       enable row level security;
alter table public.event_settings   enable row level security;
alter table public.investors        enable row level security;
alter table public.investor_devices enable row level security;
alter table public.startups         enable row level security;
alter table public.startup_private  enable row level security;
alter table public.requests         enable row level security;
alter table public.request_handling enable row level security;
alter table public.notices          enable row level security;
alter table public.live_interest    enable row level security;

-- organisers: organisers can see the list; nobody writes via the API
drop policy if exists organisers_select on public.organisers;
create policy organisers_select on public.organisers for select using (public.is_organiser());

-- event settings: readable by everyone, editable by organisers
drop policy if exists settings_select on public.event_settings;
create policy settings_select on public.event_settings for select using (true);
drop policy if exists settings_update on public.event_settings;
create policy settings_update on public.event_settings for update using (public.can_edit()) with check (public.can_edit());

-- investors: self or organisers (self-registration goes through register_investor())
drop policy if exists investors_select on public.investors;
create policy investors_select on public.investors for select
  using (id = public.current_investor_id() or public.is_organiser());
drop policy if exists investors_update on public.investors;
create policy investors_update on public.investors for update
  using (id = public.current_investor_id() or public.can_edit())
  with check (id = public.current_investor_id() or public.can_edit());
drop policy if exists investors_insert on public.investors;
create policy investors_insert on public.investors for insert with check (public.can_edit());
drop policy if exists investors_delete on public.investors;
create policy investors_delete on public.investors for delete using (public.can_edit());

-- devices: own row only (writes via functions)
drop policy if exists devices_select on public.investor_devices;
create policy devices_select on public.investor_devices for select
  using (user_id = auth.uid() or public.is_organiser());

-- startups: visible ones readable by anyone; organisers manage
drop policy if exists startups_select on public.startups;
create policy startups_select on public.startups for select using (not hidden or public.is_organiser());
drop policy if exists startups_write on public.startups;
create policy startups_write on public.startups for all using (public.can_edit()) with check (public.can_edit());

drop policy if exists startup_private_all on public.startup_private;
drop policy if exists startup_private_select on public.startup_private;
create policy startup_private_select on public.startup_private for select using (public.is_organiser());
drop policy if exists startup_private_write on public.startup_private;
create policy startup_private_write on public.startup_private for all using (public.can_edit()) with check (public.can_edit());

-- requests: investors see and write their own; organisers see all
drop policy if exists requests_select on public.requests;
create policy requests_select on public.requests for select
  using (investor_id = public.current_investor_id() or public.is_organiser());
drop policy if exists requests_insert on public.requests;
create policy requests_insert on public.requests for insert
  with check (investor_id = public.current_investor_id());
drop policy if exists requests_update on public.requests;
create policy requests_update on public.requests for update
  using (investor_id = public.current_investor_id())
  with check (investor_id = public.current_investor_id());
drop policy if exists requests_delete on public.requests;
create policy requests_delete on public.requests for delete using (public.can_edit());

-- handling: organisers only
drop policy if exists handling_all on public.request_handling;
drop policy if exists handling_select on public.request_handling;
create policy handling_select on public.request_handling for select using (public.is_organiser());
drop policy if exists handling_write on public.request_handling;
create policy handling_write on public.request_handling for all using (public.can_edit()) with check (public.can_edit());

-- notices: the investor reads (and marks read) their own; organisers manage
drop policy if exists notices_select on public.notices;
create policy notices_select on public.notices for select
  using (investor_id = public.current_investor_id() or public.is_organiser());
drop policy if exists notices_update on public.notices;
create policy notices_update on public.notices for update
  using (investor_id = public.current_investor_id() or public.can_edit());
drop policy if exists notices_write on public.notices;
create policy notices_write on public.notices for insert with check (public.can_edit());
drop policy if exists notices_delete on public.notices;
create policy notices_delete on public.notices for delete using (public.can_edit());

-- live board: any registered investor or organiser
drop policy if exists live_select on public.live_interest;
create policy live_select on public.live_interest for select
  using (public.current_investor_id() is not null or public.is_organiser());

-- =====================================================================
-- Deck viewing (see migrations/004_deck_viewing.sql)
-- =====================================================================

-- Public flag only (no URL): "this startup's deck can be viewed in the app"
alter table public.startups add column if not exists deck_available boolean not null default false;

-- Who opened which deck (organisers see all; an investor sees only their own)
create table if not exists public.deck_views (
  investor_id uuid not null references public.investors(id) on delete cascade,
  startup_id uuid not null references public.startups(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  views int not null default 1,
  primary key (investor_id, startup_id)
);
alter table public.deck_views enable row level security;
drop policy if exists deck_views_select on public.deck_views;
create policy deck_views_select on public.deck_views for select
  using (public.is_organiser() or investor_id = public.current_investor_id());
grant select on public.deck_views to authenticated;
revoke all on public.deck_views from anon;

-- Returns the deck link to a registered investor (or organiser) and logs the view.
create or replace function public.open_deck(p_startup uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_inv uuid := public.current_investor_id();
  v_url text;
begin
  if v_inv is null and not public.is_organiser() then
    raise exception 'Please enter your details first';
  end if;
  select p.deck_url into v_url
    from public.startups s
    join public.startup_private p on p.startup_id = s.id
   where s.id = p_startup
     and (s.deck_available or public.is_organiser())
     and coalesce(p.deck_url, '') <> '';
  if v_url is null then
    raise exception 'This deck is not available to view. You can request it from the RTIH team.';
  end if;
  if v_inv is not null then
    insert into public.deck_views (investor_id, startup_id) values (v_inv, p_startup)
    on conflict (investor_id, startup_id)
    do update set last_viewed_at = now(), views = public.deck_views.views + 1;
  end if;
  return v_url;
end;
$$;
grant execute on function public.open_deck(uuid) to authenticated;
revoke execute on function public.open_deck(uuid) from public, anon;  -- Postgres grants new functions to PUBLIC by default

-- Stream deck views to the organiser dashboard
do $$
begin
  alter publication supabase_realtime add table public.deck_views;
exception when duplicate_object then null;
          when undefined_object then null;
end;
$$;

-- =====================================================================
-- Grants (Supabase usually grants these by default; explicit for safety)
-- =====================================================================
grant usage on schema public to anon, authenticated;
grant select on public.event_settings, public.startups to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- Logged-out visitors (role anon) only ever need the public startup list and event settings.
-- (Investors' anonymous sign-ins use the `authenticated` role, so they are unaffected.)
revoke all on public.organisers, public.investors, public.investor_devices, public.startup_private,
  public.requests, public.request_handling, public.notices, public.live_interest from anon;
grant execute on function public.register_investor(text, text, text, text, text) to authenticated;
grant execute on function public.claim_invite(text) to authenticated;
grant execute on function public.forget_device() to authenticated;
grant execute on function public.reorder_startups(uuid[]) to authenticated;
grant execute on function public.set_pitching(uuid) to authenticated;
grant execute on function public.notify_request(uuid) to authenticated;
grant execute on function public.whoami_organiser() to authenticated;
grant execute on function public.fund_suggestions() to anon, authenticated;
grant execute on function public.is_organiser() to anon, authenticated;
grant execute on function public.can_edit() to anon, authenticated;
grant execute on function public.organiser_role() to authenticated;
grant execute on function public.current_investor_id() to anon, authenticated;
revoke execute on function public.refresh_live_interest(uuid, uuid) from public, anon, authenticated;

-- =====================================================================
-- Realtime: stream changes to the app (RLS still applies per viewer)
-- =====================================================================
do $$
declare
  t text;
begin
  foreach t in array array['startups', 'requests', 'request_handling', 'notices', 'live_interest', 'event_settings', 'investors']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
             when undefined_object then null;
    end;
  end loop;
end;
$$;

-- =====================================================================
-- Self-heal: make the live board exactly match active requests (safe to re-run)
-- =====================================================================
delete from public.live_interest l
where not exists (
  select 1 from public.requests r
  where r.startup_id = l.startup_id and r.investor_id = l.investor_id and r.active
);
insert into public.live_interest (startup_id, investor_id, fund)
select distinct r.startup_id, r.investor_id, i.fund
from public.requests r join public.investors i on i.id = r.investor_id
where r.active
on conflict (startup_id, investor_id) do nothing;
