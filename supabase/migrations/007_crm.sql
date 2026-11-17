-- Catalyst 1.0 · update 007: CRM for organisers. Tracks every investor ↔ startup connection after the event:
-- pipeline stage, owner, follow-ups with due dates, and a log of calls, emails, meetings and notes.
--   crm_connections: one row per investor + startup pair (created from event interest or by hand).
--   crm_activities:  the timeline of a connection. kind 'followup' rows are to-dos (due_on, done_at).
-- Organisers (any role) can read; editors can write. Investors and founders never see any of it.
-- Restarting the pitch queue (update 006) does not touch the CRM.
-- Safe to run more than once. Run it in Supabase → SQL Editor.

create table if not exists public.crm_connections (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,
  startup_id uuid not null references public.startups(id) on delete cascade,
  stage text not null default 'new',
  priority text not null default 'normal',
  owner text not null default '',
  -- how it started: the investor's event request, or added by an organiser
  source text not null default 'manual',
  -- ticket size / round notes
  ticket text not null default '',
  summary text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (investor_id, startup_id)
);
alter table public.crm_connections drop constraint if exists crm_connections_stage_check;
alter table public.crm_connections add constraint crm_connections_stage_check
  check (stage in ('new', 'contacted', 'meeting', 'met', 'diligence', 'term_sheet', 'invested', 'passed'));
alter table public.crm_connections drop constraint if exists crm_connections_priority_check;
alter table public.crm_connections add constraint crm_connections_priority_check check (priority in ('high', 'normal', 'low'));
alter table public.crm_connections drop constraint if exists crm_connections_source_check;
alter table public.crm_connections add constraint crm_connections_source_check
  check (source in ('meet_today', 'meet_later', 'deck', 'manual'));
create index if not exists crm_connections_startup_idx on public.crm_connections (startup_id);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.crm_connections(id) on delete cascade,
  kind text not null,
  body text not null default '',
  -- follow-ups only: when it is due and when it was done
  due_on date,
  done_at timestamptz,
  owner text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);
alter table public.crm_activities drop constraint if exists crm_activities_kind_check;
alter table public.crm_activities add constraint crm_activities_kind_check
  check (kind in ('note', 'call', 'email', 'meeting', 'whatsapp', 'stage', 'followup'));
create index if not exists crm_activities_connection_idx on public.crm_activities (connection_id);
create index if not exists crm_activities_open_followups_idx on public.crm_activities (due_on) where kind = 'followup' and done_at is null;

drop trigger if exists crm_connections_touch on public.crm_connections;
create trigger crm_connections_touch before update on public.crm_connections
for each row execute function public.touch_updated_at();

alter table public.crm_connections enable row level security;
alter table public.crm_activities enable row level security;

drop policy if exists crm_connections_select on public.crm_connections;
create policy crm_connections_select on public.crm_connections for select using (public.is_organiser());
drop policy if exists crm_connections_insert on public.crm_connections;
create policy crm_connections_insert on public.crm_connections for insert with check (public.can_edit());
drop policy if exists crm_connections_update on public.crm_connections;
create policy crm_connections_update on public.crm_connections for update using (public.can_edit()) with check (public.can_edit());
drop policy if exists crm_connections_delete on public.crm_connections;
create policy crm_connections_delete on public.crm_connections for delete using (public.can_edit());

drop policy if exists crm_activities_select on public.crm_activities;
create policy crm_activities_select on public.crm_activities for select using (public.is_organiser());
drop policy if exists crm_activities_insert on public.crm_activities;
create policy crm_activities_insert on public.crm_activities for insert with check (public.can_edit());
drop policy if exists crm_activities_update on public.crm_activities;
create policy crm_activities_update on public.crm_activities for update using (public.can_edit()) with check (public.can_edit());
drop policy if exists crm_activities_delete on public.crm_activities;
create policy crm_activities_delete on public.crm_activities for delete using (public.can_edit());

revoke all on public.crm_connections, public.crm_activities from anon;
grant select, insert, update, delete on public.crm_connections, public.crm_activities to authenticated;

-- live updates between organisers' screens
do $$
declare
  t text;
begin
  foreach t in array array['crm_connections', 'crm_activities']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
             when undefined_object then null;
    end;
  end loop;
end;
$$;
