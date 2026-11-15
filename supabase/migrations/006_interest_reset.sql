-- Catalyst 1.0 · update 006: reset investor interest when the pitch queue is restarted, and one meeting
-- option per startup.
--   1. archive_interest(): moves every request (with its RTIH handling and the notices sent for it) into
--      requests_archive and clears them, so the live board, the VC-interest screen and investors' buttons
--      start fresh. Nothing is lost: the archive keeps it all. Editors only.
--   2. An investor can choose Meet today OR Schedule a call later for a startup, not both: choosing one
--      withdraws the other. (A pitch-deck request is separate.)
-- Safe to run more than once. Run it in Supabase → SQL Editor.

-- 1. archive ------------------------------------------------------------
create table if not exists public.requests_archive (
  id uuid primary key,
  investor_id uuid,
  startup_id uuid,
  type text,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  withdrawn_at timestamptz,
  fund text,
  startup_name text,
  handling jsonb,
  notices jsonb,
  archived_at timestamptz not null default now(),
  archived_by text
);
alter table public.requests_archive enable row level security;
drop policy if exists requests_archive_select on public.requests_archive;
create policy requests_archive_select on public.requests_archive for select using (public.is_organiser());
revoke all on public.requests_archive from anon;
grant select on public.requests_archive to authenticated;

-- Archive and clear all investor interest. Returns how many requests were archived.
create or replace function public.archive_interest()
returns int
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_count int;
begin
  if not public.can_edit() then
    raise exception 'Organiser editors only';
  end if;
  insert into public.requests_archive
    (id, investor_id, startup_id, type, active, created_at, updated_at, withdrawn_at, fund, startup_name, handling, notices, archived_by)
  select r.id, r.investor_id, r.startup_id, r.type, r.active, r.created_at, r.updated_at, r.withdrawn_at,
         i.fund, s.name, to_jsonb(h) - 'request_id',
         (select coalesce(jsonb_agg(to_jsonb(nt) - 'request_id'), '[]'::jsonb) from public.notices nt where nt.request_id = r.id),
         (select u.email from auth.users u where u.id = auth.uid())
    from public.requests r
    left join public.investors i on i.id = r.investor_id
    left join public.startups s on s.id = r.startup_id
    left join public.request_handling h on h.request_id = r.id
  on conflict (id) do nothing;
  -- handling and notices go with their requests (on delete cascade); the triggers clear the live board
  delete from public.requests where id is not null;
  get diagnostics v_count = row_count;
  delete from public.live_interest where startup_id is not null;
  return v_count;
end;
$$;
revoke execute on function public.archive_interest() from public, anon;
grant execute on function public.archive_interest() to authenticated;

-- 2. one meeting option per startup --------------------------------------
create or replace function public.requests_one_meeting()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  update public.requests
     set active = false
   where investor_id = new.investor_id and startup_id = new.startup_id and active
     and type in ('meet_today', 'meet_later') and type <> new.type;
  return null;
end;
$$;

drop trigger if exists requests_one_meeting on public.requests;
create trigger requests_one_meeting
after insert or update of active on public.requests
for each row when (new.active and new.type in ('meet_today', 'meet_later'))
execute function public.requests_one_meeting();

-- Anyone who already has both: keep the one chosen most recently
update public.requests r
   set active = false
 where r.active and r.type in ('meet_today', 'meet_later')
   and exists (
     select 1 from public.requests o
      where o.investor_id = r.investor_id and o.startup_id = r.startup_id and o.active
        and o.type in ('meet_today', 'meet_later') and o.type <> r.type
        and (o.updated_at > r.updated_at or (o.updated_at = r.updated_at and o.type = 'meet_today'))
   );
